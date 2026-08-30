# AssureRail — generic transfer infrastructure scope

**Status:** canonical founder decision and product-perimeter baseline, 30 August 2026. This is a
scope and architecture decision, **not** authority to build, launch, operate a venue, issue an
instrument or describe any route as legally available. A route becomes production-capable only
after the legal, regulatory, operating, security and participant gates in this document are closed.

**Founder decision:** AssureRail is generic, provider-neutral institutional infrastructure for
both **direct assignment (DA)** and **pass-through certificate (PTC)** transactions, in both
**conventional** and **authorised tokenised** form. Its long-term scope is the full institutional
transaction lifecycle, including permitted term display, counterparty discovery, RFQ/negotiation,
matching, primary completion/issuance, secondary transfer/trading, settlement coordination and
lifecycle administration. A full-stack customer experience does not imply that AssureRail may
legally perform every regulated function itself; each function is assigned to AssureRail, a
licensed partner or the applicable external authority in the effective route pack.

**Initial commercial decision:** establish in **domestic India** and run **both conventional DA
and conventional PTC as shadow workstreams**. Neither route is subordinated to the other at the
shadow stage. GIFT IFSC is a later, separately gated expansion, not the Phase 1 establishment.

**This supersedes** every narrower description of AssureRail as:

- a tokenised-DA-only venue;
- a system that can receive transactions only from AssurePool or AssureLocker;
- a system whose principal product is an “AssurePool Note”;
- a PTC hand-off reached by sending a transaction through AssurePool; or
- a production e-Rupee/DLT venue before the applicable legal and regulatory route is approved.

The older documents remain useful as design history and possible adapter material. They do not
govern the product perimeter after this decision.

---

## 0. Current implementation reality

AssureRail is **not starting from zero**, but the generic product in this document is not built.
The repository contains:

- `apps/assurerail` — a standalone web application;
- `apps/assurerail-api` — a NestJS API with its own data model, access/security and operating
  surfaces; and
- a current end-to-end slice centred on AssurePool tape intake, Note minting, surveillance,
  permissioned holdings and demo DvP.

The founder classifies the current product as the **tokenised-DA venue/slice**. It is one input to
the new architecture, not the definition of AssureRail. Code and README language referring to an
AssurePool Note, a hard-coded venue issuer, a trustee-authorised receivables mint, an AssureLocker
tape dependency or e-Rupee DvP are implementation facts/design experiments; they do **not** prove
conventional DA, conventional PTC or tokenised PTC capability. In particular, adding a trustee DID
or calling an object a Note does not create a legally or operationally complete PTC route.

Live HTS/HCS/settlement paths are explicitly gated in the existing API README, and the API can run
with demo adapters and an in-memory store. Therefore no existing route should be described as
production merely because the endpoint, screen, mint or DvP simulation works.

Before implementation planning, engineering must produce a gap map from the existing code to the
common kernel and four adapters in this document. Reuse sound controls; quarantine route-specific
assumptions; do not delete working code merely because its original product model was too narrow.

### 0.1 Decision lineage preserved for context

The historical design record contained three propositions that must not be silently erased:

1. **Domestic India first was already the preferred sequence.** The earlier path deferred GIFT
   IFSC to a later offshore/foreign-currency expansion because it adds IFSCA, FEMA, foreign-
   exchange, investor and settlement questions. The founder has now confirmed that sequence.
2. **Deal formation was previously kept off-rail.** The earlier “no marketplace” posture assumed
   that counterparties and terms would be agreed bilaterally or through an existing arranger or
   licensed venue, with AssureRail beginning at controlled transaction completion. That posture
   reduced venue-perimeter and market-conduct risk; it was not a finding that matching has no
   product value.
3. **A separate entity was previously tied to substance, not branding.** The earlier rule was to
   create one when the regulatory perimeter, liability profile or funding/cap table genuinely
   differed. The new instruction to include matching and full secondary trading makes those
   differences more likely and therefore strengthens—not weakens—the case for a separate
   AssureRail operating company before regulated live activity.

The founder's current full-stack instruction supersedes “no marketplace” as the long-term product
destination. It does not remove the value of launching through shadow, licensed-partner and
route-specific stages.

### 0.2 As-built code audit and binding disposition

This section records the deep repository baseline inspected on 30 August 2026 at commit
`ad99675dec6a3c2148de9eca97d9a0891cd02b54`. Remote refs were refreshed again before PR-00
verification; `origin/main` was then `336fa6d62dc02df6a1eca269677a957ed74ea32b`. The intervening main
delta added OVD acquisition-channel controls, co-lending demo-zone guard execution and KYB audited-
financial reconciliation—not new Rail runtime files; the focused transfer-room golden suite was rerun
against the refreshed baseline. The working branch and working tree contain additional changes, so
the disposition below is an architecture/migration decision, not an instruction to overwrite or move
files without a reviewed migration PR.

The co-lending and DigiKYB corrections first observed concurrently during this audit are now part of
the merged baseline in commits `c2dc5f3d3` and `ad99675de`. They add explicit control coverage and
`NOT_APPLICABLE` records, synthetic-rule markers, a shared-zone excerpt privacy guard, clearer
2dp-wire-versus-4dp-computation money boundaries, runnable zone guards, and an evidence-trust helper
that distinguishes an **expected** cross-check from an entity-level cross-check actually achieved.
Rail should reuse their fail-closed semantics. They do not change the product ownership decisions
below.

The phrase **“tokenised AssurePool DA demonstration” is incorrect and must not be used**. What
exists is an **AssureRail tokenised-DA demonstration slice** which happens to ingest an AssurePool
tape as its current sample/source contract. AssurePool prepares a DA tape; AssureRail owns any
tokenised representation, venue transaction and DvP demonstration.

The current code is not discarded. Its target disposition is:

| Current code/capability | What is actually present | Binding disposition | Target owner |
|---|---|---|---|
| `apps/assurerail` and `apps/assurerail-api` | Separate web/API, database, authentication, DigiKYC gate, user roles, MFA/passkeys, tape verification, documents, mint, permissioned holdings, surveillance mirror, amortisation, closure, DvP, reporting, billing, webhooks, audit/events, security and operations surfaces | **Retain and refactor in place.** These are the AssureRail foundation. Generic services are separated from tokenised-DA assumptions; working security, audit and operations controls are not rebuilt | AssureRail |
| `apps/assurerail-api/src/tape/*` and `platform/ingress.service.ts` | Intake is hard-bound to an AssurePool `poolId`, AssureLocker endpoint and AssurePool tape type; persistence is `IngestedPool` | **Generalise.** Add a provider-neutral intake envelope, `transactionCaseId`, source/provider identity and schema adapters. Keep an AssurePool adapter; do not make it the canonical schema | AssureRail kernel plus source adapters |
| AssureRail `mint`, `dvp`, `holdings`, `amortise`, `close` and surveillance modules | A useful tokenised-DA lifecycle and control demonstration, with demo/live adapter gates, but hard-coded Note/mint/token language | **Keep as a tokenised-representation adapter.** Extract common reconciliation, exact-money, state, audit and settlement controls; do not relabel it as conventional DA or PTC | AssureRail tokenised adapter; common controls in kernel |
| AssureRail `DocumentsService` and `Document` model | Document storage/evidence capability keyed mainly to `noteId` | **Adapt, not replace.** Introduce transaction-case and evidence-object ownership, document version/purpose, participant access policy and route-specific gates; preserve legacy note linkage during migration | AssureRail kernel |
| `apps/api/src/entity/*`, `modules/services/entity-membership.service.ts`, `auth/saml-auth.service.ts`, related web screens and the central `EntityApplication`, `EntityMembership`, `EntityApiClient` and `EntityProfile` models | A substantial AssureLocker-wide institution lifecycle already exists: Indian entity identifiers/evidence, application/review/clarification, DID binding, membership/invites, SAML, roles, provisional/final membership, recertification, revocation, change-proposal maker-checker, API clients, retention/legal hold and dossier export. The merged evidence-trust correction separates catalogue expectations from achieved entity-level verification | **Reuse deliberately; do not duplicate or create a compulsory runtime dependency.** Extract neutral institution/membership/evidence-trust contracts or consume signed snapshots through an adapter. Rail retains a route-scoped participant/admission record sufficient for continuity. Reconcile legacy/new member UI/API contracts before reuse; never promote `crossCheckExpected` into verified evidence | Shared identity/admission primitives + AssureRail participant snapshot; AssureLocker remains one provider |
| `apps/api/src/co-lending/onboarding/*`, its web workspace and `ClaOnboarding*`/decision/evidence/authority/gap/validation/approval models | A tested AssureCLA **arrangement/policy onboarding** workflow: named-command state machine, immutable evidence versions, quarantine, scoped authority, concurrences, gaps, validation runs, passkey/PQ approval ceremony, audit chain, activation/suspension and export | **Extract the generic case-control patterns; do not port the co-lending decisions as Rail admission policy.** Keep CLA decisions, scenario packs and product activation in AssureCLA. Rail reuses/adapts state, evidence, authority, gap, ceremony and audit concepts for participant/route certification | AssureCLA product policy + shared workflow primitives + AssureRail admission |
| `packages/shared/src/co-lending/connector-{adapters,certification,evidence,health}.ts`, schema registry and dual-run utilities | Useful conformance, provenance, health/fail-closed and dual-run machinery, but connector catalogue/payloads and sign-offs are AssureCLA/co-lending-specific | **Generalise the framework, keep the catalogues separate.** Rail defines transaction/participant connector profiles and accepts AssurePool or third-party adapters through the same certification interface | Shared certification framework + product/route connector packs |
| `packages/shared/src/co-lending/pool.ts`, `tape.ts`; the AssurePool service/controller/UI and pool database models | DA candidate-pool evaluation, eligibility/readiness, freeze, deterministic manifest/tape, lock, exception/override evidence and tape export | **Keep in AssurePool.** Remove venue/token-mint terminology from the source product. Publish a neutral versioned export adapter alongside the existing contract until consumers migrate | AssurePool in AssureCLA |
| `packages/shared/src/co-lending/pool-surveillance.ts` and AssurePool cycle/surveillance endpoints | Exact waterfall conservation, credit-enhancement/delinquency triggers and period continuity over the underlying pool | **Split by responsibility, not by copying.** AssurePool may retain source-side pool performance evidence where contracted. AssureRail owns transaction/instrument lifecycle orchestration, holdings, distributions, notices and participant/trustee views. Share deterministic calculation primitives where both need them | AssurePool source evidence + AssureRail lifecycle |
| `apps/api/src/co-lending/transfer-room.*`, `PoolTransferRoom`/invite/access-log/message models and both transfer-room screens | A strong, tested consented transaction/diligence room: named parties, invitations, restricted reads, declarations, hash-chained access logs, manifest-drift checks, findings, dossier, Q&A and closure. It is currently bound to `poolId` and stored in the co-lending domain | **Move runtime ownership to AssureRail and generalise.** Create a provider-neutral case/room keyed by `transactionCaseId`; retain an AssurePool source link/adapter. Migrate data and routes compatibly before retiring old writes | AssureRail kernel |
| `packages/shared/src/co-lending/transfer/{types,derive,validate,rule-registry}.ts` and `apps/api/src/co-lending/transfer/transfer.service.ts` | A tested but unproductised receivables-transfer evidence/validation product: receivable structures, legal-review inputs, MHP/party/completion validation, effective-dated counsel rules and immutable evidence record | **Keep as AssureTransfer product logic.** Rail can invoke it as an optional DA/receivables evidence pack, but it is not the venue kernel and is not silently folded into AssurePool | AssureTransfer, suite placement still open |
| `packages/shared/src/co-lending/transfer/{chain,fingerprint}.ts` | Invoice fingerprints, duplicate/prior-transfer/circularity findings, frozen manifest, PII fencing and an in-memory claim registry | **Extract only the neutral primitives.** Preserve AssureTransfer policy/rules; put reusable manifest/provenance/PII interfaces in a neutral shared package and implement durable claim/transaction records in Rail | Shared primitives + AssureRail runtime |
| `apps/api/src/co-lending/transfer/completion.machine.ts` | A requirement-plan-driven completion state machine with rule-attributed transitions | **Reuse the pattern, not the product coupling.** Lift generic transition/guard/idempotency concepts into the Rail case engine; retain AssureTransfer-specific route plans with AssureTransfer | AssureRail kernel + AssureTransfer route pack |
| `packages/shared/src/co-lending/transfer/rail.ts` | Despite its filename, an AssureDynamicPay buyer-cash/lender-funded intake and registration adapter | **Do not move merely because it says `rail`.** Rename when safely possible and expose it as a DynamicPay funding-intake adapter that may feed AssureRail | AssureDynamicPay integration adapter |
| `apps/worker/src/assuretransfer-deadline-sweep.ts` | Shape-only deadline computation used by tests, with no production scheduler wiring | **Generalise and wire only after the case/deadline model exists.** Route-specific deadlines remain in effective rule packs; Rail owns durable scheduling, retries, escalation and audit | AssureRail runtime + route packs |
| AssureRail route-scoped institutional admission, PTC route, marketplace/RFQ/matching and conventional authoritative-register cases | No complete domain or runtime is wired into the current Rail app/schema. Institution and arrangement-onboarding assets exist elsewhere in the repository, but do not yet establish Rail permissions | **Build the missing Rail capability by adapting/extracting existing controls and adding route-specific records.** A token Note, trustee DID, AssureLocker entity badge or free-form ingress specification is not a substitute | AssureRail |

Two current defects/couplings must be visible in the migration backlog:

1. AssurePool implements `markPoolLockPermanent`, but the audited code has no caller from the
   current AssureRail DvP path. A successful Rail demonstration therefore does not complete the
   source-lock lifecycle. The replacement is a provider-neutral, idempotent completion
   acknowledgement; the AssurePool adapter may translate that into a permanent lock.
2. AssureRail live onboarding depends on AssureLocker DigiKYC and activates a user against coarse
   platform roles. That is a useful identity-provider integration, not institutional admission or
   a lawful requirement that customers buy AssureLocker.

#### 0.2.1 Migration rules

The move is a controlled strangler migration, not a filesystem shuffle or a big-bang rewrite:

1. Freeze and characterise the existing behaviour with contract tests and golden fixtures before
   changing ownership.
2. Introduce neutral contracts first: `transactionCaseId`, participant/institution identifiers,
   source/evidence references, route/representation discriminators and versioned event envelopes.
3. Add an AssurePool adapter that maps the existing frozen tape and pool lock to those contracts;
   do not force AssurePool fields on other providers.
4. Create the Rail-owned case/room persistence and APIs, then backfill legacy room records with a
   reversible `legacyPoolId`/`legacyRoomId` mapping and immutable migration receipt.
5. Dual-read and compare during shadow; keep one declared write authority at a time. Do not
   dual-write without idempotency keys, reconciliation and a repair queue.
6. Switch each caller behind a route/feature flag only after parity, authorisation, audit and data-
   migration checks pass. Preserve old URLs/events through compatibility adapters for an agreed
   period.
7. Retire old writes only after export/replay, rollback and participant acceptance tests. Historical
   evidence and access logs are never rewritten to look native to Rail.
8. Extract shared deterministic code only where there are at least two genuine consumers. Product-
   specific legal policy stays with the product/route pack that owns it.

### 0.3 AssureRail institutional onboarding is a first-class workstream

The current Rail `/onboard` journey verifies an individual identity and activates a `VenueUser`.
Administrators can manually assign coarse roles such as issuer, desk, investor, trustee and
regulator. This is useful authentication groundwork, but it is not sufficient onboarding for an
institutional DA/PTC rail. The Rail database has no complete institution, membership, mandate,
appointment, regulated-status, settlement-account, external-register, connector-certification or
route-permission domain wired into it.

That does **not** mean the repository is blank. The central AssureLocker API/data model already has
institution applications, entity evidence, DID binding, memberships, SAML, role administration,
maker-checker change proposals, API clients, recertification, retention/legal hold and dossier
export. AssureCLA also has a mature co-lending arrangement-onboarding case with immutable evidence,
scoped authority, named transitions, gaps, validation runs, approval ceremony, activation and
suspension, plus shared connector certification/dual-run machinery. These are source assets for
Stage 1A. They are not yet a Rail participant-admission system, and copying their product-specific
statuses or requiring their services at runtime would be the wrong reuse.

The target must separate three different questions:

- **Who is the human?** Authentication, verified identity, MFA/passkey, device/session and step-up.
- **Whom may the human bind?** Legal entity, membership, employment/agency basis, signing mandate,
  maker-checker limits, delegated authority and effective dates.
- **What may the institution do on this route?** Participant role, regulated status, product/asset
  class, jurisdiction, transaction route, representation, lifecycle leg, limits and conditions.

The onboarding capability must cover:

| Workstream | Required record and control |
|---|---|
| Institution application | Legal name/identifiers, constitutional form, registered/operating addresses, group/ownership/control, authorised contacts, tax and regulatory identifiers, data residency and declared purpose |
| KYB/KYC and screening | Versioned provider result, evidence reference, scope, as-of/expiry, exceptions and reviewer. AssureVerifID/DigiKYC/DigiKYB may be one adapter; equivalent approved external evidence must be accepted |
| Regulatory and role eligibility | Licence/registration/category, issuing authority, status/effective dates, permitted functions and evidence. No free-text role or sales promise can confer permission |
| Institution membership | User-to-entity role, invitation/acceptance, maker/checker group, authority limit, signing class, delegation, recertification and revocation. New users must not default substantively to “investor” |
| Transaction-role enrolment | Route-specific roles including originator/transferor, transferee, issuer/SPE, investor, trustee, arranger, rating agency, counsel, servicer, account bank, RTA, depository, custodian and appointed assurer/reviewer |
| Mandates and appointments | Contract/appointment type, parties, scope, transaction/programme applicability, start/end, fee/conflict disclosure, decision rights, replacement and termination |
| Cash, settlement and register setup | Referenced settlement accounts, approved payment route, authorised signers, trustee/RTA/depository/custodian endpoints, authoritative-record type and reconciliation owner. Store references/tokens rather than avoidable banking secrets |
| Data source and connector onboarding | Source system, schema/version mapping, authentication method, signing keys/certificates, environments, permitted data, acknowledgement/correction semantics, conformance results, support owner and exit/export method |
| Route admission | Explicit matrix over route, representation, jurisdiction, placement/listing, asset class, primary/secondary leg, participant role, limits and `mode-readiness` ceiling |
| Security and operations readiness | MFA/passkey policy, privileged-access owners, support/escalation contacts, SLA, incident notification, BCP/DR contacts, change windows, complaint/default contacts and periodic access review |
| Certification | Sandbox/shadow conformance, completed-deal replay, maker-checker rehearsal, negative/exception cases, settlement/register break exercise and participant sign-off |
| Platform decision and lifecycle | Independent maker-checker review, reasoned approval, route-scoped activation, conditions/expiry, renewal, suspension, remediation, rejection, exit, data export and credential/connector revocation |

