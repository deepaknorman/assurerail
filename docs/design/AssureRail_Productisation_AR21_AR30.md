# AssureRail productisation programme — AR-21 through AR-30

**Status:** founder-authorised under EX-28; dependency-ordered implementation; no deployment or
activation authority
**Date:** 2 September 2026
**Foundation:** PR-00 through PR-20 as recorded in
`AssureRail_Code_Capability_Baseline_And_Implementation_Register.md`

## 1. Outcome

PR-12 through PR-20 created governed records, APIs, initial workspaces and fail-closed activation
boundaries. They did not claim a finished commercial venue. AR-21 through AR-30 convert those
foundations into coherent end-to-end products while retaining four independent truths:

1. code presence is not external evidence;
2. a visible action is not authority to perform it;
3. Rail workflow state is not the route-defined legal or authoritative record; and
4. deployment is not controlled-live or production activation.

Work proceeds as vertical product slices. Each slice must leave replay/shadow useful, retain
non-mutating rollback and refuse unavailable external gates rather than substituting fixtures.

## 2. Programme map

| Stage | Product outcome | Depends on | Activation boundary |
|---|---|---|---|
| **AR-21 Hosted alpha** | Institution-scoped action centre, task/status navigation, coherent customer/operator journeys, accessible unavailable/error states | PR-18–20 deployment | Shadow only; no new transaction action |
| **AR-22 Institutional productisation** | Application, admission, membership, mandates, appointments, SSO/service identity, connector admission, recertification/suspension/exit | AR-21, PR-03/04/19 | Real provider/customer acceptance remains external |
| **AR-23 Conventional DA** | One case journey from intake and diligence through partner-executed completion and dossier | AR-21/22, PR-09, PR-12 | Replay/shadow first; controlled-live only with counsel/participant/provider gates |
| **AR-24 Conventional PTC** | Programme/trust, pool transfer, trustee/counsel/rating/assurance, subscription/allotment, cash and route-defined register workflow | AR-21/22, PR-10, PR-12 | Trustee and route recordkeeper evidence remain controlling |
| **AR-25 Lifecycle** | Collections, servicing, waterfalls/distributions, notices, triggers, substitutions/repurchases, defaults, maturity/redemption and reconciliation | AR-23/24 | Each external lifecycle act has an assigned performer and acknowledgement |
| **AR-26 Primary venue** | Usable permissioned discovery, terms, RFQ, negotiation, allocation and conversion to transaction case | AR-21/22/23/24, PR-13/17 | Function-by-function legal/conduct/performer gates |
| **AR-27 Conventional secondary** | Usable secondary DA/PTC journeys with title chain, restrictions, consent, cash and register reconciliation | AR-25/26, PR-14 | Observation before execution; no Rail ownership inference |
| **AR-28 Tokenised routes** | Productised tokenised DA and separately governed tokenised PTC representations and lifecycle | AR-23–27, PR-15/16 | Mirror by default; connector/custody/finality gates cannot be internalised |
| **AR-29 Enterprise integration** | Production-grade lender registry, trustee/RTA/depository, payment, signing/stamping, rating/servicer, finance/tax/CRM and notification boundaries | Stable route contracts | Connector conformance is not counterparty certification |
| **AR-30 Production scale** | Security operations, VAPT closure, DR, capacity, support, daily controls, audit/export and signed production acceptance | All activated route slices | PR-12 manifest and independent approvals remain mandatory |

## 3. Cross-stage engineering rules

- New customer surfaces use institution/case/object-scoped APIs. They do not consume the legacy
  platform-wide Note, document, report, finding or activity lists.
- User-facing work is represented as attributable tasks with source record, due time, required
  authority, operating mode and destination. Task visibility never bypasses the destination API.
- Every external action uses the durable instruction/acknowledgement/saga boundary, including
  retries, ambiguous success, reconciliation and safe pause.
- DA and PTC retain separate route packs. Conventional and tokenised remain representation
  discriminators, not renamed copies.
- Every new feature flag defaults off and crosses example, compose, build and startup validation.
- The customer and internal operating interfaces distinguish expected, received, verified,
  reconciled and legally effective.
- Accessibility, negative authorisation, idempotency, concurrency, fault injection, migration,
  backup/restore and safe-pause evidence are stage acceptance requirements, not final clean-up.
