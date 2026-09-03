# AssureRail PUB-01A public-minimisation evidence

**Executed:** 3 September 2026
**Deployment:** not performed
**Result:** passed locally

## Automated evidence

| Check | Result |
|---|---|
| diligence credential unit tests | 3 passed, 0 failed |
| anonymous-source exposure check | 11 public source files checked; passed |
| public/protected content freshness | public due 3 October 2026; diligence due 17 September 2026; passed |
| public growth/claim checks | passed |
| CX-00 capability baseline | 16 routes, 14 web flags and 7 protected capability entries; passed |
| PUB-00 claim boundary | passed |
| CX-01/SIM-01 regression | passed |
| optimized Next.js build | 40 pages generated; TypeScript and build passed |
| browser-asset exposure check | 77 static client assets checked; protected markers absent |
| whitespace/error-marker review | `git diff --check` passed |

## Local HTTP evidence

The optimized build was exercised on loopback with temporary test credentials:

| Request | Observed |
|---|---|
| anonymous `/` | 200; protected markers absent |
| disabled `/diligence` | 404 with private/no-store and no-index/no-follow/no-archive |
| enabled `/diligence`, no credentials | 401 with authentication challenge |
| enabled `/diligence`, wrong credentials | 401 |
| enabled `/diligence`, correct credentials | 200 with private/no-store and no-index/no-follow/no-archive; protected register rendered |
| generated sitemap | neither diligence nor sandbox present |
| generated robots policy | only the declared anonymous routes are allowed; all other paths disallowed |

## Evidence boundary

These checks prove the repository boundary, optimized bundle behavior and local authentication
behavior. They do not prove deployment configuration, WAF/rate limiting, secret-store injection,
monitoring, named-user access, external penetration testing or stakeholder approval. Those remain
deployer/operating gates.
