#!/usr/bin/env bash
# Install/check the local AssureRail verification harness. GitHub Actions are off by design.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MODE="${1:---check}"
case "$MODE" in
  --check|--install) ;;
  *) echo "usage: $0 [--check|--install]" >&2; exit 2 ;;
esac
cd "$ROOT"

required=(git node npm gitleaks trivy semgrep docker)
optional=(shellcheck grype osv-scanner checkov njsscan lighthouse)

if [[ "$MODE" == "--install" ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is required to install the native harness tools." >&2
    exit 1
  fi
  for tool in gitleaks trivy semgrep grype osv-scanner shellcheck; do
    command -v "$tool" >/dev/null 2>&1 || brew install "$tool"
  done
  if command -v pip3 >/dev/null 2>&1; then
    command -v checkov >/dev/null 2>&1 || pip3 install --user --break-system-packages checkov
    command -v njsscan >/dev/null 2>&1 || pip3 install --user --break-system-packages njsscan
  fi
  npx playwright install chromium webkit
fi

git config core.hooksPath .githooks
missing=0
for tool in "${required[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    echo "PASS required tool: $tool"
  else
    echo "FAIL required tool missing: $tool" >&2
    missing=1
  fi
done
for tool in "${optional[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    echo "PASS depth tool: $tool"
  else
    echo "OPEN optional depth tool: $tool"
  fi
done

node_major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
if (( node_major < 22 )); then
  echo "FAIL Node.js 22 or later is required" >&2
  missing=1
fi
[[ "$(git config core.hooksPath 2>/dev/null || true)" == ".githooks" ]] || missing=1

if node -e 'const fs=require("node:fs"); const {chromium,webkit}=require("playwright"); fs.accessSync(chromium.executablePath()); fs.accessSync(webkit.executablePath())' >/dev/null 2>&1; then
  echo "PASS required browser engines: Playwright Chromium and WebKit"
else
  echo "FAIL Playwright Chromium/WebKit missing; run: npx playwright install chromium webkit" >&2
  missing=1
fi

if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]] || command -v google-chrome >/dev/null 2>&1; then
  echo "PASS required independent Chromium channel: installed Chrome"
else
  echo "FAIL installed Chrome is required for the independent browser pass" >&2
  missing=1
fi

strix_bin="${ARAIL_STRIX_BIN:-${HOME}/.venvs/strix/bin/strix}"
if [[ -x "$strix_bin" ]]; then
  echo "PASS scheduled independent scanner: Strix"
else
  echo "OPEN daily scanner: Strix is not installed at $strix_bin (daily QA will exit SKIP, not green)"
fi

if (( missing )); then
  echo "AssureRail harness is incomplete." >&2
  exit 1
fi
echo "AssureRail local harness is ready; core.hooksPath=.githooks."
