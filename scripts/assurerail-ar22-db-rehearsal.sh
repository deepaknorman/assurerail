#!/usr/bin/env bash
# AR-22 disposable structural rehearsal. Records are synthetic shadow fixtures only; they are not
# customer acceptance, activated identity, operating authority or production evidence.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-ar22.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65490 + ($$ % 10)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_ar22_fresh"
RESTORE_DB="assurerail_ar22_restore"
case "$TEST_ROOT" in */assurerail-ar22.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-ar22.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[AR22-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)

echo "[AR22-DB] shadow identity, access-review and exit records"
psql_db "$FRESH_DB" -c '
  INSERT INTO "Institution" ("id","legalName","institutionKind","jurisdiction","legalIdentifiers","status","applicantUserId") VALUES
    ($$inst-ar22$$,$$AR22 synthetic institution$$,$$NBFC$$,$$IND$$,$${}$$::jsonb,$$ACTIVE$$,$$user-applicant$$);
  INSERT INTO "InstitutionIdentityConnection" ("id","institutionId","connectionKey","protocol","displayName","issuer","audience","metadataDigest","emailDomains","status","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","effectiveAt","expiresAt") VALUES
    ($$iic-ar22$$,$$inst-ar22$$,$$synthetic-saml$$,$$SAML$$,$$Synthetic SAML$$,$$urn:synthetic:idp$$,$$urn:synthetic:rail$$,$$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$$,$$["example.invalid"]$$::jsonb,$$SHADOW_APPROVED$$,$$user-maker$$,$$step-connection-maker$$,$$user-checker$$,$$step-connection-checker$$,$$Synthetic shadow approval$$,now(),now()+interval $$30 days$$);
  INSERT INTO "InstitutionServicePrincipal" ("id","institutionId","clientId","displayName","credentialVaultRef","credentialFingerprint","status","allowedActions","proposedByUserId","proposalStepUpId","approvedByUserId","approvalStepUpId","approvalReason","effectiveAt","expiresAt") VALUES
    ($$isp-ar22$$,$$inst-ar22$$,$$synthetic-client-ar22$$,$$Synthetic integration$$,$$vault-kv-v2://pending/isp-ar22$$,$$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb$$,$$SHADOW_APPROVED$$,$$["OPERATE_CONNECTORS"]$$::jsonb,$$user-maker$$,$$step-service-maker$$,$$user-checker$$,$$step-service-checker$$,$$Synthetic shadow approval$$,now(),now()+interval $$30 days$$);
  INSERT INTO "InstitutionAccessReview" ("id","institutionId","reviewRef","scope","evidenceRefs","dueAt","status","conclusion","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
    ($$iar-ar22$$,$$inst-ar22$$,$$SYNTHETIC-REVIEW-1$$,$${"population":"all-current-access"}$$::jsonb,$$["evidence.synthetic.access"]$$::jsonb,now()+interval $$30 days$$,$$APPROVED$$,$$No authority mutation performed$$,$$user-maker$$,$$step-review-maker$$,$$user-checker$$,$$step-review-checker$$,$$Synthetic independent review$$,now());
  INSERT INTO "InstitutionExitPlan" ("id","institutionId","exitRef","reason","requestedEffectiveAt","scope","evidenceRefs","status","proposedByUserId","proposalStepUpId","reviewedByUserId","reviewStepUpId","reviewReason","reviewedAt") VALUES
    ($$ixp-ar22$$,$$inst-ar22$$,$$SYNTHETIC-EXIT-1$$,$$Synthetic continuity rehearsal$$,now()+interval $$60 days$$,$${"records":"export-only"}$$::jsonb,$$["evidence.synthetic.exit"]$$::jsonb,$$APPROVED$$,$$user-maker$$,$$step-exit-maker$$,$$user-checker$$,$$step-exit-checker$$,$$Plan approved, execution not performed$$,now());
  DO $x$ BEGIN
    BEGIN INSERT INTO "InstitutionIdentityConnection" SELECT * FROM "InstitutionIdentityConnection" WHERE id=$$iic-ar22$$; RAISE EXCEPTION $$duplicate connection accepted$$; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN DELETE FROM "Institution" WHERE id=$$inst-ar22$$; RAISE EXCEPTION $$restrictive institution history delete accepted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END $x$;' >/dev/null

echo "[AR22-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *InstitutionIdentityConnection*|*InstitutionAccessReview*|*InstitutionExitPlan*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "InstitutionIdentityConnection")||$$|$$||(SELECT count(*) FROM "InstitutionServicePrincipal")||$$|$$||(SELECT count(*) FROM "InstitutionAccessReview")||$$|$$||(SELECT count(*) FROM "InstitutionExitPlan");')"
[[ "$rows" == "1|1|1|1" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[AR22-DB] PASS identity-connection=1 service-identity=1 access-review=1 exit-plan=1 restore=1|1|1|1 activated-authentication=none external-customer-evidence=none"
