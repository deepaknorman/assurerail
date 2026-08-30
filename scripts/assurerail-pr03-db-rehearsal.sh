#!/usr/bin/env bash
# PR-03 disposable Postgres evidence: fresh deploy and reversible legacy authority projection.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR03_MIGRATION="20260830210000_assurerail_pr03_institution_authority"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr03.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((57000 + ($$ % 4000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr03_fresh"
UPGRADE_DB="assurerail_pr03_upgrade"
RESTORE_DB="assurerail_pr03_restore"

case "$TEST_ROOT" in
  */assurerail-pr03.*) ;;
  *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;;
esac

for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx node openssl; do
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
    */assurerail-pr03.*) rm -rf -- "$TEST_ROOT" ;;
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

echo "[PR03-DB] fresh migration deploy"
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
      'Institution','InstitutionEvidenceSnapshot','ParticipantAdmission',
      'ParticipantAdmissionDecision','InstitutionMember','AuthorityMandate','Appointment',
      'RouteEntitlement','InstitutionServicePrincipal','StepUpEvidence','InstitutionChangeProposal'
    );")"
[[ "$fresh_models" == "11" ]] || { echo "expected 11 PR-03 models, found $fresh_models" >&2; exit 1; }

echo "[PR03-DB] shadow module graph and authenticated runtime startup"
(
  cd "$RAIL_DIR"
  npm run build >/dev/null
)
openssl genrsa -out "$TEST_ROOT/firebase-test-key.pem" 2048 >/dev/null 2>&1
firebase_fixture="$(node -e '
  const fs = require("node:fs");
  const value = {
    project_id: "assurerail-pr03-rehearsal",
    client_email: "assurerail-pr03@example.invalid",
    private_key: fs.readFileSync(process.argv[1], "utf8"),
  };
  process.stdout.write(Buffer.from(JSON.stringify(value)).toString("base64"));
' "$TEST_ROOT/firebase-test-key.pem")"
(
  cd "$RAIL_DIR"
  DATABASE_URL="$(db_url "$FRESH_DB")" \
  FIREBASE_ADMIN_CONFIG="$firebase_fixture" \
  NODE_ENV="development" \
  ASSURERAIL_OPERATING_MODE="SHADOW" \
  ARAIL_DEMO_ENDPOINTS_ENABLED="false" \
  ARAIL_DURABLE_RELAY_MODE="shadow" \
  ARAIL_PARTICIPANT_ADMISSION_V1="shadow" \
  ARAIL_ROUTE_ENTITLEMENT_ENFORCE="compare" \
  ASSURERAIL_STARTUP_PROBE="true" \
  node dist/main.js >/dev/null
)

echo "[PR03-DB] legacy projection is inert and identity binding is distinct"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do
  psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null
