#!/usr/bin/env bash
# Strict PRE-deployment gate. This script intentionally contains no migrate, restart, push or deploy
# operation. A passing result authorises only a separate, two-person deployment procedure.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MODE="${1:---code}"
case "$MODE" in
  --list|--code|--release) ;;
  *) echo "usage: $0 [--list|--code|--release]" >&2; exit 2 ;;
esac

stages=(
  "source-integrity"
  "effective-environment"
  "reproducible-install"
  "security-and-sbom"
  "azure-baseline"
  "complete-code-and-db-rehearsal"
  "public-private-browser-boundary"
  "container-definition-and-images"
  "external-evidence-gates"
  "evidence-receipt"
)
if [[ "$MODE" == "--list" ]]; then printf '%s\n' "${stages[@]}"; exit 0; fi

cd "$ROOT"
run() { echo "[PREDEPLOY] $1"; shift; "$@"; }
require_file() { [[ -n "$1" && -s "$1" ]] || { echo "PREDEPLOY FAIL: missing/empty $2: ${1:-UNSET}" >&2; exit 1; }; }

HEAD_SHA="$(git rev-parse HEAD)"
[[ -z "$(git status --porcelain)" ]] || { echo "PREDEPLOY FAIL: checkout contains tracked or untracked changes" >&2; exit 1; }
run "source-integrity: clean tracked tree" git diff --exit-code
run "source-integrity: clean index" git diff --cached --exit-code
run "source-integrity: signed release commit" git verify-commit HEAD

if [[ "$MODE" == "--release" ]]; then
  [[ -n "${ARAIL_RELEASE_TAG:-}" ]] || { echo "PREDEPLOY FAIL: ARAIL_RELEASE_TAG is required" >&2; exit 1; }
  [[ "$(git rev-list -n 1 "$ARAIL_RELEASE_TAG")" == "$HEAD_SHA" ]] || { echo "PREDEPLOY FAIL: release tag does not resolve to HEAD" >&2; exit 1; }
  run "source-integrity: signed annotated release tag" git verify-tag "$ARAIL_RELEASE_TAG"
  ARAIL_EXPECTED_COMMIT="$HEAD_SHA" run "effective deployment environment" node scripts/check-assurerail-release-env.mjs
fi

run "reproducible dependency install" npm ci
security_mode=--full
[[ "$MODE" == "--release" ]] && security_mode=--release
run "security scans and SBOM" bash scripts/assurerail-security-scan-local.sh "$security_mode"
run "Azure India target baseline" node scripts/check-assurerail-azure-baseline.mjs
run "complete code, boundary and disposable DB rehearsal" bash scripts/assurerail-integrated-release-check.sh --full
if [[ "$MODE" == "--release" ]]; then
  ARAIL_EXPECTED_COMMIT="$HEAD_SHA" ARAIL_RUNTIME_PROFILE_CHECK=yes \
    run "compiled runtime validation of effective environment" node scripts/check-assurerail-release-env.mjs
fi
run "local public/private/browser boundary" bash scripts/assurerail-public-release-check.sh

require_file apps/assurerail-api/dist/main.js "API artifact"
require_file apps/assurerail/.next/standalone/apps/assurerail/server.js "web standalone artifact"
require_file apps/assurerail/.next/BUILD_ID "web build identifier"

compose=(docker compose -f docker-compose.assurerail.yml)
if [[ "$MODE" == "--release" ]]; then compose+=(--env-file "$ARAIL_DEPLOY_ENV_FILE"); fi
run "compose definition" "${compose[@]}" config --quiet
API_IMAGE_ID=NOT_BUILT_CODE_CHECK
WEB_IMAGE_ID=NOT_BUILT_CODE_CHECK
if [[ "$MODE" == "--release" ]]; then
  run "exact effective-environment image build" "${compose[@]}" build assurerail-api assurerail-web
  API_IMAGE_ID="$("${compose[@]}" images -q assurerail-api)"
  WEB_IMAGE_ID="$("${compose[@]}" images -q assurerail-web)"
  [[ -n "$API_IMAGE_ID" && -n "$WEB_IMAGE_ID" ]] || { echo "PREDEPLOY FAIL: built image IDs are missing" >&2; exit 1; }
  run "API image vulnerability scan" trivy image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 --quiet "$API_IMAGE_ID"
  run "web image vulnerability scan" trivy image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 --quiet "$WEB_IMAGE_ID"
fi

deployment_class="${ARAIL_DEPLOYMENT_CLASS:-DEMO}"
case "$deployment_class" in
  DEMO|REPLAY)
    echo "OPEN external evidence: authenticated E2E/DAST and VAPT are not required for this isolated non-live class, and remain unpassed."
    ;;
  SHADOW|SANDBOX)
    require_file "${ARAIL_E2E_EVIDENCE:-}" "authenticated two-tenant E2E evidence"
    require_file "${ARAIL_DAST_EVIDENCE:-}" "authenticated DAST evidence"
    ;;
  CONTROLLED_LIVE|PRODUCTION)
    require_file "${ARAIL_E2E_EVIDENCE:-}" "authenticated two-tenant E2E evidence"
    require_file "${ARAIL_DAST_EVIDENCE:-}" "authenticated DAST evidence"
    require_file "${ARAIL_VAPT_EVIDENCE:-}" "independent VAPT closure evidence"
    require_file "${ARAIL_PRODUCTION_ACCEPTANCE_EVIDENCE:-}" "signed production acceptance evidence"
    ;;
  *) echo "PREDEPLOY FAIL: unsupported ARAIL_DEPLOYMENT_CLASS=$deployment_class" >&2; exit 1 ;;
esac

mkdir -p .release-evidence
receipt=".release-evidence/predeploy-${HEAD_SHA}.txt"
{
  echo "schema=assurerail-predeploy-v1"
  echo "commit=$HEAD_SHA"
  echo "tag=${ARAIL_RELEASE_TAG:-UNSET_CODE_CHECK}"
  echo "deployment_class=$deployment_class"
  echo "completed_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "result=PASS"
  echo "deployment_performed=false"
  echo "api_image_id=$API_IMAGE_ID"
  echo "web_image_id=$WEB_IMAGE_ID"
  shasum -a 256 package-lock.json .security-output/sbom.cdx.json apps/assurerail/.next/BUILD_ID
} >"$receipt"
chmod 600 "$receipt"
echo "[PREDEPLOY] PASS receipt=$receipt deployment=not-performed"
