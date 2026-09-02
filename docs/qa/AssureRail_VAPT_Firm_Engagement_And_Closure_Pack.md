# AssureRail external VAPT firm engagement and closure pack

**Status:** procurement/test pack ready; firm not yet engaged; assessment and retest OPEN
**Date:** 3 September 2026
**Owner:** founder/commercial owner appoints the firm; AssureRail security owner coordinates evidence
**Target:** dedicated Azure India pre-production with synthetic data only

## 1. Required outcome

Commission a currently CERT-In-empanelled firm to perform independent automated and manual,
authenticated VAPT of AssureRail's web, API and bounded external cloud perimeter. The engagement is
complete only when the firm issues:

1. a signed initial executive and technical report;
2. reproducible evidence and severity for every finding;
3. an AssureRail remediation disposition for every finding;
4. an independent retest of every material finding; and
5. a signed final closure/retest report stating the residual findings.

This is an AssureRail engagement. The older AssureLocker VAPT scope explicitly excluded AssureRail and
cannot be reused as evidence.

## 2. Minimum scope in the quotation/SOW

| Area | Required scope |
|---|---|
| Application | AssureRail pre-production web and API at the exact tested build/manifests |
| Cloud perimeter | Front Door/WAF, public DNS/TLS/origin exposure, externally reachable ports/services and approved headers |
| Authentication | Firebase login/session exchange, MFA/step-up, expiry/revocation, account recovery assumptions and reauthentication |
| Tenant matrix | At least two synthetic institutions, participant org-admin/manager/viewer and deliberately cross-tenant objects |
| Internal RBAC | Viewer, manager, sysadmin, security admin and superadmin; participant/internal context separation; elevation and maker-checker |
| APIs | Every mounted AssureRail controller family, including negative, IDOR/BOLA/BFLA and malformed request cases—not only browser-discovered routes |
| Business logic | DA/PTC cases, rooms, evidence, documents, replay/shadow, lifecycle, primary/secondary, token mirror, operations, integrations and exports, limited to flags actually enabled for the test |
| Integrations | Webhooks/SSRF/egress, provider callback/acknowledgement authentication, duplicate/replay/idempotency and ambiguous result handling using simulators we operate |
| Data handling | Upload size/type/sniff/scan/quarantine, download ACL, object IDs, watermarks, retention/legal hold, error/log leakage |
| Standards | OWASP Web Top 10, OWASP API Security Top 10, current CWE/CVSS, manual business-logic and authorization testing |
| Deliverables | Executive report, developer report, evidence/reproduction, CVSS, affected asset/build, remediation advice, retest and signed closure letter |

The firm must review the current endpoint inventory from source/build output and compare it to observed
routes. A crawler alone is inadequate because many AssureRail APIs are not linked from every role UI.

## 3. Mandatory manual attack stories

- Tenant A token with tenant B path/header, case, room, evidence, document, export and opportunity IDs.
- Viewer/manager attempts to call hidden org-admin, platform-admin, internal governance, deployment and
  high-risk mutation endpoints directly.
- Internal user attempts participant action; participant session attempts internal workspace; support
  or sysadmin attempts to read customer content without exact elevation/purpose.
- Maker approves their own assignment, admission, mandate, entitlement, repair, conduct, commercial or
  release proposal; checker alters the maker's content before approval.
- Expired, revoked, suspended and concurrently changed membership, mandate, appointment, session,
  entitlement and privileged elevation.
- Missing/reused idempotency keys, duplicate/out-of-order callbacks, timeout after external success and
  restart during a saga; no duplicate action or false completion may result.
- Evidence digest/version substitution, stale provider evidence, `UNKNOWN`/missing result promotion,
  conflicting trustee/recordkeeper facts and token/legal-record divergence.
- SSRF through webhook/provider endpoints including DNS rebinding, redirects, private/link-local,
  loopback, IPv6 and cloud metadata targets.
- Malicious upload corpus, polyglots, extension/MIME conflict, decompression/size abuse, quarantined
  object access and object-store identifier guessing.
- CSV/formula injection, stored/reflected/DOM XSS, request smuggling/desync where relevant, injection,
  mass assignment, over-posting and excessive data exposure.
- CORS, CSP, clickjacking, cache/privacy headers, TLS, rate limits and unauthenticated health/metrics
  disclosure.
- Audit/access-chain tampering, log injection, sensitive value leakage, deletion/rewriting of evidence
  and export without a receipt.