Minimum application states are:

```text
DRAFT → SUBMITTED → DUE_DILIGENCE → REMEDIATION
      → APPROVED_SHADOW → APPROVED_SANDBOX → ACTIVE_ROUTE_SCOPED
```

`REJECTED`, `WITHDRAWN`, `SUSPENDED`, `EXPIRED` and `EXITED` are explicit states. A participant can
be active for one route/role and prohibited for another. User authentication never overrides an
institution or route suspension.

#### 0.3.1 Onboarding implementation boundary

Reuse the Rail user, session, MFA/passkey, security-event and admin foundations. Extract or adapt the
central institution-application, membership/invite, SAML, maker-checker, API-client, retention and
export controls rather than designing duplicates. Extract the generic named-transition, immutable-
evidence, scoped-authority, gap, approval-ceremony and audit patterns from AssureCLA onboarding,
while leaving its co-lending decisions and product activation inside AssureCLA. Generalise the
connector certification/health/dual-run framework and keep route/provider catalogues separate.

Add only the Rail-specific domains that are genuinely absent: participant snapshot, appointment,
settlement/register endpoint, route entitlement, mode-readiness ceiling and Rail certification.
Replace manual Rail role assignment as the source of truth with derived, effective-dated
entitlements; retain emergency admin tooling only with maker-checker, reason and audit. Because the
central services belong to a broader AssureLocker estate, Rail must be able to ingest a signed
snapshot and continue safely if that provider is unavailable; it must not make an AssureLocker
product purchase or live central-service call a condition of participation.

The first onboarding delivery is complete only when:

- the same institution can be onboarded without buying AssureLocker;
- two people from one institution can exercise tested maker/checker authority and neither can
  exceed or self-approve its mandate;
- a trustee and originator can be activated for conventional PTC shadow while remaining barred
  from unapproved live or tokenised functions;
- an AssurePool connection and a third-party source connection pass the same neutral conformance
  contract;
- suspension immediately blocks new governed actions without destroying historical access/audit;
- every entitlement decision is reconstructible from evidence, rule version, approvers and time;
- a catalogue requirement or expected corroboration never becomes an achieved verification unless
  an entity-specific evidence record names the sources, method, time and result; and
- exit produces a complete permitted export and revokes users, credentials, webhooks and connector
  authority in a tested sequence.

---

## 1. The product in one sentence

> **AssureRail is provider-neutral transaction infrastructure through which eligible institutions
> can prepare, discover, negotiate, govern, execute, evidence, settle, transfer and administer
> permitted DA and PTC transactions, using either conventional authoritative records or an
> authorised tokenised representation.**

Short external wording, once counsel and claims review permit it:

> **One institutional rail for loan transfers and securitisation — DA or PTC, conventional or
> tokenised.**

“Venue” may remain the commercial category, but it is not itself a legal conclusion or a claim to
hold a particular licence. Legal materials must identify the exact functions performed, by whom,
in which jurisdiction and under which permission. Until that work is complete, product and
engineering documents should prefer **transaction infrastructure** over an unqualified claim that
AssureRail is an exchange, market or regulated venue.

---

## 2. The two-axis taxonomy

Transaction route and representation are independent choices. Neither may be inferred from the
other.

### 2.1 Axis A — transaction route

| Code | Route | Economic/legal structure | Minimum institutional parties | Governing-route baseline |
|---|---|---|---|---|
| `DA` | Direct assignment | A bilateral transfer of loan exposures under the applicable transfer structure and documents | Transferor/originator and transferee; servicer and account bank where applicable | RBI Transfer of Loan Exposures Directions, applicable entity law, contract, stamp, tax, registry and asset-specific rules; counsel-ratified route pack |
| `PTC` | Pass-through certificate securitisation | A pool is transferred to a bankruptcy-remote trust/SPE and investors hold issued securitisation interests/certificates | Originator, trustee/SPE, investors; ordinarily arranger, rating agency, counsel, servicer, account bank and relevant registrar/depository/custodian roles | RBI Securitisation Directions, SEBI SDI framework where applicable, trust/SPE, issue/listing, rating, depository, tax, stamp and investor-eligibility rules; counsel-ratified route pack |

The table is a product taxonomy, not a complete legal opinion. The rule pack must be effective-dated
by transaction date, party type, asset class, jurisdiction, listing/placement route and instrument
characteristics.

### 2.2 Axis B — representation

| Code | Representation | Meaning | Authoritative record |
|---|---|---|---|
| `CONVENTIONAL` | Conventional/traditional | The transaction may be digitally orchestrated, but no token purports to carry the transferred or issued interest | The documents, trustee/issuer/RTA/depository/lender records and other registers recognised for that route |
| `TOKENISED` | Authorised tokenised | A permissioned digital representation is used only to the extent expressly supported by the approved legal and regulatory route | Exactly the register identified by counsel and the relevant authority; until a token can lawfully be authoritative, it is a reconciled mirror and **not title** |

“Traditional” therefore does **not** mean manual or paper-only. A conventional AssureRail transaction
can still be fully digital, API-enabled, workflow-controlled and tamper-evident. “Tokenised” does
not mean public crypto, retail access or unpermissioned transfer.

### 2.3 The four product modes

| Mode | Required product capability | Initial posture |
|---|---|---|
| **Conventional DA** | Bilateral transaction room; party and mandate controls; transferee-owned diligence workflow; permitted term display/RFQ/negotiation; pool/tape lock; document and condition-precedent control; consideration and completion evidence; first and subsequent transfer support; external-register reconciliation; post-transfer servicing evidence | Selected as one of two parallel conventional shadow workstreams before live execution |
| **Tokenised DA** | Everything in conventional DA plus permissioned-holder controls, legal-record mapping, token lifecycle, one-to-one reconciliation, token/settlement failure handling and approved cash-leg adapter | Existing concept/demonstration material may be reused; sandbox-only until the legal character and permissions are explicit |
| **Conventional PTC** | Trust/SPE and role setup; pool transfer; independent review/assurance intake; rating and counsel conditions; permitted term display/book-build/RFQ/matching; primary issue/allotment/register evidence; investor permissions; secondary trading/transfer hand-off; cash-flow waterfall; credit-enhancement and trigger records; investor/trustee/rating surveillance packs | Selected as one of two parallel conventional shadow workstreams; net-new and designed with a trustee, repeat originator and anchor institutional investor |
| **Tokenised PTC** | Everything in conventional PTC plus legally approved token issuance/holding/transfer, allow-listing, custody or wallet governance, authoritative-register reconciliation, corporate-action/lifecycle processing and approved DvP | Net-new and the most highly gated mode; sandbox/controlled-pilot only until the full regulatory route is approved |

No mode is a second-class branch. Delivery sequence reflects legal and implementation risk, not the
long-term product hierarchy.

---

## 3. Product-family boundaries

The names answer different customer jobs. They must not collapse into one another.

| Product/capability | Owns | Does not own |
|---|---|---|
| **AssurePlane** | An optional control/evidence and assurance product within the AssureCLA suite, consumed where the accountable appointing party chooses it | The AssureRail venue; compulsory assurance; trustee accountability; universal approval of a transaction |
| **AssurePool** | Optional **DA-only** pool/tape preparation inside the AssureCLA suite: candidate pool, eligibility/readiness, freeze, deterministic manifest, source evidence and source-side pool performance evidence where contracted | PTC; transaction/deal-room ownership; venue operation; investor matching; instrument/holding administration; custody; settlement; a mandatory gateway into AssureRail |
| **AssureTransfer** | A currently homeless/incomplete, parallel receivables-transfer evidence and validation product: effective-dated rules, transfer facts, receivables manifest/provenance, legal-review inputs and immutable evidence output | A settled suite placement; the AssurePool sub-product; the AssureRail venue kernel; transaction-room runtime, authoritative registry or settlement |
| **AssureRail** | Provider-neutral DA/PTC transaction infrastructure, including permitted admission, term display, counterparty discovery, RFQ/negotiation, matching, completion/issuance, secondary transfer/trading, registry/settlement adapters and lifecycle administration for the selected mode | The lender's non-delegable judgement; trustee, arranger, rating, counsel, custodian, depository, RTA or assurance-provider accountability unless separately and lawfully appointed |

The current filesystem location is not the product boundary. In particular, transfer-room runtime
presently stored under `co-lending` is marked for migration to AssureRail, while AssureTransfer's
receivables rules remain a separately invokable evidence product unless and until the founder makes
a later suite-placement decision.

### 3.1 Binding relationship rules

1. **AssurePool remains DA-only.** PTC does not start in, pass through or return to AssurePool.
2. **AssureRail supports DA independently of AssurePool.** An institution may use its LMS, LOS,
   data warehouse, incumbent securitisation platform, trustee system or another provider.
3. **AssurePool is one optional feeder.** Where used, it supplies a versioned evidence package over
   the same published interface available to third-party providers.
4. **AssureRail cannot depend on AssureLocker availability to transact.** It must ingest, validate,
   retain or securely reference everything required for its own permitted operation and continuity.
5. **No privileged assurance path.** A trustee or other accountable appointing party chooses the
   assurance/review provider. It may choose AssurePlane, another firm or its own permitted process.
   AssureRail accepts the resulting signed, scoped evidence object if it meets the route schema.