done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR03_MIGRATION/*" | sort)

psql_db "$UPGRADE_DB" -c "
  INSERT INTO \"VenueUser\" (
    \"id\",\"firebaseUid\",\"did\",\"email\",\"role\",\"entityDid\",\"entityRole\",
    \"allowlisted\",\"status\",\"createdAt\",\"updatedAt\"
  ) VALUES
    ('legacy_user_a','uid-a','did:test:person-a','a@example.invalid','ISSUER','did:test:bank','ORGADMIN',true,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
    ('legacy_user_b','uid-b',NULL,'b@example.invalid','DESK','did:test:bank','OPERATOR',true,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR03_MIGRATION/migration.sql" >/dev/null

projection="$(psql_db "$UPGRADE_DB" -Atc "
  SELECT concat_ws('|',
    (SELECT count(*) FROM \"Institution\" WHERE \"legacyEntityRef\"='did:test:bank'),
    (SELECT \"status\" FROM \"Institution\" WHERE \"legacyEntityRef\"='did:test:bank'),
    (SELECT \"status\" FROM \"ParticipantAdmission\" WHERE \"institutionId\"=(SELECT \"id\" FROM \"Institution\" WHERE \"legacyEntityRef\"='did:test:bank')),
    (SELECT count(*) FROM \"InstitutionMember\" WHERE \"institutionId\"=(SELECT \"id\" FROM \"Institution\" WHERE \"legacyEntityRef\"='did:test:bank')),
    (SELECT count(*) FROM \"AuthorityMandate\"),
    (SELECT count(*) FROM \"RouteEntitlement\"),
    (SELECT coalesce(\"identityProvider\",'<null>') FROM \"VenueUser\" WHERE \"id\"='legacy_user_a'),
    (SELECT coalesce(\"identityProvider\",'<null>') FROM \"VenueUser\" WHERE \"id\"='legacy_user_b')
  );")"
[[ "$projection" == "1|LEGACY_REFERENCE_ONLY|NOT_ADMITTED|2|0|0|ASSURELOCKER_DIGIKYC|<null>" ]] || {
  echo "legacy authority projection mismatch: $projection" >&2
  exit 1
}

echo "[PR03-DB] relational constraints reject cross-record ambiguity"
psql_db "$UPGRADE_DB" -c "
  DO \$constraints\$
  DECLARE projected_institution TEXT;
  BEGIN
    SELECT \"id\" INTO projected_institution FROM \"Institution\" WHERE \"legacyEntityRef\"='did:test:bank';
    BEGIN
      INSERT INTO \"InstitutionMember\" (
        \"id\",\"institutionId\",\"userId\",\"invitedEmail\",\"membershipRole\",\"status\",\"createdAt\",\"updatedAt\"
      ) VALUES ('duplicate_member',projected_institution,'legacy_user_a','a@example.invalid','MEMBER','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'duplicate institution membership unexpectedly inserted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO \"AuthorityMandate\" (
        \"id\",\"institutionId\",\"memberId\",\"action\",\"scopeType\",\"scopeKey\",\"limits\",\"conditions\",
        \"delegationBasis\",\"authorityEvidenceRef\",\"proposedByUserId\",\"proposalStepUpId\",\"createdAt\",\"updatedAt\"
      ) VALUES ('bad_mandate',projected_institution,'missing_member','VIEW_INSTITUTION','INSTITUTION','','{}','{}',
        'fixture','fixture','legacy_user_a','missing_step_up',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'orphan mandate unexpectedly inserted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    INSERT INTO \"AuthorityMandate\" (
      \"id\",\"institutionId\",\"memberId\",\"action\",\"scopeType\",\"scopeKey\",\"limits\",\"conditions\",
      \"delegationBasis\",\"authorityEvidenceRef\",\"proposedByUserId\",\"proposalStepUpId\",\"version\",\"createdAt\",\"updatedAt\"
    ) VALUES (
      'pending_mandate_1',projected_institution,
      (SELECT \"id\" FROM \"InstitutionMember\" WHERE \"institutionId\"=projected_institution ORDER BY \"id\" LIMIT 1),
      'VIEW_INSTITUTION','INSTITUTION','','{}','{}','fixture','fixture','legacy_user_a','fixture',1,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
    BEGIN
      INSERT INTO \"AuthorityMandate\" (
        \"id\",\"institutionId\",\"memberId\",\"action\",\"scopeType\",\"scopeKey\",\"limits\",\"conditions\",
        \"delegationBasis\",\"authorityEvidenceRef\",\"proposedByUserId\",\"proposalStepUpId\",\"version\",\"createdAt\",\"updatedAt\"
      ) VALUES (
        'pending_mandate_2',projected_institution,
        (SELECT \"id\" FROM \"InstitutionMember\" WHERE \"institutionId\"=projected_institution ORDER BY \"id\" LIMIT 1),
        'VIEW_INSTITUTION','INSTITUTION','','{}','{}','fixture','fixture','legacy_user_a','fixture',2,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      );
      RAISE EXCEPTION 'second pending mandate for the same scope unexpectedly inserted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    DELETE FROM \"AuthorityMandate\" WHERE \"id\"='pending_mandate_1';
  END
  \$constraints\$;" >/dev/null

echo "[PR03-DB] backup/restore retains the deployed schema and migration ledger"
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc "
  SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN (
    'Institution','InstitutionEvidenceSnapshot','ParticipantAdmission',
    'ParticipantAdmissionDecision','InstitutionMember','AuthorityMandate','Appointment',
    'RouteEntitlement','InstitutionServicePrincipal','StepUpEvidence','InstitutionChangeProposal'
  );")"
[[ "$restored" == "11" ]] || { echo "restore model count mismatch: $restored" >&2; exit 1; }
(
  cd "$RAIL_DIR"
  DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma
)

echo "[PR03-DB] PASS fresh=11-models startup=shadow legacy=reference-only admission=none mandates=0 entitlements=0 constraints=bounded restore=11-models"