## 4. Explicit exclusions and safety rules

Unless separately added in writing, exclude:

- denial-of-service, load/stress, social engineering and phishing;
- production/customer data, production identities and live money/ownership movement;
- destructive deletion, persistence/backdoors and malware outside the supplied safe corpus;
- third-party systems or endpoints not operated by AssureRail;
- AssureLocker, AssurePlane, AssurePool and AssureTransfer except the exact simulator/adapter boundary
  exposed by the AssureRail test target; and
- the later HashSphere/HTS multi-node network, which is not part of the current Azure topology.

The signed rules of engagement name URLs/IPs, auditor source IPs, test window, time zone, allowed
techniques, emergency stop, critical escalation, backups, rollback owner and contacts. No target is
tested before written owner authorization.

## 5. Day-zero evidence pack

Provide securely after NDA and SOW:

- Azure subscription/resource inventory and target diagram, with secrets and sensitive identifiers
  removed;
- tested git commit, signed image digests, deployment manifest, database migration state and active
  feature/mode manifest;
- `AssureRail_Azure_India_Threat_Model_And_Config_Baseline.md` and actual Azure Policy/Defender/private
  endpoint/diagnostic exports;
- endpoint inventory, API request collection/OpenAPI if available and event/webhook contracts;
- eight or more named synthetic role accounts from the SEC-01 E2E matrix, separate MFA/step-up test
  mechanism and seeded cross-tenant objects;
- internal dependency, secret, SAST and E2E/DAST reports, including every accepted/open exception;
- data classification/retention, incident, access, backup/restore and safe-pause runbooks; and
- an encrypted finding channel separate from ordinary email.

Passwords/tokens are shared out of band, short-lived where possible and revoked after the engagement.
The firm receives no production key, customer data or unconstrained Azure owner credential.

## 6. Supplier selection and commercial requirements

Obtain at least two comparable fixed-scope quotations. Verify the firm is currently listed as CERT-In
empanelled at contracting and at final report date against CERT-In's own
[empanelment page and current list](https://www.cert-in.org.in/s2cMainServlet?pageid=CERTEMPANEL). The
SOW must include named tester(s), manual and
automated methods, cloud/perimeter and API limits, one full retest of material findings, signed closure
letter, secure India-based report handling, breach notification, evidence destruction/return and no
subcontracting without approval.

Do not buy an automated-only vulnerability scan as VAPT. Do not describe the outcome as CERT-In
certification or approval of AssureRail; it is a test conducted by an empanelled firm against a named
scope/build and date.

## 7. Finding lifecycle and closure rules

| State | Required evidence |
|---|---|
| `REPORTED` | Firm ID, severity/CVSS, affected asset/build, reproduction and evidence |
| `VALIDATED` | Internal owner reproduced or documented why independent reproduction is unsafe |
| `DISPUTED` | Technical basis and counter-evidence sent to firm; never silently relabelled |
| `REMEDIATION_READY` | Reviewed code/config/SOP change and scoped tests green |
| `RETEST_REQUESTED` | Exact target/build deployed to pre-production and mapping to firm IDs supplied |
| `RETEST_PASSED` | Firm independently confirms the finding cannot be reproduced |
| `RISK_ACCEPTED` | Named accountable executive, expiry, compensating controls and firm residual status |
| `CLOSED` | Firm retest/closure report plus internal acceptance; evidence archived |

Critical/high findings block controlled-live. Medium findings also remain blocking unless the
security/risk owner, product owner and customer/regulatory authority where applicable sign a
time-bounded acceptance with compensating controls and the external report retains the residual
finding. No developer closes their own security finding unreviewed.

## 8. Exit criteria

The external VAPT gate closes only when all are true:

- the test target matches the recorded build/config and had no production data or live effects;
- scope includes authenticated two-tenant and all privileged-role classes;
- every finding has a final state, owner and evidence;
- every critical/high and required medium has an independent passing retest;
- residual accepted risks have explicit expiry and compensating-control verification;
- all test accounts/tokens/access are revoked and the firm confirms evidence return/destruction;
- the signed initial and final reports are stored under restricted retention; and
- engineering, security/risk and the accountable release owner sign the closure record.

Until then, capability and public materials must say **independent VAPT is pending**. VAPT closure
does not itself approve a DA/PTC route, provider, participant, token network or production activation.
