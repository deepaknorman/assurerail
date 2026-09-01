#!/usr/bin/env bash
# PR-14 disposable Postgres structural evidence only; fixtures are not transaction or external gate evidence.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr14.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65460 + ($$ % 30)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr14_fresh"
RESTORE_DB="assurerail_pr14_restore"

case "$TEST_ROOT" in */assurerail-pr14.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr14.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR14-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
model_count="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('SecondaryTransfer','SecondaryTransferEvidence','SecondaryTransferLeg','SecondaryTransferBreak');")"
[[ "$model_count" == "4" ]] || { echo "expected 4 PR-14 models, found $model_count" >&2; exit 1; }

echo "[PR14-DB] exact values, immutable evidence versions, restrictive history and explicit break"
psql_db "$FRESH_DB" -c '
  INSERT INTO "Institution" ("id","legalName","institutionKind","jurisdiction","legalIdentifiers","status","applicantUserId","createdAt","updatedAt") VALUES
    ($$pr14_seller$$,$$PR14 Seller$$,$$LENDER$$,$$IN$$,$${}$$::jsonb,$$ACTIVE$$,$$seller-user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
    ($$pr14_buyer$$,$$PR14 Buyer$$,$$INVESTOR$$,$$IN$$,$${}$$::jsonb,$$ACTIVE$$,$$buyer-user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
    ($$pr14_recordkeeper$$,$$PR14 Recordkeeper$$,$$RTA$$,$$IN$$,$${}$$::jsonb,$$ACTIVE$$,$$record-user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "TransactionCase" ("id","caseReference","ownerInstitutionId","transactionRoute","representation","jurisdiction","marketContext","placementOrListing","lifecycleLeg","assetClass","operatingMode","routePackRef","routePackVersion","status","routeState","currentVersion","aggregateVersion","creationIdempotencyKey","creationRequestDigest","createdByUserId","createdByMandateId","createdAt","updatedAt") VALUES
    ($$pr14_case$$,$$PR14-CASE-1$$,$$pr14_seller$$,$$DA$$,$$CONVENTIONAL$$,$$IN$$,$$DOMESTIC$$,$$BILATERAL$$,$$SECONDARY_TRANSFER_OR_TRADE$$,$$MSME_LOAN$$,$$SHADOW$$,$$assurerail://route-packs/domestic-conventional-da-secondary-replay$$,$$1.0.0$$,$$APPROVED_FOR_EXECUTION$$,$$READY$$,1,1,$$case-idem$$,$$sha256:case$$,$$seller-user$$,$$seller-mandate$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "EvidenceObject" ("id","institutionId","transactionCaseId","evidenceType","classification","purpose","status","currentVersion","retentionUntilAt","legalHold","createdByUserId","createdAt","updatedAt") VALUES
    ($$pr14_evidence_object$$,$$pr14_recordkeeper$$,$$pr14_case$$,$$CURRENT_HOLDER$$,$$CONFIDENTIAL$$,$$SECONDARY_REPLAY$$,$$AVAILABLE$$,1,CURRENT_TIMESTAMP + INTERVAL $$7 years$$,false,$$record-user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "SecondaryTransfer" ("id","transactionCaseId","transactionRoute","routePackRef","routePackVersion","executionMode","transferReference","instrumentReference","instrumentDigest","sellerInstitutionId","buyerInstitutionId","recordkeeperInstitutionId","quantityUnits","quantityScale","considerationCurrency","considerationMinorUnits","considerationScale","status","aggregateVersion","creationIdempotencyKey","creationRequestDigest","createdByUserId","createdByMandateId","createdAt","updatedAt") VALUES
    ($$pr14_transfer$$,$$pr14_case$$,$$DA$$,$$assurerail://route-packs/domestic-conventional-da-secondary-replay$$,$$1.0.0$$,$$OBSERVE_ONLY$$,$$PR14-T-1$$,$$INSTRUMENT-1$$,$$sha256:instrument$$,$$pr14_seller$$,$$pr14_buyer$$,$$pr14_recordkeeper$$,$$100$$,0,$$INR$$,$$500000$$,2,$$BREAK_OPEN$$,3,$$transfer-idem$$,$$sha256:request$$,$$seller-user$$,$$seller-mandate$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "SecondaryTransferEvidence" ("id","secondaryTransferId","evidenceType","version","providerInstitutionId","evidenceObjectId","evidenceResult","assertionDigest","sourceAsOfAt","idempotencyKey","requestDigest","recordedByUserId","recordedByMandateId","stepUpEvidenceId","createdAt") VALUES
    ($$pr14_evidence$$,$$pr14_transfer$$,$$CURRENT_HOLDER$$,1,$$pr14_recordkeeper$$,$$pr14_evidence_object$$,$$VERIFIED$$,$$sha256:holder$$,CURRENT_TIMESTAMP,$$evidence-idem$$,$$sha256:evidence-request$$,$$seller-user$$,$$seller-mandate$$,$$step-evidence$$,CURRENT_TIMESTAMP);
  INSERT INTO "SecondaryTransferLeg" ("id","secondaryTransferId","legKey","legType","sequence","performerInstitutionId","performerClass","expectedEvidenceType","expectedAssertionDigest","evidenceRecordId","state","comparisonDigest","createdAt","updatedAt") VALUES
    ($$pr14_leg$$,$$pr14_transfer$$,$$current-holder$$,$$CURRENT_HOLDER_VERIFICATION$$,10,$$pr14_recordkeeper$$,$$EXTERNAL_AUTHORITY$$,$$CURRENT_HOLDER$$,$$sha256:holder$$,$$pr14_evidence$$,$$MATCHED$$,$$sha256:comparison$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "SecondaryTransferBreak" ("id","secondaryTransferId","breakCode","severity","expectedDigest","observedDigest","blockedCapabilities","ownerInstitutionId","status","detail","openedByUserId","createdAt","updatedAt") VALUES
    ($$pr14_break$$,$$pr14_transfer$$,$$PTC_TRUSTEE_RECORDKEEPER_DISAGREEMENT$$,$$CRITICAL$$,$$sha256:expected$$,$$sha256:observed$$,$$["EXECUTION","CASH_SETTLEMENT"]$$::jsonb,$$pr14_recordkeeper$$,$$OPEN$$,$${"syntheticEvidenceAccepted":false}$$::jsonb,$$checker-user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  DO $rehearsal$ BEGIN
    BEGIN DELETE FROM "SecondaryTransfer" WHERE id=$$pr14_transfer$$; RAISE EXCEPTION $$secondary history unexpectedly deleted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN INSERT INTO "SecondaryTransferEvidence" ("id","secondaryTransferId","evidenceType","version","providerInstitutionId","evidenceObjectId","evidenceResult","assertionDigest","sourceAsOfAt","idempotencyKey","requestDigest","recordedByUserId","recordedByMandateId","stepUpEvidenceId","createdAt") VALUES ($$duplicate$$,$$pr14_transfer$$,$$CURRENT_HOLDER$$,1,$$pr14_recordkeeper$$,$$pr14_evidence_object$$,$$VERIFIED$$,$$sha256:different$$,CURRENT_TIMESTAMP,$$different-idem$$,$$sha256:different$$,$$seller-user$$,$$seller-mandate$$,$$step$$,CURRENT_TIMESTAMP); RAISE EXCEPTION $$version unexpectedly duplicated$$; EXCEPTION WHEN unique_violation THEN NULL; END;
  END $rehearsal$;' >/dev/null

echo "[PR14-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *SecondaryTransfer*) echo "PR-14 schema drift detected:" >&2; echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "SecondaryTransfer") || $$|$$ || (SELECT count(*) FROM "SecondaryTransferEvidence") || $$|$$ || (SELECT count(*) FROM "SecondaryTransferLeg") || $$|$$ || (SELECT count(*) FROM "SecondaryTransferBreak");')"
[[ "$restored" == "1|1|1|1" ]] || { echo "restore count mismatch: $restored" >&2; exit 1; }
echo "[PR14-DB] PASS models=4 evidence-version=immutable restrictive-history=verified explicit-break=1 restore=1|1|1|1 external-mutation=none external-evidence=not-claimed"
