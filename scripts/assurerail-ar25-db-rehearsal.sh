#!/usr/bin/env bash
# AR-25 disposable lifecycle rehearsal. Synthetic fixtures are software evidence only.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-ar25.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65510 + ($$ % 10)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_ar25_fresh"
RESTORE_DB="assurerail_ar25_restore"
case "$TEST_ROOT" in */assurerail-ar25.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx node; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-ar25.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[AR25-DB] compile lifecycle service rehearsal"
(cd "$RAIL_DIR"; npx prisma generate --schema=prisma/schema.prisma >/dev/null; npx tsc)
echo "[AR25-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
echo "[AR25-DB] service idempotency, break, correction and reconciliation"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" node dist/lifecycle/lifecycle-db-rehearsal.js)
echo "[AR25-DB] restrictive history"
psql_db "$FRESH_DB" -c 'DO $x$ BEGIN BEGIN DELETE FROM "RailLifecycleEvent" WHERE id=(SELECT id FROM "RailLifecycleEvent" LIMIT 1); RAISE EXCEPTION $$event history delete accepted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END; END $x$;' >/dev/null
echo "[AR25-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *RailLifecycle*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "RailLifecyclePlan")||$$|$$||(SELECT count(*) FROM "RailLifecycleEvent")||$$|$$||(SELECT count(*) FROM "RailLifecycleBreak");')"
[[ "$rows" == "1|2|1" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[AR25-DB] PASS plan|events|breaks=$rows history=restrictive restore=verified external-evidence=none"
