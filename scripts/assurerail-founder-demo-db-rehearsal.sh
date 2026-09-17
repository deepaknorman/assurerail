#!/usr/bin/env bash
# Disposable database rehearsal for the founder Initial Assessment demo bootstrap. Synthetic only.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-founder-demo.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65500 + ($$ % 20)))"
PG_USER="$(id -un)"
DB_NAME="assurerail_founder_demo"
case "$TEST_ROOT" in */assurerail-founder-demo.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb npx; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-founder-demo.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$DB_NAME"
DATABASE_URL="postgresql://$PG_USER@127.0.0.1:$PG_PORT/$DB_NAME"
(cd "$RAIL_DIR"; DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy --schema=prisma/schema.prisma >/dev/null; npm run build >/dev/null; ASSURERAIL_DISPOSABLE_FOUNDER_DEMO_REHEARSAL=true DATABASE_URL="$DATABASE_URL" node dist/customer-operations/founder-demo-bootstrap.db-rehearsal.js)
