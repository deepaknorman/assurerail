# AssureRail enterprise integration product — AR-29

**Status:** implemented under EX-28; shadow-only; not deployed or activated
**Date:** 3 September 2026

## Outcome

AR-29 adds the governed boundary between AssureRail and the enterprise systems required by the DA
and PTC products. It covers lender registries, trustees, RTAs/depositories/registers, payment
providers, electronic signing and stamping, rating agencies, servicers, finance/tax systems, CRM
and notification providers.

It deliberately does not add a generic live connector or dispatch switch. A connector registration,
passed fixture set and a profile are three different facts:

1. `DeveloperConformanceRun` proves only that software passed a bounded sandbox corpus.
2. `EnterpriseIntegrationProfile` defines the purpose, route, material functions, data class, SLA,
   reconciliation and authority policy for one version of one connector.
3. external evidence gates retain the signed acceptance supplied by the accountable provider,
   customer, counsel, security, operations or finance owner.
4. `EnterpriseCaseIntegrationBinding` separately proves that a shadow-ready profile matches the
   institution assigned to the material function in that case.

None of those facts transfers legal authority to AssureRail.

## Connector taxonomy and additional gates

Every class requires software conformance, security review, provider UAT, customer UAT, data-
protection acceptance, operating acceptance and an exit rehearsal. It then adds route-specific
evidence:

| Class | Additional evidence |
|---|---|
| Lender registry | source authority; data quality and lineage |
| Trustee | counsel/trustee route acceptance; trustee authority acknowledgement |
| RTA/depository/register | route acceptance; authoritative-record acknowledgement |
| Payment | finality/reversal opinion; cash reconciliation rehearsal |
| E-signature / e-stamping | legal-validity acceptance |
| Rating agency | data quality and timeliness |
| Servicer | lifecycle-data reconciliation |
| Finance/tax | accounting and tax sign-off |
| CRM | privacy and purpose acceptance |
| Notification | deliverability and escalation rehearsal |

Evidence must be current, signed, verified, owned within the institution boundary, match the exact
retained digest and be scoped to the profile and gate. Reusing a generic evidence object across
unrelated gates is rejected.

## State and currentness

A profile moves `PROPOSED → SHADOW_READY` only after an independent reviewer confirms all external
gates, software conformance and a healthy observation no more than 24 hours old. Evidence expiry,
provider/admission suspension, evidence quarantine or stale/degraded health makes readiness false
when read; retained case bindings are returned as `SAFE_PAUSED`. History is not rewritten.

Profiles and bindings are idempotent and maker/checker controlled. Health observations are
append-only by sequence and evidence digest. Credentials remain opaque Vault references on the
pre-existing connector/client models and are never returned in AR-29 profiles or evidence packs.

## API and user surfaces

- `/v1/rail/institutions/:institutionId/integrations/catalogue/v1`
- `/v1/rail/institutions/:institutionId/integrations/profiles`
- profile software-conformance, external-evidence, health, review and evidence-pack subroutes
- `/v1/rail/cases/:caseId/integrations` for case bindings and independent review
- `/workspace/integrations` and `/workspace/cases/:caseId/integrations`

All routes require the active institution context and an appropriate institution mandate. The API
and web flags default `off`; `shadow` is accepted only in REPLAY/SHADOW with institutional product,
developer portal, customer operations, durable shadow relay and internal RBAC prerequisites.

## Rejected shortcuts

- treating `PASSED_SOFTWARE` or `CERTIFIED_SHADOW` as counterparty acceptance;
- using a profile itself as legal authority for a transaction;
- binding a connector to a case without the active function assignment and performer match;
- accepting generic, unsigned, expired, quarantined or cross-gate evidence;
- persisting connector secrets in the profile/evidence pack;
- dispatching payment, signature, stamp, notice, register or other external acts from AR-29; and
- calling synthetic database rehearsal evidence provider certification or production acceptance.

## External gates still open

Every actual provider/customer profile requires its own evidence. VAPT, provider due diligence,
customer security approval, route-specific counsel, UAT, operating acceptance, exit rehearsal and
PR-12 controlled-live/production acceptance remain external. Their absence is an open gate, not a
failed software build and never a synthetic pass.
