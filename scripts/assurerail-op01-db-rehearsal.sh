#!/usr/bin/env bash
# OP-01a disposable Postgres migration/restore evidence for the internal staff RBAC control plane.
# It never reads DATABASE_URL and never connects to a configured/deployed database.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RAIL_DIR="$REPO_ROOT/apps/assurerail-api"
MIGRATIONS_DIR="$RAIL_DIR/prisma/migrations"
OP01_MIGRATION="20260901100000_assurerail_op01_internal_rbac"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/assurerail-op01.XXXXXX")"
PG_DATA="$TEST_ROOT/postgres"
PG_SOCKET="$TEST_ROOT/socket"
PG_LOG="$TEST_ROOT/postgres.log"
PG_PORT="$((62000 + ($$ % 1000)))"
PG_USER="$(id -un)"
FRESH_DB="assurerail_op01_fresh"
UPGRADE_DB="assurerail_op01_upgrade"
RESTORE_DB="assurerail_op01_restore"

case "$TEST_ROOT" in */assurerail-op01.*) ;; *) echo "refusing unsafe scratch path: $TEST_ROOT" >&2; exit 1 ;; esac
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore npx; do
  command -v "$command_name" >/dev/null || { echo "missing required command: $command_name" >&2; exit 1; }
done
cleanup() {
  if [[ -f "$PG_DATA/postmaster.pid" ]]; then pg_ctl -D "$PG_DATA" -m fast -w stop >/dev/null 2>&1 || true; fi
  case "$TEST_ROOT" in */assurerail-op01.*) rm -rf -- "$TEST_ROOT" ;; esac
}
trap cleanup EXIT INT TERM
mkdir -p "$PG_SOCKET"
initdb -D "$PG_DATA" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$PG_DATA" -l "$PG_LOG" -o "-F -h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET" -w start >/dev/null
db_url() { printf 'postgresql://%s@127.0.0.1:%s/%s' "$PG_USER" "$PG_PORT" "$1"; }
psql_db() { local database="$1"; shift; psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$database" "$@"; }

echo "[OP01-DB] fresh migration deploy"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$FRESH_DB"
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$FRESH_DB")" npx prisma migrate deploy --schema=prisma/schema.prisma)
models="$(psql_db "$FRESH_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('InternalRoleAssignment','PrivilegedAccessRequest','InternalAccessEvent');")"
[[ "$models" == "3" ]] || { echo "expected 3 OP-01 models, found $models" >&2; exit 1; }