6. **No hidden write-back.** AssureRail may send completion and lifecycle events to a consenting
   source system, but cannot silently change an AssurePool/AssureCLA assurance result, eligibility
   decision or historical evidence record.
7. **Related-party services are visible.** If AssurePlane or another related-party service is used,
   the appointment, fee, scope, independence basis and any conflict controls are disclosed in the
   transaction record.
8. **AssureTransfer is optional evidence logic, not Rail's case authority.** A Rail DA route may
   invoke it where its receivables scope applies. Bilateral users may also use it without Rail. Its
   result cannot open, complete, settle or transfer a Rail case by itself.

This separation provides commercial interoperability and operational resilience. It also supports
the trustee-led assurance model: the party accountable for the PTC programme organises the review;
AssureRail transports and enforces the evidence requirement without marking its own transaction.

---

## 4. Common transaction kernel

The four modes share one controlled kernel and use route/representation adapters. Engineering must
not implement four independent products, and must not erase route differences behind a generic
status field.

```text
Institution / incumbent / AssurePool / AssureTransfer / AssurePlane / other provider
                                      │
                         Provider-neutral intake contract
                                      │
┌────────────────────────────────────────────────────────────────────┐
│                    ASSURERAIL COMMON KERNEL                        │
│ party + authority │ evidence │ gates │ state │ audit │ lifecycle   │
└────────────────────────────────────────────────────────────────────┘
              │                                  │
       Route adapter                       Representation adapter
       ├─ DA                                ├─ conventional registers
       └─ PTC                               └─ authorised token registry
              │                                  │
       External legal, registry, payment, depository and reporting rails
```

### 4.1 Kernel capability map

| Kernel domain | Required capability |
|---|---|
| **Transaction identity** | Globally unique case ID; route, representation, jurisdiction, asset class, programme, legal entities, effective rule-pack version and source-system references |
| **Party and authority** | Legal-entity identity; regulated status where relevant; role; mandate; signing authority; maker-checker; delegated permissions; effective dates; conflicts; participant suspension and revocation |
| **Provider-neutral intake** | Versioned schemas; file and API carriers; manifests, hashes, signatures, receipts, schema/rule versions, provenance and a canonical validation result; no proprietary AssurePool field may be mandatory |
| **Evidence** | Immutable evidence objects; source class; provider; independence domain; scope; as-of date; validity/expiry; qualifications; exceptions; supersession; legal-authority reference; retention and access controls |
| **Rules and gates** | Effective-dated route packs; `REVIEW_PENDING`/`APPROVED` governance; fail-closed result assembly; conditions precedent/subsequent; explicit override authority; no silent default or permissive unknown |
| **State machine** | Transition guards, required approvers, idempotency, concurrency control, timestamps, reversal/cancellation reason, failed-settlement recovery and append-only transition evidence |
| **Documents** | Approved templates and negotiated versions; schedule-to-tape reconciliation; digital signature evidence; stamp/filing/notice evidence; disclosure versions; signed-copy completeness |
| **Settlement orchestration** | Payment instruction/reference, asset-leg readiness, conditional release, settlement confirmation, breaks, retries, cancellation and reconciliation. AssureRail does not hold funds unless specifically authorised |
| **Authoritative record** | For every transaction, exactly one declared legal source of truth for ownership/holding; adapter acknowledgements; before/after snapshots; discrepancy queue; no dual authoritative state |
| **Lifecycle** | Servicing and collection reports; pool factor; waterfalls; credit enhancement; trigger events; payments; delinquencies/defaults; substitutions/repurchases; maturity/redemption; surveillance cadence and recipients |
| **Audit and oversight** | Tamper-evident logs; human/service actor; reason and authority; exportable regulator/trustee/auditor record; access reviews; operational reconciliations; incident and exception registers |
| **Resilience** | Mode-specific RTO/RPO; tested restore; queued external events; reconciliation after recovery; provider exit/export; no critical dependency on one assurance provider or source platform |

### 4.2 Canonical transaction discriminator

At minimum, every case carries governed values equivalent to:

```text
transaction_route       = DA | PTC
representation          = CONVENTIONAL | TOKENISED
jurisdiction            = <effective legal jurisdiction>
market_context          = DOMESTIC | IFSC | OTHER_APPROVED  # initial value: DOMESTIC
placement_or_listing    = BILATERAL | PRIVATE_PLACEMENT | LISTED | OTHER_APPROVED
lifecycle_leg           = INITIAL_TRANSFER_OR_ISSUE | SECONDARY_TRANSFER_OR_TRADE
asset_class             = <governed taxonomy code>
legal_record_type       = <approved authoritative-register type>
route_pack_id/version   = <counsel-ratified effective rules>
operating_mode          = REPLAY | SHADOW | SANDBOX | CONTROLLED_LIVE | PRODUCTION
```

The pair `transaction_route + representation` is immutable after the evidence-lock gate. A change
creates a new transaction version and a recorded migration/cancellation of the old one.

### 4.3 Function-performance taxonomy

“Full stack” is a product-scope statement, not permission for one entity to perform every role. For
each mode, jurisdiction and lifecycle leg, the route pack must assign every material function one
of these values:

| Code | Meaning | AssureRail treatment |
|---|---|---|
| `OWNED_AUTHORISED` | AssureRail is expressly permitted, contracted, staffed and accountable for the function | Performs the function and retains its complete decision/audit record |
| `LICENSED_PARTNER` | A licensed/recognised intermediary or market infrastructure performs the regulated act within the AssureRail journey | AssureRail may provide the unified interface and workflow but records the partner as performer and preserves the partner acknowledgement |
| `PARTICIPANT_OWNED` | An originator, transferee, investor, issuer, trustee or other transaction party retains a non-delegable decision or duty | AssureRail provides facts, controls and evidence without substituting its judgement |
| `EXTERNAL_AUTHORITY` | A depository, RTA, trustee-designated register, clearing corporation, bank or statutory system creates the legally operative result | AssureRail instructs or observes only as permitted, reconciles and does not overwrite |
| `PROHIBITED` | The function is not allowed in that product/regulatory mode | UI and API fail closed; sales and contracts cannot imply availability |

At minimum, the matrix covers participant admission, instrument/loan admission, disclosures, term
display, solicitation, recommendation/ranking, quote invitation, negotiation, matching, allocation,
execution, issuance/allotment, clearing, cash settlement, register update, custody, secondary
transfer/trading, lifecycle calculation, surveillance, complaints, default handling and regulatory
reporting. One function may change performer between DA/PTC, primary/secondary and
conventional/tokenised modes. No generic “venue enabled” flag may bypass this matrix.

### 4.4 Common state spine

All modes map to a common state spine while retaining route-specific substates:

```text
DRAFT
  → PARTICIPANTS_AUTHORISED
  → EVIDENCE_LOCKED
  → DILIGENCE_OR_REVIEW_COMPLETE
  → CONDITIONS_SATISFIED
  → READY_TO_SETTLE_OR_ISSUE
  → SETTLEMENT_OR_ISSUE_IN_PROGRESS
  → COMPLETED
  → ACTIVE_LIFECYCLE
  → MATURED / REDEEMED / TERMINATED
```

At every pre-completion state, `CANCELLED`, `EXPIRED` and `FAILED` are explicit terminal or recovery
paths. A user-interface label never creates legal completion; the completion event needs the
mode-specific evidence bundle below.

---

## 5. Route-specific design

### 5.1 DA adapter

The DA adapter must support, only where the approved route pack permits:

- transferor and transferee role/eligibility capture;
- admission of eligible loan exposures and participant-provided transfer interests;
- controlled term display, counterparty discovery, RFQ and negotiation without representing that
  AssureRail has made the transferee's credit decision;
- pool/tape cutoff, eligibility and MHP evidence;
- the transferee's own diligence workspace, approvals and exceptions;
- offer/acceptance and negotiated transfer terms without AssureRail giving credit advice;
- assignment/novation/participation document variants where legally applicable;
- loan schedule and executed-document reconciliation;
- consideration instruction, confirmation and break handling;
- required borrower/registry/servicer/accounting notices and acknowledgements;
- transferor/transferee source-system updates and external register evidence;
- subsequent transfers of an eligible exposure, with provenance back to the prior legal transfer,
  current holder/participant authority and controls against duplicate or inconsistent transfer;
- servicing continuity, collection remittance and repurchase/substitution events; and
- completion evidence sufficient to show what moved, between whom, when, for what consideration
  and by which recognised legal mechanism.

**Non-delegable boundary:** under the applicable RBI transfer regime, the transferee owns its
diligence and credit decision. AssureRail can organise facts, calculations, exceptions and evidence;
it does not make or outsource that judgement.

### 5.2 PTC adapter

The PTC adapter is not “DA plus a certificate”. It must separately support:

- programme, trust/SPE and transaction-account setup;
- originator, trustee, arranger, counsel, rating agency, servicer, account bank, investors and
  registrar/depository/custodian roles as applicable;
- initial pool selection, cutoff, transfer to the trust/SPE, MHP/MRR and representations;
- independent review/assurance evidence appointed by the trustee or other accountable party;
- rating process inputs, versions, surveillance and publication permissions;
- term sheet, information memorandum/disclosure, trust deed, assignment, servicing, account,
  placement/subscription and other controlled document families;
- tranche/class structure, credit enhancement, priority of payments and loss allocation;
- investor eligibility, allocation, subscription, funding, issue, allotment and holding-register
  evidence;
