# AssureRail SEC-01 internal closure evidence

**Date:** 3 September 2026
**Status:** internal code/config-harness portion complete; staged/Azure/external evidence OPEN
**Deployment:** none performed or authorised by this record

## Delivered

- AssureRail production dependency upgrades and a scoped, fail-closed audit command.
- Exact residual-moderate baseline with owner and 3 October 2026 review date.
- Azure India machine-readable target baseline plus threat model for Hyderabad primary/Pune recovery.
- Authenticated Playwright suite covering anonymous boundaries, two-tenant header/path attacks,
  participant/staff context separation and five internal privilege classes.
- Authenticated ZAP wrapper that proxies the eight-account Playwright suite, with a target allow-list,
  HTTPS, pinned-image and active-scan synthetic/change-window/rollback gates; no reusable bearer
  token is supplied to the scanner.
- AssureRail-specific external VAPT procurement, rules-of-engagement, test and closure pack.
- Provider-neutral correction to the login explanation; identity verification no longer implies that
  AssureLocker is the only supported provider or that it alone grants admission.

## Executed checks

| Check | Result | Meaning |
|---|---|---|
| Clean `npm ci --ignore-scripts --legacy-peer-deps --install-strategy=nested` | Passed | Lockfile reproducibly installs; install scripts deliberately excluded from this dependency check |
| `npm run security:assurerail:deps` | Passed: 0 critical, 0 high, 6 exact monitored moderate, 0 low | Production dependency threshold and residual set match SEC-01 baseline |
| Firebase/Storage source reachability search | Firebase `app`/`auth` imports only; no Cloud Storage import/use found | Supports but does not independently close the residual moderate risk decision |
| `npm test --workspace @code/assurerail-api -- --runInBand` | 366 passed, 0 failed, 0 skipped | Existing API/security/domain corpus remains green after Nest/Firebase/dependency updates |
| `npm run build --workspace @code/assurerail-api` | Passed | Prisma generation and TypeScript production compilation green |
| `npm run build --workspace @code/assurerail` | Passed | Next.js 16.3.4 production compilation and type check green |
| `npm run security:assurerail:azure` | Passed | Target baseline retains required controls; not proof of an Azure deployment |
| `npm run security:assurerail:e2e:list` | Passed: 8 tests discovered | Playwright harness compiles and enumerates; authenticated tests were not executed |
| `bash -n scripts/assurerail-sec01-dast.sh` | Passed | DAST wrapper shell syntax valid; no host was scanned |
| Local Semgrep review of the six changed JavaScript/TypeScript security surfaces | Passed: 4 focused rules, 6 files, 0 findings | No dynamic-code execution, shell execution, unconditional TLS bypass or hard-coded credential finding |
| `npm run qa:public-gate` | Passed: 0 failed checks; pre-existing/report-only warnings retained | Changed public surfaces contain no blocking content, density or image finding |
| Missing-config E2E preflight | Failed closed as designed | No target/accounts means no test and the evidence gate stays open |

`shellcheck` was unavailable locally, so no shellcheck result is claimed.

## Deliberately open evidence

| Gate | State | Accountable closure evidence |
|---|---|---|
| Azure service availability and final regional design | OPEN | Subscription/service inventory and approved per-service Hyderabad/Pune topology |
| Azure IaC/Policy/private networking/identity/logging | OPEN | Reviewed deployment plan, policy negatives and resource/configuration exports |
| Backup/restore and regional failover | OPEN | Timed restore/failover/failback with provider and authoritative-record reconciliation |
| Authenticated E2E | OPEN | Exact deployed build plus private eight-account role matrix and signed results |
| Authenticated DAST | OPEN | Authorised synthetic pre-production run, triage, remediation and rerun |
| Independent VAPT | OPEN | Signed initial report, remediation evidence, independent retest and closure report |
| Six moderate Firebase transport-chain advisories | MONITORED OPEN | Patched compatible upstream or reassessment by review date; external assessor may supersede |

No synthetic entry, local source test, scanner preflight or application build may be used to mark an
environment or independent-assurance row complete.
