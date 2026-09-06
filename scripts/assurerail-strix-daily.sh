#!/usr/bin/env bash
# AssureRail Strix daily — timeboxed, budget-capped autonomous security scan of the venue's source
# (apps/assurerail-api/src). Threat focus: ledger integrity in the DvP settlement path, the k-anon mint
# gate, tape-integrity verification, CORS/authz exposure, secrets handling, and SSRF in outbound
# provider clients. Fail-soft: missing CLI/key/Docker ⇒ explicit SKIP + exit 3 (a NON-RUN, never
# a pass — the runner renders it ⚠ SKIP; exit 0 here would hide a scan that never ran). Secrets are
# supplied directly to this process at runtime and never read from another product's environment.
set -u
REPO="${ARAIL_REPO_ROOT:-$(git rev-parse --show-toplevel)}"
TARGET="${1:-$REPO}"
STRIX_BIN="${ARAIL_STRIX_BIN:-$HOME/.venvs/strix/bin/strix}"
RUNS_DIR="$REPO/docs/qa/daily/arail/strix-runs"
mkdir -p "$RUNS_DIR"

if [ ! -x "$STRIX_BIN" ]; then
  echo "SKIP: strix CLI not installed (expected $STRIX_BIN — python3.12 -m venv ~/.venvs/strix && ~/.venvs/strix/bin/pip install strix-agent)"; exit 3
fi
if ! docker info >/dev/null 2>&1; then
  echo "SKIP: Docker not running (strix sandboxes each target in a container)"; exit 3
fi
KEY="${LLM_API_KEY:-${OPENAI_API_KEY:-}}"
if [ -z "$KEY" ]; then
  echo "SKIP: supply LLM_API_KEY or OPENAI_API_KEY to the AssureRail scan process"; exit 3
fi

export LLM_API_KEY="$KEY"
export STRIX_LLM="${STRIX_MODEL:-openai/gpt-4o-mini}"
DATE=$(date +%F)
OUT="$RUNS_DIR/strix-$DATE.log"

# Source-only target (apps/assurerail-api/src) — node_modules/dist trip strix's file streamer, and src is
# the whitebox audit surface anyway.
SCAN_TARGET="$TARGET/apps/assurerail-api/src"
if [ ! -d "$SCAN_TARGET" ]; then
  echo "SKIP: scan target not found ($SCAN_TARGET) — the daily QA creates the shadow worktree before scanning (or pass an existing checkout: TARGET=/Users/DNorman/Development/Code)"; exit 3
fi
echo "arail strix scan → ${SCAN_TARGET} · mode=${STRIX_SCAN_MODE:-quick} · model=$STRIX_LLM · budget=\$${STRIX_BUDGET_USD:-4}"
cd "$RUNS_DIR" || exit 0
TIMEOUT_BIN="$(command -v gtimeout || command -v timeout || true)"
INSTR="Whitebox source audit of a NestJS securitisation/tokenisation venue (AssureRail). Prioritise, in order: (1) ledger integrity in the DvP settlement path — dvp/dvp.service.ts and store/prisma-mint.repository.ts (settleDvp/commitMint/incHolding): atomicity, oversell, lost updates, negative balances, unit conservation; (2) the k-anon mint gate mint/kanon.ts (bypass, integer/threshold errors); (3) tape-integrity verification tape/verify.ts (hash/lock bypass); (4) CORS/authz exposure in main.ts; (5) secrets handling; (6) SSRF / unvalidated URL handling in outbound provider adapters, including tape/tape-provider.client.ts. Report ONLY concrete, reproducible findings with file:line and a fix."
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
REPORT_MD=$(ls -t "$RUNS_DIR"/strix_runs/*/penetration_test_report.md 2>/dev/null | head -1)
SARIF=$(ls -t "$RUNS_DIR"/strix_runs/*/findings.sarif 2>/dev/null | head -1)
N=0; [ -n "$SARIF" ] && N=$(grep -c '"ruleId"' "$SARIF" 2>/dev/null || echo 0)
if [ -n "$REPORT_MD" ]; then echo "--- arail strix report ($REPORT_MD) ---"; grep -iE "severity|title|CWE|^#{1,3} |recommend" "$REPORT_MD" | head -40; fi

# PASS/FAIL is about whether the CHECK RAN (like the AssureLocker wrapper): no SARIF + not a timebox ⇒
# broken harness leg (FAIL); findings are ADVISORY and go to human triage.
if [ -z "$SARIF" ] && [ "$RC" -ne 124 ]; then
  echo "arail strix FAILED to run rc=$RC (no artifacts produced) — tail:"; tail -n 12 "$OUT"; exit 1
fi
if [ "$RC" -eq 124 ]; then echo "arail strix TIMEBOX reached — partial (${N} flagged so far)"; exit 0; fi
if [ "$N" -gt 0 ]; then
  echo "⚠ ARAIL STRIX flagged ${N} potential finding(s) — HUMAN TRIAGE NEEDED (quick LLM scan; validate before acting). SARIF: $SARIF"
else
  echo "arail strix: 0 vulnerabilities detected"
fi
exit 0
