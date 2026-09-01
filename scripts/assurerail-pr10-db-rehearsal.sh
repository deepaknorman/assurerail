#!/usr/bin/env bash
# PR-10 disposable Postgres evidence for the observe-only conventional PTC foundation.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR10_MIGRATION="20260901150000_assurerail_pr10_ptc_replay_foundation"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr10.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((64000 + ($$ % 1000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr10_fresh"
UPGRADE_DB="assurerail_pr10_upgrade"
RESTORE_DB="assurerail_pr10_restore"

case "$TEST_ROOT" in */assurerail-pr10.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr10.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR10-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
fresh_models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('PtcReplayAuthorisation','SagaEvidenceLink');")"
[[ "$fresh_models" == "2" ]] || { echo "expected 2 PR-10 models, found $fresh_models" >&2; exit 1; }

echo "[PR10-DB] PTC saga uses generic evidence without fabricated DA evidence"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"email\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('user10','pr10@example.invalid','IDENTITY_BOUND',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('inst10','PR10 Issuer','REGULATED_ENTITY','IN','{}','ACTIVE','user10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"status\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('case10','PR10-CASE','inst10','PTC','CONVENTIONAL','IN','DOMESTIC','PRIVATE_PLACEMENT','INITIAL_TRANSFER_OR_ISSUE','MSME_LOAN','REPLAY','assurerail://route-packs/domestic-conventional-ptc-replay','1.0.0','EXECUTION_PENDING','case-create-10','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','user10','mandate10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"EvidenceObject\" (\"id\",\"institutionId\",\"transactionCaseId\",\"evidenceType\",\"classification\",\"purpose\",\"status\",\"currentVersion\",\"retentionUntilAt\",\"createdByUserId\",\"createdAt\",\"updatedAt\") VALUES ('evidence10','inst10','case10','TRUSTEE_TRANSACTION_CONTROL','CASE_CONFIDENTIAL','PTC replay','AVAILABLE',1,CURRENT_TIMESTAMP + INTERVAL '1 year','user10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"PtcReplayAuthorisation\" (\"id\",\"transactionCaseId\",\"idempotencyKey\",\"requestDigest\",\"authorityEvidenceRef\",\"reason\",\"status\",\"proposedByUserId\",\"proposedByMandateId\",\"proposalStepUpId\",\"reviewedByUserId\",\"reviewedByMandateId\",\"reviewStepUpId\",\"reviewReason\",\"effectiveAt\",\"createdAt\",\"updatedAt\") VALUES ('auth10','case10','auth-command-10','sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','evidence://trustee-authority','historic replay approval','APPROVED','maker10','mandate10','step10a','checker10','mandate10','step10b','approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SettlementSaga\" (\"id\",\"transactionCaseId\",\"routePackRef\",\"routePackVersion\",\"transactionRoute\",\"executionMode\",\"state\",\"idempotencyKey\",\"requestDigest\",\"planDigest\",\"routeEvidenceBundleDigest\",\"legalMechanism\",\"considerationCurrency\",\"considerationMinorUnits\",\"considerationScale\",\"historicOutcomeRef\",\"historicOutcomeDigest\",\"expectedOutcome\",\"expectedOutcomeDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('saga10','case10','assurerail://route-packs/domestic-conventional-ptc-replay','1.0.0','PTC','OBSERVE_ONLY','READY','saga-command-10','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','SECURITISATION_TRUST_PTC','INR','0',2,'historic://redacted','sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','{}','sha256:1111111111111111111111111111111111111111111111111111111111111111','user10','mandate10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SagaEvidenceLink\" (\"id\",\"settlementSagaId\",\"evidenceObjectId\",\"evidenceRole\",\"evidenceDigest\",\"sequence\",\"createdAt\") VALUES ('link10','saga10','evidence10','TRUSTEE_TRANSACTION_CONTROL','sha256:1212121212121212121212121212121212121212121212121212121212121212',10,CURRENT_TIMESTAMP);
  DO \$rehearsal\$ BEGIN
    IF EXISTS (SELECT 1 FROM \"SettlementSaga\" WHERE id='saga10' AND (\"historicOutcomeEvidenceObjectId\" IS NOT NULL OR \"transfereeCreditDecisionEvidenceObjectId\" IS NOT NULL OR \"executedTransferDocumentEvidenceObjectId\" IS NOT NULL)) THEN RAISE EXCEPTION 'PTC saga contains fabricated DA evidence'; END IF;
    BEGIN INSERT INTO \"SagaEvidenceLink\" (\"id\",\"settlementSagaId\",\"evidenceObjectId\",\"evidenceRole\",\"evidenceDigest\",\"sequence\",\"createdAt\") VALUES ('link10x','saga10','evidence10','TRUSTEE_TRANSACTION_CONTROL','sha256:1313131313131313131313131313131313131313131313131313131313131313',11,CURRENT_TIMESTAMP); RAISE EXCEPTION 'duplicate evidence role unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN DELETE FROM \"EvidenceObject\" WHERE id='evidence10'; RAISE EXCEPTION 'referenced evidence unexpectedly deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END \$rehearsal\$;" >/dev/null

echo "[PR10-DB] additive upgrade retains and classifies an existing DA saga"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do
  psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null
done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR10_MIGRATION/*" | sort)
psql_db "$UPGRADE_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"email\",\"createdAt\",\"updatedAt\") VALUES ('upgrade10','upgrade10@example.invalid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('upgradeinst10','Upgrade','REGULATED_ENTITY','IN','{}','ACTIVE','upgrade10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('upgradecase10','UPGRADE10','upgradeinst10','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','MSME_LOAN','REPLAY','route://da','1','u10','sha256:abababababababababababababababababababababababababababababababab','upgrade10','m10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"EvidenceObject\" (\"id\",\"institutionId\",\"transactionCaseId\",\"evidenceType\",\"classification\",\"purpose\",\"status\",\"currentVersion\",\"retentionUntilAt\",\"createdByUserId\",\"createdAt\",\"updatedAt\") VALUES ('upgradeevidence10','upgradeinst10','upgradecase10','HISTORIC_DA_OUTCOME','CASE_CONFIDENTIAL','DA replay','AVAILABLE',1,CURRENT_TIMESTAMP + INTERVAL '1 year','upgrade10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SettlementSaga\" (\"id\",\"transactionCaseId\",\"routePackRef\",\"routePackVersion\",\"executionMode\",\"state\",\"idempotencyKey\",\"requestDigest\",\"planDigest\",\"legalMechanism\",\"considerationCurrency\",\"considerationMinorUnits\",\"considerationScale\",\"historicOutcomeRef\",\"historicOutcomeDigest\",\"historicOutcomeEvidenceObjectId\",\"transfereeCreditDecisionEvidenceObjectId\",\"executedTransferDocumentEvidenceObjectId\",\"expectedOutcome\",\"expectedOutcomeDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('upgradesaga10','upgradecase10','route://da','1','OBSERVE_ONLY','READY','saga-u10','sha256:bcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc','sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd','ASSIGNMENT','INR','1',2,'historic://da','sha256:dededededededededededededededededededededededededededededededededede','upgradeevidence10','upgradeevidence10','upgradeevidence10','{}','sha256:efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef','upgrade10','m10',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR10_MIGRATION/migration.sql" >/dev/null
upgrade_result="$(psql_db "$UPGRADE_DB" -Atc "SELECT \"transactionRoute\" || '|' || \"routeEvidenceBundleDigest\" || '|' || COALESCE(\"historicOutcomeEvidenceObjectId\",'') || '|' || COALESCE(\"transfereeCreditDecisionEvidenceObjectId\",'') || '|' || COALESCE(\"executedTransferDocumentEvidenceObjectId\",'') FROM \"SettlementSaga\" WHERE id='upgradesaga10';")"
[[ "$upgrade_result" == "DA|sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd|upgradeevidence10|upgradeevidence10|upgradeevidence10" ]] || { echo "legacy DA saga changed during upgrade: $upgrade_result" >&2; exit 1; }

echo "[PR10-DB] backup/restore and schema parity"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in
  *'Changed the `PtcReplayAuthorisation` table'*|*'Changed the `SagaEvidenceLink` table'*|*'Changed the `SettlementSaga` table'*|*'Added the `PtcReplayAuthorisation` table'*|*'Added the `SagaEvidenceLink` table'*)
    echo "PR-10 schema drift detected:" >&2; echo "$schema_diff" >&2; exit 1 ;;
esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "SagaEvidenceLink";')"
[[ "$restored" == "1" ]] || { echo "restore evidence-link count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR10-DB] PASS models=2 ptc-evidence=generic da-upgrade=retained history=restrictive restore=1-link"
