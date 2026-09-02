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

## 8. Stage evidence and handoff

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