- primary placement/book-build hand-off and secondary RFQ/trading hand-off through the performer
  authorised for the applicable mode;
- cash-flow waterfall calculation and independent reconciliation;
- servicer advances, collections, pool factor, delinquency/default, prepayment, trigger, credit-
  enhancement utilisation and clean-up/maturity events;
- trustee, investor, rating and regulator reporting at governed frequencies; and
- replacement/fallback procedures for servicer, account bank, calculation agent, technology
  provider and other critical roles.

The trustee-led assurance choice is deliberate. AssureRail enforces that a required review exists,
is signed, scoped, current and attributable. It does not select itself or an affiliate as reviewer,
and it does not convert an external review into an AssureRail assurance grade.

### 5.3 Conventional representation adapter

This adapter integrates with the recognised documents and registers for the route. It must capture:

- declared authoritative register and accountable recordkeeper;
- pre-transaction snapshot or reference;
- accepted instruction and acknowledgement;
- post-transaction snapshot/reference;
- reconciliation status and unresolved breaks; and
- legally and operationally meaningful time of completion.

“On AssureRail” is never sufficient completion evidence by itself.

#### 5.3.1 Trustee authority and the legal system of record for PTCs

The founder's operating instruction is that **the trustee is the final transaction-control
authority for the PTC workflow**, including when the trustee directs AssureRail to rely on evidence
from a depository, RTA or other register. That instruction is implemented without pretending that a
trustee's informal statement can rewrite a statutory or legally operative holding record:

```text
PTC transaction-control authority = trustee
PTC legal system of record         = route-pack-defined depository/RTA/register, as applicable
AssureRail platform record         = reconciled evidence and state; never an unapproved substitute
```

For completion or transfer, AssureRail requires a trustee-signed or trustee-authenticated
confirmation that identifies the external acknowledgement or snapshot on which the trustee relies.
Where the trustee, depository/RTA and AssureRail records disagree, AssureRail must:

1. classify the discrepancy as a critical break and prevent further issue, transfer, settlement
   release or token movement affected by it;
2. notify the trustee and the accountable recordkeeper;
3. accept correction authority from the trustee but require the correction to be made and
   acknowledged in the legally operative system; and
4. retain the before/after records, reason, authority and reconciliation evidence.

Thus, the trustee has the final operational acceptance/rejection decision in AssureRail, while the
route-defined depository or other register retains its legal force. This distinction prevents an
internal platform entry—or a casual email—from creating a competing ownership record.

### 5.4 Tokenised representation adapter

This adapter is an additional controlled representation, not a shortcut around the conventional
route. It must add:

- approved legal character of the token for this route and jurisdiction;
- issuer/controller and token-contract authority;
- permissioned participant and holder allow-list;
- wallet/custody/key lifecycle, recovery and segregation model;
- mint, transfer, freeze, correction, redemption and burn authorities;
- token supply and economic-interest reconciliation;
- deterministic link to the transaction/pool/evidence manifest;
- approved cash-leg and DvP semantics, including partial-failure recovery;
- privacy classification and a prohibition on borrower personal data on an immutable ledger;
- chain/technology outage, fork/change and exit procedures; and
- an explicit statement of whether the token is the authoritative record or a digital mirror.

Until counsel and the relevant authority confirm that the token itself is legally authoritative,
the conventional record remains authoritative. Divergence blocks further token movement and raises
a critical operational exception.

---

## 6. Participants, accountability and separation

| Role | Accountability AssureRail must preserve |
|---|---|
| Originator/transferor | Asset facts, representations, valid transfer authority, servicing data and disclosures |
| Transferee/investor | Own diligence, credit/investment approval, eligibility, funding authority and acceptance of terms |
| Trustee/SPE | PTC fiduciary/transaction duties, appointments, controlled accounts, authoritative records and stakeholder reporting as applicable |
| Arranger/placement agent | Structuring, distribution and placement functions where appointed and permitted |
| Rating agency | Rating methodology, opinion and surveillance; AssureRail only transports authorised inputs/outputs |
| Legal counsel | Route, document, perfection, authority, regulatory, tax/stamp and enforceability conclusions |
| Independent assurer/reviewer | Signed conclusion within its commissioned scope; selected by the accountable appointing party, not imposed by the venue |
| Servicer/calculation agent | Collections, servicing, calculations, reports, reconciliations and exception resolution |
| Account bank/payment provider | Cash custody/movement and confirmation; AssureRail ordinarily orchestrates and records rather than holds funds |
| RTA/depository/custodian/registry operator | The recognised holding/ownership record and participant/custody functions where applicable |
| AssureRail operator | Platform admission, workflow/gate enforcement, transaction records, technical availability, audit trail, external-adapter control and incident management within its authorised perimeter |
| Regulator/auditor | Scoped inspection, evidence export and immutable access log; no operational editing rights unless lawfully provided |

### 6.1 Operating separation that is actually required

A separate company has genuine organisational and legal benefits; the point is that incorporation
**alone** does not produce independence or regulatory compliance. Fixed-fee versus percentage
pricing is a separate conduct/conflict question and is not the principal reason for choosing an
entity structure.

#### 6.1.1 What a separate AssureRail company can achieve

Subject to Indian regulatory, tax and legal advice, a properly constituted operating company can:

- be the identifiable applicant/holder of the permission, registration or recognition attached to
  the functions it actually performs, with its own accountable board and fit-and-proper/KMP record;
- keep venue participant contracts, rulebook, admission/discipline decisions, complaints and
  regulator-facing records separate from AssureLocker's assurance/TSP contracts;
- maintain separately identifiable regulatory capital/net worth, reserves, bank accounts,
  insurance, books, audit and fee revenue;
- ring-fence venue, execution, settlement, market-conduct, cyber and participant liabilities from
  AssureLocker to a meaningful—although not absolute—degree;
- support independent investors, strategic shareholders, funding and a future venue-specific cap
  table without granting them rights over the assurance business or its confidential data;
- make related-party technology/IP outsourcing visible, contracted, auditable and replaceable;
- support regulatory inspection, resolution, step-in, continuity, sale or transfer of the venue
  business; and
- protect the perceived neutrality of AssureLocker where it is one of several possible evidence or
  assurance providers.

These benefits can be lost through parent guarantees, commingled cash/data/people/keys, inadequate
capital, undocumented intra-group services, common decision makers acting without role separation,
or AssureLocker exercising day-to-day control over regulated venue decisions. Corporate
ring-fencing is therefore real but not absolute.

#### 6.1.2 Current structural presumption and trigger

Because the founder has selected long-term matching and full secondary trading, planning should
now presume a **separate domestic-India AssureRail operating company** for regulated venue/operator
functions. A division inside AssureLocker may remain suitable for research, completed-deal replay,
prototype development and non-live shadow work. The separate company should exist before the first
formal application/sandbox participation in its name, regulated participant contract, or
controlled-live performance of a function for which it is to be accountable—whichever comes first.

This is a planning presumption, not a conclusion that “AssureRail Pvt Ltd” automatically qualifies
for any particular licence. Counsel and the relevant authority must determine the permissible path,
ownership/governance conditions and whether AssureRail performs a function itself or through an
existing recognised/registered participant.

The preferred operating allocation to test is:

| Area | AssureRail operating company | AssureLocker and/or neutral IP owner |
|---|---|---|
| Permissions and accountability | Applies for/holds only the permissions relevant to functions it performs; owns venue rulebook and regulator obligations | Holds no venue permission merely because it develops software; separately assesses whether any assurance activity itself is regulated |
| Customers and revenue | Venue/participant/programme contracts, authorised transaction fees and venue liabilities | Technology licence/support fees and separately commissioned assurance/evidence fees |
| Operations and data | Participant admission, matching/execution controls, venue operations, transaction data, complaints, surveillance and incidents | Minimum data required to provide contracted technology or assurance; no privileged venue or competitor data |
| IP | Receives durable, auditable rights needed for regulated continuity, including escrow/step-in/exit where required | May retain common software IP under an arm's-length licence; venue-specific ownership remains a funding/counsel decision |
| Funding | Venue-specific capital, reserves and strategic funding | Assurance/TSP capital and common-product R&D; a later HoldCo is optional, not automatic |

AssureLocker should **not** acquire a licence simply because it supplies AssureRail's software,
schemas or evidence. The entity that performs the regulated act needs the relevant permission. If
AssureLocker itself solicits, recommends, matches, executes, holds assets/money, keeps a legally
operative register, rates an instrument or carries out another reserved activity, its own perimeter
must be assessed and it cannot rely on AssureRail's permission. Conversely, an AssureRail licence
does not authorise AssureLocker. There may be several route-specific permissions rather than one
generic “venue licence”.

Before controlled-live use, regardless of ownership structure, the operating model must establish
and test:

- independent role appointments and acceptance;
- role-based access and service-account separation;
- maker-checker for admission, gate overrides, settlement release and registry correction;
- fee disclosure and a ban on undisclosed outcome-dependent assurance fees;
- trustee-controlled appointment of the PTC assurer/reviewer;
- no ability for transaction-commercial staff to alter an assurance result;
- separate records for platform decision, participant decision and external assurance;
- periodic reconciliation of mandates, access, fees, transactions, exceptions and assurance work;
- incident escalation to the accountable institution and trustee, not only to internal product staff;
- tested provider substitution and full transaction-data export; and
- board/committee ownership appropriate to the final licensed and outsourced operating perimeter.

