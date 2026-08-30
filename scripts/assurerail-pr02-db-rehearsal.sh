#!/usr/bin/env bash
# PR-02 disposable Postgres evidence: fresh deploy, legacy upgrade, queue-index plan, backup/restore.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR02_MIGRATION="20260830190000_assurerail_pr02_persistence_foundation"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr02.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((56000 + ($$ % 5000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr02_fresh"
UPGRADE_DB="assurerail_pr02_upgrade"
RESTORE_DB="assurerail_pr02_restore"

case "$TEST_ROOT" in
  */assurerail-pr02.*) ;;
  *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;;
esac

for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || {
    echo "missing required command: $command_name" >&2
    exit 1
  }
done

cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then
    pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true
  fi
  case "$TEST_ROOT" in
    */assurerail-pr02.*) rm -rf -- "$TEST_ROOT" ;;
  esac
}
trap cleanup EXIT INT TERM

mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null

db_url() {
  printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"
}

psql_db() {
  local database="$1"
  shift
  psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"
}

echo "[PR02-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(
  cd "$RAIL_DIR"
  DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma
)

fresh_models="$(psql_db "$FRESH_DB" -Atc "
  SELECT count(*)
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'ProviderReference','SourceReference','IntakeSubmission','IntakeReceipt',
      'IdempotencyRecord','InboxMessage','OutboxMessage','ExternalInstruction',
      'ExternalAcknowledgement','MigrationReceipt'
    );")"
[[ "$fresh_models" == "10" ]] || { echo "expected 10 PR-02 models, found $fresh_models" >&2; exit 1; }

echo "[PR02-DB] idempotency constraints and stale-worker recovery"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"ProviderReference\" (
    \"id\",\"providerKey\",\"providerType\",\"status\",\"createdAt\",\"updatedAt\"
  ) VALUES ('provider_rehearsal','provider-rehearsal','TEST','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"IdempotencyRecord\" (
    \"id\",\"scope\",\"key\",\"requestDigest\",\"status\",\"createdAt\",\"updatedAt\"
  ) VALUES ('idem_rehearsal','rail.rehearsal','command-1','sha256:request','IN_PROGRESS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"ExternalInstruction\" (
    \"id\",\"providerReferenceId\",\"instructionType\",\"idempotencyKey\",\"requestDigest\",\"state\",\"createdAt\",\"updatedAt\"
  ) VALUES ('exti_rehearsal','provider_rehearsal','TEST','instruction-1','sha256:request','PENDING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"EventLog\" (\"id\",\"event\",\"payload\",\"createdAt\")
  VALUES ('evt_billing_rehearsal','test.billing','{}'::jsonb,CURRENT_TIMESTAMP);
  INSERT INTO \"BillingEvent\" (\"id\",\"type\",\"sourceEventId\",\"createdAt\")
  VALUES ('bill_rehearsal','test','evt_billing_rehearsal',CURRENT_TIMESTAMP);
  DO \$rehearsal\$
  BEGIN
    BEGIN
      INSERT INTO \"IdempotencyRecord\" (
        \"id\",\"scope\",\"key\",\"requestDigest\",\"status\",\"createdAt\",\"updatedAt\"
      ) VALUES ('idem_duplicate','rail.rehearsal','command-1','sha256:different','IN_PROGRESS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'idempotency duplicate unexpectedly inserted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO \"ExternalInstruction\" (
        \"id\",\"providerReferenceId\",\"instructionType\",\"idempotencyKey\",\"requestDigest\",\"state\",\"createdAt\",\"updatedAt\"
      ) VALUES ('exti_duplicate','provider_rehearsal','TEST','instruction-1','sha256:different','PENDING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'external-instruction duplicate unexpectedly inserted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO \"BillingEvent\" (\"id\",\"type\",\"sourceEventId\",\"createdAt\")
      VALUES ('bill_duplicate','test','evt_billing_rehearsal',CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'billing duplicate unexpectedly inserted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END
  \$rehearsal\$;

  INSERT INTO \"EventLog\" (\"id\",\"event\",\"payload\",\"createdAt\")
  VALUES ('evt_restart_rehearsal','test.restart','{}'::jsonb,CURRENT_TIMESTAMP);
  INSERT INTO \"OutboxMessage\" (
    \"id\",\"eventLogId\",\"event\",\"schemaId\",\"schemaVersion\",\"payloadDigest\",\"payload\",
    \"idempotencyKey\",\"state\",\"attemptCount\",\"nextAttemptAt\",\"lockedAt\",\"lockOwner\",\"createdAt\",\"updatedAt\"
  ) VALUES (
    'out_restart_rehearsal','evt_restart_rehearsal','test.restart','assurerail.rehearsal','1.0.0',
    'sha256:' || repeat('0',64),'{}'::jsonb,'restart:1','PROCESSING',1,CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP - INTERVAL '5 minutes','dead-worker',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  );
  WITH candidates AS (
    SELECT \"id\" FROM \"OutboxMessage\"
    WHERE \"state\"='PROCESSING' AND \"lockedAt\" < CURRENT_TIMESTAMP - INTERVAL '2 minutes'
    FOR UPDATE SKIP LOCKED
  )
  UPDATE \"OutboxMessage\" AS message
  SET \"state\"='PROCESSING',\"attemptCount\"=message.\"attemptCount\"+1,
      \"lockedAt\"=CURRENT_TIMESTAMP,\"lockOwner\"='resumed-worker',\"updatedAt\"=CURRENT_TIMESTAMP
  FROM candidates WHERE message.\"id\"=candidates.\"id\";
  DO \$recovery\$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM \"OutboxMessage\"
      WHERE \"id\"='out_restart_rehearsal' AND \"attemptCount\"=2 AND \"lockOwner\"='resumed-worker'
    ) THEN RAISE EXCEPTION 'stale worker claim was not recovered';
    END IF;
  END
  \$recovery\$;
  DELETE FROM \"OutboxMessage\" WHERE \"id\"='out_restart_rehearsal';
  DELETE FROM \"EventLog\" WHERE \"id\"='evt_restart_rehearsal';" >/dev/null

