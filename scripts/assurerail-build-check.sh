#!/usr/bin/env bash
# AssureRail per-build gate — the venue's "check a bunch of things on every build (incl. security)".
# HARD-fails on build/test/invariant/schema regressions; SOFT (non-blocking) on optional local tools
# (sandbox-exec, gitleaks) so it runs anywhere without another repository.
#
#   usage:  ./scripts/assurerail-build-check.sh
#   env:    ARAIL_CHECK_SKIP_WEB=1   skip the (slower) apps/assurerail next build
#
# Wired into: the venue's `npm run check`, the deploy rebuild, and the daily shadow QA.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
NO_EGRESS='(version 1)(allow default)(deny network*)'
FAIL=0
red(){ printf "\033[31m%s\033[0m\n" "$1"; }; grn(){ printf "\033[32m%s\033[0m\n" "$1"; }; ylw(){ printf "\033[33m%s\033[0m\n" "$1"; }
step(){ local n="$1"; shift; printf "\n\033[1m── %s ──\033[0m\n" "$n"; if "$@"; then grn "  ✓ $n"; else red "  ✗ $n"; FAIL=1; fi; }
soft(){ local n="$1"; shift; printf "\n\033[1m── %s ──\033[0m\n" "$n"; if "$@"; then grn "  ✓ $n"; else ylw "  ⚠ $n (non-blocking)"; fi; }

# 1. shell syntax on all venue/CI scripts
step "shell syntax (bash -n)" bash -c 'rc=0; for f in "'"$ROOT"'"/scripts/assurerail-*.sh; do [ -f "$f" ] && { bash -n "$f" || rc=1; }; done; exit $rc'

# 2. prisma schema is valid (dummy DATABASE_URL — validation checks structure, not a live DB, and the
#    gate runs from repo root without the venue's .env)
step "prisma validate (venue schema)" bash -c 'cd "'"$ROOT"'/apps/assurerail-api" && DATABASE_URL="postgresql://validate:validate@localhost:5432/validate" npm exec -- prisma validate --schema prisma/schema.prisma'

# 3. static invariants — security / segregation / ledger atomicity
step "AssureRail invariants" node scripts/check-assurerail-invariants.mjs

# 4. venue API build — NO-EGRESS when sandbox-exec is available (build-time phone-home = a finding)
if command -v sandbox-exec >/dev/null 2>&1; then
  step "NO-EGRESS build — venue api" sandbox-exec -p "$NO_EGRESS" bash -c "cd '$ROOT/apps/assurerail-api' && npm run build"
else
  step "build — venue api" bash -c "cd '$ROOT/apps/assurerail-api' && npm run build"
fi

# 5. venue unit tests
step "venue unit tests" bash -c "cd '$ROOT/apps/assurerail-api' && npm test"

# 6. standalone web build
if [ "${ARAIL_CHECK_SKIP_WEB:-0}" = "1" ]; then
  ylw "── build — venue web (apps/assurerail) ──"; ylw "  ⚠ skipped (ARAIL_CHECK_SKIP_WEB=1)"
else
  step "build — venue web (apps/assurerail)" bash -c "cd '$ROOT/apps/assurerail' && (npx next build --no-lint 2>/dev/null || npx next build)"
fi

# 7. repository-local secret scan when gitleaks is installed.
if command -v gitleaks >/dev/null 2>&1; then
  soft "secret scan (gitleaks)" gitleaks git --no-banner --redact
else
  ylw "── secret scan ──"; ylw "  ⚠ gitleaks not installed — skipped"
fi

echo
[ "$FAIL" = 0 ] && { grn "✓ AssureRail build-check clean"; exit 0; } || { red "✗ AssureRail build-check FAILED"; exit 1; }
