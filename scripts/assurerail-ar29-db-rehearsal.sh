#!/usr/bin/env bash
# AR-29 disposable enterprise-integration governance rehearsal. Synthetic evidence proves software
# behaviour only; it cannot certify a provider or close customer, counsel or production gates.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"; RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-ar29.XXXXXX")"; PG_DATA="$TEST_ROOT/postgres"; PG_SOCKET="$TEST_ROOT/socket"; PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65500 + ($$ % 20)))"; PG_USER="$(id -un)"; FRESH_DB="assurerail_ar29_fresh"; RESTORE_DB="assurerail_ar29_restore"
case "$TEST_ROOT" in */assurerail-ar29.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx node; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() { if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi; case "$TEST_ROOT" in */assurerail-ar29.*) rm -rf -- "$TEST_ROOT" ;; esac; }
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"; initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null; pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }
echo "[AR29-DB] compile and deploy all migrations from zero"; (cd "$RAIL_DIR"; npx prisma generate --schema=prisma/schema.prisma >/dev/null; npx tsc)
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"; (cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
echo "[AR29-DB] gated profile, external evidence, currentness, maker-checker and case-binding rehearsal"; (cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" node dist/enterprise-integration/enterprise-integration-db-rehearsal.js)
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"; case "$schema_diff" in *EnterpriseIntegration*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"; createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"; pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "EnterpriseIntegrationProfile")||$$|$$||(SELECT count(*) FROM "EnterpriseIntegrationGate")||$$|$$||(SELECT count(*) FROM "EnterpriseCaseIntegrationBinding")||$$|$$||(SELECT count(*) FROM "EnterpriseIntegrationHealthObservation");')"; [[ "$rows" == "1|9|1|1" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[AR29-DB] PASS profile|gates|binding|health=$rows schema-parity=verified restore=verified external-evidence=synthetic-only"
