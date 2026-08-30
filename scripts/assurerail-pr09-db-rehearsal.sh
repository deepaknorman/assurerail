#!/usr/bin/env bash
# PR-09 disposable Postgres evidence for an observe-only conventional DA saga and retained history.
# It never reads DATABASE_URL and never connects to a configured database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
PR09_MIGRATION="20260831190000_assurerail_pr09_da_replay_saga"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr09.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((63000 + ($$ % 1000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr09_fresh"
UPGRADE_DB="assurerail_pr09_upgrade"
RESTORE_DB="assurerail_pr09_restore"

case "$TEST_ROOT" in */assurerail-pr09.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr09.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR09-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
fresh_models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('DaReplayAuthorisation','SettlementSaga','SettlementLeg','SagaLegObservation','AuthoritativeRecordDeclaration','AuthoritativeRecordSnapshot','ReconciliationBreak','SagaRepairAction');")"
[[ "$fresh_models" == "8" ]] || { echo "expected 8 PR-09 models, found $fresh_models" >&2; exit 1; }

echo "[PR09-DB] append-only observations, one plan, one declaration and restrictive evidence history"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"email\",\"status\",\"createdAt\",\"updatedAt\") VALUES ('user9','pr09@example.invalid','IDENTITY_BOUND',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES
    ('inst9a','PR09 Transferor','REGULATED_ENTITY','IN','{}','ACTIVE','user9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
    ('inst9b','PR09 Transferee','REGULATED_ENTITY','IN','{}','ACTIVE','user9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
    ('inst9r','PR09 Recordkeeper','REGULATED_ENTITY','IN','{}','ACTIVE','user9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"status\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES
    ('case9','PR09-CASE','inst9a','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','MSME_LOAN','REPLAY','assurerail://route-packs/domestic-conventional-da-replay','1.0.0','EXECUTION_PENDING','case-create-9','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','user9','mandate9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"EvidenceObject\" (\"id\",\"institutionId\",\"transactionCaseId\",\"evidenceType\",\"classification\",\"purpose\",\"status\",\"currentVersion\",\"retentionUntilAt\",\"createdByUserId\",\"createdAt\",\"updatedAt\") VALUES
    ('evidence9','inst9r','case9','AUTHORITATIVE_RECORD_SNAPSHOT','CASE_CONFIDENTIAL','DA replay','AVAILABLE',1,CURRENT_TIMESTAMP + INTERVAL '1 year','user9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"DaReplayAuthorisation\" (\"id\",\"transactionCaseId\",\"idempotencyKey\",\"requestDigest\",\"authorityEvidenceRef\",\"reason\",\"status\",\"proposedByUserId\",\"proposedByMandateId\",\"proposalStepUpId\",\"reviewedByUserId\",\"reviewedByMandateId\",\"reviewStepUpId\",\"reviewReason\",\"effectiveAt\",\"createdAt\",\"updatedAt\") VALUES
    ('auth9','case9','auth-command-9','sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','evidence://authorisation','replay approval','APPROVED','maker9','mandate9','step9a','checker9','mandate9','step9b','approved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SettlementSaga\" (\"id\",\"transactionCaseId\",\"routePackRef\",\"routePackVersion\",\"executionMode\",\"state\",\"idempotencyKey\",\"requestDigest\",\"planDigest\",\"legalMechanism\",\"considerationCurrency\",\"considerationMinorUnits\",\"considerationScale\",\"historicOutcomeRef\",\"historicOutcomeDigest\",\"historicOutcomeEvidenceObjectId\",\"transfereeCreditDecisionEvidenceObjectId\",\"executedTransferDocumentEvidenceObjectId\",\"expectedOutcome\",\"expectedOutcomeDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES
    ('saga9','case9','assurerail://route-packs/domestic-conventional-da-replay','1.0.0','OBSERVE_ONLY','BREAK_OPEN','saga-command-9','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','ASSIGNMENT','INR','125000000',2,'historic://redacted','sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','evidence9','evidence9','evidence9','{}','sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','user9','mandate9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SettlementLeg\" (\"id\",\"settlementSagaId\",\"legKey\",\"legType\",\"sequence\",\"participantOwnerInstitutionId\",\"performerClass\",\"expected\",\"expectedDigest\",\"state\",\"currentObservationVersion\",\"createdAt\",\"updatedAt\") VALUES
    ('leg9','saga9','authoritative-register-update','AUTHORITATIVE_REGISTER_UPDATE',60,'inst9r','EXTERNAL_AUTHORITY','{\"afterDigest\":\"sha256:1111111111111111111111111111111111111111111111111111111111111111\"}','sha256:1212121212121212121212121212121212121212121212121212121212121212','BREAK_OPEN',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SettlementLeg\" (\"id\",\"settlementSagaId\",\"legKey\",\"legType\",\"sequence\",\"participantOwnerInstitutionId\",\"performerClass\",\"expected\",\"expectedDigest\",\"state\",\"reconciliationIdempotencyKey\",\"reconciliationRequestDigest\",\"createdAt\",\"updatedAt\") VALUES
    ('leg9idem','saga9','idempotency-control','NOTICE_DELIVERY',61,'inst9a','PARTICIPANT_OWNED','{}','sha256:2727272727272727272727272727272727272727272727272727272727272727','RECONCILED','reconcile-command-9','sha256:2828282828282828282828282828282828282828282828282828282828282828',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SagaLegObservation\" (\"id\",\"settlementLegId\",\"version\",\"idempotencyKey\",\"requestDigest\",\"observation\",\"observationDigest\",\"externalReference\",\"finalityClass\",\"signatureStatus\",\"evidenceObjectId\",\"observedAt\",\"recordedByUserId\",\"recordedByMandateId\",\"comparisonResult\",\"comparison\",\"createdAt\") VALUES
    ('obs9','leg9',1,'observe-command-9','sha256:1313131313131313131313131313131313131313131313131313131313131313','{\"afterDigest\":\"sha256:1414141414141414141414141414141414141414141414141414141414141414\"}','sha256:1515151515151515151515151515151515151515151515151515151515151515','historic-register-ack','FINAL','VERIFIED','evidence9',CURRENT_TIMESTAMP,'maker9','mandate9','BREAK_OPEN','{}',CURRENT_TIMESTAMP);
  INSERT INTO \"AuthoritativeRecordDeclaration\" (\"id\",\"transactionCaseId\",\"recordType\",\"authorityClass\",\"recordkeeperInstitutionId\",\"declarationEvidenceRef\",\"declarationEvidenceDigest\",\"declarationEvidenceObjectId\",\"routePackRef\",\"routePackVersion\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES
    ('record9','case9','PARTICIPANT_LOAN_REGISTER','LEGAL_OPERATIVE_EXTERNAL_RECORD','inst9r','evidence://record','sha256:1616161616161616161616161616161616161616161616161616161616161616','evidence9','assurerail://route-packs/domestic-conventional-da-replay','1.0.0','user9','mandate9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"AuthoritativeRecordSnapshot\" (\"id\",\"authoritativeRecordDeclarationId\",\"settlementSagaId\",\"snapshotKind\",\"recordReference\",\"payloadDigest\",\"evidenceObjectId\",\"sourceAsOfAt\",\"recordedByUserId\",\"createdAt\") VALUES
    ('snapshot9','record9','saga9','BEFORE','register-before','sha256:1717171717171717171717171717171717171717171717171717171717171717','evidence9',CURRENT_TIMESTAMP,'user9',CURRENT_TIMESTAMP);
  INSERT INTO \"ReconciliationBreak\" (\"id\",\"transactionCaseId\",\"settlementSagaId\",\"settlementLegId\",\"breakCode\",\"severity\",\"expected\",\"observed\",\"expectedDigest\",\"observedDigest\",\"blockedCapabilities\",\"status\",\"ownerInstitutionId\",\"dueAt\",\"openedByUserId\",\"createdAt\",\"updatedAt\") VALUES
    ('break9','case9','saga9','leg9','DA_LEG_OBSERVATION_MISMATCH','CRITICAL','{}','{}','sha256:1818181818181818181818181818181818181818181818181818181818181818','sha256:1919191919191919191919191919191919191919191919191919191919191919','[\"CASE_COMPLETION\"]','REPAIR_PROPOSED','inst9r',CURRENT_TIMESTAMP + INTERVAL '4 hours','maker9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"SagaRepairAction\" (\"id\",\"reconciliationBreakId\",\"idempotencyKey\",\"requestDigest\",\"actionType\",\"replacementObservation\",\"reason\",\"authorityEvidenceRef\",\"status\",\"proposedByUserId\",\"proposedByMandateId\",\"proposalStepUpId\",\"proposedAt\") VALUES
    ('repair9','break9','repair-command-9','sha256:2020202020202020202020202020202020202020202020202020202020202020','APPEND_CORRECTED_OBSERVATION','{}','append correction','evidence://repair','PROPOSED','maker9','mandate9','step9c',CURRENT_TIMESTAMP);
  DO \$rehearsal\$ BEGIN
    BEGIN INSERT INTO \"SettlementSaga\" (\"id\",\"transactionCaseId\",\"routePackRef\",\"routePackVersion\",\"idempotencyKey\",\"requestDigest\",\"planDigest\",\"legalMechanism\",\"considerationCurrency\",\"considerationMinorUnits\",\"considerationScale\",\"historicOutcomeRef\",\"historicOutcomeDigest\",\"historicOutcomeEvidenceObjectId\",\"transfereeCreditDecisionEvidenceObjectId\",\"executedTransferDocumentEvidenceObjectId\",\"expectedOutcome\",\"expectedOutcomeDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('saga9x','case9','route','1','another-command','sha256:2121212121212121212121212121212121212121212121212121212121212121','sha256:2222222222222222222222222222222222222222222222222222222222222222','ASSIGNMENT','INR','1',2,'historic','sha256:2323232323232323232323232323232323232323232323232323232323232323','evidence9','evidence9','evidence9','{}','sha256:2424242424242424242424242424242424242424242424242424242424242424','user9','mandate9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); RAISE EXCEPTION 'second saga version unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN INSERT INTO \"SagaLegObservation\" (\"id\",\"settlementLegId\",\"version\",\"idempotencyKey\",\"requestDigest\",\"observation\",\"observationDigest\",\"externalReference\",\"finalityClass\",\"signatureStatus\",\"evidenceObjectId\",\"observedAt\",\"recordedByUserId\",\"recordedByMandateId\",\"comparisonResult\",\"comparison\",\"createdAt\") VALUES ('obs9x','leg9',1,'other-command','sha256:2525252525252525252525252525252525252525252525252525252525252525','{}','sha256:2626262626262626262626262626262626262626262626262626262626262626','other','FINAL','VERIFIED','evidence9',CURRENT_TIMESTAMP,'user9','mandate9','MATCHED','{}',CURRENT_TIMESTAMP); RAISE EXCEPTION 'observation version rewrite unexpectedly inserted'; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN INSERT INTO \"SettlementLeg\" (\"id\",\"settlementSagaId\",\"legKey\",\"legType\",\"sequence\",\"participantOwnerInstitutionId\",\"performerClass\",\"expected\",\"expectedDigest\",\"state\",\"reconciliationIdempotencyKey\",\"reconciliationRequestDigest\",\"createdAt\",\"updatedAt\") VALUES ('leg9idemx','saga9','idempotency-control-duplicate','NOTICE_DELIVERY',62,'inst9a','PARTICIPANT_OWNED','{}','sha256:2929292929292929292929292929292929292929292929292929292929292929','RECONCILED','reconcile-command-9','sha256:3030303030303030303030303030303030303030303030303030303030303030',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); RAISE EXCEPTION 'reconciliation command unexpectedly duplicated'; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN DELETE FROM \"EvidenceObject\" WHERE \"id\"='evidence9'; RAISE EXCEPTION 'referenced evidence unexpectedly deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END \$rehearsal\$;" >/dev/null

echo "[PR09-DB] additive upgrade retains PR-08 completion state"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null; done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$PR09_MIGRATION/*" | sort)
psql_db "$UPGRADE_DB" -c "INSERT INTO \"VenueUser\" (\"id\",\"email\",\"createdAt\",\"updatedAt\") VALUES ('upgrade9','upgrade9@example.invalid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO \"Institution\" (\"id\",\"legalName\",\"institutionKind\",\"jurisdiction\",\"legalIdentifiers\",\"status\",\"applicantUserId\",\"createdAt\",\"updatedAt\") VALUES ('upgradeinst9','Upgrade','REGULATED_ENTITY','IN','{}','ACTIVE','upgrade9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); INSERT INTO \"TransactionCase\" (\"id\",\"caseReference\",\"ownerInstitutionId\",\"transactionRoute\",\"representation\",\"jurisdiction\",\"marketContext\",\"placementOrListing\",\"lifecycleLeg\",\"assetClass\",\"operatingMode\",\"routePackRef\",\"routePackVersion\",\"creationIdempotencyKey\",\"creationRequestDigest\",\"createdByUserId\",\"createdByMandateId\",\"createdAt\",\"updatedAt\") VALUES ('upgradecase9','UPGRADE9','upgradeinst9','DA','CONVENTIONAL','IN','DOMESTIC','BILATERAL','INITIAL_TRANSFER_OR_ISSUE','MSME_LOAN','REPLAY','route://da','1','u9','sha256:abababababababababababababababababababababababababababababababab','upgrade9','m9',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$PR09_MIGRATION/migration.sql" >/dev/null
retained="$(psql_db "$UPGRADE_DB" -Atc "SELECT \"caseReference\" FROM \"TransactionCase\" WHERE id='upgradecase9';")"
[[ "$retained" == "UPGRADE9" ]] || { echo "PR-08 case state changed during upgrade: $retained" >&2; exit 1; }

echo "[PR09-DB] backup/restore and migration ledger"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in
  *DaReplayAuthorisation*|*SettlementSaga*|*SettlementLeg*|*SagaLegObservation*|*AuthoritativeRecordDeclaration*|*AuthoritativeRecordSnapshot*|*ReconciliationBreak*|*SagaRepairAction*)
    echo "PR-09 schema drift detected:" >&2
    echo "$schema_diff" >&2
    exit 1
    ;;
esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "SagaLegObservation";')"
[[ "$restored" == "1" ]] || { echo "restore observation count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR09-DB] PASS models=8 one-plan=enforced observations=append-only history=restrictive upgrade=retained restore=1-observation"
