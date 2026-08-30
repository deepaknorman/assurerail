#!/usr/bin/env bash
# PR-05 disposable Postgres evidence: fresh deploy, legacy-byte retention, constraints and restore.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR05_MIGRATION="20260830220000_assurerail_pr05_evidence_intake"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr05.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((58000 + ($$ % 3000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr05_fresh"
UPGRADE_DB="assurerail_pr05_upgrade"
RESTORE_DB="assurerail_pr05_restore"

case "$TEST_ROOT" in */assurerail-pr05.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr05.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR05-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
fresh_models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('ConnectorRegistration','ConnectorCertification','EvidenceObject','EvidenceVersion','RailDocumentFamily','RailDocumentVersion','EvidenceAccessGrant','EvidenceAccessReceipt','EvidenceRetentionEvent');")"
[[ "$fresh_models" == "9" ]] || { echo "expected 9 PR-05 models, found $fresh_models" >&2; exit 1; }

echo "[PR05-DB] immutable-version, storage and retention constraints"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"firebaseUid\",\"email\",\"role\",\"allowlisted\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('user_pr05','uid-pr05','pr05@example.invalid','ISSUER',false,'IDENTITY_BOUND',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('inst_pr05','PR05 Test Institution','REGULATED_ENTITY','IN','{}','ACTIVE','user_pr05',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"EvidenceObject\" (\"id\",\"institutionId\",\"evidenceType\",\"classification\",\"purpose\",\"retentionUntilAt\",\"createdByUserId\",\"createdAt\",\"updatedAt\") VALUES ('evo_pr05','inst_pr05','TEST','RESTRICTED','TEST_REHEARSAL',CURRENT_TIMESTAMP + INTERVAL '7 years','user_pr05',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"EvidenceVersion\" (\"id\",\"evidenceObjectId\",\"version\",\"schemaId\",\"schemaVersion\",\"payloadDigest\",\"signatureStatus\",\"result\",\"sourceAsOfAt\",\"qualifications\",\"validationStatus\",\"validationDetail\",\"createdByUserId\",\"createdAt\") VALUES ('evv_pr05','evo_pr05',1,'test','1','$(printf '0%.0s' {1..64})','NOT_PROVIDED','REVIEW_REQUIRED',CURRENT_TIMESTAMP,'{}','VALID','{}','user_pr05',CURRENT_TIMESTAMP);
  INSERT INTO \"RailDocumentFamily\" (\"id\",\"evidenceObjectId\",\"institutionId\",\"title\",\"documentType\",\"createdAt\",\"updatedAt\") VALUES ('dfam_pr05','evo_pr05','inst_pr05','Test','TEST',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"RailDocumentVersion\" (\"id\",\"documentFamilyId\",\"evidenceVersionId\",\"version\",\"filename\",\"claimedContentType\",\"detectedContentType\",\"sizeBytes\",\"storageRef\",\"malwareStatus\",\"encryptionClass\",\"createdAt\") VALUES ('dver_pr05','dfam_pr05','evv_pr05',1,'test.pdf','application/pdf','application/pdf',10,'s3://test/evidence/pr05','CLEAN','SSE_KMS',CURRENT_TIMESTAMP);
  DO \$rehearsal\$ BEGIN
    BEGIN
      INSERT INTO \"EvidenceVersion\" (\"id\",\"evidenceObjectId\",\"version\",\"schemaId\",\"schemaVersion\",\"payloadDigest\",\"signatureStatus\",\"result\",\"sourceAsOfAt\",\"qualifications\",\"validationStatus\",\"validationDetail\",\"createdByUserId\",\"createdAt\") VALUES ('evv_duplicate','evo_pr05',1,'test','1','$(printf '1%.0s' {1..64})','NOT_PROVIDED','REVIEW_REQUIRED',CURRENT_TIMESTAMP,'{}','VALID','{}','user_pr05',CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'duplicate version unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO \"RailDocumentVersion\" (\"id\",\"documentFamilyId\",\"evidenceVersionId\",\"version\",\"filename\",\"claimedContentType\",\"detectedContentType\",\"sizeBytes\",\"storageRef\",\"malwareStatus\",\"encryptionClass\",\"createdAt\") VALUES ('dver_duplicate','dfam_pr05','evv_pr05',2,'test.pdf','application/pdf','application/pdf',10,'s3://test/evidence/pr05','CLEAN','SSE_KMS',CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'duplicate storage reference unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END \$rehearsal\$;" >/dev/null

echo "[PR05-DB] legacy inline bytes survive upgrade"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null; done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR05_MIGRATION/*" | sort)
psql_db "$UPGRADE_DB" -c "INSERT INTO \"Document\" (\"id\",\"filename\",\"contentType\",\"size\",\"data\",\"createdAt\") VALUES ('legacy_doc_pr05','legacy.pdf','application/pdf',4,decode('01020304','hex'),CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR05_MIGRATION/migration.sql" >/dev/null
legacy_state="$(psql_db "$UPGRADE_DB" -Atc "SELECT concat_ws('|',encode(\"data\",'hex'),coalesce(\"neutralDocumentVersionId\",'<null>')) FROM \"Document\" WHERE \"id\"='legacy_doc_pr05';")"
[[ "$legacy_state" == "01020304|<null>" ]] || { echo "legacy document changed during migration: $legacy_state" >&2; exit 1; }

echo "[PR05-DB] backup/restore and migration ledger"
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "RailDocumentVersion";')"
[[ "$restored" == "1" ]] || { echo "restore document count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR05-DB] PASS fresh=9-models immutable=bounded legacy-bytes=retained restore=1-document"
