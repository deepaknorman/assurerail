#!/usr/bin/env bash
# Read-only post-deployment smoke verification. It does not mutate state or activate features.
set -euo pipefail

API_URL="${ARAIL_POSTDEPLOY_API_URL:-}"
WEB_URL="${ARAIL_POSTDEPLOY_WEB_URL:-}"
EXPECT_DARK="${ARAIL_POSTDEPLOY_EXPECT_DARK:-yes}"
[[ "$API_URL" =~ ^https://[^/]+$ || ( "${ARAIL_POSTDEPLOY_ALLOW_LOCAL_HTTP:-no}" == yes && "$API_URL" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?$ ) ]] || { echo "invalid/missing ARAIL_POSTDEPLOY_API_URL" >&2; exit 1; }
[[ "$WEB_URL" =~ ^https://[^/]+$ || ( "${ARAIL_POSTDEPLOY_ALLOW_LOCAL_HTTP:-no}" == yes && "$WEB_URL" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?$ ) ]] || { echo "invalid/missing ARAIL_POSTDEPLOY_WEB_URL" >&2; exit 1; }
[[ "$EXPECT_DARK" == yes || "$EXPECT_DARK" == no ]] || { echo "ARAIL_POSTDEPLOY_EXPECT_DARK must be yes or no" >&2; exit 1; }

check() {
  local label="$1" url="$2" expected="${3:-200}" code
  code="$(curl --silent --show-error --location --output /dev/null --write-out '%{http_code}' --max-time 15 "$url")"
  [[ "$code" == "$expected" ]] || { echo "POSTDEPLOY FAIL $label: HTTP $code, expected $expected" >&2; exit 1; }
  echo "PASS $label: HTTP $code"
}

check "API liveness" "$API_URL/healthz"
check "API readiness" "$API_URL/readyz"
check "web home" "$WEB_URL/"
check "web login" "$WEB_URL/login"
if [[ "$EXPECT_DARK" == yes ]]; then
  for path in diligence sandbox internal admin workspace; do check "dark protected route /$path" "$WEB_URL/$path" 404; done
else
  echo "OPEN activation-specific smoke: protected-route expectations come from the signed activation manifest and authenticated E2E evidence."
fi
echo "AssureRail post-deployment read-only smoke PASS. Authenticated E2E/DAST and environment evidence remain separate gates."
