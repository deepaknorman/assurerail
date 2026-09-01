#!/usr/bin/env bash
# PR-19 disposable structural rehearsal; fixtures prove software structure only, never certification.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr19.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65520 + ($$ % 10)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr19_fresh"
RESTORE_DB="assurerail_pr19_restore"
case "$TEST_ROOT" in */assurerail-pr19.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr19.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR19-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)

echo "[PR19-DB] scoped client, immutable credential versions, software conformance and exit manifest"
psql_db "$FRESH_DB" -c '
  INSERT INTO "Institution" ("id","legalName","institutionKind","jurisdiction","legalIdentifiers","status","applicantUserId") VALUES
    ($$inst-pr19$$,$$PR19 structural institution$$,$$NBFC$$,$$IND$$,$${}$$::jsonb,$$ACTIVE$$,$$user-pr19$$);
  INSERT INTO "ConnectorRegistration" ("id","institutionId","connectorKey","connectorType","displayName","transport","schemaProfiles","status","createdByUserId") VALUES
    ($$conn-pr19$$,$$inst-pr19$$,$$registry-api$$,$$COMMON_REGISTRY$$,$$Structural connector$$,$$API$$,$$[]$$::jsonb,$$PENDING_CERTIFICATION$$,$$user-pr19$$);
  INSERT INTO "DeveloperClientRegistration" ("id","institutionId","clientKey","displayName","allowedActions","status","currentCredentialVersion","createdByUserId","createdByMandateId") VALUES
    ($$client-pr19$$,$$inst-pr19$$,$$treasury-integration$$,$$Structural client$$,$$["READ_RECEIPTS"]$$::jsonb,$$SHADOW_ONLY$$,2,$$user-pr19$$,$$mandate-pr19$$);
  INSERT INTO "DeveloperCredentialVersion" ("id","developerClientId","version","credentialVaultRef","credentialFingerprint","status","reason","createdByUserId","createdByMandateId","stepUpEvidenceId","effectiveAt","expiresAt","supersededAt") VALUES
    ($$cred-pr19-v1$$,$$client-pr19$$,1,$$vault-kv-v2://secret/assurerail/clients/v1#credential$$,$$sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$$,$$SUPERSEDED$$,$$Initial fixture$$,$$user-pr19$$,$$mandate-pr19$$,$$step-pr19-v1$$,now()-interval $$2 days$$,now()+interval $$1 day$$,now()-interval $$1 day$$),
    ($$cred-pr19-v2$$,$$client-pr19$$,2,$$vault-kv-v2://secret/assurerail/clients/v2#credential$$,$$sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb$$,$$ACTIVE_SHADOW$$,$$Rotation fixture$$,$$user-pr19$$,$$mandate-pr19$$,$$step-pr19-v2$$,now()-interval $$1 day$$,now()+interval $$2 days$$,NULL);
  INSERT INTO "DeveloperConformanceRun" ("id","institutionId","connectorRegistrationId","fixtureSetVersion","schemaProfileRef","result","assertions","inputDigest","resultDigest","sandboxNonEvidence","createdByUserId","createdByMandateId","stepUpEvidenceId") VALUES
    ($$conf-pr19$$,$$inst-pr19$$,$$conn-pr19$$,$$1.0.0$$,$$assurerail.neutral-intake-envelope@1.0.0$$,$$PASSED_SOFTWARE$$,$$[]$$::jsonb,$$sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc$$,$$sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd$$,true,$$user-pr19$$,$$mandate-pr19$$,$$step-pr19-conf$$);
  INSERT INTO "IntegrationExitExport" ("id","institutionId","exportVersion","scope","recordCounts","manifestDigest","requestedByUserId","requestedByMandateId","stepUpEvidenceId") VALUES
    ($$exit-pr19$$,$$inst-pr19$$,$$1.0.0$$,$${"secretsExcluded":true}$$::jsonb,$${"clients":1,"credentials":2}$$::jsonb,$$sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$$,$$user-pr19$$,$$mandate-pr19$$,$$step-pr19-exit$$);
  DO $x$ BEGIN
    BEGIN INSERT INTO "DeveloperCredentialVersion" SELECT * FROM "DeveloperCredentialVersion" WHERE id=$$cred-pr19-v2$$; RAISE EXCEPTION $$duplicate credential accepted$$; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN DELETE FROM "DeveloperClientRegistration" WHERE id=$$client-pr19$$; RAISE EXCEPTION $$restrictive history delete accepted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END $x$;' >/dev/null

echo "[PR19-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *DeveloperClient*|*DeveloperCredential*|*DeveloperConformance*|*IntegrationExit*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "DeveloperClientRegistration")||$$|$$||(SELECT count(*) FROM "DeveloperCredentialVersion")||$$|$$||(SELECT count(*) FROM "DeveloperConformanceRun")||$$|$$||(SELECT count(*) FROM "IntegrationExitExport");')"
[[ "$rows" == "1|2|1|1" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[PR19-DB] PASS client=1 credentials=2 software-conformance=1 exit-manifest=1 restore=1|2|1|1 external-certification=none"
