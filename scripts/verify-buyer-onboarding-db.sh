#!/usr/bin/env bash
# Applies the complete Rail SQL migration chain to a disposable loopback PostgreSQL instance.
set -euo pipefail
export PATH="/usr/local/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
buyer_repo="$(cd "$(dirname "$0")/.." && pwd)"
buyer_scratch="$(mktemp -d "${TMPDIR:-/tmp}/buyer-onboarding-test.XXXXXX")"
buyer_port="$((62000 + ($$ % 1000)))"
buyer_user="$(id -un)"
cleanup(){ if [[ -f "$buyer_scratch/data/postmaster.pid" ]]; then pg_ctl -D "$buyer_scratch/data" -m fast -w stop >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT INT TERM
mkdir "$buyer_scratch/socket"
initdb -D "$buyer_scratch/data" --auth=trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$buyer_scratch/data" -l "$buyer_scratch/postgres.log" -o "-F -h 127.0.0.1 -p $buyer_port -k $buyer_scratch/socket" -w start >/dev/null
createdb -h 127.0.0.1 -p "$buyer_port" -U "$buyer_user" buyer_onboarding_test
export BUYER_ONBOARDING_TEST_URL="postgresql://$buyer_user@127.0.0.1:$buyer_port/buyer_onboarding_test"
for buyer_migration in "$buyer_repo"/apps/assurerail-api/prisma/migrations/*/migration.sql; do
 psql "$BUYER_ONBOARDING_TEST_URL" -X -q -v ON_ERROR_STOP=1 -f "$buyer_migration" >>"$buyer_scratch/migrations.log" 2>&1 || { tail -30 "$buyer_scratch/migrations.log"; exit 1; }
done
node "$buyer_repo/scripts/verify-buyer-onboarding-db.cjs"
pg_dump "$BUYER_ONBOARDING_TEST_URL" -Fc -f "$buyer_scratch/backup.dump"
createdb -h 127.0.0.1 -p "$buyer_port" -U "$buyer_user" buyer_onboarding_restore
pg_restore -h 127.0.0.1 -p "$buyer_port" -U "$buyer_user" -d buyer_onboarding_restore --exit-on-error "$buyer_scratch/backup.dump"
buyer_counts="$(psql "postgresql://$buyer_user@127.0.0.1:$buyer_port/buyer_onboarding_restore" -X -Atc 'SELECT count(*) FROM "BuyerRequirementsProfile"')"
[[ "$buyer_counts" == "2" ]] || { echo "profile restore mismatch"; exit 1; }
echo "PASS: complete migration chain and restore; evidence directory $buyer_scratch"
