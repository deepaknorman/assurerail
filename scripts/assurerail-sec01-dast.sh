#!/usr/bin/env bash
set -euo pipefail

# Authenticated AssureRail DAST: run the SEC-01 role/tenant Playwright suite through a local ZAP
# proxy, then report on the observed authenticated web/API traffic. Active attack is separately
# gated and may be used only against an authorised, disposable synthetic pre-production target.

die() {
  echo "SEC-01 DAST preflight FAILED: $*" >&2
  echo "No scan was executed; the DAST evidence gate remains OPEN." >&2
  exit 1
}

[[ "${ARAIL_DAST_AUTHORISED:-}" == "yes" ]] || die "ARAIL_DAST_AUTHORISED=yes is required"
[[ "${ARAIL_DAST_DATA_CLASSIFICATION:-}" == "SYNTHETIC_ONLY" ]] || die "a dedicated SYNTHETIC_ONLY target is required"
[[ -n "${ARAIL_DAST_ALLOWED_HOSTS:-}" ]] || die "ARAIL_DAST_ALLOWED_HOSTS is required"
[[ -n "${ARAIL_DAST_OUTPUT_DIR:-}" ]] || die "ARAIL_DAST_OUTPUT_DIR is required"
[[ -n "${ARAIL_ZAP_IMAGE:-}" ]] || die "ARAIL_ZAP_IMAGE must be an approved ZAP image pinned by sha256 digest"
[[ -d "${ARAIL_DAST_OUTPUT_DIR}" && "${ARAIL_DAST_OUTPUT_DIR}" = /* ]] || die "output directory must be an existing absolute path"

case "${ARAIL_ZAP_IMAGE}" in
  *@sha256:????????????????????????????????????????????????????????????????) ;;
  *) die "ARAIL_ZAP_IMAGE must be pinned as registry/image@sha256:<64 lowercase hex characters>" ;;
esac
[[ "${ARAIL_ZAP_IMAGE##*@sha256:}" =~ ^[0-9a-f]{64}$ ]] || die "ARAIL_ZAP_IMAGE digest is malformed"

command -v docker >/dev/null 2>&1 || die "Docker is required"
command -v curl >/dev/null 2>&1 || die "curl is required"
command -v openssl >/dev/null 2>&1 || die "openssl is required"

node scripts/assurerail-sec01-e2e-preflight.mjs

web_host="$(node -e 'process.stdout.write(new URL(process.argv[1]).hostname)' "${ARAIL_E2E_WEB_URL}")"
api_host="$(node -e 'process.stdout.write(new URL(process.argv[1]).hostname)' "${ARAIL_E2E_API_URL}")"
IFS=',' read -r -a allowed_hosts <<< "${ARAIL_DAST_ALLOWED_HOSTS}"
for target_host in "${web_host}" "${api_host}"; do
  allowed=0
  for host in "${allowed_hosts[@]}"; do
    [[ "${target_host}" == "${host}" ]] && allowed=1
  done
  [[ "${allowed}" == "1" ]] || die "${target_host} is not in ARAIL_DAST_ALLOWED_HOSTS"
done

mode="${ARAIL_DAST_MODE:-passive}"
case "${mode}" in
  passive) ;;
  active)
    [[ "${ARAIL_DAST_ACTIVE_CONFIRMED:-}" == "yes" ]] || die "active mode requires ARAIL_DAST_ACTIVE_CONFIRMED=yes"
    [[ -n "${ARAIL_DAST_CHANGE_WINDOW_ID:-}" ]] || die "active mode requires ARAIL_DAST_CHANGE_WINDOW_ID"
    [[ -n "${ARAIL_DAST_ROLLBACK_OWNER:-}" ]] || die "active mode requires ARAIL_DAST_ROLLBACK_OWNER"
    ;;
  *) die "ARAIL_DAST_MODE must be passive or active" ;;
esac

zap_port="${ARAIL_DAST_ZAP_PORT:-18090}"
[[ "${zap_port}" =~ ^[0-9]+$ && "${zap_port}" -ge 1024 && "${zap_port}" -le 65535 ]] || die "ARAIL_DAST_ZAP_PORT must be 1024-65535"

run_id="$(date -u +%Y%m%dT%H%M%SZ)"
report_dir="${ARAIL_DAST_OUTPUT_DIR}/${run_id}-${mode}"
mkdir -m 700 "${report_dir}"
container_name="assurerail-sec01-zap-${run_id}"
zap_key="$(openssl rand -hex 24)"

cleanup() {
  if [[ -n "${container_name:-}" && "${container_name}" == assurerail-sec01-zap-* ]]; then
    docker rm -f "${container_name}" >/dev/null 2>&1 || true
  fi
  unset zap_key
}
trap cleanup EXIT

docker run --detach --rm \
  --name "${container_name}" \
  --publish "127.0.0.1:${zap_port}:8080" \
  --volume "${report_dir}:/zap/wrk:rw" \
  "${ARAIL_ZAP_IMAGE}" \
  zap.sh -daemon -host 0.0.0.0 -port 8080 \
  -config api.disablekey=false \
  -config "api.key=${zap_key}" \
  -config api.addrs.addr.name='.*' \
  -config api.addrs.addr.regex=true >/dev/null

ready=0
for _ in $(seq 1 60); do
  if curl --silent --fail "http://127.0.0.1:${zap_port}/JSON/core/view/version/?apikey=${zap_key}" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
[[ "${ready}" == "1" ]] || die "ZAP did not become ready within 60 seconds"

context_json="$(curl --silent --fail --get "http://127.0.0.1:${zap_port}/JSON/context/action/newContext/" \
  --data-urlencode "apikey=${zap_key}" --data-urlencode 'contextName=assurerail-sec01')"
context_id="$(node -e 'const v=JSON.parse(process.argv[1]); if(!v.contextId) process.exit(2); process.stdout.write(String(v.contextId))' "${context_json}")" \
  || die "ZAP context creation failed"
[[ "${context_id}" =~ ^[0-9]+$ ]] || die "ZAP returned an invalid context identifier"

for origin in "${ARAIL_E2E_WEB_URL}" "${ARAIL_E2E_API_URL}"; do
  include_regex="$(node -e 'const u=new URL(process.argv[1]); const e=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); process.stdout.write(`^${e(u.origin)}/.*`) ' "${origin}")"
  curl --silent --fail --get "http://127.0.0.1:${zap_port}/JSON/context/action/includeInContext/" \
    --data-urlencode "apikey=${zap_key}" \
    --data-urlencode 'contextName=assurerail-sec01' \
    --data-urlencode "regex=${include_regex}" >/dev/null
done

echo "Running the eight-role/two-tenant authenticated E2E suite through ZAP; reports: ${report_dir}"
ARAIL_E2E_PROXY_URL="http://127.0.0.1:${zap_port}" \
ARAIL_E2E_DAST_PROXY=yes \
npx playwright test --config=playwright.assurerail.config.ts

remaining=1
for _ in $(seq 1 120); do
  remaining="$(curl --silent --fail "http://127.0.0.1:${zap_port}/JSON/pscan/view/recordsToScan/?apikey=${zap_key}" \
    | node -e 'let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(s).recordsToScan)))')"
  [[ "${remaining}" == "0" ]] && break
  sleep 1
done
[[ "${remaining}" == "0" ]] || die "ZAP passive queue did not drain within 120 seconds"

if [[ "${mode}" == "active" ]]; then
  for origin in "${ARAIL_E2E_WEB_URL}" "${ARAIL_E2E_API_URL}"; do
    scan_json="$(curl --silent --fail --get "http://127.0.0.1:${zap_port}/JSON/ascan/action/scan/" \
      --data-urlencode "apikey=${zap_key}" \
      --data-urlencode "url=${origin}" \
      --data-urlencode 'recurse=true' \
      --data-urlencode 'inScopeOnly=true')"
    scan_id="$(node -e 'const v=JSON.parse(process.argv[1]); if(v.scan===undefined) process.exit(2); process.stdout.write(String(v.scan))' "${scan_json}")" \
      || die "ZAP active scan did not start"
    status=0
    for _ in $(seq 1 900); do
      status="$(curl --silent --fail "http://127.0.0.1:${zap_port}/JSON/ascan/view/status/?apikey=${zap_key}&scanId=${scan_id}" \
        | node -e 'let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>process.stdout.write(String(JSON.parse(s).status)))')"
      [[ "${status}" == "100" ]] && break
      sleep 1
    done
    [[ "${status}" == "100" ]] || die "ZAP active scan ${scan_id} did not finish within 15 minutes"
  done
fi

curl --silent --fail "http://127.0.0.1:${zap_port}/OTHER/core/other/htmlreport/?apikey=${zap_key}" > "${report_dir}/report.html"
curl --silent --fail "http://127.0.0.1:${zap_port}/OTHER/core/other/jsonreport/?apikey=${zap_key}" > "${report_dir}/report.json"
curl --silent --fail "http://127.0.0.1:${zap_port}/OTHER/core/other/xmlreport/?apikey=${zap_key}" > "${report_dir}/report.xml"

echo "SEC-01 authenticated ${mode} DAST completed. Reports are security-confidential; triage every alert before claiming a pass."
