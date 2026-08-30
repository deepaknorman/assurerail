#!/usr/bin/env bash
# PR-08 disposable Postgres evidence: cohort authority, idempotent active rooms and exact completion.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR08_MIGRATION="20260831130000_assurerail_pr08_room_cutover_completion"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr08.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((62000 + ($$ % 1000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr08_fresh"
UPGRADE_DB="assurerail_pr08_upgrade"
RESTORE_DB="assurerail_pr08_restore"

case "$TEST_ROOT" in */assurerail-pr08.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr08.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR08-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
fresh_models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('ConnectorSubjectMapping','RoomAuthorityAssignment','RoomAuthorityChange','SourceCompletion');")"
[[ "$fresh_models" == "4" ]] || { echo "expected 4 PR-08 models, found $fresh_models" >&2; exit 1; }

echo "[PR08-DB] one writer, command idempotency, exact completion and restrictive history"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"email\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('user8','pr08@example.invalid','IDENTITY_BOUND',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('inst8','PR08 Owner','REGULATED_ENTITY','IN','{}','ACTIVE','user8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),('inst8b','PR08 Counterparty','REGULATED_ENTITY','IN','{}','ACTIVE','user8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"ProviderReference\" (\"id\",\"providerKey\",\"providerType\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('provider8','provider-pr08','SOURCE','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"ConnectorRegistration\" (\"id\",\"institutionId\",\"providerReferenceId\",\"connectorKey\",\"connectorType\",\"displayName\",\"transport\",\"endpoint\",\"schemaProfiles\",\"credentialVaultRef\",\"status\",\"createdByUserId\",\"createdAt\",\"updatedAt\") VALUES ('connector8','inst8','provider8','pr08','SOURCE','PR08','API','https://provider.invalid/completion','[]','vault-kv-v2://secret/data/pr08#hmac','CERTIFIED_SHADOW','user8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"status\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('case8','PR08-CASE','inst8','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','MSME_LOAN','SHADOW','route://da/review','1','COMPLETION_PENDING','case-create','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','user8','mandate8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SourceReference\" (\"id\",\"providerReferenceId\",\"sourceSystem\",\"sourceObjectType\",\"sourceObjectId\",\"sourceVersion\",\"schemaId\",\"schemaVersion\",\"payloadDigest\",\"transactionCaseId\",\"createdAt\") VALUES ('source8','provider8','assurepool','FROZEN_ASSET_TAPE','pool8','1.0','assurepool.frozen-tape','1.0','sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','case8',CURRENT_TIMESTAMP);
  INSERT INTO \"RoomAuthorityChange\" (\"id\",\"transactionCaseId\",\"command\",\"expectedVersion\",\"fromWriteSource\",\"fromState\",\"toWriteSource\",\"toState\",\"cohortRef\",\"reason\",\"authorityEvidenceRef\",\"proposalDigest\",\"status\",\"proposedByUserId\",\"proposedByMandateId\",\"proposalStepUpId\",\"proposedAt\") VALUES ('change8','case8','ALLOCATE_RAIL',0,'LEGACY','ACTIVE','RAIL','ACTIVE','cohort8','cutover','evidence://cutover','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','APPROVED','user8','mandate8','step8',CURRENT_TIMESTAMP);
  INSERT INTO \"RoomAuthorityAssignment\" (\"id\",\"transactionCaseId\",\"writeSource\",\"state\",\"cohortRef\",\"version\",\"lastChangeId\",\"allocatedByUserId\",\"allocatedByMandateId\",\"allocatedAt\",\"updatedAt\") VALUES ('authority8','case8','RAIL','ACTIVE','cohort8',1,'change8','user8','mandate8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  UPDATE \"RoomAuthorityChange\" SET \"assignmentId\"='authority8' WHERE \"id\"='change8';
  INSERT INTO \"CaseRoom\" (\"id\",\"transactionCaseId\",\"purpose\",\"policyVersion\",\"sourceReferenceId\",\"sourceManifestDigest\",\"status\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('room8','case8','PASSIVE_DILIGENCE','v1','source8','sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','OPEN','room-create','sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','user8','mandate8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"RoomGrant\" (\"id\",\"caseRoomId\",\"granteeInstitutionId\",\"purpose\",\"classification\",\"status\",\"invitationIdempotencyKey\",\"invitationRequestDigest\",\"declarationTextVersion\",\"relianceTextVersion\",\"grantedByUserId\",\"createdAt\",\"updatedAt\") VALUES ('grant8','room8','inst8b','PASSIVE_DILIGENCE','PENDING_DECLARATION','INVITED','invite8','sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','v1','v1','user8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"ExternalInstruction\" (\"id\",\"providerReferenceId\",\"instructionType\",\"idempotencyKey\",\"requestDigest\",\"request\",\"state\",\"transactionCaseId\",\"createdAt\",\"updatedAt\") VALUES ('instruction8','provider8','SOURCE_LOCK_PERMANENT','completion8','sha256:1212121212121212121212121212121212121212121212121212121212121212','{}','CANCELLED','case8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SourceCompletion\" (\"id\",\"transactionCaseId\",\"sourceReferenceId\",\"providerReferenceId\",\"connectorRegistrationId\",\"completionKind\",\"idempotencyKey\",\"requestDigest\",\"completionEvidenceRef\",\"completionEvidenceDigest\",\"expectedSourceObjectId\",\"expectedSourceVersion\",\"expectedManifestDigest\",\"dispatchMode\",\"state\",\"externalInstructionId\",\"initiatedByUserId\",\"initiatedByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('completion8','case8','source8','provider8','connector8','SOURCE_LOCK_PERMANENT','completion8','sha256:3434343434343434343434343434343434343434343434343434343434343434','evidence://completion','sha256:5656565656565656565656565656565656565656565656565656565656565656','pool8','1.0','sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','SHADOW','SHADOW_RECORDED','instruction8','user8','mandate8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  DO \$rehearsal\$ BEGIN
    BEGIN INSERT INTO \"RoomAuthorityAssignment\" (\"id\",\"transactionCaseId\",\"writeSource\",\"state\",\"version\",\"allocatedByUserId\",\"allocatedByMandateId\",\"allocatedAt\",\"updatedAt\") VALUES ('authority8x','case8','LEGACY','ACTIVE',1,'user8','mandate8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); RAISE EXCEPTION 'second writer unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN INSERT INTO \"CaseRoom\" (\"id\",\"transactionCaseId\",\"purpose\",\"policyVersion\",\"status\",\"creationIdempotencyKey\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('room8x','case8','PASSIVE_DILIGENCE','v1','OPEN','room-create','user8','mandate8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); RAISE EXCEPTION 'duplicate room command unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN DELETE FROM \"SourceReference\" WHERE \"id\"='source8'; RAISE EXCEPTION 'completion source history unexpectedly deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END \$rehearsal\$;" >/dev/null

echo "[PR08-DB] additive upgrade retains PR-07 room state"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null; done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR08_MIGRATION/*" | sort)
psql_db "$UPGRADE_DB" -c "INSERT INTO \"VenueUser\" (\"id\",\"email\",\"createdAt\",\"updatedAt\") VALUES ('upgrade8','upgrade8@example.invalid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('upgradeinst8','Upgrade','REGULATED_ENTITY','IN','{}','ACTIVE','upgrade8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('upgradecase8','UPGRADE8','upgradeinst8','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','MSME_LOAN','SHADOW','route://da','1','u8','sha256:abababababababababababababababababababababababababababababababab','upgrade8','m8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO \"CaseRoom\" (\"id\",\"transactionCaseId\",\"purpose\",\"policyVersion\",\"status\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('upgraderoom8','upgradecase8','PASSIVE_DILIGENCE','v1','DARK_IMPORTED','upgrade8','m8',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR08_MIGRATION/migration.sql" >/dev/null
retained="$(psql_db "$UPGRADE_DB" -Atc "SELECT status FROM \"CaseRoom\" WHERE id='upgraderoom8';")"
[[ "$retained" == "DARK_IMPORTED" ]] || { echo "PR-07 room state changed during upgrade: $retained" >&2; exit 1; }

echo "[PR08-DB] backup/restore and migration ledger"
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "SourceCompletion";')"
[[ "$restored" == "1" ]] || { echo "restore source-completion count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR08-DB] PASS models=4 one-writer=enforced idempotency=enforced history=restrictive upgrade=retained restore=1-completion"
