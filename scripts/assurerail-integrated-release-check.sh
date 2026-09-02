#!/usr/bin/env bash
# Cumulative AssureRail verification from PR-01 through the current productisation stage.
# `--full` additionally runs every disposable PostgreSQL migration/service/restore rehearsal.
# The script proves software behaviour only; it cannot close counsel, customer, trustee, provider,
# VAPT, historic-transaction, controlled-live or production-acceptance gates.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
MODE="${1:---code}"
case "$MODE" in
  --code|--full) ;;
  *) echo "usage: $0 [--code|--full]" >&2; exit 2 ;;
esac

run() {
  local label="$1"
  shift
  echo "[ARAIL-INTEGRATED] $label"
  "$@"
}

cd "$REPO_ROOT"
run "shell syntax" bash -c 'for file in scripts/assurerail-*.sh; do bash -n "$file"; done'
run "scoped diff hygiene" git diff --check -- apps/assurerail-api apps/assurerail scripts/check-assurerail-invariants.mjs scripts/assurerail-integrated-release-check.sh 'scripts/assurerail-*.sh' docker-compose.assurerail.yml
run "static architecture and safety invariants" node scripts/check-assurerail-invariants.mjs
run "API compile and complete test corpus" npm test --workspace=@code/assurerail-api

for check in pr18 ar21 ar22 ar23 ar24 ar25 ar26 ar27 ar28 ar29; do
  run "web boundary check $check" npm run "check:$check" --workspace=@code/assurerail
done
run "web production build" npm run build --workspace=@code/assurerail

if [[ "$MODE" == "--full" ]]; then
  rehearsals=(
    scripts/assurerail-pr02-db-rehearsal.sh
    scripts/assurerail-pr03-db-rehearsal.sh
    scripts/assurerail-pr05-db-rehearsal.sh
    scripts/assurerail-pr06-db-rehearsal.sh
    scripts/assurerail-pr07-db-rehearsal.sh
    scripts/assurerail-pr08-db-rehearsal.sh
    scripts/assurerail-pr09-db-rehearsal.sh
    scripts/assurerail-op01-db-rehearsal.sh
    scripts/assurerail-pr10-db-rehearsal.sh
    scripts/assurerail-pr11-db-rehearsal.sh
    scripts/assurerail-pr12-db-rehearsal.sh
    scripts/assurerail-pr13-db-rehearsal.sh
    scripts/assurerail-pr14-db-rehearsal.sh
    scripts/assurerail-pr15-db-rehearsal.sh
    scripts/assurerail-pr16-db-rehearsal.sh
    scripts/assurerail-pr17-db-rehearsal.sh
    scripts/assurerail-pr19-db-rehearsal.sh
    scripts/assurerail-pr20-db-rehearsal.sh
    scripts/assurerail-ar22-db-rehearsal.sh
    scripts/assurerail-ar25-db-rehearsal.sh
    scripts/assurerail-ar26-db-rehearsal.sh
    scripts/assurerail-ar27-db-rehearsal.sh
    scripts/assurerail-ar29-db-rehearsal.sh
  )
  for rehearsal in "${rehearsals[@]}"; do run "database rehearsal $rehearsal" bash "$rehearsal"; done
fi

echo "[ARAIL-INTEGRATED] PASS mode=$MODE external-evidence=not-tested external-gates=remain-open deployment=not-performed"