The final IP, HoldCo, funding, ownership and outsourced-service arrangements remain open. The
product must be capable of real accountability and separation regardless of where the company
boxes are drawn.

### 6.2 Full-stack destination and staged regulatory execution

The selected destination includes the complete institutional customer journey:

1. participant onboarding, eligibility, authority and admission;
2. loan exposure/instrument/programme admission and controlled disclosures;
3. term display, counterparty discovery, RFQ/order/bid capture, negotiation and matching;
4. participant diligence/investment approval and controlled document execution;
5. DA completion or PTC issue, allocation and allotment;
6. clearing and cash/asset settlement coordination;
7. authoritative register/depository/RTA acknowledgement and reconciliation;
8. subsequent DA transfer and PTC secondary trading/transfer;
9. servicing, waterfall/corporate actions, payments, surveillance and reporting; and
10. default, dispute, complaint, correction, maturity/redemption and exit.

This scope applies to conventional and authorised-tokenised representation. It does not mean
AssureRail must become a bank, trustee, depository, clearing corporation, custodian, exchange,
stock broker, arranger, rating agency and assurer simultaneously. The function-performance matrix
determines what is owned, partnered, participant-owned, externally authoritative or prohibited.

#### 6.2.1 Why not remain orchestration-only forever

| Dimension | Parties/terms agreed elsewhere; AssureRail orchestrates | AssureRail displays terms and enables discovery/matching |
|---|---|---|
| Launch | Faster; fits shadow and early controlled programmes | Slower; function-specific permissions, market rules and integrations precede live use |
| Customer adoption | Coexists easily with incumbent arrangers and venues | Stronger reason to consolidate the workflow if sufficient counterparties participate |
| Regulatory burden | Lower, but not zero: a standing multi-party transaction system may still enter a regulated perimeter based on substance | Materially higher: fair access, conduct, conflicts, surveillance, quote/order integrity, execution, reporting, complaints and resilience become central |
| Economics | Workflow/programme fees; less capture of discovery and liquidity value | Greater transaction/network economics, subject to permitted fee basis and conflict controls |
| Defensibility/data | More dependent on incumbents; easier to commoditise or disintermediate | Better network effects, liquidity data, price/term discovery and end-to-end experience |
| Operational risk | More hand-offs, reconciliations and ambiguous responsibility when an external platform fails | More direct accountability, market-abuse/availability risk and default/settlement complexity |
| Commercial relationship | Incumbents can remain partners and referral channels | Incumbents may view AssureRail as a competitor; cold-start and liquidity fragmentation risk increase |

The founder selects **matching/full-stack as the destination**, not orchestration-only. The chosen
route to that destination is staged:

- **Shadow:** both conventional DA and PTC; observe and compare without matching or changing the
  authoritative incumbent process.
- **Partner-executed full-stack journey:** AssureRail provides one interface and controlled case,
  while the applicable recognised exchange/EBP, debt-segment broker, clearing corporation,
  depository, trustee or other authorised party performs its regulated act.
- **AssureRail-owned functions:** add only where the AssureRail operating company has explicit
  permission, people, capital, controls and tested operations for that function and mode.
- **Tokenised extension:** mirror the same legal functions and authorities; tokenisation cannot be
  used to bypass an incumbent register, market or settlement requirement.

For institutional launch, an invite-only RFQ/negotiated workflow is preferable to an anonymous
central-limit order book: it fits existing wholesale behaviour, produces auditable term discovery
and reduces the initial liquidity burden. It does not create a regulatory safe harbour; the
licensed-performer decision still applies.

#### 6.2.2 What “get a licence” may mean in practice

There is no assumption that India offers one generic licence covering all of AssureRail. Current
route research gives different starting points:

- **PTC/SDI primary issuance:** the SEBI debt master circular permits an issuer, if it wishes, to
  use an Electronic Book Provider for private placement of securitised debt instruments. The EBP
  performs a governed bidding/allotment/settlement role on the recognised-market infrastructure;
  integration or partnership is not the same as AssureRail becoming the EBP.
- **PTC/SDI secondary activity:** specified institutional SDI trades have stock-exchange reporting,
  confirmation and clearing/settlement requirements. The recognised-exchange RFQ framework already
  supports centralised one-to-one or one-to-many quote negotiation in SDIs. AssureRail must not
  reproduce that regulated act under a different product label without an approved route.
- **Recognised stock exchange:** recognition is not an ordinary fintech software licence. The
  current SEBI framework requires, among other things, a company limited by shares,
  demutualisation, fit-and-proper status, ownership/governance compliance, capability and minimum
  net worth of ₹100 crore, plus trading, surveillance, member regulation, complaints/arbitration,
  connectivity and resilience infrastructure. This makes partnership with existing market
  infrastructure the realistic first hypothesis; own recognition remains a strategic option to
  test, not a Phase 1 assumption.
- **Stock-broker/OBPP route:** an online bond platform provider must first be a stock broker in the
  debt segment and be approved by a recognised stock exchange, with its own product and operating
  restrictions. Counsel must determine whether that framework fits the intended institutional PTC
  functions; the label “bond platform” does not prove that it does.
- **DA:** the RBI transfer directions govern eligible lenders, transfer mechanics,
  arm's-length consideration and transferee-owned diligence, but do not by themselves create a
  generic platform licence. Counsel/RBI engagement must determine when AssureRail's actual
  discovery, matching or execution conduct needs a permission, partnership or boundary.

The working answer is therefore: **do not licence AssureLocker by default; map the function, then
place the relevant permission in the accountable AssureRail operating company or use a licensed
partner.** A licence is valuable only when it lawfully enables the chosen function and its capital,
governance, conduct, surveillance, reporting and liability obligations are intentionally accepted.

### 6.3 Domestic India first; GIFT IFSC later

The first establishment and route packs are domestic India. Architecture should preserve
jurisdiction adapters and data isolation, but Phase 1 budgets, counsel instructions, participant
contracts and regulatory engagement must not assume a GIFT entity or an offshore/foreign-currency
transaction. GIFT IFSC becomes a separately approved expansion only after its customer case,
IFSCA/FEMA/FX/cash-leg/custody route, tax treatment and group structure are justified.

---

## 7. Provider-neutral integration contract

AssureRail must meet customers where they already operate. It is not sold or built as a forced
replacement for an incumbent loan platform, securitisation platform, trustee system or internal
workflow.

### 7.1 Required entry patterns

1. **File coexistence:** signed manifest plus reference-format files; downloadable exception and
   completion workbooks; suitable for a first shadow transaction with no core-system integration.
2. **API coexistence:** authenticated, idempotent intake/events and receipt APIs using the same
   canonical schema as file intake.
3. **Operator workspace:** controlled screens for participants who do not have an integrated
   upstream workflow.
4. **External-system adapter:** import/export mappings for incumbent platforms, trustee/RTA/
   depository systems, payment providers and participant books.

The carriers may differ; their downstream evidence meaning cannot. An API record is not more
independent or authoritative merely because it arrived by API.

### 7.2 Minimum intake envelope

Every source/provider submission needs:

- source organisation and system;
- submitting actor/service identity and authority;
- transaction and programme identifiers;
- schema and taxonomy versions;
- source as-of/effective times and received time;
- content manifest and canonical hashes;
- signature or equivalent authenticated provenance;
- replacement/supersession relationship;
- data classification and permitted recipients;
- validation outcome and rejected-record report; and
- provider-specific qualifications without translating them into a stronger AssureRail claim.

AssureLocker may publish a conforming connector. It gets no undisclosed schema capability or product
permission unavailable to another provider.

---

## 8. How to sell AssureRail alongside existing systems

### 8.1 The proposition

Do not ask a customer to replace its incumbent at the start. Sell the controlled institutional
transaction and interoperability layer around the systems it already trusts:

> “Keep your LMS, trustee stack, arranger workflow and incumbent platform. Run one net-new programme
> through AssureRail in parallel. We will make the transaction state, evidence, approvals,
> completion and lifecycle portable and independently reconcilable across all of them.”

The wedge is not “our interface is newer.” It is:

- one governed case across originator, investor, trustee and service providers;
- provider-neutral evidence and fewer repeated diligence requests;
- explicit completion and authoritative-register reconciliation;
- a shared audit trail without surrendering each party's decision rights;
- conventional production compatibility today where approved; and
- a controlled path to authorised tokenisation without rebuilding the transaction model.

### 8.2 First-customer consortium

The first serious programme should contain:

- one repeat originator with a credible forward transaction pipeline;
- one anchor bank or institutional investor willing to define acceptance evidence;
- one trustee willing to own the assurance appointment and PTC operating requirements;
- the parties' existing arranger/platform operators rather than excluding them;
- transaction counsel; and
- for tokenised testing, the relevant sandbox/authority and authorised registry/cash/custody
  participants.

One party alone can design a convenient demo. The consortium is what proves that the rail works
across real accountability boundaries.

### 8.3 Adoption ladder

