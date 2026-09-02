#!/usr/bin/env bash
# AR-27 disposable conventional-secondary product rehearsal. Synthetic fixtures prove software
# behaviour only and cannot close counsel, participant, trustee, recordkeeper or live evidence gates.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-ar27.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"; PG_SOCKET="$TEST_ROOT/socket"; PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65500 + ($$ % 20)))"; PG_USER="$(id -un)"
FRESH_DB="assurerail_ar27_fresh"; RESTORE_DB="assurerail_ar27_restore"
case "$TEST_ROOT" in */assurerail-ar27.*) ;; *) echo "unsafe scratch path" >&2; exit 1 ;; esac
for item in initdb pg_ctl createdb psql pg_dump pg_restore npx node; do command -v "$item" >/dev/null || { echo "missing $item" >&2; exit 1; }; done
cleanup() { if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi; case "$TEST_ROOT" in */assurerail-ar27.*) rm -rf -- "$TEST_ROOT" ;; esac; }
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"; initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[AR27-DB] compile product service rehearsal"
(cd "$RAIL_DIR"; npx prisma generate --schema=prisma/schema.prisma >/dev/null; npx tsc)
echo "[AR27-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
echo "[AR27-DB] maker-checker append-only repair and evidence-pack service rehearsal"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" node dist/secondary-transfer/secondary-product-db-rehearsal.js)
echo "[AR27-DB] restrictive history, schema parity, backup and restore"
psql_db "$FRESH_DB" -c 'DO $x$ BEGIN BEGIN DELETE FROM "SecondaryTransferBreak" WHERE id=$$ar27_break$$; RAISE EXCEPTION $$break history delete accepted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END; END $x$;' >/dev/null
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in *SecondaryTransferRepair*) echo "$schema_diff" >&2; exit 1 ;; esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" -Fc -f "$TEST_ROOT/db.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/db.dump"
rows="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "SecondaryTransferRepair")||$$|$$||(SELECT count(*) FROM "SecondaryTransferEvidence" WHERE "secondaryTransferId"=$$ar27_transfer$$)||$$|$$||(SELECT count(*) FROM "AuditLog" WHERE event IN ($$rail.secondary_transfer.repair_proposed$$,$$rail.secondary_transfer.repair_reviewed$$,$$rail.secondary_transfer.evidence_snapshot_accessed$$));')"
[[ "$rows" == "1|3|3" ]] || { echo "restore mismatch: $rows" >&2; exit 1; }
echo "[AR27-DB] PASS repair|evidence|audit=$rows restrictive=verified restore=verified external-evidence=none"
