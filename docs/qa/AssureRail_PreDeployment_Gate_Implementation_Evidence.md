# AssureRail pre-deployment gate implementation evidence

**Checked:** 7 September 2026

**Scope:** standalone AssureRail repository; control implementation and local verification only

**Deployment/activation:** not performed

## Result

The standalone repository now has a local-control release path equivalent in purpose to the
AssureLocker controls, with stricter pre-deployment ordering. GitHub Actions are not part of the
trust path. The deployer gate performs no migration, restart, push, deployment or capability
activation.

The checked architecture is separate at source and runtime-boundary level:

- standalone `@assurerail/api` and `@assurerail/web` packages;
- no executable `@code/*` or AssureLocker application-source import;
- Rail-owned Prisma client, 32 migrations and PostgreSQL data plane;
- Rail-specific containers, ports, environment contract, release signing and intended Azure
  workload identities; and
- provider communication through HTTP/contracts rather than shared source or cross-database keys.

This does not claim that all optional provider profiles have disappeared. The legacy Note slice
retains an optional AssurePool tape/surveillance adapter. SEP-01 subsequently replaced the
product-specific human-identity path with a deployment-selected, provider-neutral identity
assurance contract; DigiKYC is not a required or privileged Rail dependency.

## Controls implemented

| Control | Enforcement |
|---|---|
| Git/source integrity | clean checkout, signed HEAD and exact signed annotated release tag |
| Format/configuration | LF, final newline, trailing whitespace, conflict markers, JSON parsing, shell syntax and TypeScript builds |
| Secrets/SAST | full-history gitleaks plus blocking repository-local AssureRail Semgrep rules |
| Dependencies/IaC | exact npm-audit ratchet, Trivy high/critical dependency gate, release IaC gate and CycloneDX SBOM |
| Application/database | cumulative 377-test API corpus, web boundary suites and all 24 disposable database rehearsals through AR-30 |
| Browser/mobile | 13 public pages in Chromium, installed Chrome and WebKit at 1440×1000 and 375×812; accessibility, overflow, links, canonical and JSON-LD assertions |
| Public/private boundary | built-client leak scan; controlled routes remain 404 and inbound remains unavailable while disabled |
| Environment | private absolute mode-600 file, exact commit, explicit flags/adapters, no demo/live masquerade and compiled runtime-profile validation |
| Container handoff | versioned image names, explicit runtime-variable handoff and no hidden migration in restart command |
| Daily independent scan | isolated marked shadow worktree, daily full checks and Strix; SKIP, REVIEW and FAIL are never green |
| Post-deployment | separate read-only liveness/readiness/home/login and dark-route verifier |

## Executed evidence

| Check | Result |
|---|---|
| Shell syntax and launchd plist | PASS |
| Release-control/compose/environment tests | PASS — 12/12 |
| Repository format/configuration | PASS — 491 files |
| API compile/test corpus | PASS — 377/377 |
| Web source boundary suites and production build | PASS — 40 routes built |
| Disposable PostgreSQL migration/upgrade/restore rehearsals | PASS — 24 scripts; all 32 migrations exercised from zero through AR-30 |
| Architecture/invariant suite | PASS — includes package/database segregation and fail-closed modes |
| Gitleaks | PASS — 128 commits / approximately 5.35 MB scanned, no leak |
| AssureRail Semgrep rules | PASS — 7 blocking rules over 404 application/script targets, no finding |
| npm production dependency gate | PASS — 0 critical, 0 high, 6 bounded moderate, 0 low |
| Trivy filesystem vulnerability/config scan | PASS — 0 high/critical dependency or Dockerfile finding |
| CycloneDX SBOM | PASS — generated locally under ignored `.security-output/` |
| Browser/mobile/public boundary | PASS — 13 pages × 3 engines × 2 viewports; 14 internal links |
| Effective demo environment, including compiled runtime profile | PASS; no value or secret printed |
| Azure India target-baseline contract | PASS as target validation only; no resource/deployment claim |

The OSV depth scanner reports `GHSA-w5hq-g745-h8pq` against transitive optional `uuid@9.0.1`.
GitHub's advisory classifies the issue as moderate; this is the same exact package already retained
in the dated six-package SEC-01 reachability baseline, not a new closure. It remains open for upstream
remediation/review by 3 October 2026 and for challenge by the independent VAPT firm.

## Correctly open—not passed

- Strict `--release` execution awaits an actual signed release tag and the exact private deployment
  environment. Code-check success is not a release receipt.
- Container image builds and Trivy image scans await a running Docker daemon on the release host.
- Lighthouse is intentionally mandatory only when the founder authorises deliberate public release;
  it has not been represented as run here.
- The daily Strix wrapper was negative-tested for missing prerequisites. A real independent scan and
  the daily launchd installation await the standalone secret file and running Docker/Strix harness.
- Authenticated two-tenant E2E and DAST await the Azure Hyderabad-primary/Pune-recovery pre-production
  environment.
- Independent VAPT and its remediation/retest remain external gates before controlled live.
- Historic participant-authorised DA and trustee-authorised all-leg PTC evidence remain external
  replay gates; synthetic evidence cannot close them.

## Release use

Follow `docs/runbooks/AssureRail_PreDeployment_And_Release_Gate.md`. Preserve the generated receipt,
SBOM, scanner artifacts, environment review and external evidence in the restricted release evidence
store. A successful check is permission to begin the separately authorised two-person deployment
procedure; it is never permission to activate a Rail capability.
