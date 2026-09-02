# AssureRail Azure India threat model and configuration baseline

**Tranche:** SEC-01
**Status:** target architecture and control baseline; not deployed, approved or independently tested
**Date:** 3 September 2026
**Machine-readable control:** `deploy/azure/assurerail/security-baseline.json`
**Check:** `npm run security:assurerail:azure`

## 1. Decision and boundary

AssureRail's intended Azure data plane is India-only, with **India South Central (Hyderabad)** as the
primary region and **Central India (Pune)** as the recovery region. Azure documents both as
availability-zone regions. Azure's pairing table is asymmetric: India South Central points to
Central India, while Central India points to South India. The design must therefore prove each
service's replication and failover behaviour explicitly and must not sell Hyderabad–Pune as a
symmetric, automatic managed pair. Service availability, subscription eligibility and zone support
must be rechecked immediately before provisioning. See Microsoft's [Azure region list](https://learn.microsoft.com/en-us/azure/reliability/regions-list)
and [region-pairing guidance](https://learn.microsoft.com/en-us/azure/reliability/regions-paired).

This document covers the conventional DA/PTC AssureRail web, API, workers, PostgreSQL, evidence
objects, secrets, audit/telemetry and approved external connectors. It does not place AssureLocker
inside the Rail trust boundary and does not make AssureLocker a mandatory provider.

The potential later five-to-seven-node HashSphere or other approved HTS network is explicitly outside
this topology. It may or may not run on Azure and requires a separate architecture, node-operator,
key-custody, consensus, availability, jurisdiction and incident-response threat model before build or
activation.

## 2. Protected assets and security outcomes

| Asset | Required outcome |
|---|---|
| Human and service identities | One attributable actor; phishing-resistant privileged access; no shared or long-lived cloud credentials |
| Institution, membership, mandate and appointment state | Tenant-isolated, effective-dated and immediately revocable; participant and internal contexts never combined |
| Transaction cases and evidence | Exact case and institution ACL; immutable versions, digests, provenance and access receipts |
| Instructions, acknowledgements and reconciliations | Idempotent, authenticated, replayable and fail-closed on ambiguity or divergence |
| Authoritative-record references | Rail never silently replaces the trustee, RTA, depository or other route-defined authority |
| Keys and secrets | Vault-held, least-privilege, private-network accessed and rotatable with evidence |
| Audit and security telemetry | Complete, time-synchronised, access-controlled, retained and tamper-resistant |
| Availability and recovery | Safe pause, restore and regional recovery without duplicate execution; reconciliation before resumption |

## 3. Target trust boundaries

```text
Internet users / institutions
        |
        v
Azure Front Door Premium + WAF + DDoS controls
        |
        v  private origin only
AssureRail web/API/worker network segments (managed identities)
   |          |              |
   |          |              +--> allow-listed provider connectors
   |          +--> private Key Vault / container registry
   +--> private PostgreSQL / object storage / malware scanner
        |
        v
Central diagnostic/security workspace and immutable archive

Hyderabad primary  -- tested, orchestrated recovery -->  Pune recovery
```

The browser, every participant institution, each external provider, each Azure subscription, each
region and the AssureLocker runtime are separate trust domains. A successful network connection,
identity assertion or provider capability declaration is not transaction authority or verified
evidence.

## 4. Threat analysis

| ID | Threat and abuse case | Primary controls | Verification evidence | Residual/open gate |
|---|---|---|---|---|
| `AZ-S01` | Stolen staff credential or session becomes persistent privileged access | Entra ID, phishing-resistant MFA, PIM/JIT, two monitored break-glass accounts, Rail step-up, bounded assignments and session revocation | Authenticated E2E role tests, Entra/PIM export, access recertification sample | Tenant configuration and live exercise open |
| `AZ-S02` | A participant changes the institution header/path to read another customer's case or evidence | API-side institution/session binding, case ACL, no UI-only grants, object-level authorization and negative tenant matrix | Two-tenant E2E/DAST and external VAPT | Requires provisioned synthetic tenants |
| `AZ-S03` | Internal staff combine staff power with participant authority | Rail rejects internal workspace access when an active participant context exists; distinct managed identities and permissions | API tests plus authenticated staff/participant E2E | Full role-account matrix open |
| `AZ-T01` | Evidence, instruction or acknowledgement is changed or replayed | Immutable versions, canonical digest, provider signature, idempotency, inbox/outbox and reconciliation | Existing unit/integration corpus; staged fault injection and DAST | Real connector evidence remains external |
| `AZ-T02` | Container, dependency or deployment artifact is substituted | Pinned lockfile, high/critical dependency gate, signed immutable images, controlled registry, two-person deployment and provenance | SEC-01 audit, image signature policy and deployment receipt | Azure implementation open |
| `AZ-T03` | Operator alters logs or closes their own break | Append-only audit, write-once/immutable archive, independent break closure and separate log permissions | Audit-chain tests, storage immutability check and RBAC review | Azure archive proof open |
| `AZ-R01` | Actor disputes a sensitive decision or support access | Actor/session/mandate/step-up evidence, correlation IDs, before/after state and access receipt | E2E and exported evidence verification | Legal retention approval open |
| `AZ-I01` | Public origin, database, vault or bucket leaks customer data | Front Door-only ingress, private endpoints/DNS, no public DB/Key Vault/storage/registry, default-deny egress, Azure Policy | Resource Graph/Policy export, private DNS test, external port scan | Not provisioned |
| `AZ-I02` | Secrets or raw evidence appear in logs, WAF telemetry or error responses | Structured redaction, WAF log scrubbing, secret references rather than values, secure exception handling | DAST, log sampling and secret scan | Needs staged traffic |
| `AZ-I03` | Support/admin reads customer content without purpose | No default customer-object permission, ticket/case-scoped elevation, approval, expiry and access receipt | RBAC tests and VAPT role abuse testing | Human SOP rehearsal open |
| `AZ-D01` | Volumetric or application-layer denial of service | Azure DDoS Network Protection, Front Door WAF/rate limits, API throttling, bounded uploads/queries and autoscaling limits | Load/abuse test and alert drill | Capacity numbers open |
| `AZ-D02` | Provider outage or ambiguous success blocks or duplicates a transfer | Durable saga, timeouts, idempotent provider instructions, safe pause, manual repair and reconciliation | Existing fault tests plus provider simulator and recovery drill | Live provider conformance open |
| `AZ-D03` | Region failure causes data loss or split execution | Zone-redundant HA, PITR, explicit Hyderabad→Pune recovery, single write authority, fencing, RTO/RPO and reconcile-before-resume | Quarterly restore and annual regional failover exercise | RTO/RPO and service design owner approval open |
| `AZ-E01` | SSRF reaches metadata/private services or arbitrary outbound targets | Private segmentation, workload identity, default-deny egress, destination approval, DNS/IP re-resolution and connector allow-list | DAST SSRF cases and egress firewall logs | Azure rules open |
| `AZ-E02` | Malicious file executes or contaminates evidence | Streaming size bounds, content sniffing, quarantine, malware scanning, encrypted storage and immutable versioning | File-upload DAST corpus and scanner evidence | Staged scanner open |
| `AZ-E03` | Cloud administrator bypasses application maker-checker | Separate cloud/application roles, PIM, two-person production changes, no shared accounts, central audit and alerting | Entra/Azure RBAC matrix and deployment ceremony rehearsal | Azure tenant design open |
| `AZ-C01` | Misconfiguration silently weakens the perimeter | IaC only, Azure Policy deny/audit, machine-readable baseline, Defender for Cloud, drift detection and signed exceptions | Policy compliance export and deliberate-negative deployment test | IaC implementation is a later tranche |

## 5. Required Azure configuration

### Edge and network

- Internet ingress terminates only at Azure Front Door Premium with WAF. The origin accepts no public
  ingress and validates the expected origin path/identity.
- WAF starts in detection for tuning only, then reaches **prevention** before controlled-live. TLS is
  at least 1.2; diagnostic settings and log scrubbing are enabled. Microsoft's guidance explicitly
  covers Front Door/WAF [Zero Trust controls and diagnostic logging](https://learn.microsoft.com/en-us/azure/networking/security/zero-trust-front-door-waf)
  and [secure WAF deployment](https://learn.microsoft.com/en-us/azure/web-application-firewall/secure-web-application-firewall).
- DDoS Network Protection, WAF application-layer controls and tested rate limits are separate layers;
  WAF is not treated as network DDoS protection. See Microsoft's [DDoS and WAF guidance](https://learn.microsoft.com/en-us/azure/web-application-firewall/shared/application-ddos-protection).
- PostgreSQL, Key Vault, object storage and registry use private endpoints/private DNS. Egress is
  default-deny and each provider destination has an owner, purpose, schema, certificate policy and
  expiry/review date.

### Identity, secrets and administration

- Workloads use dedicated managed identities. Rail and Locker do not share application identities,
  databases, vault permissions, storage accounts or connector credentials.
- Humans use Entra ID. Privileged access is phishing-resistant MFA plus PIM/JIT; shared accounts and
  standing owner access are prohibited. Break-glass use alerts immediately and is rehearsed.
- Secrets live in Key Vault through private access, Azure RBAC, soft delete and purge protection.
  Microsoft recommends disabling public access and using private endpoints/firewall controls for
  Key Vault; see [Defender for Cloud Key Vault recommendations](https://learn.microsoft.com/en-us/azure/defender-for-cloud/recommendations-reference-keyvault).
- Controlled environments do not use checked-in or host `.env` files as the secret store. An
  environment variable may carry a non-secret configuration value or short-lived reference, never a
  long-lived application secret.

### Data and recovery

- Azure Database for PostgreSQL Flexible Server uses private networking, Entra authentication,
  zone-redundant HA, connection limits, PITR and tested backup restoration. Microsoft recommends
  private endpoints, Entra authentication, Defender and Key Vault-backed customer-managed keys where
  the risk decision requires them; see the [PostgreSQL Well-Architected guidance](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/postgresql).
- The Pune recovery implementation must be designed per service; no generic region-pair assumption
  is allowed. RTO/RPO, replication lag, write fencing, DNS/failover, key availability and failback are
  approved and rehearsed.
- After any restore or regional recovery, Rail compares its state with the route's external payment,
  trustee, RTA/depository/register and provider authorities before resuming execution.
- Evidence objects are encrypted, private, malware-scanned, versioned and retained under legal-hold
  policy. Microsoft also recommends private endpoints for PostgreSQL and other data services; see
  [Defender for Cloud data recommendations](https://learn.microsoft.com/en-us/azure/defender-for-cloud/recommendations-reference-data).

## 6. Deployment and policy gates

The following must be machine-enforced through IaC/Policy before Azure shadow enablement:

1. approved India regions only and service availability recorded;
2. separate production/non-production subscriptions and Rail/Locker identities;
3. no public origin, DB, vault, object storage or registry;
4. managed identity and least-privilege RBAC; no shared accounts;
5. Key Vault RBAC, private access, soft delete, purge protection and rotation alerts;
6. Front Door/WAF diagnostics, TLS, scrubbing, prevention-mode readiness and DDoS protection;
7. Defender for Cloud and central diagnostic settings on every supported resource;
8. immutable security/audit archive, at least 365-day security retention and tested alert delivery;
9. signed immutable images and two-person production changes; and
10. explicit runtime mode/capability manifests: no demo flag or adapter in controlled-live or
    production.

`security-baseline.json` is a design invariant, not an ARM/Bicep/Terraform deployment. The later IaC
must consume or map every field and produce a signed compliance export. A green local check proves
only that the target file retains the agreed controls.

## 7. SEC-01 acceptance and open evidence

| Evidence | State at authoring | Closure requirement |
|---|---|---|
| Machine-readable target baseline | Built | Local checker green |
| Azure resource inventory and service-availability record | Open | Export from intended subscriptions before provisioning |
| IaC and Azure Policy implementation | Open | Reviewed plan plus deliberate-negative policy tests |
| Private-network, identity and logging proof | Open | Resource Graph/Policy/diagnostic exports from pre-production |
| Restore and regional recovery | Open | Timed restore and Hyderabad→Pune exercise with external reconciliation |
| Authenticated E2E/DAST | Harness built; execution open | Signed staged run using synthetic tenants and role accounts |
| Independent VAPT/retest | Open | External firm's signed report, remediation register and clean retest |

No open row may be changed to passed from a screenshot, synthetic database row or declaration that a
cloud service supports the feature. It needs evidence from the configured AssureRail environment.
