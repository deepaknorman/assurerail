#!/usr/bin/env bash
# Local pre-deployment/public-release verification. It serves the already-built standalone web
# artifact on loopback only and performs no external mutation.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PORT="${ARAIL_PUBLIC_CHECK_PORT:-3317}"
BASE="http://127.0.0.1:${PORT}"
cd "$ROOT"
mkdir -p .security-output

for check in cx00 pub00 cx01-sim01 inbound01 public-growth public-exposure content-freshness diligence-access private-ui-access; do
  npm run "check:${check}" --workspace=@assurerail/web
done
npm run build --workspace=@assurerail/web
npm run check:built-public-exposure --workspace=@assurerail/web

server="$ROOT/apps/assurerail/.next/standalone/apps/assurerail/server.js"
test -f "$server"
(
  cd "$ROOT/apps/assurerail/.next/standalone"
  PORT="$PORT" HOSTNAME=127.0.0.1 NODE_ENV=production \
    ASSURERAIL_INBOUND_ENABLED=no ASSURERAIL_PRIVATE_UI_ENABLED=no ASSURERAIL_DILIGENCE_ENABLED=no \
    node apps/assurerail/server.js
) >"${TMPDIR:-/tmp}/assurerail-public-check.log" 2>&1 &
server_pid=$!
cleanup() { kill "$server_pid" >/dev/null 2>&1 || true; wait "$server_pid" >/dev/null 2>&1 || true; }
trap cleanup EXIT

ready=0
for _ in $(seq 1 60); do
  if curl --silent --fail "$BASE/" >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo "local public artifact did not become ready" >&2; exit 1; }

ARAIL_PUBLIC_BASE_URL="$BASE" npm run check:pub-release-browser --workspace=@assurerail/web

if [[ "${ARAIL_PUBLIC_RELEASE:-no}" == "yes" ]]; then
  command -v lighthouse >/dev/null 2>&1 || { echo "PUBLIC RELEASE FAIL: lighthouse is required" >&2; exit 1; }
  lighthouse "$BASE/" --quiet --chrome-flags='--headless=new --no-sandbox --disable-gpu' \
    --only-categories=performance,accessibility,best-practices,seo --output=json \
    --output-path=.security-output/lighthouse.json
  node scripts/check-assurerail-lighthouse.mjs .security-output/lighthouse.json
else
  echo "OPEN public-release-only: Lighthouse threshold gate (set ARAIL_PUBLIC_RELEASE=yes)."
fi
echo "AssureRail local public/browser gate PASS."