| Stage | Customer change | AssureRail outcome | Commercial ask |
|---|---|---|---|
| **Completed-deal replay** | Provides redacted artefacts from a closed DA or PTC | Maps evidence, states, roles, breaks and completion without affecting the transaction | Fixed discovery/replay fee or funded design partnership |
| **Shadow transaction** | Runs AssureRail beside the incumbent; incumbent remains authoritative | Produces a comparison report, missing-evidence list, workflow timings and reconciliation results | Fixed programme fee; agreed proof metrics |
| **Controlled conventional pilot** | Uses approved workflow for a net-new transaction; external legal registers and cash rails remain authoritative | Demonstrates participant approvals, completion evidence, adapter acknowledgements and lifecycle hand-off | Implementation plus per-transaction/programme fee, subject to counsel |
| **Tokenised sandbox** | Adds permissioned token and simulated/approved settlement within sandbox limits | Proves one-to-one asset/holding and cash-leg controls without public or retail claims | Consortium/sandbox programme fee; no claim of unrestricted production availability |
| **Production programme** | Commits repeat flow under signed operating, SLA, security and legal arrangements | Repeat DA/PTC processing in the specifically approved modes | Venue/platform/programme economics approved for that regulated perimeter |

### 8.4 Proof metrics agreed before the shadow

- elapsed time from data receipt to a diligence-ready package;
- repeated or manual evidence requests avoided;
- schema, tape, document and register breaks found;
- time and ownership to close each exception;
- percentage of required conditions evidenced by the due date;
- settlement/issue breaks and recovery time;
- reconciliation completeness at completion and each lifecycle cycle;
- analyst/trustee/operations hours by participant;
- audit/regulatory evidence retrieval time; and
- provider/system portability demonstrated by successful export and replay.

The pilot is not graded on whether a transaction closes. That would reward suppressed findings.

---

## 9. Delivery stages and gates

The generic kernel is built once. Route and representation capabilities are promoted independently.

| Stage | Deliverable | Exit gate |
|---|---|---|
| **0 — as-built baseline and perimeter** | This perimeter; product taxonomy; current-code disposition in §0.2; onboarding gap in §0.3; participant map; four legal-issue lists; operating RACI; completed-deal artefact inventory | Founder accepts boundaries and migration order; counsel/design-partner instruction packs ready; no greenfield duplicate authorised |
| **1A — institutional foundation** | Adapt/extract existing entity application, membership/SAML, maker-checker, evidence-case and connector-certification controls around the retained Rail auth/security foundation; add Rail participant snapshot, appointment, settlement/register endpoint, route entitlement and certification domains; migrate existing users without silently gaining authority | Source-vs-Rail contract tests; onboarding acceptance tests in §0.3.1; maker-checker and suspension tests; provider-neutral KYC/KYB path; central-provider outage continuity; reversible data migration |
| **1B — neutral case and transaction-room migration** | Common transaction case; provider-neutral room/evidence APIs; port of the tested co-lending transfer room; AssurePool adapter; legacy ID mapping, compatibility routes, dual-read comparison, export and rollback | Existing transfer-room contract/golden tests pass against Rail; no access/audit regression; backfill reconciles; old write path can be disabled and restored safely |
| **1C — replay kernel** | Common evidence, party/authority, state, audit, document, deadline and reconciliation services; file-in/file-out; completed conventional DA and PTC replays; AssureTransfer invoked only through an explicit evidence adapter where relevant | Golden corpora pass; no positive legal/production claim; export/replay deterministic; AssurePool and a non-AssurePool source produce equivalent conformance outcomes |
| **2 — shadow conventional** | DA and PTC adapters; incumbent import/export; exception and comparison workbooks; lifecycle shadow | Originator + investor + trustee sign the observed gaps and target operating model |
| **3 — controlled conventional orchestration** | Approved external-register/payment adapters, operational controls, security, DR, monitoring and participant support; live order determined separately after both shadows | Counsel opinion; required registration/permission; contracts; VAPT; operational-readiness approval; production accuracy gates |
| **4 — partner-executed matching and secondary** | Unified term-display/RFQ/matching/secondary journey with each regulated act and acknowledgement performed by the applicable recognised/registered partner | Function matrix ratified; partner permissions and contracts verified; fair-access/conduct/surveillance/complaint/settlement controls tested |
| **5 — AssureRail-owned authorised functions** | AssureRail performs selected matching/venue functions for modes where its operating company has obtained the required permission and operating capability | Explicit authority for each function/mode; capital, governance, people, rules, audit, resilience and participant protection evidenced |
| **6 — tokenised sandbox** | Token representation adapter, allow-list, custody/key model, authoritative-register reconciliation and sandbox cash/DvP adapter | Authority/sandbox approval; legal-character statement; privacy/threat review; recovery and divergence tests |
| **7 — authorised tokenised production** | Production-grade token lifecycle and permitted settlement for each separately approved route | Explicit production authority and all conventional-plus-token controls evidenced |

The recommended acquisition sequence is **coexistence first, conventional shadow before live,
tokenisation through a sandbox**. This does not require abandoning the existing tokenised-DA demo;
it reclassifies that work as one representation adapter and demonstration track, not the entire
product.

### 9.1 Mode-readiness register

The product must publish an internal register with one row per combination of route,
representation, jurisdiction, asset class and placement/listing context. Permitted statuses are:

`CONCEPT → COUNSEL_REVIEW → REPLAY_ONLY → SHADOW_APPROVED → SANDBOX_APPROVED → CONTROLLED_LIVE → PRODUCTION`

Only an approved governance authority can promote a row. A higher status for one row never promotes
another. The UI, API, sales material and contracts must all read the same register.

---

## 10. Production assurance and accuracy standard

“Production” is the highest grade of operational assurance, not a configuration label. Before a
mode can be promoted to production, it needs evidence of:

- a counsel-ratified, effective-dated route pack and approved participant perimeter;
- golden-corpus coverage for happy paths, boundary dates, missing/contradictory facts, exceptions,
  cancellation, settlement failure, replay, duplicate events and external-register divergence;
- exact money handling, declared rounding boundaries and full waterfall conservation where relevant;
- deterministic reruns against the same inputs, versions and rule packs;
- no `PASS`, completion, mint, transfer, issue or settlement-release path when a governing fact,
  rule, approval, signature or acknowledgement is missing or pending;
- maker-checker and separation-of-duties tests for every high-impact action;
- authoritative-register and cash reconciliation before completion is released;
- security architecture, threat model, VAPT closure, key/secret controls and data-residency review;
- DR/restore plus external-event replay and post-recovery reconciliation;
- incident, correction, cancellation, participant-default and provider-exit runbooks exercised;
- complete audit exports tested by a participant other than the development team; and
- operating staff accreditation, dual coverage and named accountable owners.

Synthetic success is not production evidence. Neither a token ID nor a successful API response is
proof of legal issuance, transfer, title or cash finality.

---

## 11. Explicit non-goals and prohibited shortcuts

Until separately decided and authorised, AssureRail is **not**:

- a public or retail marketplace;
- an unpermissioned token platform;
- a claim that token transfer always equals legal-title transfer;
- an arranger, rating agency, trustee, depository, custodian, RTA, investment adviser or assurer;
- a holder of customer money or securities;
- a substitute for the transferee's own DA diligence;
- a substitute for trustee-organised PTC review/assurance;
- dependent on AssurePool or AssureLocker to admit a transaction;
- a reason to duplicate or contradict an authoritative external register; or
- four copied codebases hidden behind one brand.

Do not build a universal “approve transaction” button, a route-switch after evidence lock, a token
mint that precedes legal-record readiness, or a success fee for an independent assurance outcome.

---

## 12. Decisions selected, rejected and still open

### 12.1 Selected

| Decision | Why |
|---|---|
| One generic AssureRail product with four modes | Customers need DA and PTC; the representation should not dictate the legal route |
| Common kernel plus explicit adapters | Reuses controls without pretending DA and PTC are the same transaction |
| Provider-neutral intake | Customers already have systems and the trustee may appoint any assurance provider |
| AssurePool DA-only and optional | Preserves its evidence/preparation purpose without making it a venue gateway |
| AssurePlane named as the optional AssureCLA assurance product | Corrects the prior generic reference to AssureLocker/AssureCLA and preserves trustee/provider choice |
| AssureTransfer remains a parallel, presently unassigned evidence product | Reflects the code and founder history; its rule/evidence logic may be consumed without giving it venue ownership |
| Existing Rail app/API retained as the platform foundation | Avoids duplicating working identity, security, audit, operations, document, lifecycle and adapter controls |
| Existing Rail tokenised-DA code becomes a representation adapter | Preserves useful work without allowing its Note/mint/DvP assumptions to define conventional DA or PTC |
| Co-lending transfer-room runtime migrates to Rail | The room is transaction infrastructure; AssurePool remains only an optional DA source/adapter |
| Institutional onboarding precedes case migration and live route work | A user login and manual role do not establish legal-entity authority or route permission |
| PTC direct into AssureRail | PTC has its own trust/issue/investor lifecycle and does not belong inside AssurePool |
| Trustee-organised PTC assurance | Keeps appointment/accountability with the relevant fiduciary/transaction role and removes compulsory related-party assurance |
| Coexistence-led selling | Lowers switching risk and produces proof against incumbents on a real programme |
| Trustee is the PTC transaction-control authority; the route-defined register retains legal force | Gives the trustee final workflow acceptance without creating a competing platform or informal title record |
| Fail-closed promotion by mode | Protects the highest-grade production accuracy requirement |
| Domestic India is Phase 1; GIFT IFSC is deferred | Preserves the previously selected domestic sequence and avoids importing offshore/FX/FEMA assumptions into the first build |
| Conventional DA and PTC both lead in shadow | Learns both workflows in parallel while incumbent processes remain authoritative |
| Full-stack primary and secondary institutional lifecycle | The destination includes permitted term display, discovery, matching, issuance/completion and secondary activity, not only post-agreement orchestration |
| Function-by-function owned/partnered/external model | Delivers one journey without claiming that one company may perform every regulated role |
| Separate domestic AssureRail OpCo as the planning presumption before regulated live activity | Matching and secondary functions create a distinct likely perimeter, liability profile, governance need and funding case; counsel/regulator determine the final form and permissions |
| Value-linked AssureRail commercial intent, where permitted | Venue economics may scale with the transaction; exact basis, payer, caps and functions remain mode-specific counsel/commercial work |
| Trustee-paid PTC surveillance | Keeps the mandated lifecycle function visible and separate from the venue transaction fee |

