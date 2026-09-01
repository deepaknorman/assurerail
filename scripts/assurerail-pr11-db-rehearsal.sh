#!/usr/bin/env bash
# PR-11 disposable Postgres evidence for tokenised-DA linkage, observe-only actions and reconciliation.
# It never reads a configured DATABASE_URL and never connects to a non-disposable database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-pr11.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((65000 + ($$ % 400)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_pr11_fresh"
RESTORE_DB="assurerail_pr11_restore"

case "$TEST_ROOT" in */assurerail-pr11.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore node npm npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-pr11.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[PR11-DB] compile service rehearsal"
(cd "$RAIL_DIR"; npm run build >/dev/null)

echo "[PR11-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
model_count="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('TokenRepresentation','TokenAction','TokenReconciliationSnapshot','TokenReconciliationBreak');")"
[[ "$model_count" == "4" ]] || { echo "expected 4 PR-11 models, found $model_count" >&2; exit 1; }

echo "[PR11-DB] governed linkage, instruction observation, idempotency and reconciliation"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" node dist/token-representation/token-representation-db-rehearsal.js)

echo "[PR11-DB] relational restrictions and mirror invariant"
mirror="$(psql_db "$FRESH_DB" -Atc 'SELECT "authorityMode" || $$|$$ || "representationType" FROM "TokenRepresentation" LIMIT 1;')"
[[ "$mirror" == "MIRROR|TOKENISED" ]] || { echo "unexpected representation authority: $mirror" >&2; exit 1; }
psql_db "$FRESH_DB" -c '
  DO $rehearsal$ BEGIN
    BEGIN DELETE FROM "Note" WHERE id=$$pr11_note$$; RAISE EXCEPTION $$linked Note unexpectedly deleted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN UPDATE "TokenRepresentation" SET "transactionCaseId"=$$missing_case$$ WHERE "noteId"=$$pr11_note$$; RAISE EXCEPTION $$invalid case link unexpectedly accepted$$; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END $rehearsal$;' >/dev/null

echo "[PR11-DB] schema parity, backup and restore"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in
  *'TokenRepresentation'*|*'TokenAction'*|*'TokenReconciliationSnapshot'*|*'TokenReconciliationBreak'*)
    echo "PR-11 schema drift detected:" >&2; echo "$schema_diff" >&2; exit 1 ;;
esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT (SELECT count(*) FROM "TokenRepresentation") || $$|$$ || (SELECT count(*) FROM "TokenAction") || $$|$$ || (SELECT count(*) FROM "TokenReconciliationSnapshot") || $$|$$ || (SELECT count(*) FROM "TokenReconciliationBreak");')"
[[ "$restored" == "1|1|3|1" ]] || { echo "restore count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[PR11-DB] PASS models=4 mirror=explicit actions=observe-only idempotency=verified reconciliation=match+break+unresolved-break-persistence restore=1|1|3|1"
