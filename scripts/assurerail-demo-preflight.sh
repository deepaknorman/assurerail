#!/usr/bin/env bash
# AR-DEMO-01 local/source verification and optional remote smoke. This proves presentation
# availability and access boundaries only. It does not test or close any external evidence gate.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
MODE="${1:---source}"

fail() {
  echo "[AR-DEMO-01] FAIL: $1" >&2
  exit 1
}

status_code() {
  curl --silent --show-error --output "$2" --write-out "%{http_code}" "$1"
}

case "$MODE" in
  --source)
    cd "$REPO_ROOT"
    npm run demo:check
    npm run check:cx01-sim01 --workspace=@assurerail/web
    echo "[AR-DEMO-01] PASS source-boundaries=true external-effects=not-tested"
    ;;
  --remote)
    : "${ASSURERAIL_DEMO_WEB_URL:?Set ASSURERAIL_DEMO_WEB_URL without a trailing slash}"
    : "${ASSURERAIL_DEMO_API_URL:?Set ASSURERAIL_DEMO_API_URL without a trailing slash}"
    : "${ASSURERAIL_DEMO_USERNAME:?Set ASSURERAIL_DEMO_USERNAME}"
    : "${ASSURERAIL_DEMO_PASSWORD:?Set ASSURERAIL_DEMO_PASSWORD}"

    BODY="$(mktemp)"
    trap 'rm -f "$BODY"' EXIT

    CODE="$(status_code "${ASSURERAIL_DEMO_API_URL}/healthz" "$BODY")"
    [[ "$CODE" == "200" ]] || fail "API /healthz returned $CODE"
    CODE="$(status_code "${ASSURERAIL_DEMO_API_URL}/readyz" "$BODY")"
    [[ "$CODE" == "200" ]] || fail "API /readyz returned $CODE"
    CODE="$(status_code "${ASSURERAIL_DEMO_WEB_URL}/login" "$BODY")"
    [[ "$CODE" == "200" ]] || fail "web /login returned $CODE"
    CODE="$(status_code "${ASSURERAIL_DEMO_WEB_URL}/sandbox" "$BODY")"
    [[ "$CODE" == "401" ]] || fail "unauthenticated /sandbox returned $CODE instead of 401"

    CODE="$(curl --silent --show-error --user "${ASSURERAIL_DEMO_USERNAME}:${ASSURERAIL_DEMO_PASSWORD}" --output "$BODY" --write-out "%{http_code}" "${ASSURERAIL_DEMO_WEB_URL}/sandbox")"
    [[ "$CODE" == "200" ]] || fail "authenticated /sandbox returned $CODE"
    grep -q "One governed transaction record" "$BODY" || fail "full-system fixture marker missing"
    grep -q "SYNTHETIC" "$BODY" || fail "synthetic boundary marker missing"

    echo "[AR-DEMO-01] PASS remote-showcase=true access-gate=true api-ready=true external-effects=not-tested"
    ;;
  *)
    echo "usage: $0 [--source|--remote]" >&2
    exit 2
    ;;
esac