echo "[PR02-DB] legacy-to-PR02 upgrade and plaintext-secret retirement"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do
  psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null
done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR02_MIGRATION/*" | sort)

psql_db "$UPGRADE_DB" -c "
  INSERT INTO \"WebhookSubscription\" (\"id\",\"url\",\"secret\",\"events\",\"active\",\"createdAt\")
  VALUES ('whs_legacy','https://hooks.example.invalid/rail','legacy-plaintext-test-only','[\"*\"]'::jsonb,true,CURRENT_TIMESTAMP);
  INSERT INTO \"WebhookDelivery\" (\"id\",\"subscriptionId\",\"event\",\"statusCode\",\"ok\",\"createdAt\")
  VALUES ('whd_legacy','whs_legacy','note.minted',500,false,CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR02_MIGRATION/migration.sql" >/dev/null

legacy_state="$(psql_db "$UPGRADE_DB" -Atc "
  SELECT concat_ws('|',\"active\"::text,\"endpointStatus\",coalesce(\"secret\",'<null>'),\"disabledReason\")
  FROM \"WebhookSubscription\" WHERE \"id\"='whs_legacy';")"
[[ "$legacy_state" == "false|DISABLED|<null>|LEGACY_PLAINTEXT_SECRET_CLEARED_REPROVISION_AND_VERIFY" ]] || {
  echo "legacy subscription migration mismatch: $legacy_state" >&2
  exit 1
}
psql_db "$UPGRADE_DB" -Atc "SELECT 1 FROM \"Note\" LIMIT 0;" >/dev/null
psql_db "$UPGRADE_DB" -Atc "SELECT 1 FROM \"EventLog\" LIMIT 0;" >/dev/null

echo "[PR02-DB] queue index/selectivity rehearsal"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"OutboxMessage\" (
    \"id\",\"event\",\"schemaId\",\"schemaVersion\",\"payloadDigest\",\"payload\",
    \"idempotencyKey\",\"state\",\"nextAttemptAt\",\"createdAt\",\"updatedAt\"
  )
  SELECT
    'out_perf_' || n,
    'note.minted',
    'assurerail.performance-fixture',
    '1.0.0',
    'sha256:' || repeat('0',64),
    jsonb_build_object('fixture',n),
    'perf:' || n,
    CASE WHEN n <= 100 THEN 'PENDING' ELSE 'FANOUT_COMPLETE' END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM generate_series(1,50000) AS n;
  ANALYZE \"OutboxMessage\";" >/dev/null

plan="$(psql_db "$FRESH_DB" -Atc "
  EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT \"id\" FROM \"OutboxMessage\"
  WHERE \"state\"='PENDING' AND \"nextAttemptAt\" <= CURRENT_TIMESTAMP
  LIMIT 25;")"
grep -q 'OutboxMessage_state_nextAttemptAt_idx' <<<"$plan" || {
  echo "queue due-work query did not use OutboxMessage_state_nextAttemptAt_idx" >&2
  echo "$plan" >&2
  exit 1
}

echo "[PR02-DB] backup/restore and migration-status rehearsal"
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored_count="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "OutboxMessage";')"
[[ "$restored_count" == "50000" ]] || { echo "restore count mismatch: $restored_count" >&2; exit 1; }
(
  cd "$RAIL_DIR"
  DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma
)

echo "[PR02-DB] PASS fresh=10-models idempotency=bounded stale-claim=recovered legacy-secret=disabled+cleared queue-index=used restore=50000"
