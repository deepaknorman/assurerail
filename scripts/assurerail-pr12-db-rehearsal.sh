#!/usr/bin/env bash
# PR-12 disposable Postgres migration/restore evidence for readiness and activation records.
# Synthetic rows exercise persistence only and never count as accepted external production evidence.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr12.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65400 + ($$ % 100)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr12_fresh"
RESTORE_DB="assurerail_pr12_restore"

case "$TEST_ROOT" in */assurerail-pr12.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr12.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR12-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('OperationalReadinessGate','OperationalReadinessDecision','DeploymentActivation','DeploymentActivationGate');")"
[[ "$models" == "4" ]] || { echo "expected 4 PR-12 models, found $models" >&2; exit 1; }

echo "[PR12-DB] immutable decision and activation binding"
psql_db "$FRESH_DB" -c '
  INSERT INTO "OperationalReadinessGate" ("id","environment","scopeType","scopeRef","scopeKey","gateCode","requirementVersion","title","requirement","evidenceClassRequired","status","ownerUserId","proposedByUserId","proposalStepUpId","proposalDigest","createdAt","updatedAt") VALUES
    ($$gate-1$$,$$rail-pilot-in$$,$$ROUTE_FUNCTION$$,$$da-route-1$$,$$ROUTE_FUNCTION:da-route-1$$,$$ROUTE_LEGAL_PERMISSION$$,1,$$Route permission$$,$$External authority evidence required$$,$$EXTERNAL$$,$$OPEN$$,$$staff-owner$$,$$staff-maker$$,$$step-propose$$,$$sha256:1111111111111111111111111111111111111111111111111111111111111111$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO "OperationalReadinessDecision" ("id","readinessGateId","version","decision","evidenceClass","evidenceRef","evidenceDigest","reason","decidedByUserId","decisionStepUpId","decisionDigest","validFrom","expiresAt","createdAt") VALUES
    ($$decision-1$$,$$gate-1$$,1,$$ACCEPT$$,$$EXTERNAL$$,$$external-authority/permission/1$$,$$sha256:2222222222222222222222222222222222222222222222222222222222222222$$,$$Independent rehearsal acceptance$$,$$staff-checker$$,$$step-review$$,$$sha256:3333333333333333333333333333333333333333333333333333333333333333$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$30 days$$,CURRENT_TIMESTAMP);
  UPDATE "OperationalReadinessGate" SET "status"=$$ACCEPTED$$,"currentEvidenceRef"=$$external-authority/permission/1$$,"currentEvidenceDigest"=$$sha256:2222222222222222222222222222222222222222222222222222222222222222$$,"currentDecisionId"=$$decision-1$$,"acceptedAt"=CURRENT_TIMESTAMP,"expiresAt"=CURRENT_TIMESTAMP + INTERVAL $$30 days$$ WHERE "id"=$$gate-1$$;
  INSERT INTO "DeploymentActivation" ("id","manifestId","environment","operatingMode","buildCommit","status","manifest","manifestDigest","signatureAlgorithm","signingKeyId","signature","proposedByUserId","proposalStepUpId","approvedByUserId","approvalStepUpId","approvalReason","approvalDigest","approvedAt","expiresAt","createdAt") VALUES
    ($$activation-1$$,$$manifest-1$$,$$rail-pilot-in$$,$$CONTROLLED_LIVE$$,$$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$$,$$APPROVED$$,$${"rehearsal":true}$$::jsonb,$$sha256:4444444444444444444444444444444444444444444444444444444444444444$$,$$ED25519$$,$$offline-release-key-1$$,$$rehearsal-signature$$,$$staff-release-maker$$,$$step-release-propose$$,$$staff-release-checker$$,$$step-release-review$$,$$Independent rehearsal approval$$,$$sha256:7777777777777777777777777777777777777777777777777777777777777777$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$7 days$$,CURRENT_TIMESTAMP);
  INSERT INTO "DeploymentActivationGate" ("deploymentActivationId","readinessGateId","readinessDecisionId","gateCode","scopeKey","evidenceDigest","boundAt") VALUES
    ($$activation-1$$,$$gate-1$$,$$decision-1$$,$$ROUTE_LEGAL_PERMISSION$$,$$ROUTE_FUNCTION:da-route-1$$,$$sha256:2222222222222222222222222222222222222222222222222222222222222222$$,CURRENT_TIMESTAMP);
  DO $rehearsal$ BEGIN
    BEGIN DELETE FROM "OperationalReadinessDecision" WHERE id=$$decision-1$$; RAISE EXCEPTION $$bound decision unexpectedly deleted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN DELETE FROM "OperationalReadinessGate" WHERE id=$$gate-1$$; RAISE EXCEPTION $$bound gate unexpectedly deleted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN INSERT INTO "OperationalReadinessDecision" ("id","readinessGateId","version","decision","evidenceClass","evidenceRef","evidenceDigest","reason","decidedByUserId","decisionStepUpId","decisionDigest","validFrom","expiresAt","createdAt") VALUES ($$decision-duplicate$$,$$gate-1$$,1,$$ACCEPT$$,$$EXTERNAL$$,$$external-authority/permission/2$$,$$sha256:5555555555555555555555555555555555555555555555555555555555555555$$,$$duplicate$$,$$staff-other$$,$$step-other$$,$$sha256:6666666666666666666666666666666666666666666666666666666666666666$$,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL $$30 days$$,CURRENT_TIMESTAMP); RAISE EXCEPTION $$decision version unexpectedly duplicated$$; EXCEPTION WHEN unique_violation THEN NULL; END;
  END $rehearsal$;' >/dev/null

echo "[PR12-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *OperationalReadiness*|*DeploymentActivation*) echo "PR-12 schema drift detected:" >&2; echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "OperationalReadinessGate") || $$|$$ || (SELECT count(*) FROM "OperationalReadinessDecision") || $$|$$ || (SELECT count(*) FROM "DeploymentActivation") || $$|$$ || (SELECT count(*) FROM "DeploymentActivationGate");')"
[[ "$restored" == "1|1|1|1" ]] || { echo "restore count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR12-DB] PASS models=4 decisions=immutable activation=two-person-binding restore=1|1|1|1 external-evidence=not-claimed"
