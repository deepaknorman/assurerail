#!/usr/bin/env bash
# Local security control path. --quick is used by pre-push; --release makes every core scanner and
# advisory service mandatory. Optional depth scanners remain supplemental and never create a false
# green when absent.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MODE="${1:---full}"
case "$MODE" in
  --quick|--full|--release) ;;
  *) echo "usage: $0 [--quick|--full|--release]" >&2; exit 2 ;;
esac
cd "$ROOT"
mkdir -p .security-output
# Keep scanner state inside the ignored repository output directory. SSL_CERT_FILE also avoids a
# Homebrew Semgrep/macOS trust-store regression while retaining normal certificate verification.
export SEMGREP_LOG_FILE="$ROOT/.security-output/semgrep.log"
export SEMGREP_SETTINGS_FILE="$ROOT/.security-output/semgrep-settings.yml"
export SEMGREP_SEND_METRICS=off
export SEMGREP_ENABLE_VERSION_CHECK=0
if [[ -z "${SSL_CERT_FILE:-}" && -f /etc/ssl/cert.pem ]]; then export SSL_CERT_FILE=/etc/ssl/cert.pem; fi

require_tool() {
  command -v "$1" >/dev/null 2>&1 || { echo "SECURITY FAIL: required tool missing: $1" >&2; exit 1; }
}
require_tool gitleaks
require_tool semgrep

echo "[SECURITY] gitleaks"
if [[ "$MODE" == "--quick" && -n "${ARAIL_GIT_RANGE:-}" ]]; then
  gitleaks git --no-banner --redact --config .gitleaks.toml --log-opts="$ARAIL_GIT_RANGE"
else
  gitleaks git --no-banner --redact --config .gitleaks.toml
fi

echo "[SECURITY] semgrep"
semgrep scan --config .security/semgrep-assurerail.yml --metrics off \
  --exclude node_modules --exclude dist --exclude .next --exclude .security-output \
  --error apps/assurerail/src apps/assurerail-api/src scripts

if [[ "$MODE" == "--quick" ]]; then
  echo "AssureRail quick security gate PASS."
  exit 0
fi

require_tool trivy
echo "[SECURITY] npm advisory ratchet"
node scripts/assurerail-sec01-dependency-audit.mjs

echo "[SECURITY] Trivy dependency scan"
trivy fs --scanners vuln --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 --quiet .

echo "[SECURITY] Trivy IaC/configuration scan"
if [[ "$MODE" == "--release" ]]; then
  trivy config --severity HIGH,CRITICAL --exit-code 1 --quiet .
else
  trivy config --severity HIGH,CRITICAL --exit-code 0 --quiet .
fi

echo "[SECURITY] CycloneDX SBOM"
trivy fs --format cyclonedx --output .security-output/sbom.cdx.json --quiet .
test -s .security-output/sbom.cdx.json

echo "[SECURITY] optional depth scanners"
if command -v grype >/dev/null 2>&1; then grype sbom:.security-output/sbom.cdx.json -q --fail-on never || echo "OPEN optional: grype could not complete"; else echo "OPEN optional: grype"; fi
if command -v osv-scanner >/dev/null 2>&1; then osv-scanner scan --lockfile=package-lock.json || echo "REVIEW optional: osv-scanner reported findings or could not complete"; else echo "OPEN optional: osv-scanner"; fi
if command -v checkov >/dev/null 2>&1 && [[ -d deploy ]]; then checkov -d deploy --compact --quiet --soft-fail; else echo "OPEN optional: checkov"; fi
if command -v njsscan >/dev/null 2>&1; then njsscan apps/assurerail-api/src apps/assurerail/src >/dev/null; else echo "OPEN optional: njsscan"; fi

echo "AssureRail security gate PASS mode=$MODE."
