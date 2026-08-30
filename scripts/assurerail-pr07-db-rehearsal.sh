#!/usr/bin/env bash
# PR-07 disposable Postgres evidence: additive room schema, restrictive history and restore.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR07_MIGRATION="20260831010000_assurerail_pr07_case_rooms"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr07.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((61000 + ($$ % 2000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr07_fresh"
UPGRADE_DB="assurerail_pr07_upgrade"
RESTORE_DB="assurerail_pr07_restore"

case "$TEST_ROOT" in */assurerail-pr07.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr07.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR07-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
fresh_models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('CaseRoom','RoomGrant','RoomAccessEvent','RoomMessage','LegacyRoomImport','RoomParityRun','RoomParityBreak');")"
[[ "$fresh_models" == "7" ]] || { echo "expected 7 PR-07 models, found $fresh_models" >&2; exit 1; }

echo "[PR07-DB] exact legacy chain, unique sequence and restrictive history"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"firebaseUid\",\"email\",\"role\",\"allowlisted\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('user_pr07','uid-pr07','pr07@example.invalid','ISSUER',false,'IDENTITY_BOUND',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('inst_pr07','PR07 Institution','REGULATED_ENTITY','IN','{}','ACTIVE','user_pr07',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"ProviderReference\" (\"id\",\"providerKey\",\"providerType\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('provider_pr07','provider-pr07','SOURCE','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SourceReference\" (\"id\",\"providerReferenceId\",\"sourceSystem\",\"sourceObjectType\",\"sourceObjectId\",\"sourceVersion\",\"schemaId\",\"schemaVersion\",\"payloadDigest\",\"createdAt\") VALUES ('source_pr07','provider_pr07','assurepool','FROZEN_ASSET_TAPE','pool-pr07','1','assurepool.frozen-tape','1','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',CURRENT_TIMESTAMP);
  INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('case_pr07','PR07-CASE-001','inst_pr07','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','TRADE_RECEIVABLE','REPLAY','route://da/test','1','create-1','sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','user_pr07','mandate_pr07',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  UPDATE \"SourceReference\" SET \"transactionCaseId\"='case_pr07' WHERE \"id\"='source_pr07';
  INSERT INTO \"MigrationReceipt\" (\"id\",\"batchId\",\"migrationName\",\"sourceSystem\",\"sourceCount\",\"targetCount\",\"operatorRef\",\"status\",\"createdAt\") VALUES ('receipt_pr07','batch-pr07','assurerail-pr07-legacy-room-import','assurecla-data-db',2,2,'user_pr07','VERIFIED',CURRENT_TIMESTAMP);
  INSERT INTO \"CaseRoom\" (\"id\",\"transactionCaseId\",\"purpose\",\"policyVersion\",\"sourceReferenceId\",\"sourceManifestDigest\",\"status\",\"legacyRoomId\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('troom-pr07','case_pr07','PASSIVE_DILIGENCE','assurerail.room.passive-diligence.v1','source_pr07','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','DARK_IMPORTED','troom-pr07','user_pr07','mandate_pr07',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"RoomAccessEvent\" (\"id\",\"caseRoomId\",\"sequence\",\"chainOrigin\",\"hashRoomReference\",\"actorReference\",\"action\",\"previousHash\",\"eventHash\",\"occurredAt\",\"createdAt\") VALUES ('event_pr07','troom-pr07',9007199254740993,'LEGACY','troom-pr07','did:legacy','ROOM_OPENED','GENESIS','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"LegacyRoomImport\" (\"id\",\"caseRoomId\",\"migrationReceiptId\",\"migrationBatchId\",\"sourceSystem\",\"sourceVersion\",\"legacyRoomId\",\"importVersion\",\"exportDigest\",\"sourceHighWaterMark\",\"sourceCounts\",\"chainTailHash\",\"sealedExport\",\"importedByUserId\",\"createdAt\") VALUES ('import_pr07','troom-pr07','receipt_pr07','batch-pr07','assurecla-data-db','1','troom-pr07',1,'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','seq:9007199254740993','{\"total\":2}','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','{\"sealed\":true}','user_pr07',CURRENT_TIMESTAMP);
  INSERT INTO \"MigrationReceipt\" (\"id\",\"batchId\",\"migrationName\",\"sourceSystem\",\"sourceCount\",\"targetCount\",\"operatorRef\",\"status\",\"createdAt\") VALUES ('receipt_pr07_v2','batch-pr07-v2','assurerail-pr07-legacy-room-import','assurecla-data-db',3,3,'user_pr07','VERIFIED',CURRENT_TIMESTAMP);
  INSERT INTO \"LegacyRoomImport\" (\"id\",\"caseRoomId\",\"migrationReceiptId\",\"migrationBatchId\",\"sourceSystem\",\"sourceVersion\",\"legacyRoomId\",\"importVersion\",\"exportDigest\",\"sourceHighWaterMark\",\"sourceCounts\",\"chainTailHash\",\"sealedExport\",\"importedByUserId\",\"createdAt\") VALUES ('import_pr07_v2','troom-pr07','receipt_pr07_v2','batch-pr07','assurecla-data-db','2','troom-pr07',2,'sha256:abababababababababababababababababababababababababababababababab','seq:9007199254740994','{\"total\":3}','dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','{\"sealed\":true,\"version\":2}','user_pr07',CURRENT_TIMESTAMP);
  INSERT INTO \"MigrationReceipt\" (\"id\",\"batchId\",\"migrationName\",\"sourceSystem\",\"sourceCount\",\"targetCount\",\"operatorRef\",\"status\",\"createdAt\") VALUES ('receipt_pr07_v3','batch-pr07-v3','assurerail-pr07-legacy-room-import','assurecla-data-db',3,3,'user_pr07','VERIFIED',CURRENT_TIMESTAMP);
  DO \$rehearsal\$ BEGIN
    BEGIN
      INSERT INTO \"RoomAccessEvent\" (\"id\",\"caseRoomId\",\"sequence\",\"chainOrigin\",\"hashRoomReference\",\"actorReference\",\"action\",\"previousHash\",\"eventHash\",\"occurredAt\",\"createdAt\") VALUES ('duplicate_pr07','troom-pr07',9007199254740993,'LEGACY','troom-pr07','did:legacy','VIEW_TAPE','x','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'duplicate sequence unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      DELETE FROM \"CaseRoom\" WHERE \"id\"='troom-pr07';
      RAISE EXCEPTION 'room history unexpectedly deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO \"LegacyRoomImport\" (\"id\",\"caseRoomId\",\"migrationReceiptId\",\"migrationBatchId\",\"sourceSystem\",\"sourceVersion\",\"legacyRoomId\",\"importVersion\",\"exportDigest\",\"sourceHighWaterMark\",\"sourceCounts\",\"chainTailHash\",\"sealedExport\",\"importedByUserId\",\"createdAt\") VALUES ('duplicate_import_pr07','troom-pr07','receipt_pr07_v3','batch-pr07','assurecla-data-db','3','troom-pr07',2,'sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd','seq:3','{}','x','{}','user_pr07',CURRENT_TIMESTAMP);
      RAISE EXCEPTION 'duplicate import version unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END \$rehearsal\$;" >/dev/null
exact_sequence="$(psql_db "$FRESH_DB" -Atc "SELECT \"sequence\" FROM \"RoomAccessEvent\" WHERE \"id\"='event_pr07';")"
[[ "$exact_sequence" == "9007199254740993" ]] || { echo "legacy sequence lost precision: $exact_sequence" >&2; exit 1; }
root_batch_versions="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM \"LegacyRoomImport\" WHERE \"migrationBatchId\"='batch-pr07';")"
[[ "$root_batch_versions" == "2" ]] || { echo "root migration batch was not retained across versions: $root_batch_versions" >&2; exit 1; }