### 12.2 Rejected or superseded

| Earlier position | Current disposition |
|---|---|
| AssureRail is only a tokenised DA venue | **Superseded** — tokenised DA is one of four modes |
| “Tokenised AssurePool DA demonstration” | **Rejected as a category error** — the tokenised-DA demonstration is in AssureRail; AssurePool is only its present sample DA-tape feeder |
| PTC passes from AssurePool to AssureRail | **Rejected** — PTC enters AssureRail directly |
| AssureTransfer is inside AssurePool | **Rejected** — it is parallel and presently homeless/incomplete; later suite placement remains an explicit decision |
| Filesystem location determines product ownership | **Rejected** — the tested transfer room moves to Rail; product-specific AssureTransfer rules do not |
| Rebuild AssureRail as a greenfield generic venue | **Rejected** — retain the existing app/API and refactor with compatibility, migration and rollback controls |
| “MSME supply-chain credit will expand at least tenfold in six years” as the growth story | **Withdrawn** — no sufficiently defensible source, denominator and projection basis was established. Do not use the claim in web copy, decks, articles, fundraising or product planning unless independently re-sourced and claims-reviewed |
| AssureRail consumes only an AssureLocker frozen tape | **Rejected** — one optional conforming provider among many |
| The AssurePool Note is the universal instrument | **Rejected** — instruments and legal records are route-specific; branding cannot determine legal form |
| Runtime availability may depend on AssureLocker | **Rejected** — AssureRail requires provider and source-system continuity/exit |
| Start by replacing the customer's existing platform | **Rejected** — replay, shadow and coexistence first |
| Tokenisation establishes ownership by itself | **Rejected** — only the approved authoritative record does |
| A separate division/company alone resolves conflicts | **Rejected** — the entity provides real benefits, but operational appointments, access, fees, decision rights and reconciliations are also required |
| AssureRail appoints or performs all assurance | **Rejected** — trustee/accountable party organises it and may choose another provider |
| Deal formation and matching must remain off-rail forever | **Superseded** — useful launch constraint, but full-stack matching is the long-term destination |
| Orchestration-only is the final product | **Rejected** — it remains an early operating stage and fallback for functions AssureRail cannot lawfully own |
| GIFT IFSC is the first establishment | **Deferred** — domestic India is Phase 1; GIFT is a later separately justified expansion |
| AssureLocker should hold a venue licence because it supplies the technology | **Rejected** — permission follows the entity performing the regulated act; AssureLocker remains subject to a separate perimeter assessment for its own activities |

### 12.3 Open — founder, counsel, regulator and design-partner work

1. Exact incorporation trigger, ownership, board, capital, IP licence, funding/cap-table and
   related-party outsourcing terms for the presumptive domestic AssureRail operating company; and
   the separate future test for any GIFT entity.
2. Which conventional route and asset class proceeds to controlled-live first **after** both DA and
   PTC shadow workstreams; the shadow lead decision does not automatically approve parallel live
   launches.
3. For each PTC route: issuer/trust/SPE structure, trustee powers, placement/listing path, investor
   classes, RTA/depository/custody and authoritative holding record.
4. For tokenised DA: legal character of the represented interest, transfer/perfection mechanics,
   holder rights, custody/key model, insolvency treatment and whether the token can ever be the
   authoritative record.
5. For tokenised PTC: the same questions plus issue/allotment, secondary transfer, corporate
   actions, rating/disclosure and investor-protection requirements.
6. Permitted settlement model by route: bank money, approved tokenised deposit/CBDC/other cash leg,
   finality point, conditionality, refund/reversal and insolvency treatment.
7. Tax, withholding, GST, stamp duty, accounting, capital treatment and cross-border/FEMA effects.
8. For each function and mode, the exact permission/registration/recognition, responsible entity,
   licensed-partner route and prohibited boundary for term display, recommendation/ranking, RFQ,
   matching, allocation, arrangement/placement, execution, clearing, settlement, recordkeeping,
   custody, surveillance and secondary trading.
9. Commercial implementation of the founder's value-linked venue intent by authorised function:
   fee basis/bps, payer, minimum/maximum, trigger, refund/cancellation, disclosure, treatment of a
   failed/refused transaction and any mode where percentage pricing is not permitted. PTC
   surveillance is trustee-paid and separately visible. Assurance-provider fees remain separately
   appointed and outcome-independent.
10. The first consortium, their incumbent systems, one completed deal for replay and the success
    metrics they will sign before work starts.
11. Three-year bottom-up operating, technology, regulatory, security and participant-support plan.
    It must be derived after the first-route decision and operating RACI, not guessed from the old
    tokenised-DA scaffold.
12. Final suite/brand placement and commercial packaging of AssureTransfer. Its current code-level
    boundary and use as optional evidence logic are decided; its permanent home is not.
13. Pull-request-level migration manifest derived from §0.2: exact models/endpoints/events/screens,
    backfill volumes, compatibility period, feature flags, deployment order and rollback owners.

---

## 13. Immediate artefacts before detailed implementation planning

No implementation epic should be estimated until these are written and jointly reviewed:

1. **Four mode cards** — scope, parties, legal object, authoritative record, functions, exclusions,
   inputs, outputs, lifecycle and regulatory gate for each quadrant.
2. **Common data taxonomy and schemas** — transaction, party/role, asset/pool, evidence, document,
   condition, register, settlement, lifecycle, exception and assurance objects.
3. **Responsibility and licensed-performer matrix** — participant decision, AssureRail platform
   control, AssureRail-owned authorised act, licensed-partner act, external-authority record,
   appointed-provider conclusion and regulator/trustee oversight separated line by line.
4. **Counsel issue matrix** — questions in §12.3 converted into mode-specific written propositions
   and worked transaction cases.
5. **Completed-deal replay pack** — one conventional DA and one conventional PTC, redacted but
   complete enough to derive state, evidence and reconciliation requirements.
6. **Incumbent integration map** — what remains authoritative, what AssureRail reads/writes, format,
   frequency, identity, acknowledgement, correction and exit.
7. **Institutional onboarding design pack** — domain schema, evidence taxonomy, state machine,
   route-entitlement matrix, provider adapters, maker-checker decisions, migration of current users,
   suspension/exit behaviour and the acceptance cases in §0.3.1.
8. **Operating model and runbooks** — onboarding, access, maker-checker, transaction operations,
   assurance intake, settlement breaks, reconciliation, incidents, complaints, corrections, DR and
   provider replacement.
9. **Threat and misuse model** — double transfer, double issuance, duplicate token, collusion,
   compromised signer/key, stale tape, document substitution, register divergence, settlement
   partial failure, PII leakage and unauthorised participant.
10. **Mode-readiness register** — initial rows all set honestly to concept/replay/shadow status.
11. **Commercial design-partner offer** — replay/shadow scope, proof metrics, data obligations,
    liability boundaries, fee, timetable and conversion criteria.
12. **PR migration manifest** — expand the binding baseline in §0.2 to every affected endpoint,
    service, database model, job, event and screen; name the target package, compatibility contract,
    migration/backfill, test, flag, observability, cut-over, rollback and retirement condition.

The as-built ownership baseline and the onboarding workstream are now established in this document.
Engineering may use them to prepare the detailed Stage 1A/1B designs and PR manifest; it must not
start moving data or callers until those designs are reviewed. After the remaining artefacts exist,
engineering can estimate later route stages, staff the work and build a credible three-year resource
and cost plan.

---

## 14. Primary regulatory anchors for the instruction pack

These are starting anchors, not a substitute for counsel confirming the versions and application
current for a transaction:

- [RBI Transfer of Loan Exposures Directions, 2021](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12166&Mode=0)
- [RBI Securitisation of Standard Assets Directions, 2021](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12165&Mode=0)
- [SEBI Issue and Listing of Securitised Debt Instruments and Security Receipts Regulations — page showing amendment through 6 July 2026](https://www.sebi.gov.in/legal/regulations/jul-2026/securities-and-exchange-board-of-india-issue-and-listing-of-securitised-debt-instruments-and-security-receipts-regulations-2008-last-amended-on-july-06-2026-_102674.html)
- [SEBI Master Circular for issue/listing of securities, including EBP, SDI trade reporting and RFQ provisions, 15 October 2025](https://www.sebi.gov.in/sebi_data/attachdocs/oct-2025/1760532257519.pdf)
- [SEBI Stock Exchanges and Clearing Corporations Regulations, last amended 22 November 2025](https://www.sebi.gov.in/sebi_data/attachdocs/dec-2025/1765167625472.pdf)
- [Depositories Act, 1996 — India Code consolidation as on 1 June 2026](https://www.indiacode.nic.in/bitstream/123456789/1955/1/aA1996-22.pdf)
- [RBI Outsourcing of Information Technology Services Directions, 2023](https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=12486&Mode=0&fn=14)
- [IFSCA FinTech framework and sandbox materials](https://www.ifsca.gov.in/Pages/Contents/Fintech)
