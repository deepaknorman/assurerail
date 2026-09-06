# AssureRail pre-deployment and release gate

**Status:** operative standalone-repository control, 7 September 2026

**Deployment authority:** separate; this gate never deploys

**Automation model:** local Git hooks, daily shadow QA and a deployer-run release gate; GitHub
Actions are deliberately not used

## Control objective

No AssureRail migration, image promotion, feature activation or application restart may begin until
the exact signed release has completed every applicable pre-deployment check. A check that cannot
run is not a pass. External evidence that does not exist remains an open gate.

This improves the AssureLocker pattern by moving the applicable build, security, browser and
configuration checks ahead of deployment mutation. Runtime-only checks remain in a separate,
read-only post-deployment verifier and cannot retroactively make a failed pre-deployment gate green.

## AssureLocker-to-AssureRail control map

| AssureLocker control | AssureRail implementation | Release treatment |
|---|---|---|
| committed pre-push hook | `.githooks/pre-push` → `assurerail-prepush-gate.sh` | blocks secrets, focused SAST, architecture and public-boundary failures |
| developer security bootstrap | `assurerail-dev-setup.sh` | requires Git, Node/npm, gitleaks, Semgrep, Trivy and Docker; reports depth tools separately |
| gitleaks | full Git-history scan using `.gitleaks.toml` | blocking |
| Semgrep | repository-local Rail rules; no registry/network dependency | blocking |
| npm audit ratchet | existing exact SEC-01 production-dependency baseline | blocking; advisory-service outage is failure, not pass |
| Trivy dependency/IaC | filesystem vulnerabilities plus Docker/compose/configuration | high/critical blocking for release |
| SBOM | CycloneDX generated from the release tree | required and hashed into receipt |
| Grype, OSV, Checkov, njsscan | depth scanners run when installed | supplemental/report-first, explicitly shown as OPEN when absent |
| source/build/unit checks | cumulative PR-01–AR-30 integrated check and 366-test API corpus | blocking |
| format/lint hygiene | repository-wide LF/final-newline/trailing-space/conflict-marker/JSON check, shell syntax, TypeScript compilation | blocking; `.editorconfig` defines editor defaults |
| migration safety | all disposable PostgreSQL rehearsals PR-02–AR-30 | blocking before any real migration |
| public claims/content gate | CX/PUB/SIM/inbound/growth/exposure/freshness checks | blocking |
| role/private boundary checks | diligence and private-UI contract suites plus built-asset leak scan | blocking |
| browser/mobile/link/JSON-LD | loopback standalone build in Chromium, installed Chrome and WebKit, desktop/mobile | blocking |
| Lighthouse | local loopback artifact; thresholds 85/95/90/95 | required only for deliberate public release (`ARAIL_PUBLIC_RELEASE=yes`) |
| Azure/config baseline | Hyderabad-primary/Pune-recovery SEC-01 machine contract | blocking; target validation is not proof of deployment |
| container verification | Compose parse, API/web image builds and Trivy image scans | blocking in release mode |
| production environment invariants | private effective-env parser plus application startup/runtime tests | blocking; values and secrets are never printed |
| signed source | signed HEAD and signed annotated release tag resolving exactly to HEAD | blocking |
| live health/404 crawl | `assurerail-postdeploy-verify.sh` | read-only after deployment; cannot replace pre-deployment checks |
| OpenAPI drift | no committed standalone Rail OpenAPI contract exists yet | explicitly not applicable; becomes blocking when a canonical spec is introduced |
| AssureLocker plane/co-lending/SMTP/algorithm checks | product-specific, absent from the standalone Rail boundary | not applicable, not copied as meaningless green checks |

## Fresh-clone setup

```bash
npm ci
bash scripts/assurerail-dev-setup.sh --check
```

`npm ci` wires `core.hooksPath=.githooks`. `--check` does not install software. On a controlled Mac
developer host, `--install` installs the Homebrew/Python scanner set and then verifies it. Docker must
be installed separately and running for a release gate. Chromium and WebKit must be installed with
`npx playwright install chromium webkit`; an independently installed Chrome channel is also required.

## Daily shadow QA and independent Strix

