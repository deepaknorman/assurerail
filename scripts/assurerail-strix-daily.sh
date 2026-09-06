#!/usr/bin/env bash
# AssureRail Strix daily — timeboxed, budget-capped independent scan of an isolated source snapshot:
# API, web, Prisma and deployment configuration. Threat focus includes settlement integrity,
# tenant/RBAC isolation, evidence reconciliation, client exposure, secrets and SSRF. Missing
# CLI/key/Docker ⇒ explicit SKIP + exit 3 (a NON-RUN, never
# a pass — the runner renders it ⚠ SKIP; exit 0 here would hide a scan that never ran). A produced
# finding exits 4 (REVIEW), so it is neither hidden as PASS nor confused with a broken scan. Secrets
# are supplied directly or through a mode-600 standalone Rail secret file, never by AssureLocker.
set -u
REPO="${ARAIL_REPO_ROOT:-$(git rev-parse --show-toplevel)}"
TARGET="${1:-${ARAIL_SHADOW_ROOT:-${REPO}-shadow}}"
STRIX_BIN="${ARAIL_STRIX_BIN:-${HOME}/.venvs/strix/bin/strix}"
RUNS_DIR="${ARAIL_STRIX_RUNS_DIR:-$REPO/docs/qa/daily/arail/strix-runs}"
mkdir -p "$RUNS_DIR"

if [ ! -x "$STRIX_BIN" ]; then
  echo "SKIP: strix CLI not installed (expected $STRIX_BIN — python3.12 -m venv ~/.venvs/strix && ~/.venvs/strix/bin/pip install strix-agent)"; exit 3
fi
if ! docker info >/dev/null 2>&1; then
  echo "SKIP: Docker not running (strix sandboxes each target in a container)"; exit 3
fi
KEY="${LLM_API_KEY:-}"
if [ -z "$KEY" ] && [ -n "${ARAIL_STRIX_SECRET_FILE:-}" ]; then
  if [ ! -f "$ARAIL_STRIX_SECRET_FILE" ]; then echo "SKIP: ARAIL_STRIX_SECRET_FILE is not a regular file"; exit 3; fi
  MODE=$(stat -f '%Lp' "$ARAIL_STRIX_SECRET_FILE" 2>/dev/null || stat -c '%a' "$ARAIL_STRIX_SECRET_FILE" 2>/dev/null || echo unknown)
  if [ "$MODE" != "600" ]; then echo "SKIP: ARAIL_STRIX_SECRET_FILE must have mode 600 (received $MODE)"; exit 3; fi
  KEY=$(grep -E '^LLM_API_KEY=' "$ARAIL_STRIX_SECRET_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
if [ -z "$KEY" ]; then echo "SKIP: set LLM_API_KEY or a mode-600 ARAIL_STRIX_SECRET_FILE"; exit 3; fi

export LLM_API_KEY="$KEY"
export STRIX_LLM="${STRIX_MODEL:-openai/gpt-4o-mini}"
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$RUNS_DIR/strix-$RUN_ID.log"
MARKER="$RUNS_DIR/.run-$RUN_ID"

# Build a source-only snapshot: scanning the checkout root makes Strix stream node_modules/dist,
# while scanning only the API omits the customer UI and deployment boundary. Preserve repository
# relative paths in the snapshot so every finding remains reproducible.
if [ ! -d "$TARGET/apps/assurerail-api/src" ] || [ ! -d "$TARGET/apps/assurerail/src" ]; then
  echo "SKIP: standalone AssureRail source surfaces not found under $TARGET"; exit 3
fi
SCAN_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/assurerail-strix.XXXXXX")
cleanup() { rm -rf "$SCAN_ROOT"; rm -f "$MARKER"; }
trap cleanup EXIT
touch "$MARKER"
for relative in apps/assurerail-api/src apps/assurerail-api/prisma apps/assurerail/src deploy; do
  mkdir -p "$SCAN_ROOT/$(dirname "$relative")"
  cp -R "$TARGET/$relative" "$SCAN_ROOT/$relative"
done
for relative in docker-compose.assurerail.yml package.json package-lock.json; do
  cp "$TARGET/$relative" "$SCAN_ROOT/$relative"
done
SCAN_TARGET="$SCAN_ROOT"
echo "arail strix scan → ${SCAN_TARGET} · mode=${STRIX_SCAN_MODE:-quick} · model=$STRIX_LLM · budget=\$${STRIX_BUDGET_USD:-4}"
cd "$RUNS_DIR" || exit 1
TIMEOUT_BIN="$(command -v gtimeout || command -v timeout || true)"
INSTR="Whitebox source audit of the standalone NestJS AssureRail DA/PTC transaction infrastructure. Prioritise: (1) settlement-saga and token-adapter atomicity, idempotency, oversell, lost updates, negative balances and unit conservation; (2) institution/case/mandate/RBAC tenant isolation and object-level authorisation; (3) evidence/tape digest and authoritative-record reconciliation bypasses; (4) CORS, authentication, step-up and break-glass exposure; (5) secrets, object-store and webhook handling; (6) SSRF or unvalidated provider URLs. Report ONLY concrete, reproducible findings with file:line, exploit path and fix."
STRIX_ARGS=(
  --target "$SCAN_TARGET"
  --non-interactive
  --scan-mode "${STRIX_SCAN_MODE:-quick}"
  --max-budget-usd "${STRIX_BUDGET_USD:-4}"
  --instruction "$INSTR"
)
if [ -n "$TIMEOUT_BIN" ]; then "$TIMEOUT_BIN" 3000 "$STRIX_BIN" "${STRIX_ARGS[@]}" >"$OUT" 2>&1; RC=$?
else "$STRIX_BIN" "${STRIX_ARGS[@]}" >"$OUT" 2>&1; RC=$?; fi

grep -iE "Vulnerabilities|No exploitable|Cost \\\$" "$OUT" | tail -3
REPORT_MD=$(find "$RUNS_DIR/strix_runs" -type f -name penetration_test_report.md -newer "$MARKER" -print 2>/dev/null | head -1)
SARIF=$(find "$RUNS_DIR/strix_runs" -type f -name findings.sarif -newer "$MARKER" -print 2>/dev/null | head -1)
N=0
if [ -n "$SARIF" ]; then N=$(grep -c '"ruleId"' "$SARIF" 2>/dev/null || true); N=${N:-0}; fi
if [ -n "$REPORT_MD" ]; then echo "--- arail strix report ($REPORT_MD) ---"; grep -iE "severity|title|CWE|^#{1,3} |recommend" "$REPORT_MD" | head -40; fi

# No SARIF plus no timebox means a broken harness leg. Findings are REVIEW and must be reproduced and
# triaged by a human; an incomplete timeboxed run is SKIP/REVIEW, never PASS.
if [ -z "$SARIF" ] && [ "$RC" -ne 124 ]; then
  echo "arail strix FAILED to run rc=$RC (no artifacts produced) — tail:"; tail -n 12 "$OUT"; exit 1
fi
if [ "$RC" -eq 124 ]; then
  echo "arail strix TIMEBOX reached — incomplete scan (${N} flagged so far); this is not a pass"
  [ "$N" -gt 0 ] && exit 4
  exit 3
fi
if [ "$N" -gt 0 ]; then
  echo "⚠ ARAIL STRIX flagged ${N} potential finding(s) — HUMAN TRIAGE NEEDED (quick LLM scan; validate before acting). SARIF: $SARIF"
  exit 4
else
  echo "arail strix: 0 vulnerabilities detected"
fi
exit 0
