#!/usr/bin/env bash
# Disposable structural rehearsal for seller-specific DA execution fee invoices. Synthetic only.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-execution-fee.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65470 + ($$ % 20)))"
PG_USER="$(id -un)"
DB_NAME="assurerail_execution_fee"
case "$TEST_ROOT" in */assurerail-execution-fee.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql npx; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-execution-fee.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$DB_NAME"
DATABASE_URL="postgresql://$PG_USER@127.0.0.1:$PG_PORT/$DB_NAME"
(cd "$RAIL_DIR"; DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy --schema=prisma/schema.prisma >/dev/null)
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$DATABASE_URL" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *ExecutionFeeInvoice*|*executionFeeInvoice*) echo "$schema_diff" >&2; exit 1 ;; esac
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL' >/dev/null
INSERT INTO "Institution" ("id","legalName","institutionKind","jurisdiction","legalIdentifiers","status","applicantUserId") VALUES
('seller-1','Synthetic seller','NBFC','IND','{}','ACTIVE','applicant'),
('buyer-1','Synthetic buyer','BANK','IND','{}','ACTIVE','applicant');
INSERT INTO "CustomerContract" ("id","institutionId","contractRef","version","status","currency","currencyScale","termsDigest","termsEvidenceRef","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt","participantAcceptedByUserId","participantMandateId","participantStepUpId","participantAcceptedAt","effectiveAt","expiresAt","renewalReviewAt") VALUES
('contract-1','seller-1','SYNTHETIC',1,'ACTIVE_SHADOW','INR',2,'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','synthetic:terms','maker','step-maker','checker','step-checker','synthetic review',now(),'seller-user','mandate','seller-step',now(),now()-interval '1 day',now()+interval '30 days',now()+interval '20 days');
INSERT INTO "CustomerRateCard" ("id","customerContractId","version","status","effectiveAt","expiresAt","rateCardDigest","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
('rate-1','contract-1',1,'APPROVED_SHADOW',now()-interval '1 day',now()+interval '30 days','sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','maker','step-maker','checker','step-checker','synthetic review',now());
INSERT INTO "AssessmentEngagement" ("id","customerContractId","requestRef","requestDigest","billingProfile","scope","quote","quoteDigest","termsDigest","rateCardId","status","route","acceptedByUserId","acceptanceStepUpId","acceptedAt","preparationAcceptedBy","preparationStepUpId","preparationAcceptedAt","offerExpiresAt") VALUES
('engagement-1','contract-1','synthetic-request','sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','{}','{}','{}','sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd','sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','rate-1','ACCEPTED_SHADOW','STANDALONE','seller-user','accept-step',now(),'seller-user','prep-step',now(),now()+interval '10 days');
INSERT INTO "TransactionCase" ("id","caseReference","ownerInstitutionId","transactionRoute","representation","jurisdiction","marketContext","placementOrListing","lifecycleLeg","assetClass","operatingMode","routePackRef","routePackVersion","status","routeState","creationIdempotencyKey","creationRequestDigest","createdByUserId","createdByMandateId") VALUES
('case-1','SYNTHETIC-DA-1','seller-1','DA','CONVENTIONAL','IND','PRIVATE','UNLISTED','INITIAL_TRANSFER_OR_ISSUE','VEHICLE_EV','SHADOW','route-pack','1','ACTIVE','IN_PROGRESS','case-create','sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee','seller-user','mandate');
INSERT INTO "CustomerDesignPartnerCoupon" ("id","institutionId","programmeCode","discountBps","status","slot","evidenceRef","signedScopeAt","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
('coupon-1','seller-1','DESIGN_PARTNER_30',3000,'APPROVED',1,'synthetic:founder-decision',now()-interval '1 day','coupon-maker','coupon-step','coupon-checker','coupon-review','synthetic approval',now());
INSERT INTO "CustomerInvoiceStatement" ("id","customerContractId","customerRateCardId","statementRef","periodStart","periodEnd","currency","currencyScale","grossFeeMinor","creditMinor","netFeeMinor","status","statementDigest","preparedByUserId","preparationStepUpId") VALUES
('invoice-1','contract-1','rate-1','EXEC:engagement-1:1',now()-interval '1 minute',now(),'INR',2,'195880000','58764000','137116000','DRAFT','sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff','invoice-maker','invoice-step');
INSERT INTO "CustomerInvoiceDiscount" ("id","invoiceId","couponId","programmeCode","discountBps","standardBaseMinor","standardTaxMinor","standardTotalMinor","discountedBaseMinor","discountedTaxMinor","discountedTotalMinor","baseCreditMinor","taxCreditMinor","totalCreditMinor","snapshotDigest") VALUES
('discount-1','invoice-1','coupon-1','DESIGN_PARTNER_30',3000,'166000000','29880000','195880000','116200000','20916000','137116000','49800000','8964000','58764000','sha256:1111111111111111111111111111111111111111111111111111111111111111');
INSERT INTO "ExecutionFeeInvoice" ("id","sellerInstitutionId","engagementId","transactionCaseId","invoiceStatementId","designPartnerCouponId","requestRef","closingRef","sequence","policyVersion","policyDigest","acceptedMinimumMinor","previousCumulativeConsiderationMinor","acceptedCumulativeConsiderationMinor","considerationAcceptanceDigest","sellerAcceptanceEvidenceRef","buyerAcceptanceEvidenceRef","acceptedAt","cumulativeGrossBaseMinor","incrementalGrossBaseMinor","eligibleStandalonePremiumMinor","previouslyAppliedPremiumMinor","appliedPremiumCreditMinor","remainingPremiumMinor","postPremiumBaseMinor","designPartnerProgrammeCode","designPartnerDiscountBps","designPartnerCreditBaseMinor","netBaseMinor","grossTaxMinor","premiumTaxCreditMinor","designPartnerTaxCreditMinor","totalTaxCreditMinor","netTaxMinor","grossTotalMinor","invoiceGrossTotalMinor","designPartnerTotalCreditMinor","totalCreditMinor","netTotalMinor","taxRuleSnapshot","snapshotDigest","preparedByUserId","preparationStepUpId") VALUES
('efi-1','seller-1','engagement-1','case-1','invoice-1','coupon-1','request-1','close-1',1,'DA-2026','sha256:2222222222222222222222222222222222222222222222222222222222222222','50000000','0','55000000000','sha256:3333333333333333333333333333333333333333333333333333333333333333','synthetic:seller-acceptance','synthetic:buyer-acceptance',now()-interval '1 minute','190000000','190000000','24000000','0','24000000','0','166000000','DESIGN_PARTNER_30',3000,'49800000','116200000','34200000','4320000','8964000','13284000','20916000','224200000','195880000','58764000','87084000','137116000','{"feeBasis":"NOTIONAL_BASIS_POINTS","rateValue":"1800","minimumFeeMinor":null,"maximumFeeMinor":null,"roundingMode":"HALF_UP"}','sha256:4444444444444444444444444444444444444444444444444444444444444444','invoice-maker','invoice-step');
UPDATE "ExecutionFeeInvoice" SET "status"='APPROVED',"reviewedByUserId"='invoice-checker',"reviewStepUpId"='review-step',"reviewReason"='synthetic independent review',"reviewedAt"=now() WHERE "id"='efi-1';
UPDATE "CustomerInvoiceStatement" SET "status"='ISSUED_SHADOW',"issuedByUserId"='invoice-checker',"issueStepUpId"='review-step',"issueReason"='synthetic independent review',"issuedAt"=now() WHERE "id"='invoice-1';
DO $x$ BEGIN
  BEGIN UPDATE "ExecutionFeeInvoice" SET "netTotalMinor"='1' WHERE "id"='efi-1'; RAISE EXCEPTION 'mutation unexpectedly accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='mutation unexpectedly accepted' THEN RAISE; END IF; END;
  BEGIN UPDATE "CustomerInvoiceStatement" SET "netFeeMinor"='1' WHERE "id"='invoice-1'; RAISE EXCEPTION 'mutation unexpectedly accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='mutation unexpectedly accepted' THEN RAISE; END IF; END;
  BEGIN DELETE FROM "ExecutionFeeInvoice" WHERE "id"='efi-1'; RAISE EXCEPTION 'mutation unexpectedly accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='mutation unexpectedly accepted' THEN RAISE; END IF; END;
END $x$;
SQL
result="$(psql -X -At "$DATABASE_URL" -c 'SELECT e.status||$$|$$||s.status||$$|$$||s."netFeeMinor"||$$|$$||d."programmeCode" FROM "ExecutionFeeInvoice" e JOIN "CustomerInvoiceStatement" s ON s.id=e."invoiceStatementId" JOIN "CustomerInvoiceDiscount" d ON d."invoiceId"=s.id WHERE e.id=$$efi-1$$;')"
[[ "$result" == "APPROVED|ISSUED_SHADOW|137116000|DESIGN_PARTNER_30" ]] || { echo "execution invoice rehearsal mismatch: $result" >&2; exit 1; }
echo "[EXECUTION-FEE-DB] PASS seller scope, cumulative fee snapshot, premium-then-coupon composition, maker-checker and immutable invoice leg"