echo "[OP01-DB] scoped assignment/elevation receipts and restrictive history"
psql_db "$FRESH_DB" -c "
  INSERT INTO \"VenueUser\" (\"id\",\"email\",\"createdAt\",\"updatedAt\") VALUES
    ('staff-maker','maker@example.invalid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
    ('staff-reviewer','reviewer@example.invalid',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"InternalRoleAssignment\" (\"id\",\"userId\",\"role\",\"scopeType\",\"scopeRef\",\"scopeKey\",\"status\",\"version\",\"reason\",\"proposalDigest\",\"proposedByUserId\",\"approvedByUserId\",\"approvalReason\",\"effectiveAt\",\"expiresAt\",\"createdAt\",\"updatedAt\") VALUES
    ('ira-1','staff-maker','SYSADMIN','ENVIRONMENT','prod-in','ENVIRONMENT:prod-in','ACTIVE',1,'on-call rotation','sha256:1111111111111111111111111111111111111111111111111111111111111111','staff-reviewer','staff-maker','dual-control fixture',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '90 days',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"PrivilegedAccessRequest\" (\"id\",\"userId\",\"requestedPermission\",\"scopeType\",\"scopeRef\",\"scopeKey\",\"status\",\"reason\",\"ticketRef\",\"riskClass\",\"requestedByUserId\",\"approvedByUserId\",\"approvalReason\",\"startsAt\",\"expiresAt\",\"createdAt\",\"updatedAt\") VALUES
    ('par-1','staff-maker','SUPPORT_DIAGNOSTIC_VIEW','SUPPORT_TICKET','ticket-1','SUPPORT_TICKET:ticket-1','ACTIVE','provider incident triage','INC-1','HIGH','staff-maker','staff-reviewer','bounded approval',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '2 hours',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO \"InternalAccessEvent\" (\"id\",\"userId\",\"internalRoleAssignmentId\",\"privilegedAccessRequestId\",\"eventType\",\"permission\",\"scopeType\",\"scopeRef\",\"requestId\",\"reason\",\"payloadDigest\",\"occurredAt\") VALUES
    ('iae-1','staff-maker','ira-1','par-1','PRIVILEGED_ACCESS_USED','SUPPORT_DIAGNOSTIC_VIEW','SUPPORT_TICKET','ticket-1','request-1','diagnostic read','sha256:2222222222222222222222222222222222222222222222222222222222222222',CURRENT_TIMESTAMP);
  DO \$rehearsal\$ BEGIN
    BEGIN INSERT INTO \"InternalRoleAssignment\" (\"id\",\"userId\",\"role\",\"scopeType\",\"scopeRef\",\"scopeKey\",\"status\",\"version\",\"reason\",\"proposalDigest\",\"proposedByUserId\",\"createdAt\",\"updatedAt\") VALUES ('ira-dup','staff-maker','SYSADMIN','ENVIRONMENT','prod-in','ENVIRONMENT:prod-in','PROPOSED',1,'duplicate scope','sha256:3333333333333333333333333333333333333333333333333333333333333333','staff-reviewer',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP); RAISE EXCEPTION 'assignment scope version unexpectedly duplicated'; EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN DELETE FROM \"InternalRoleAssignment\" WHERE \"id\"='ira-1'; RAISE EXCEPTION 'assignment with event unexpectedly deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    BEGIN DELETE FROM \"PrivilegedAccessRequest\" WHERE \"id\"='par-1'; RAISE EXCEPTION 'elevation with event unexpectedly deleted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END \$rehearsal\$;" >/dev/null

echo "[OP01-DB] additive upgrade retains existing venue users"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$UPGRADE_DB"
while IFS= read -r migration_file; do psql_db "$UPGRADE_DB" -f "$migration_file" >/dev/null; done < <(find "$MIGRATIONS_DIR" -mindepth 2 -maxdepth 2 -name migration.sql ! -path "*/$OP01_MIGRATION/*" | sort)
psql_db "$UPGRADE_DB" -c "INSERT INTO \"VenueUser\" (\"id\",\"email\",\"platformRole\",\"isAdmin\",\"createdAt\",\"updatedAt\") VALUES ('legacy-admin','legacy-admin@example.invalid','ADMIN',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);" >/dev/null
psql_db "$UPGRADE_DB" -f "$MIGRATIONS_DIR/$OP01_MIGRATION/migration.sql" >/dev/null
retained="$(psql_db "$UPGRADE_DB" -Atc "SELECT \"platformRole\" FROM \"VenueUser\" WHERE id='legacy-admin';")"
[[ "$retained" == "ADMIN" ]] || { echo "legacy bootstrap user changed during OP-01 migration: $retained" >&2; exit 1; }

echo "[OP01-DB] backup/restore and migration ledger"
schema_diff="$(cd "$RAIL_DIR"; npx prisma migrate diff --from-url="$(db_url "$FRESH_DB")" --to-schema-datamodel=prisma/schema.prisma)"
case "$schema_diff" in
  *InternalRoleAssignment*|*PrivilegedAccessRequest*|*InternalAccessEvent*)
    echo "OP-01 schema drift detected:" >&2
    echo "$schema_diff" >&2
    exit 1
    ;;
esac
pg_dump -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$FRESH_DB" --format=custom --file="$TEST_ROOT/fresh.dump"
createdb -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" "$RESTORE_DB"
pg_restore -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -d "$RESTORE_DB" --exit-on-error "$TEST_ROOT/fresh.dump"
restored="$(psql_db "$RESTORE_DB" -Atc 'SELECT count(*) FROM "InternalAccessEvent";')"
[[ "$restored" == "1" ]] || { echo "restore internal-access-event count mismatch: $restored" >&2; exit 1; }
(cd "$RAIL_DIR"; DATABASE_URL="$(db_url "$RESTORE_DB")" npx prisma migrate status --schema=prisma/schema.prisma)
echo "[OP01-DB] PASS models=3 scoped-assignment=unique receipts=restrictive legacy=retained restore=1-event"