- Public copy, SEO, simulations and inbound are separate PUB/SIM/GTM/CONTENT/INBOUND workstreams
  whose claims are limited by the accepted capability registry.

## 4. AR-21 acceptance contract

AR-21 is the first implementation stage because the deployed foundations currently require users
to navigate multiple record registers and the header notification control reads a legacy
platform-wide activity feed.

AR-21 must provide:

- a server-generated, institution-scoped action centre derived only from records the active member
  may view;
- task categories for governance, cases, evidence, reconciliation, commercial responses and
  customer service;
- deterministic priority and due-state ordering with overdue and due-soon semantics;
- source record and destination links without embedding confidential payloads;
- separate action-required, watch and unavailable states;
- a dedicated customer task page and a bounded summary on the institution home;
- participant notifications sourced from the same scoped task response, never `/venue/activity`;
- an explicit shadow-only API and web flag with fail-closed deployment wiring; and
- unit/contract/build evidence. No task closes a gate, performs a command or proves authority.

AR-21 does not activate PR-13–20, add external egress, create public claims, or treat the hosted
alpha as a customer-accepted pilot.

## 5. AR-22 acceptance contract

AR-22 turns institutional controls into a usable journey without treating configuration as access.
It provides:

- one institution-scoped overview of application, evidence, admission, membership, mandates,
  appointments, connectors, identity/access, recertification and exit;
- maker/checker records for SAML/OIDC configuration, bounded service identities, access reviews and
  exit plans;
- purpose-bound step-up and exact mandate actions for every mutation;
- digest/fingerprint-only configuration surfaces that accept no secret material;
- explicit `SHADOW_APPROVED` states that cannot authenticate or grant route authority;
- scoped action-centre review work and safe suspension/revocation proposals; and
- an additive migration with uniqueness, restrictive history and backup/restore evidence.

Real identity-provider validation, login mapping, client-secret issuance, customer acceptance and
executed exit remain AR-29 or external evidence. Approval in AR-22 cannot silently perform them.

## 6. AR-23 acceptance contract

AR-23 must present one conventional-DA customer journey over the proven PR-09 controls. It includes
intake, diligence, transferee-owned credit decision, executed documentation, governed replay
authority, immutable completion planning, partner observations, reconciliation, append-only repair
and downloadable dossier. Evidence and room visibility remain separately scoped. Expected facts are
never offered as observed facts.

The slice is `OBSERVE_ONLY`: it cannot dispatch funds, title, notices, source-system updates or
authoritative-register updates. Counsel route ratification, participant/operator acknowledgements,
recordkeeper confirmation and PR-12 controlled-live acceptance remain independent external gates.

## 7. AR-24 acceptance contract

AR-24 must present one conventional-PTC customer journey over PR-10 without collapsing the trustee,
RTA/depository/register, counsel, rating, assurance, servicer, subscriber or originator functions.
It includes programme/trust and appointment, pool transfer/eligibility, route-required independent
reviews, executed documents/tranche terms, subscription/consideration, trustee transaction control,
issue/allotment, authoritative-record acknowledgement, lifecycle/notice setup, reconciliation and
the reproducible dossier.

The journey remains `OBSERVE_ONLY`. The trustee is final for Rail transaction control; the legally
operative record remains the route-defined RTA, depository or register. Internal approval or a
matched comparison cannot close customer/trustee acceptance, counsel, provider, authoritative-
record or PR-12 controlled-live gates. AssurePlane is one optional assurance provider and is never a
mandatory dependency.

## 8. AR-25 acceptance contract

AR-25 adds route-neutral lifecycle plans only after an observe-only DA/PTC completion has reconciled
with no open completion break. Every ordered obligation names a material function, accountable
institution, performer class, due time, canonical expected fact and optional exact amount. Signed,
verified evidence records the assigned performer's actual acknowledgement; a different authorised
human reconciles it. Mismatches open a durable break and corrections append rather than overwrite.

The slice remains `OBSERVE_ONLY`: it cannot service assets, move funds, deliver legal notices,
exercise trustee discretion or alter an authoritative register. External performer, payment,
trustee/recordkeeper and controlled-live acceptance remain open.