echo "[PR07-DB] additive upgrade retains PR-06 case state"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null; done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR07_MIGRATION/*" | sort)
psql_db "$UPGRADE_DB" -c "INSERT INTO \"VenueUser\" (\"id\",\"firebaseUid\",\"email\",\"role\",\"allowlisted\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('upgrade_user','upgrade-uid','upgrade@example.invalid','ISSUER',false,'IDENTITY_BOUND',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('upgrade_inst','Upgrade Institution','REGULATED_ENTITY','IN','{}','ACTIVE','upgrade_user',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('upgrade_case','UPGRADE-CASE','upgrade_inst','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','TRADE_RECEIVABLE','REPLAY','route://da/test','1','upgrade-create','sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','upgrade_user','upgrade_mandate',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR07_MIGRATION/migration.sql" >/dev/null
case_state="$(psql_db "$UPGRADE_DB" -Atc "SELECT \"status\" FROM \"TransactionCase\" WHERE \"id\"='upgrade_case';")"
[[ "$case_state" == "DRAFT" ]] || { echo "PR-06 case changed during room migration: $case_state" >&2; exit 1; }

echo "[PR07-DB] backup/restore and migration ledger"
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "LegacyRoomImport";')"
[[ "$restored" == "2" ]] || { echo "restore import count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR07-DB] PASS fresh=7-models exact-sequence=retained versioned-imports=2 root-batch=reused history=restrictive upgrade=retained restore=2-imports"
