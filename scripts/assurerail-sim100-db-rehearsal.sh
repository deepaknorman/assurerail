#!/usr/bin/env bash
# SIM-100 disposable Postgres gate. It never reads a configured DATABASE_URL and cannot target a
# shared database: the compiled driver also independently enforces loopback + database-name prefix.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-sim100.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((62000 + ($$ % 1000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_sim100_fresh"
RESTORE_DB="assurerail_sim100_restore"
REPORT="$TEST_ROOT/simulation-report.json"

case "$TEST_ROOT" in */assurerail-sim100.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore node npm npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-sim100.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }

echo "[SIM-100-DB] compile and migrate isolated database"
(cd "$RAIL_DIR"; npm run build >/dev/null)
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma >/dev/null)

echo "[SIM-100-DB] execute 200 persisted multi-party scenarios"
(cd "$RAIL_DIR"; \
  DATABASE_URL="$(db_url "$FRESH_DB")" \
  ARAIL_DISPOSABLE_SIMULATION_DATABASE="SIM100_ONLY" \
  ARAIL_SIM_PHASE="run" \
  ARAIL_SIM_REPORT_PATH="$REPORT" \
  node dist/simulation/multi-party-simulation-db-rehearsal.js)
test -s "$REPORT"

echo "[SIM-100-DB] restart database with a pending instruction and mid-flight observe-only saga"
pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
(cd "$RAIL_DIR"; \
  DATABASE_URL="$(db_url "$FRESH_DB")" \
  ARAIL_DISPOSABLE_SIMULATION_DATABASE="SIM100_ONLY" \
  ARAIL_SIM_PHASE="verify" \
  node dist/simulation/multi-party-simulation-db-rehearsal.js)

echo "[SIM-100-DB] backup, restore and reverify persisted controls"
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/sim100.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/sim100.dump"
(cd "$RAIL_DIR"; \
  DATABASE_URL="$(db_url "$RESTORE_DB")" \
  ARAIL_DISPOSABLE_SIMULATION_DATABASE="SIM100_ONLY" \
  ARAIL_SIM_PHASE="verify" \
  node dist/simulation/multi-party-simulation-db-rehearsal.js)
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma >/dev/null)

echo "[SIM-100-DB] PASS scenarios=200 parties=800 persisted-intakes=19 recovered-intake=verified mid-saga-restart=verified restore=verified external-evidence=not-tested"
