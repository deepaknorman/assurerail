#!/usr/bin/env bash
# PR-06 disposable Postgres evidence: fresh deploy, additive upgrade, constraints and restore.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR06_MIGRATION="20260830230000_assurerail_pr06_transaction_case"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr06.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((61000 + ($$ % 2000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr06_fresh"
UPGRADE_DB="assurerail_pr06_upgrade"
RESTORE_DB="assurerail_pr06_restore"

case "$TEST_ROOT" in */assurerail-pr06.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr06.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR06-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
fresh_models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('TransactionCase','CaseVersion','CaseParty','CaseFunctionAssignment','CaseCondition','CaseDecision','CaseApproval','CaseTransition','CaseReplayReceipt');")"
[[ "$fresh_models" == "9" ]] || { echo "expected 9 PR-06 models, found $fresh_models" >&2; exit 1; }

echo "[PR06-DB] immutable versions, idempotency and restrictive case history"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"firebaseUid\",\"email\",\"role\",\"allowlisted\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('user_pr06','uid-pr06','pr06@example.invalid','ISSUER',false,'IDENTITY_BOUND',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('inst_pr06','PR06 Test Institution','REGULATED_ENTITY','IN','{}','ACTIVE','user_pr06',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('case_pr06','PR06-CASE-001','inst_pr06','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','TRADE_RECEIVABLE','REPLAY','route://da/test','1','create-1','$(printf 'a%.0s' {1..64})','user_pr06','mandate_pr06',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"CaseVersion\" (\"id\",\"transactionCaseId\",\"version\",\"spec\",\"specDigest\",\"reason\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\") VALUES ('cver_pr06','case_pr06',1,'{}','$(printf 'b%.0s' {1..64})','initial','user_pr06','mandate_pr06',CURRENT_TIMESTAMP);
  INSERT INTO \"CaseParty\" (\"id\",\"transactionCaseId\",\"institutionId\",\"partyRole\",\"status\",\"authorityEvidenceRef\",\"createdByUserId\",\"createdAt\",\"updatedAt\") VALUES ('cparty_pr06','case_pr06','inst_pr06','TRANSFEROR','ACTIVE','evidence://authority','user_pr06',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"CaseTransition\" (\"id\",\"transactionCaseId\",\"command\",\"idempotencyKey\",\"requestDigest\",\"fromStatus\",\"toStatus\",\"expectedVersion\",\"resultingVersion\",\"guardResult\",\"evidenceBundleDigest\",\"rulePackRef\",\"rulePackVersion\",\"actorUserId\",\"actingInstitutionId\",\"authorityMandateId\",\"stepUpEvidenceId\",\"transitionDigest\",\"occurredAt\") VALUES ('ctrans_pr06','case_pr06','OPEN_INTAKE','transition-1','$(printf 'c%.0s' {1..64})','DRAFT','INTAKE_OPEN',1,2,'{}','$(printf 'd%.0s' {1..64})','route://da/test','1','user_pr06','inst_pr06','mandate_pr06','stepup_pr06','$(printf 'e%.0s' {1..64})',CURRENT_TIMESTAMP);
  DO \$rehearsal\$ BEGIN
    BEGIN
      INSERT INTO \"CaseVersion\" (\"id\",\"transactionCaseId\",\"version\",\"spec\",\"specDigest\",\"reason\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\") VALUES ('cver_duplicate','case_pr06',1,'{}','$(printf 'f%.0s' {1..64})','duplicate','user_pr06','mandate_pr06',CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'duplicate case version unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      DELETE FROM \"TransactionCase\" WHERE \"id\"='case_pr06';
      RAISE EXCEPTION 'case history unexpectedly deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
  END \$rehearsal\$;" >/dev/null

echo "[PR06-DB] additive upgrade retains legacy evidence"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null; done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR06_MIGRATION/*" | sort)
psql_db "$UPGRADE_DB" -c "INSERT INTO \"Document\" (\"id\",\"filename\",\"contentType\",\"size\",\"data\",\"createdAt\") VALUES ('legacy_doc_pr06','legacy.pdf','application/pdf',4,decode('01020304','hex'),CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR06_MIGRATION/migration.sql" >/dev/null
legacy_state="$(psql_db "$UPGRADE_DB" -Atc "SELECT encode(\"data\",'hex') FROM \"Document\" WHERE \"id\"='legacy_doc_pr06';")"
[[ "$legacy_state" == "01020304" ]] || { echo "legacy evidence changed during migration: $legacy_state" >&2; exit 1; }

echo "[PR06-DB] backup/restore and migration ledger"
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "TransactionCase";')"
[[ "$restored" == "1" ]] || { echo "restore case count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR06-DB] PASS fresh=9-models constraints=enforced legacy-evidence=retained restore=1-case"
