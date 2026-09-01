#!/usr/bin/env bash
# PR-17 disposable structural rehearsal; fixture observations are not conduct findings or live evidence.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr17.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65470 + ($$ % 50)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr17_fresh"
RESTORE_DB="assurerail_pr17_restore"
case "$TEST_ROOT" in */assurerail-pr17.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr17.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR17-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)

echo "[PR17-DB] versioned policy, evidential alert, complaint/correction, bounded control and capacity"
psql_db "$FRESH_DB" -c '
  INSERT INTO "ConductPolicyRelease" ("id","policyRef","version","status","effectiveFrom","expiresAt","prohibitedActionRules","fairAccessRules","communicationsRules","allocationRules","slaRules","policyDigest","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
    ($$pr17_policy$$,$$domestic-commercial-conduct$$,1,$$APPROVED$$,now()-interval $$1 hour$$,now()+interval $$1 day$$,$${}$$::jsonb,$${}$$::jsonb,$${}$$::jsonb,$${}$$::jsonb,$${"HIGH":"PT4H"}$$::jsonb,$$sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$$,$$maker$$,$$step-maker$$,$$checker$$,$$step-checker$$,$$Structural rehearsal only$$,now());
  INSERT INTO "VenueConductSignal" ("id","signalType","sourceEventRef","sourceOccurredAt","sourceEvidenceRef","sourceEvidenceDigest","facts","factsDigest","policyReleaseId","evaluation","evaluationDigest","result","idempotencyKey","recordedByUserId","stepUpEvidenceId") VALUES
    ($$pr17_signal$$,$$CONFLICT$$,$$fixture-event-1$$,now(),$$fixture://not-live-evidence$$,$$sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb$$,$${"conflictDeclared":true}$$::jsonb,$$sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc$$,$$pr17_policy$$,$${"result":"REVIEW_REQUIRED","autonomousLegalConclusion":false}$$::jsonb,$$sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd$$,$$REVIEW_REQUIRED$$,$$idem-1$$,$$operator$$,$$step-signal$$);
  INSERT INTO "VenueConductAlert" ("id","signalId","alertCode","severity","ownerUserId","dueAt") VALUES
    ($$pr17_alert$$,$$pr17_signal$$,$$CONFLICT_DECLARED$$,$$HIGH$$,$$risk-owner$$,now()+interval $$4 hours$$);
  INSERT INTO "VenueComplaint" ("id","complaintRef","category","summary","evidenceRefs","ownerUserId","dueAt","idempotencyKey","requestDigest","recordedByUserId","stepUpEvidenceId") VALUES
    ($$pr17_complaint$$,$$CMP-STRUCTURAL-1$$,$$FAIR_ACCESS$$,$$Structural rehearsal complaint$$,$$["fixture://complaint"]$$::jsonb,$$risk-owner$$,now()+interval $$1 day$$,$$complaint-idem$$,$$sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$$,$$operator$$,$$step-complaint$$);
  INSERT INTO "VenueCorrection" ("id","complaintId","targetType","targetRef","reason","priorDigest","correctedDigest","correctionEvidenceRef","proposalDigest","proposedByUserId","proposalStepUpId") VALUES
    ($$pr17_correction$$,$$pr17_complaint$$,$$COMMERCIAL_TERM$$,$$term-1$$,$$Preserve prior bytes; append correction$$,$$sha256:1111111111111111111111111111111111111111111111111111111111111111$$,$$sha256:2222222222222222222222222222222222222222222222222222222222222222$$,$$fixture://correction$$,$$sha256:3333333333333333333333333333333333333333333333333333333333333333$$,$$maker$$,$$step-correction$$);
  INSERT INTO "VenueControlAction" ("id","actionType","scopeType","scopeRef","severity","reason","evidenceRefs","effectiveFrom","expiresAt","status","proposalDigest","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
    ($$pr17_control$$,$$SAFE_PAUSE$$,$$COHORT$$,$$fixture-cohort$$,$$HIGH$$,$$Structural rehearsal$$,$$["fixture://control"]$$::jsonb,now(),now()+interval $$1 day$$,$$APPROVED$$,$$sha256:4444444444444444444444444444444444444444444444444444444444444444$$,$$maker$$,$$step-control-maker$$,$$checker$$,$$step-control-checker$$,$$Structural review$$,now());
  INSERT INTO "VenueCapacityBudget" ("id","environment","route","cohortRef","metric","unit","warningThreshold","hardThreshold","version","budgetDigest","changedByUserId","stepUpEvidenceId","effectiveFrom","expiresAt") VALUES
    ($$pr17_budget$$,$$shadow$$,$$DA$$,$$fixture-cohort$$,$$OPEN_CASES$$,$$COUNT$$,$$80$$,$$100$$,1,$$sha256:5555555555555555555555555555555555555555555555555555555555555555$$,$$manager$$,$$step-budget$$,now(),now()+interval $$1 day$$);
  INSERT INTO "VenueCapacityObservation" ("id","capacityBudgetId","observedValue","observedAt","state","sourceEvidenceRef","sourceEvidenceDigest","observationDigest","recordedByUserId","stepUpEvidenceId") VALUES
    ($$pr17_observation$$,$$pr17_budget$$,$$100$$,now(),$$HARD_LIMIT$$,$$fixture://metrics$$,$$sha256:6666666666666666666666666666666666666666666666666666666666666666$$,$$sha256:7777777777777777777777777777777777777777777777777777777777777777$$,$$manager$$,$$step-observation$$);
  DO $x$ BEGIN
    BEGIN INSERT INTO "VenueConductAlert" ("id","signalId","alertCode","severity","ownerUserId","dueAt") VALUES ($$duplicate$$,$$pr17_signal$$,$$DUPLICATE$$,$$LOW$$,$$owner$$,now()); RAISE EXCEPTION $$duplicate alert accepted$$; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN INSERT INTO "VenueCapacityBudget" SELECT * FROM "VenueCapacityBudget" WHERE id=$$pr17_budget$$; RAISE EXCEPTION $$duplicate budget accepted$$; EXCEPTION WHEN unique_violation THEN NULL; END;
  END $x$;' >/dev/null

echo "[PR17-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *VenueConduct*|*ConductPolicy*|*VenueComplaint*|*VenueCorrection*|*VenueControl*|*VenueCapacity*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "ConductPolicyRelease")||$$|$$||(SELECT count(*) FROM "VenueConductSignal")||$$|$$||(SELECT count(*) FROM "VenueConductAlert")||$$|$$||(SELECT count(*) FROM "VenueComplaint")||$$|$$||(SELECT count(*) FROM "VenueCorrection")||$$|$$||(SELECT count(*) FROM "VenueControlAction")||$$|$$||(SELECT count(*) FROM "VenueCapacityObservation");')"
[[ "$rows" == "1|1|1|1|1|1|1" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[PR17-DB] PASS policy=approved signal=review-required alert=open correction=append-only control=shadow capacity=hard-limit restore=1|1|1|1|1|1|1 external-action=none"
