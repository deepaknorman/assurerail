#!/usr/bin/env bash
# PR-20 disposable structural rehearsal. All records are synthetic shadow fixtures, never invoices,
# customer acceptance, transaction evidence or production activation.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr20.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65510 + ($$ % 10)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr20_fresh"
RESTORE_DB="assurerail_pr20_restore"
case "$TEST_ROOT" in */assurerail-pr20.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr20.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR20-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)

echo "[PR20-DB] exact commercial records, maker-checker receipts, service history and exit manifest"
psql_db "$FRESH_DB" -c '
  INSERT INTO "Institution" ("id","legalName","institutionKind","jurisdiction","legalIdentifiers","status","applicantUserId") VALUES
    ($$inst-pr20$$,$$PR20 synthetic institution$$,$$NBFC$$,$$IND$$,$${}$$::jsonb,$$ACTIVE$$,$$user-customer$$);
  INSERT INTO "CustomerContract" ("id","institutionId","contractRef","version","status","currency","currencyScale","termsDigest","termsEvidenceRef","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt","participantAcceptedByUserId","participantMandateId","participantStepUpId","participantAcceptedAt","effectiveAt","expiresAt","renewalReviewAt") VALUES
    ($$contract-pr20$$,$$inst-pr20$$,$$SYNTHETIC-2026$$,1,$$ACTIVE_SHADOW$$,$$INR$$,2,$$sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$$,$$evidence.synthetic.terms$$,$$user-maker$$,$$step-maker$$,$$user-checker$$,$$step-checker$$,$$Synthetic review$$,now(),$$user-customer$$,$$mandate-customer$$,$$step-customer$$,now(),now()-interval $$1 day$$,now()+interval $$364 days$$,now()+interval $$300 days$$);
  INSERT INTO "CustomerRateCard" ("id","customerContractId","version","status","effectiveAt","expiresAt","rateCardDigest","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
    ($$rate-pr20$$,$$contract-pr20$$,1,$$APPROVED_SHADOW$$,now()-interval $$1 day$$,now()+interval $$364 days$$,$$sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb$$,$$user-maker$$,$$step-rate-maker$$,$$user-checker$$,$$step-rate-checker$$,$$Synthetic independent review$$,now());
  INSERT INTO "CustomerFeeRule" ("id","customerRateCardId","transactionRoute","representation","lifecycleLeg","metric","feeBasis","rateValue","roundingMode") VALUES
    ($$fee-conventional-pr20$$,$$rate-pr20$$,$$PTC$$,$$CONVENTIONAL$$,$$INITIAL_TRANSFER_OR_ISSUE$$,$$TRANSFERRED_NOTIONAL_MINOR$$,$$NOTIONAL_BASIS_POINTS$$,$$30$$,$$DOWN$$),
    ($$fee-token-pr20$$,$$rate-pr20$$,$$PTC$$,$$TOKENISED$$,$$INITIAL_TRANSFER_OR_ISSUE$$,$$TRANSFERRED_NOTIONAL_MINOR$$,$$NOTIONAL_BASIS_POINTS$$,$$50$$,$$DOWN$$);
  INSERT INTO "CustomerUsageEvent" ("id","institutionId","customerContractId","sourceEventRef","sourceEventDigest","transactionRoute","representation","lifecycleLeg","metric","quantityMinor","notionalMinor","currency","occurredAt","status","recordedByUserId") VALUES
    ($$usage-pr20$$,$$inst-pr20$$,$$contract-pr20$$,$$event.synthetic.1$$,$$sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc$$,$$PTC$$,$$CONVENTIONAL$$,$$INITIAL_TRANSFER_OR_ISSUE$$,$$TRANSFERRED_NOTIONAL_MINOR$$,$$1$$,$$165000000000$$,$$INR$$,now(),$$BILLED$$,$$user-maker$$);
  INSERT INTO "CustomerInvoiceStatement" ("id","customerContractId","customerRateCardId","statementRef","periodStart","periodEnd","currency","currencyScale","grossFeeMinor","creditMinor","netFeeMinor","status","statementDigest","preparedByUserId","preparationStepUpId","issuedByUserId","issueStepUpId","issueReason","issuedAt") VALUES
    ($$invoice-pr20$$,$$contract-pr20$$,$$rate-pr20$$,$$SYNTHETIC-STATEMENT-1$$,now()-interval $$1 day$$,now()+interval $$1 day$$,$$INR$$,2,$$495000000$$,$$500000$$,$$494500000$$,$$CORRECTED$$,$$sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd$$,$$user-maker$$,$$step-invoice-maker$$,$$user-checker$$,$$step-invoice-checker$$,$$Synthetic issue review$$,now());
  INSERT INTO "CustomerInvoiceLine" ("id","invoiceStatementId","usageEventId","feeRuleId","basisMinor","rateValue","calculatedFeeMinor","calculationDigest") VALUES
    ($$line-pr20$$,$$invoice-pr20$$,$$usage-pr20$$,$$fee-conventional-pr20$$,$$165000000000$$,$$30$$,$$495000000$$,$$sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$$);
  INSERT INTO "CustomerCreditCorrection" ("id","customerContractId","invoiceStatementId","amountMinor","reason","evidenceRef","proposalDigest","status","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
    ($$credit-pr20$$,$$contract-pr20$$,$$invoice-pr20$$,$$500000$$,$$Synthetic correction$$,$$evidence.synthetic.credit$$,$$sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff$$,$$APPROVED$$,$$user-maker$$,$$step-credit-maker$$,$$user-checker$$,$$step-credit-checker$$,$$Synthetic independent review$$,now());
  INSERT INTO "CustomerImplementationCohort" ("id","institutionId","customerContractId","cohortRef","operatingMode","routes","gateRefs","status","startsAt","endsAt","ownerUserId","changeReason","changedByUserId","changeStepUpId") VALUES
    ($$cohort-pr20$$,$$inst-pr20$$,$$contract-pr20$$,$$SYNTHETIC-COHORT$$,$$SHADOW$$,$$["PTC/CONVENTIONAL"]$$::jsonb,$$["gate.open"]$$::jsonb,$$PLANNED$$,now(),now()+interval $$30 days$$,$$user-manager$$,$$Synthetic cohort$$,$$user-maker$$,$$step-cohort$$);
  INSERT INTO "CustomerServiceRequest" ("id","institutionId","requestRef","requestType","priority","subject","description","evidenceRefs","status","slaDueAt","escalationLevel","escalationPath","createdByUserId","createdByMandateId") VALUES
    ($$request-pr20$$,$$inst-pr20$$,$$SYNTHETIC-SR-1$$,$$GENERAL_OPERATIONS$$,$$NORMAL$$,$$Synthetic request$$,$$No production effect$$,$$[]$$::jsonb,$$ACKNOWLEDGED$$,now()+interval $$24 hours$$,0,$${"levels":["SUPPORT_ANALYST","MANAGER"]}$$::jsonb,$$user-customer$$,$$mandate-customer$$);
  INSERT INTO "CustomerServiceMessage" ("id","customerServiceRequestId","authorType","authorUserId","body","evidenceRefs") VALUES
    ($$message-pr20$$,$$request-pr20$$,$$INTERNAL$$,$$user-support$$,$$Synthetic acknowledgement$$,$$[]$$::jsonb);
  INSERT INTO "CustomerOperationalReview" ("id","institutionId","periodStart","periodEnd","serviceMetrics","openItems","evidenceRefs","recordedByUserId","stepUpEvidenceId") VALUES
    ($$review-pr20$$,$$inst-pr20$$,now()-interval $$30 days$$,now(),$${"availability":"synthetic"}$$::jsonb,$$["gate.open"]$$::jsonb,$$[]$$::jsonb,$$user-manager$$,$$step-review$$);
  INSERT INTO "CustomerDataExitExport" ("id","institutionId","exportVersion","highWaterAt","recordCounts","manifestDigest","scope","requestedByUserId","requestedByMandateId","stepUpEvidenceId") VALUES
    ($$exit-pr20$$,$$inst-pr20$$,$$1.0.0$$,now(),$${"contracts":1,"serviceRequests":1}$$::jsonb,$$sha256:1111111111111111111111111111111111111111111111111111111111111111$$,$${"secretsExcluded":true}$$::jsonb,$$user-customer$$,$$mandate-customer$$,$$step-exit$$);
  DO $x$ BEGIN
    BEGIN INSERT INTO "CustomerUsageEvent" SELECT * FROM "CustomerUsageEvent" WHERE id=$$usage-pr20$$; RAISE EXCEPTION $$duplicate usage accepted$$; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN DELETE FROM "Institution" WHERE id=$$inst-pr20$$; RAISE EXCEPTION $$restrictive customer history delete accepted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END $x$;' >/dev/null

echo "[PR20-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *CustomerContract*|*CustomerRateCard*|*CustomerInvoice*|*CustomerService*|*CustomerDataExit*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "CustomerContract")||$$|$$||(SELECT count(*) FROM "CustomerFeeRule")||$$|$$||(SELECT count(*) FROM "CustomerInvoiceStatement")||$$|$$||(SELECT count(*) FROM "CustomerServiceRequest")||$$|$$||(SELECT count(*) FROM "CustomerDataExitExport");')"
[[ "$rows" == "1|2|1|1|1" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[PR20-DB] PASS contract=1 fee-rules=2 invoice=1 service-request=1 exit=1 restore=1|2|1|1|1 external-customer-evidence=none"
