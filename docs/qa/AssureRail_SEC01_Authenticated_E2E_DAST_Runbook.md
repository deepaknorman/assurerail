# AssureRail SEC-01 authenticated E2E and DAST runbook

**Status:** harness ready; no staged authenticated run is claimed
**Date:** 3 September 2026
**Scope:** AssureRail web/API only; synthetic pre-production tenants; no deployment action

## 1. What this tranche proves—and does not

The checked-in harness makes two-tenant and internal-role tests repeatable without committing
credentials. It exercises the real Firebase login/session exchange, institution binding, cross-tenant
denials, staff/participant context separation, internal workspace boundaries and non-superadmin
governance denial.

The DAST wrapper starts a locally bound ZAP proxy and runs the same eight-account Playwright suite
through it, so ZAP observes the real Firebase-authenticated web and API traffic without copying a
bearer token into a command line. It then completes the passive scan and can run a separately gated
active scan only against the two in-scope origins. It prevents accidental scanning of unlisted hosts,
refuses unpinned scanner images, and requires explicit synthetic-data/change-window/rollback
declarations for active attack.

A green source build or `--list` is **not** an authenticated run. DAST does not replace the external
firm's manual business-logic, role-abuse, API and cloud-configuration VAPT.

## 2. Environment prerequisites

Use a dedicated Azure pre-production environment after its configuration baseline has been applied:

- no customer/production data; two synthetic admitted institutions A and B;
- `ASSURERAIL_OPERATING_MODE=SHADOW`, DB-mode auth and the minimum capabilities needed for the tested
  workspaces—never demo or controlled-live;
- eight named test identities, no shared credentials and no production privileges;
- the participant/internal account and institution assignments independently reviewed;
- logs and alerts monitored during testing; rollback owner and test window recorded;
- web/API HTTPS origins and a separate approved auditor source IP where applicable; and
- a current ZAP image approved by security and pinned to its sha256 digest.

The required accounts are shown structurally in
`docs/qa/assurerail-sec01-accounts.example.json`. Copy it **outside the repository**, provision real
synthetic accounts, replace every placeholder and run `chmod 600` on the resulting file.

## 3. Authenticated E2E

```bash
export ARAIL_E2E_WEB_URL='https://rail-web-preprod.example'
export ARAIL_E2E_API_URL='https://rail-api-preprod.example'
export ARAIL_E2E_ACCOUNTS_FILE='/secure/absolute/path/assurerail-e2e-accounts.json'
npm run security:assurerail:e2e
```

Local HTTP is accepted only for loopback and only with
`ARAIL_E2E_ALLOW_LOCAL_HTTP=yes`. The preflight fails if a URL contains credentials/path/query, the
account file is not private, a role is missing, placeholders remain, emails are reused, or tenants A
and B are the same.

Archive securely:

- exact tested commit and deployment manifest;
- account-to-role/institution assignment export with secrets removed;
- Playwright JSON/HTML output and failure traces/videos;
- API/WAF/application audit correlation IDs for the run;
- defects, owners and retest results; and
- signer/reviewer, timestamps and environment identity.

## 4. Authenticated DAST

The private E2E account file supplies all named roles; the wrapper invokes its preflight and uses the
Playwright login/session exchange. ZAP's control API binds to loopback only and uses a random key. The
container is removed at exit. Passive authenticated crawl:

```bash
export ARAIL_DAST_AUTHORISED=yes
export ARAIL_DAST_DATA_CLASSIFICATION=SYNTHETIC_ONLY
export ARAIL_E2E_WEB_URL='https://rail-web-preprod.example'
export ARAIL_E2E_API_URL='https://rail-api-preprod.example'
export ARAIL_E2E_ACCOUNTS_FILE='/secure/absolute/path/assurerail-e2e-accounts.json'
export ARAIL_DAST_ALLOWED_HOSTS='rail-web-preprod.example,rail-api-preprod.example'
export ARAIL_DAST_OUTPUT_DIR='/secure/absolute/path/dast-results'
export ARAIL_ZAP_IMAGE='ghcr.io/zaproxy/zaproxy@sha256:REPLACE_WITH_APPROVED_64_HEX_DIGEST'
npm run security:assurerail:dast
```

Active DAST is allowed only on disposable synthetic data with an approved change window:

```bash
export ARAIL_DAST_MODE=active
export ARAIL_DAST_ACTIVE_CONFIRMED=yes
export ARAIL_DAST_DATA_CLASSIFICATION=SYNTHETIC_ONLY
export ARAIL_DAST_CHANGE_WINDOW_ID='approved-ticket-id'
export ARAIL_DAST_ROLLBACK_OWNER='named-person'
npm run security:assurerail:dast
```

Do not active-scan production, the demonstration box, a partner/provider endpoint or any host absent
from the signed rules of engagement. The wrapper deliberately has no default external target.

The harness logs in as participant viewer A, participant org-admin A, internal viewer, internal
manager, sysadmin, security admin and superadmin, and uses tenant B as the cross-tenant target. The
assessor must also manually exercise tenant B as an actor, stale and
revoked sessions, changed institution headers/path IDs, step-up expiry, upload/quarantine, SSRF,
webhook egress, export authorization and maker-checker self-approval.

## 5. Result classification and gate closure

| Result | Gate treatment |
|---|---|
| Preflight missing configuration | Not executed; OPEN |
| Test skipped or environment unavailable | Not passed; OPEN |
| Scanner finished but alerts untriaged | Executed; OPEN |
| False positive asserted without reproducer/evidence | OPEN |
| Finding fixed but not rerun | Remediated internally; OPEN |
| E2E/DAST rerun green with signed evidence | Internal SEC-01 execution evidence complete |
| Independent VAPT/retest accepted | External VAPT gate complete |

No result closes counsel, route, participant, trustee, provider, authoritative-register or
production-acceptance gates.
