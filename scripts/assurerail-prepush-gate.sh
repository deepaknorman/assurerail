#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
updates=()
while read -r local_ref local_sha remote_ref remote_sha; do
  [[ -n "${local_ref:-}" ]] || continue
  [[ "$local_sha" == 0000000000000000000000000000000000000000 ]] && continue
  if [[ "$remote_sha" == 0000000000000000000000000000000000000000 ]]; then
    updates+=("$local_sha")
  else
    updates+=("${remote_sha}..${local_sha}")
  fi
done

cd "$ROOT"
git diff --check
node scripts/check-assurerail-format.mjs
node scripts/check-assurerail-invariants.mjs
for check in pub00 public-growth public-exposure content-freshness; do
  npm run "check:${check}" --workspace=@assurerail/web
done

if (( ${#updates[@]} )); then
  for range in "${updates[@]}"; do
    ARAIL_GIT_RANGE="$range" bash scripts/assurerail-security-scan-local.sh --quick
  done
else
  bash scripts/assurerail-security-scan-local.sh --quick
fi
echo "AssureRail pre-push gate PASS. The full pre-deployment gate still remains mandatory."
