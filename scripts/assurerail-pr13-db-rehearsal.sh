#!/usr/bin/env bash
# PR-13 disposable Postgres evidence for the permissioned primary-commercial record layer.
# Synthetic rows test persistence only; they do not close any legal, participant or production gate.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr13.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65500 + ($$ % 30)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr13_fresh"
RESTORE_DB="assurerail_pr13_restore"

case "$TEST_ROOT" in */assurerail-pr13.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr13.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR13-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
model_count="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('CommercialOpportunity','CommercialTermVersion','CommercialAudienceGrant','CommercialOpportunityChange','CommercialInterestIndication','CommercialRfq','CommercialNegotiationThread','CommercialNegotiationMessage','CommercialAllocation');")"
[[ "$model_count" == "9" ]] || { echo "expected 9 PR-13 models, found $model_count" >&2; exit 1; }

echo "[PR13-DB] case scope, named audience, immutable versions, idempotency and restrictive history"
psql_db "$FRESH_DB" -c '
  INSERT INTO "Institution" ("id","legalName","institutionKind","jurisdiction","legalIdentifiers","status","applicantUserId","createdAt","updatedAt") VALUES
    ($$pr13_owner$$,$$PR13 Owner$$,$$LENDER$$,$$IN$$,$${"lei":"owner-test"}$$::jsonb,$$ACTIVE$$,$$owner-user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
    ($$pr13_counterparty$$,$$PR13 Counterparty$$,$$INVESTOR$$,$$IN$$,$${"lei":"counterparty-test"}$$::jsonb,$$ACTIVE$$,$$counterparty-user$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "TransactionCase" ("id","caseReference","ownerInstitutionId","transactionRoute","representation","jurisdiction","marketContext","placementOrListing","lifecycleLeg","assetClass","operatingMode","routePackRef","routePackVersion","status","routeState","currentVersion","aggregateVersion","creationIdempotencyKey","creationRequestDigest","createdByUserId","createdByMandateId","createdAt","updatedAt") VALUES
    ($$pr13_case$$,$$PR13-CASE-1$$,$$pr13_owner$$,$$DA$$,$$CONVENTIONAL$$,$$IN$$,$$DOMESTIC$$,$$BILATERAL$$,$$INITIAL_TRANSFER_OR_ISSUE$$,$$RECEIVABLES$$,$$SHADOW$$,$$route.da.primary$$,$$1$$,$$DRAFT$$,$$NOT_STARTED$$,1,1,$$case-idem-1$$,$$sha256:case$$,$$owner-user$$,$$owner-mandate$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialOpportunity" ("id","transactionCaseId","ownerInstitutionId","opportunityReference","status","audienceMode","currentTermVersion","aggregateVersion","opensAt","closesAt","creationIdempotencyKey","creationRequestDigest","createdByUserId","createdByMandateId","createdAt","updatedAt") VALUES
    ($$pr13_opportunity$$,$$pr13_case$$,$$pr13_owner$$,$$PR13-OPP-1$$,$$PUBLISHED$$,$$NAMED_INSTITUTIONS$$,1,2,CURRENT_TIMESTAMP - INTERVAL $$1 hour$$,CURRENT_TIMESTAMP + INTERVAL $$30 days$$,$$opportunity-idem-1$$,$$sha256:opportunity$$,$$owner-user$$,$$owner-mandate$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialTermVersion" ("id","commercialOpportunityId","version","currency","amountUnits","amountScale","minimumParticipationUnits","maximumParticipationUnits","pricingType","pricingValue","commercialTerms","validFrom","expiresAt","termDigest","reason","createdByUserId","createdByMandateId","stepUpEvidenceId","createdAt") VALUES
    ($$pr13_term$$,$$pr13_opportunity$$,1,$$INR$$,$$100000000$$,2,$$1000000$$,$$25000000$$,$$YIELD_BPS$$,$$875.25$$,$${"recourse":"limited"}$$::jsonb,CURRENT_TIMESTAMP - INTERVAL $$1 hour$$,CURRENT_TIMESTAMP + INTERVAL $$30 days$$,$$sha256:term$$,$$initial governed terms$$,$$owner-user$$,$$owner-mandate$$,$$step-term$$,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialAudienceGrant" ("id","commercialOpportunityId","institutionId","status","purpose","conflictDisclosure","effectiveAt","expiresAt","invitationDigest","invitedByUserId","invitedByMandateId","stepUpEvidenceId","createdAt") VALUES
    ($$pr13_grant$$,$$pr13_opportunity$$,$$pr13_counterparty$$,$$ACTIVE$$,$$TERM_DISPLAY_AND_RFQ$$,$${"disclosed":true}$$::jsonb,CURRENT_TIMESTAMP - INTERVAL $$1 hour$$,CURRENT_TIMESTAMP + INTERVAL $$30 days$$,$$sha256:grant$$,$$owner-user$$,$$owner-mandate$$,$$step-grant$$,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialOpportunityChange" ("id","commercialOpportunityId","action","expectedVersion","fromStatus","toStatus","reason","proposalDigest","status","proposedByUserId","proposedByMandateId","proposalStepUpId","reviewedByUserId","reviewedByMandateId","reviewStepUpId","reviewReason","proposedAt","reviewedAt","appliedAt") VALUES
    ($$pr13_change$$,$$pr13_opportunity$$,$$PUBLISH$$,1,$$DRAFT$$,$$PUBLISHED$$,$$maker-checker publication$$,$$sha256:change$$,$$APPROVED$$,$$owner-maker$$,$$owner-mandate$$,$$step-change-maker$$,$$owner-checker$$,$$owner-mandate-checker$$,$$step-change-checker$$,$$approved$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialInterestIndication" ("id","commercialOpportunityId","institutionId","termVersionId","currency","amountUnits","amountScale","status","qualifications","idempotencyKey","requestDigest","submittedByUserId","submittedByMandateId","submissionStepUpId","expiresAt","createdAt") VALUES
    ($$pr13_interest$$,$$pr13_opportunity$$,$$pr13_counterparty$$,$$pr13_term$$,$$INR$$,$$10000000$$,2,$$SUBMITTED$$,$${"subjectToCredit":true}$$::jsonb,$$interest-idem-1$$,$$sha256:interest$$,$$counterparty-user$$,$$counterparty-mandate$$,$$step-interest$$,CURRENT_TIMESTAMP + INTERVAL $$7 days$$,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialRfq" ("id","commercialOpportunityId","requesterInstitutionId","termVersionId","currency","amountUnits","amountScale","requestedTerms","requestedTermsDigest","status","idempotencyKey","requestDigest","requestedByUserId","requestedByMandateId","requestStepUpId","expiresAt","createdAt") VALUES
    ($$pr13_rfq$$,$$pr13_opportunity$$,$$pr13_counterparty$$,$$pr13_term$$,$$INR$$,$$10000000$$,2,$${"yieldBps":"850"}$$::jsonb,$$sha256:requested-terms$$,$$OPEN$$,$$rfq-idem-1$$,$$sha256:rfq$$,$$counterparty-user$$,$$counterparty-mandate$$,$$step-rfq$$,CURRENT_TIMESTAMP + INTERVAL $$7 days$$,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialNegotiationThread" ("id","commercialOpportunityId","commercialRfqId","ownerInstitutionId","counterpartyInstitutionId","status","createdAt","updatedAt") VALUES
    ($$pr13_thread$$,$$pr13_opportunity$$,$$pr13_rfq$$,$$pr13_owner$$,$$pr13_counterparty$$,$$OPEN$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialNegotiationMessage" ("id","negotiationThreadId","senderInstitutionId","messageKind","body","termSnapshot","termSnapshotDigest","idempotencyKey","requestDigest","sentByUserId","sentByMandateId","stepUpEvidenceId","occurredAt") VALUES
    ($$pr13_message$$,$$pr13_thread$$,$$pr13_counterparty$$,$$COUNTER$$,$$Counterproposal for governed review$$,$${"yieldBps":"850"}$$::jsonb,$$sha256:term-snapshot$$,$$message-idem-1$$,$$sha256:message$$,$$counterparty-user$$,$$counterparty-mandate$$,$$step-message$$,CURRENT_TIMESTAMP);
  INSERT INTO "CommercialAllocation" ("id","commercialOpportunityId","allocationReference","offereeInstitutionId","termVersionId","basisType","basisId","currency","amountUnits","amountScale","status","idempotencyKey","proposalDigest","proposedByUserId","proposedByMandateId","proposalStepUpId","reviewedByUserId","reviewedByMandateId","reviewStepUpId","reviewReason","reviewedAt","expiresAt","createdAt") VALUES
    ($$pr13_allocation$$,$$pr13_opportunity$$,$$PR13-ALLOC-1$$,$$pr13_counterparty$$,$$pr13_term$$,$$INTEREST$$,$$pr13_interest$$,$$INR$$,$$10000000$$,2,$$OFFERED$$,$$allocation-idem-1$$,$$sha256:allocation$$,$$owner-maker$$,$$owner-mandate$$,$$step-allocation-maker$$,$$owner-checker$$,$$owner-mandate-checker$$,$$step-allocation-checker$$,$$approved$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$7 days$$,CURRENT_TIMESTAMP);
  DO $rehearsal$ BEGIN
    BEGIN DELETE FROM "CommercialOpportunity" WHERE id=$$pr13_opportunity$$; RAISE EXCEPTION $$commercial history unexpectedly deleted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN INSERT INTO "CommercialTermVersion" ("id","commercialOpportunityId","version","currency","amountUnits","amountScale","minimumParticipationUnits","pricingType","pricingValue","commercialTerms","validFrom","expiresAt","termDigest","reason","createdByUserId","createdByMandateId","stepUpEvidenceId","createdAt") VALUES ($$pr13_term_duplicate$$,$$pr13_opportunity$$,1,$$INR$$,$$1$$,2,$$1$$,$$YIELD_BPS$$,$$1$$,$${}$$::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$1 day$$,$$sha256:term-duplicate$$,$$duplicate version$$,$$owner-user$$,$$owner-mandate$$,$$step-duplicate$$,CURRENT_TIMESTAMP); RAISE EXCEPTION $$term version unexpectedly duplicated$$; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN INSERT INTO "CommercialInterestIndication" ("id","commercialOpportunityId","institutionId","termVersionId","currency","amountUnits","amountScale","status","qualifications","idempotencyKey","requestDigest","submittedByUserId","submittedByMandateId","submissionStepUpId","expiresAt","createdAt") VALUES ($$pr13_interest_duplicate$$,$$pr13_opportunity$$,$$pr13_counterparty$$,$$pr13_term$$,$$INR$$,$$10000000$$,2,$$SUBMITTED$$,$${}$$::jsonb,$$interest-idem-1$$,$$sha256:different$$,$$counterparty-user$$,$$counterparty-mandate$$,$$step-duplicate$$,CURRENT_TIMESTAMP + INTERVAL $$1 day$$,CURRENT_TIMESTAMP); RAISE EXCEPTION $$interest idempotency unexpectedly duplicated$$; EXCEPTION WHEN unique_violation THEN NULL; END;
  END $rehearsal$;' >/dev/null

echo "[PR13-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *CommercialOpportunity*|*CommercialTermVersion*|*CommercialAudienceGrant*|*CommercialInterestIndication*|*CommercialRfq*|*CommercialAllocation*) echo "PR-13 schema drift detected:" >&2; echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "CommercialOpportunity") || $$|$$ || (SELECT count(*) FROM "CommercialTermVersion") || $$|$$ || (SELECT count(*) FROM "CommercialAudienceGrant") || $$|$$ || (SELECT count(*) FROM "CommercialInterestIndication") || $$|$$ || (SELECT count(*) FROM "CommercialRfq") || $$|$$ || (SELECT count(*) FROM "CommercialNegotiationMessage") || $$|$$ || (SELECT count(*) FROM "CommercialAllocation");')"
[[ "$restored" == "1|1|1|1|1|1|1" ]] || { echo "restore count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR13-DB] PASS models=9 named-audience=1 immutable-version=verified idempotency=verified restrictive-history=verified restore=1|1|1|1|1|1|1 matching=not-implemented external-mutation=none external-evidence=not-claimed"