## 9. AR-26 acceptance contract

AR-26 turns the PR-13 record layer into a named-audience primary venue without widening the legal
perimeter. It provides an opportunity register and detail workspace for governed term display,
invitations, interest, RFQ, negotiation and allocation, followed by an immutable accepted-allocation
handoff to the already-associated transaction case.

The handoff binds the exact term, allocation, audience grant, route-eligibility decision and proposed
case role. It does not create a second case, match parties, complete the transaction or accept a case
role for the counterparty. Owner and counterparty use separate mandates and step-up ceremonies. Once
audience access ends, retained handoff access is limited to the exact frozen handoff evidence and
does not reveal later terms or ongoing commercial records.

The slice remains `REPLAY/SHADOW` only. Function-by-function counsel, conduct and authorised-
performer gates remain open, and no payment, title, issue, allotment, register, token or external
instruction is emitted.

## 10. AR-27 acceptance contract

AR-27 turns the PR-14 observation layer into a conventional DA/PTC secondary register and guided
case journey. It requires current-holder/prior-chain, restriction/consent, seller authority,
executed-document, exact cash-observation and before/after authoritative-record evidence; PTC retains
a separate trustee transaction-control fact. Seller proposal/review and break-owner repair/review
use independent humans, scoped mandates, purpose-bound step-up and idempotency.

Corrections append a new verified evidence version and preserve the original break. Comparison CSV
and digest-bound evidence-pack exports require evidence authority and assert no legal effect. The
slice remains `OBSERVE_ONLY` in replay/shadow, with no trade execution, funds/title/token/notice or
register mutation. Counsel, participant, trustee/recordkeeper, VAPT and controlled-live acceptance
remain open external gates.

## 11. AR-28 acceptance contract

AR-28 productises the PR-11/15 tokenised-DA adapter and PR-16 tokenised-PTC shadow route without
merging them. One institution-scoped register opens a route-specific case cockpit. DA links a Note
only as a mirror, records authenticated observe-only action results and performs four-way token
supply/holding/economic-interest/authoritative-record reconciliation. PTC retains programme, trust,
class, trustee, recordkeeper and optional assurance-provider boundaries, 14 current external
evidence gates, independent review and five dormant action plans.

The product derives state from existing governed records and adds no duplicate product-status
schema. Evidence IDs/digests and the digest-bound export require `VIEW_EVIDENCE`; ordinary case
visibility remains redacted. Token legal finality, custody, connector/provider acceptance,
authoritative-record acceptance and PR-12 controlled-live approval remain open external gates.
`ARAIL_TOKENISED_PRODUCT_V1=shadow` is replay/shadow-only and requires both route products,
lifecycle, tokenised DA allow-list, tokenised PTC shadow, saga and internal-RBAC foundations. It adds
no live capability, external dispatch or authority claim.

## 12. Cumulative verification and stage evidence

`docs/qa/AssureRail_PR01_AR26_Integrated_Release_Audit.md` is the preceding cumulative
release-candidate checkpoint; `docs/qa/AssureRail_AR27_Conventional_Secondary_Product_Evidence.md`
records the additive AR-27 code gate and database rehearsal. AR-28 design and boundaries are in
`docs/design/AssureRail_Tokenised_Route_Product_AR28.md`, with implementation evidence in
`docs/qa/AssureRail_AR28_Tokenised_Route_Product_Evidence.md` and deployer handoff in
`docs/runbooks/AssureRail_AR28_Deployer_Handoff.md`. The cumulative
`scripts/assurerail-integrated-release-check.sh --code` repeats the compile, complete API
corpus, invariant checks, all web boundary checks and production web build; `--full` also runs every
available disposable PostgreSQL migration/service/restore rehearsal. Neither mode closes an external
gate.

Each stage produces:

1. design and rejected-shortcut record;
2. code/schema/API/UI change behind a fail-closed flag where applicable;
3. automated evidence with executed/skipped/external-open counts separated;
4. deployer handoff including exact flags, prerequisites, smoke checks and rollback;
5. as-built update to the implementation register; and
6. a cohesive commit and push without deployment.

External data, signatures, VAPT results, counsel opinions, provider certifications, customer
acceptance and authoritative-record confirmations remain open until actually supplied by their
accountable owners.
