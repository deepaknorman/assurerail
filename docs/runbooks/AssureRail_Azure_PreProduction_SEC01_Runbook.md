# AssureRail Azure pre-production SEC-01 runbook

**Status:** execution-ready preparation; subscription inventory, provisioning and tests remain open

**Date:** 4 September 2026

**Scope:** synthetic AssureRail pre-production only; Hyderabad primary and Pune recovery

**Not authorised by this document:** deployment, customer-data intake, controlled-live, production,
external active scanning or a public security claim

## 1. Fixed decisions and open decisions

Fixed for this tranche:

- Azure India data plane;
- `indiasouthcentral` (Hyderabad) primary and `centralindia` (Pune) recovery;
- no assumption of a symmetric managed region pair;
- private origins/data services, Front Door Premium/WAF, managed identities and Key Vault;
- synthetic tenants and accounts only; and
- independent VAPT and clean retest before any controlled-live route.

Open and therefore not fabricated:

- subscription and tenant ownership;
- per-service availability/quota in both regions;
- RTO/RPO and warm/cold recovery cost choice;
- exact application compute service and scaling envelope;
- customer-managed-key risk/counsel decision;
- approved VAPT firm and test window; and
- company incorporation date. Planning assumes no completion before mid-October 2026, but there is
  no committed date.

Synthetic pre-production can technically precede incorporation only if the founder accepts the
tenant/subscription ownership and later transfer/exit implications. No long-lived production asset,
contract or public claim is inferred from a temporary setup.

## 2. Stage A — read-only subscription and regional inventory

Do not create resources first. The subscription owner runs:

```bash
export ARAIL_AZURE_SUBSCRIPTION_ID='<approved-subscription-id>'
bash scripts/assurerail-azure-service-inventory.sh \
  /secure/absolute/path/assurerail-azure-inventory
```

The operator and reviewer record:

1. tenant and subscription identifiers, with personal identity removed from the retained copy;
2. visibility of both target regions;
3. registered state and region lists for the required resource providers;
4. quotas and feature registrations for the selected compute/data services;
5. service-specific zone, private-link, backup and geo-recovery support; and
6. any availability exception, alternate design, owner and expiry.

Provider metadata is only an availability record. It is not proof that a configured resource is
private, resilient or compliant.

## 3. Stage B — architecture and IaC acceptance

Before the first plan/apply, an architecture record fixes:

- web/API/worker compute and zone layout;
- PostgreSQL HA, PITR, recovery replication and write-fencing design;
- evidence-object storage, immutability, malware scanning and recovery;
- Front Door/WAF origin authentication, private connectivity and certificate lifecycle;
- default-deny egress plus exact CRM, identity and approved-provider destinations;
- Key Vault/managed-identity/RBAC and secret-rotation design;
- ACR image signing/provenance and two-person deployment approval;
- central diagnostics, Defender/SIEM, immutable archive and 365-day minimum security retention; and
- backup/restore, regional recovery, reconciliation-before-resume and failback.

IaC and Azure Policy must map every field in
`deploy/azure/assurerail/security-baseline.json`. A reviewed plan, deliberate-negative policy tests
and a signed exception register precede apply. No portal-only resource may silently become the
production template.

## 4. Stage C — synthetic environment build

Record the exact commit and immutable image digests. The environment must use:

```text
ASSURERAIL_OPERATING_MODE=SHADOW
ARAIL_DEMO_ENDPOINTS_ENABLED=false
ASSURERAIL_INBOUND_ENABLED=no
ASSURERAIL_PRIVATE_UI_ENABLED=yes
```

Only the minimum feature cohorts required for the security tests may be set to `shadow`; all route
execution, token, primary/secondary and controlled-live/production capabilities remain fail-closed.
The API must refuse no-database or demo configuration.

`ASSURERAIL_PRIVATE_UI_ENABLED=yes` mounts the operational web shell for the security exercise. It
does not authenticate a person. Azure ingress restriction plus the real Firebase session, Rail API
session, institution context, membership, mandate, assignment and object-level checks must still be
tested. Public-only deployments keep this value `no`, causing operational routes to return 404
before rendering their page shell.

Before the operational application is reachable from the Internet, choose and test a server-side
boundary: an authenticated edge/BFF session or a separately restricted application host. A
client-side redirect is not sufficient to protect route-shell text or future server-rendered data.
The public host must continue to return 404 for the operational roots even if a private application
deployment mounts them elsewhere.

Do not deploy the combined Next.js artifact as the anonymous website: route-specific client chunks
can disclose internal workflow labels and endpoint paths even while the route itself returns 404.
The public origin uses a public-only/static artifact; the application origin uses the authenticated
build. Retain an anonymous-origin asset crawl showing that no operational chunk is reachable.

Create two unrelated synthetic institutions and the eight named test identities defined in
`docs/qa/assurerail-sec01-accounts.example.json`. Credentials live outside Git with restricted file
permissions. An independent reviewer confirms that tenant A and B identifiers, memberships,
mandates, staff assignments and step-up capabilities are distinct.

## 5. Stage D — internal security execution

Run and retain:

```bash
npm run security:assurerail:deps
npm run security:assurerail:azure
npm run security:assurerail:e2e
npm run security:assurerail:dast
```

Follow `docs/qa/AssureRail_SEC01_Authenticated_E2E_DAST_Runbook.md`. Active DAST requires the explicit
authorisation, synthetic-data declaration, change-window ID, rollback owner and pinned ZAP digest
listed there. It may target only the two approved AssureRail pre-production origins.

Triage every result. A scanner completion with unreviewed alerts is not a pass; a remediation without
the same test rerun is not closed. Archive reports, correlation IDs, environment identity, tested
commit, owner, reviewer and retest outcome in the controlled security evidence store.

## 6. Stage E — VAPT handoff and closure

Use `docs/qa/AssureRail_VAPT_Firm_Engagement_And_Closure_Pack.md` to procure the independent firm.
The assessment must include authenticated two-tenant business-logic abuse, internal/participant role
separation, APIs, file/evidence handling, webhook/SSRF egress and the Azure perimeter/configuration.

No firm receives customer data or production credentials. Critical/high findings block activation;
material remediations require the firm's clean retest. The signed final report, remediation register
and retest letter remain protected diligence material, not an anonymous web download.

## 7. Exit criteria

SEC-01 closes only when all of the following exist:

- reviewed inventory and service-specific regional design;
- IaC/Policy deployment and compliance export;
- private-network, identity, Key Vault, logging and alert evidence;
- successful restore and Hyderabad-to-Pune recovery rehearsal against the agreed RTO/RPO;
- green signed authenticated E2E and DAST reruns;
- accepted independent VAPT and clean retest; and
- no unresolved critical or unowned high finding.

Incorporation, counsel, participant replay, trustee evidence and route activation remain separate
gates even when SEC-01 is green.