The standalone workflow is `scripts/assurerail-daily-qa.sh`. In a marked, isolated shadow worktree it
fetches `origin/main` without mutating the operator checkout, performs a no-egress API build, tests,
architecture and format checks, the full local
security/SBOM scan, then invokes the independent Strix white-box scan. Results distinguish:

- `PASS`: the check ran and met its gate;
- `FAIL`: the check or harness failed;
- `SKIP`: a prerequisite such as Docker, Strix or its private key was absent; and
- `REVIEW`: Strix produced potential findings requiring human reproduction and triage.

Neither `SKIP` nor `REVIEW` yields a green daily run. Strix receives a standalone Rail key through
`LLM_API_KEY` or a mode-600 file named by `ARAIL_STRIX_SECRET_FILE`; it never reads an AssureLocker
environment file.

On macOS, after installing Strix and creating that private file, install the committed daily 02:15
launchd schedule with:

```bash
ARAIL_STRIX_SECRET_FILE=<absolute-mode-600-file> \
bash scripts/install-assurerail-daily-qa-launchd.sh
```

The template is `scripts/launchd/com.assurerail.daily-qa.plist.template`. Linux operators should
schedule the same daily-QA script through the controlled systemd/cron service account; do not place
the LLM key in a crontab or tracked file.

## Fast developer and pre-push controls

```bash
npm run check:prepush
```

An ordinary `git push` invokes the same fast control automatically and scans the outgoing range when
Git supplies it. This is not the release gate and does not authorise a deployment.

## Strict release invocation

1. Merge through the protected `main` branch.
2. Create and push an annotated, signed release tag at the exact commit. Configure Git's SSH
   `allowedSignersFile` on the release host so both commit and tag verification are meaningful.
3. Copy `deploy/examples/assurerail-demo.env.example` outside the repository, insert the exact commit
   SHA and reproduce the effective deployment settings. Keep it mode `600`; use the actual values,
   not desired-state guesses.
4. Run:

```bash
export ARAIL_RELEASE_TAG=<signed-annotated-tag>
export ARAIL_DEPLOYMENT_CLASS=DEMO
export ARAIL_DEPLOY_ENV_FILE=<absolute-private-effective-env-file>
npm run check:predeploy
```

For `SHADOW` or `SANDBOX`, also supply non-empty authenticated two-tenant E2E and DAST evidence
files. `CONTROLLED_LIVE` and `PRODUCTION` additionally require independent VAPT closure and signed
production-acceptance evidence. The files are existence gates here; their human approval, scope,
build identity and finding closure must be checked under the SEC-01/VAPT runbooks.

The receipt is written under `.release-evidence/` and is intentionally ignored by Git. Preserve it
in the restricted release evidence store. A receipt states `deployment_performed=false`.

## Deployer sequence after a pass

The two-person deploy process starts only after the receipt is reviewed:

1. verify the checkout, tag, receipt and effective environment are unchanged;
2. take the required backup/restore point and record the migration high-water mark;
3. run the schema migration once as an explicit release job;
4. promote the already checked image digests and restart according to the environment runbook;
5. keep every capability at the approved value—deployment never implies activation;
6. run the read-only post-deployment verifier; and
7. for shadow or higher, run the authorised authenticated E2E/DAST or attach the exact current-build
   evidence required by the operating-mode gate.

Example read-only smoke invocation:

```bash
ARAIL_POSTDEPLOY_API_URL=https://api.example \
ARAIL_POSTDEPLOY_WEB_URL=https://app.example \
npm run check:postdeploy
```

The default verifier expects the current all-dark deployment. For an approved shadow activation set
`ARAIL_POSTDEPLOY_EXPECT_DARK=no`; the signed activation manifest and authenticated E2E suite then
own the capability-specific route expectations.

## Fail-closed rules

- Do not use `--no-verify` for a release unless the founder records an explicit exception and the
  deployer still runs the full pre-deployment gate independently.
- Do not treat an optional scanner's absence, an unavailable advisory service, a missing browser,
  a skipped database rehearsal or an external evidence placeholder as a pass.
- Do not put credentials in the effective-env example or commit release evidence.
- Do not switch a capability flag as part of an ordinary code deployment. Activation uses the
  signed activation-manifest, authority and external-evidence process already implemented in Rail.
- Do not describe Azure target-baseline validation as evidence that Azure resources exist.
