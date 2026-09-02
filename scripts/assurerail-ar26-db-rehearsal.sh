#!/usr/bin/env bash
# AR-26 disposable primary-venue rehearsal. Synthetic fixtures are software evidence only.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-ar26.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"; PG_SOCKET="$TEST_ROOT/socket"; PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65520 + ($$ % 10)))"; PG_USER="$(id -un)"
FRESH_DB="assurerail_ar26_fresh"; RESTORE_DB="assurerail_ar26_restore"
case "$TEST_ROOT" in */assurerail-ar26.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx node; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() { if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi; case "$TEST_ROOT" in */assurerail-ar26.*) rm -rf -- "$TEST_ROOT" ;; esac; }
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"; initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[AR26-DB] compile primary-venue service rehearsal"
(cd "$RAIL_DIR"; npx prisma generate --schema=prisma/schema.prisma >/dev/null; npx tsc)
echo "[AR26-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
echo "[AR26-DB] accepted-allocation handoff, separate acceptance, retained access and minimised projection"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" node dist/commercial/commercial-product-db-rehearsal.js)
echo "[AR26-DB] restrictive history, schema parity, backup and restore"
psql_db "$FRESH_DB" -c 'DO $x$ BEGIN BEGIN DELETE FROM "CommercialAllocation" WHERE id=$$ar26_allocation$$; RAISE EXCEPTION $$allocation history delete accepted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END; END $x$;' >/dev/null
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *CommercialCaseHandoff*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "CommercialCaseHandoff")||$$|$$||(SELECT count(*) FROM "CaseParty")||$$|$$||(SELECT count(*) FROM "AuditLog" WHERE event=$$rail.commercial.case_handoff_prepared$$);')"
[[ "$rows" == "1|1|1" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[AR26-DB] PASS handoff|party|audit=$rows restrictive=verified restore=verified external-evidence=none"
