# AssureRail website copy change brief

**Status:** refreshed implementation brief, 3 September 2026. This identifies required copy and information-
architecture changes; it does **not** authorise publication or change the live/public web
application. Legal/claims review is required before release.

**Canonical product source:**
`docs/design/AssureRail_Generic_Transfer_Infrastructure_Scope.md`.

**Current publication source:**
`docs/design/AssureRail_Customer_Public_Capability_Baseline_CX00.md` and
`apps/assurerail/src/lib/public-capability.ts`. AR-21–AR-30 are now implemented and deployed behind
disabled controls; this supersedes the pre-build status language in the 30 August draft.

**GTM companions:**

- `docs/decks/AssureRail_Institutional_GTM_Deck.html`
- `docs/decks/AssureRail_Objection_Handling_And_Pilot_Playbook.html`

**Implementation checkpoint, 3 September 2026:** the AssureRail web application now contains the
accurate root proposition plus DA/PTC route pages, participant pages, trust/status, replay intake
surface and effective-dated resources described by PUB-01, PUB-02, CONTENT-01 and INBOUND-01. The
code is not published by that implementation checkpoint; inbound remains disabled by default.

---

## 1. Executive decision

The current AssureRail web story must not be incrementally polished. It describes a superseded
product: an already separated AssureLocker subsidiary that tokenises verified receivables, depends
on AssureLocker, settles through CBDC/regulated rails and is “built but exploratory”. The selected
product is materially broader and differently bounded:

> **AssureRail is provider-neutral institutional transaction infrastructure for direct assignment
> and PTC transactions, conventional or authorised tokenised, with full primary and secondary scope
> delivered through AssureRail-owned, participant-owned, external-authority and licensed-partner
> functions.**

The website must lead with **conventional DA and PTC coexistence and proof**, not tokenisation. It
must present matching and secondary trading as the selected destination while identifying the
performer and permission for each live function. Tokenisation is a separately gated representation
adapter, not the product category.

The eventual website may be as complete as the AssureLocker site, but it should be built in phases.
Until the claims, route packs and design-partner evidence exist, a smaller accurate site is more
credible than a large speculative one.

---

## 2. Immediate claims-safety actions

These changes should precede any new AssureRail campaign.

| Current surface | Current problem | Required disposition |
|---|---|---|
| `apps/web/src/app/downloads/briefings/AssureRail/page.tsx` | Entire 14-slide briefing is built around “subsidiary”, verified receivables, compulsory AssureLocker input, token issuance, CBDC settlement and “built” venue status | Replace with the new institutional GTM story or temporarily mark the briefing superseded and remove it from the downloads index |
| `apps/web/src/app/downloads/page.tsx:62` | Calls AssureRail “the subsidiary” and a verified-receivables liquidity venue | Change to provider-neutral DA/PTC transaction infrastructure; label design-partner/replay-shadow stage |
| `apps/web/src/app/investors/page.tsx:68` and `:117` | States that AssureRail is a separately incorporated subsidiary tokenising verified receivables | Replace with a separate domestic OpCo **planning presumption** before regulated live activity; generic DA/PTC product and exact funding/IP structure remain gated |
| `apps/web/src/app/investors/page.tsx:716` | “Further optionality” section implies receivables tokenisation is the product | Reframe as an excluded-from-base-case institutional transaction-infrastructure option with four modes and conventional proof first |
| `apps/web/src/app/downloads/briefings/AssureLocker-Product/page.tsx:1279` | “Liquidity layer on verified, accepted receivables” is too narrow and implies AssureLocker is the necessary feeder | Replace with a short boundary slide: AssureLocker may provide evidence; AssureRail is provider-neutral DA/PTC infrastructure; no compulsory route or live claim |
| `apps/web/src/app/downloads/briefings/AssureLocker-Company/page.tsx:391` | Calls AssureRail a separately incorporated subsidiary and verified-receivables venue | Correct company status, full scope and incorporation trigger; do not claim ring-fencing is already in place |
| `apps/web/src/app/downloads/briefings/Pool-Tokenisation/page.tsx:90` | Defines AssureRail as a separate private permissioned blockchain and routes AssurePool into it | Retire as current product material. Preserve only as explicitly historical token-adapter exploration. AssurePool is DA-only; PTC never passes through it |
| `apps/web/src/app/downloads/briefings/RBI-July2026/page.tsx:1163` | Describes AssureRail as a separately structured accepted-receivables liquidity venue | Add a supersession notice or replace the AssureRail section before reuse with any authority |

### 2.1 Statements to remove immediately from current AssureRail materials

- “A subsidiary of AssureLocker” or “separately incorporated” as a present fact.
- “AssureRail tokenises verified receivables” as the product definition.
- “AssureLocker verifies; AssureRail tokenises” as a compulsory path.
- “Only a verified AssureLocker receivable can enter AssureRail.”
- “The venue infrastructure is built” or “built but exploratory.”
- “Settlement is atomic on CBDC/regulated rails.”
- “AssureRail’s failure could never strand anyone’s money.”
- “SEBI is the perimeter for the tokenised units” as a concluded characterisation.
- “The trustee holds the security” as a universal role statement across DA and PTC.
- “The token is an evidence-backed unit” without the approved instrument and authoritative-record
  analysis.
- A named trustee candidate in public product diagrams unless that organisation has approved the
  reference.

### 2.2 Statements that may remain only with explicit qualification

| Term | Required qualification |
|---|---|
| `venue` | Commercial destination/category; not a claim of exchange recognition or current authorisation |
| `full stack` | Product/customer-journey scope; each function has an AssureRail, partner, participant or external-authority performer |
| `matching` | Selected destination; not live until the applicable permission/partner path is approved |
| `secondary trading` | Long-term PTC scope; specific reporting, execution, clearing, settlement and depository route remains gated |
| `tokenised` | Authorised representation only; token is a reconciled mirror unless the route expressly makes it authoritative |
| `settlement` | Orchestration/coordination unless AssureRail is separately authorised for another role; never infer cash or securities custody |
| `authoritative` | Identify the precise legal system of record and accountable recordkeeper for the route |
| `trustee final` | Final transaction-control/acceptance authority in the PTC workflow; does not casually overwrite the legal depository/RTA record |
| `separate company` | Planning presumption before regulated live venue activity; incorporation, ownership and permissions are not complete facts |
| `built` | May describe the implemented AR-21–AR-30 software only with the precise boundary: deployed behind disabled controls; customer/external evidence and controlled-live/production activation remain open |

---

## 3. Messaging hierarchy

### 3.1 Category

**Primary category:** institutional transaction infrastructure for loan transfers and
securitisation.

**Avoid as the unqualified primary category:** exchange, marketplace, tokenisation venue,
blockchain platform, liquidity venue or receivables venue.

### 3.2 One-line positioning

Long form:

> AssureRail is provider-neutral transaction infrastructure through which eligible institutions
> can prepare, discover, negotiate, govern, execute, evidence, settle, transfer and administer
> permitted direct-assignment and PTC transactions—using conventional authoritative records or an
> authorised tokenised representation.

External short form, after claims review:

> **One institutional rail for loan transfers and securitisation—DA or PTC, conventional or
> authorised tokenised.**

### 3.3 Opening value proposition

> Keep your LMS, arranger workflow, trustee stack, depository/RTA and payment providers. AssureRail
> creates one governed transaction case across them: parties, authority, evidence, terms,
> approvals, completion, reconciliation and lifecycle.

### 3.4 The core wedge

> Do not replace a system first. Replay one completed DA and one completed PTC, then shadow the next
> transactions beside the incumbent process. Compare evidence, exceptions, time, effort and final
> reconciliation before deciding what should change.

### 3.5 Trust statement

> The trustee or accountable party appoints the PTC assurance provider. It may choose AssurePlane
> within the AssureCLA suite, another provider or its own permitted
> process. AssureRail validates and preserves the signed result but does not mark its own
> transaction.

### 3.6 Status statement

> AssureRail’s generic DA/PTC product journeys are implemented and deployed behind fail-closed,
> disabled controls. Historic replay, customer/trustee/provider acceptance, VAPT, route permission
> and signed activation remain open. No live matching, issuance, secondary execution, token-title,
> custody or production-settlement availability is claimed.

---

## 4. Implemented first public AssureRail page

**Route:** `/` on the dedicated AssureRail public application/domain

This is the first build and the source from which the accurate route/persona sub-site now extends.

### 4.1 Metadata

**Title:** `AssureRail | Institutional infrastructure for DA and PTC transactions`

**Description:**

> Provider-neutral transaction infrastructure for direct assignments and PTC securitisation,
> designed to work beside existing lender, arranger, trustee, depository and payment systems.
> Conventional first; tokenised only where authorised.

Avoid “exchange”, “marketplace” and “blockchain” in the initial metadata.

### 4.2 Hero

**Eyebrow:** `Institutional transaction infrastructure · Domestic India first`

**Headline:**

> **One governed rail for direct assignments and PTC transactions.**

**Body:**

> Prepare, evidence, negotiate, complete and administer loan transfers and securitisation across
> the systems and service providers you already use. Conventional first. Matching, secondary
> activity and tokenised representations only through the approved performer and route.

**Primary CTA:** `Propose a completed-deal replay`

**Secondary CTA:** `View product scope and status`

**Status strip:**

- `Design-partner stage`
- `Conventional DA + PTC lead in shadow`
- `Product software built · customer/external evidence open`
- `No production venue claim`

Do not use `Book a demo` as the primary CTA until the demo reflects the generic product. A tokenised-
DA demo is not evidence of the customer proposition above.

### 4.3 Page section order and draft copy

#### Section A — The problem

**Headline:** `One transaction lives across many partial systems of truth.`

**Body:**

> Loan data sits in lender systems. Terms and allocation may sit with an arranger. PTC duties and
> lifecycle records sit with the trustee. Holdings may sit with an RTA or depository. Payment and
> clearing confirmations sit elsewhere. AssureRail is designed to govern the transaction across
> those boundaries without claiming that every record belongs on AssureRail.

Four cards:

1. `Repeated diligence` — The same pool, documents and exceptions are rebuilt for each party.
2. `Completion ambiguity` — Signed, funded, allotted and registered are different events.
3. `Reconciliation debt` — Tape, documents, cash and holding records drift across hand-offs.
4. `Lifecycle fragmentation` — Servicing, waterfalls, triggers and reporting move through email and
   spreadsheets.

#### Section B — The four modes

**Headline:** `The route and the representation are separate choices.`

Show a 2×2 matrix:

| | Conventional | Authorised tokenised |
|---|---|---|
| Direct assignment | Bilateral first/subsequent transfer with transferee-owned diligence and external-record completion | Same DA controls plus approved holder/token lifecycle and one-to-one register reconciliation |
| PTC | Trust/SPE, placement/issue, holding record, waterfall, surveillance and secondary hand-offs | Same PTC lifecycle plus approved token holding/transfer, custody/key and corporate-action controls |

Footnote: `The four product journeys are implemented behind disabled controls. Code presence does
not imply customer acceptance, legal availability, authoritative-record effect or activation.`

#### Section C — Keep your systems

**Headline:** `Coexistence first. Replacement only if the proof justifies it.`

Three columns:

1. `Ingest` — Signed files first; APIs later over the same versioned schema.
2. `Govern` — Identity, mandate, evidence, documents, decisions, state, exceptions and audit.
3. `Reconcile` — Payment, trustee, RTA/depository, participant books and lifecycle outputs.

CTA: `Map one completed transaction`

**Institutional admission band — built, provider/customer acceptance open:**

**Headline:** `A login proves identity. A mandate proves who may bind the institution.`

**Body:**

> AssureRail keeps individual identity, institution membership, signing and maker-checker
> authority, participant role and route permission separate. Existing identity and
> KYB providers can connect through approved evidence adapters; customers are not required to buy
> AssureLocker to participate.

Four labels:

1. `Institution` — legal identity, regulatory status and approved participant roles.
2. `People` — membership, mandate, delegation, limits and effective dates.
3. `Routes` — DA/PTC, conventional/tokenised, primary/secondary and asset-class permissions.
4. `Operations` — connector certification, settlement/register references, security readiness,
   suspension and exit.

Status note: `Rail-local institution, membership, mandate, appointment and route-entitlement
controls are implemented behind disabled controls. Provider validation, real assignments,
enforcement rehearsal and customer acceptance remain open.`

#### Section D — Full-stack destination

**Headline:** `One journey. The right accountable performer for every function.`

Body:

> AssureRail’s destination includes controlled term display, counterparty discovery, RFQ,
> negotiation, matching, DA completion, PTC issuance/allotment, secondary transfer/trading,
> settlement coordination and lifecycle administration. The route pack identifies whether each
> function is AssureRail-owned and authorised, performed by a licensed partner, retained by a
> participant or created by an external authority.

Do not use a flow diagram that visually shows AssureRail directly performing every box.

#### Section E — Participant value

- `Originator` — reusable transaction package, controlled versions and fewer repeated requests.
- `Investor / transferee` — own diligence/decision, comparable evidence and explicit completion.
- `Trustee` — control over appointments/acceptance, holding-record reconciliation and lifecycle
  packs.
- `Arranger / incumbent platform` — standard hand-offs and lifecycle continuity without immediate
  displacement.

#### Section F — Trustee and assurance

**Headline:** `The party accountable for the PTC organises the assurance.`

Body:

> The trustee or other accountable party may appoint AssurePlane within the AssureCLA suite,
> another provider or its own permitted review process. Where the group product is selected, it is AssurePlane within the
> AssureCLA suite. AssureRail accepts a conforming signed evidence object, preserves its scope and
> qualifications, and cannot upgrade or alter the conclusion.

#### Section G — Authoritative record

**Headline:** `The trustee controls the workflow. The route-defined register retains legal force.`

Use three labels:

- `Trustee` — final PTC transaction acceptance/rejection in AssureRail.
- `Depository/RTA/route register` — legally operative holding record where applicable.
- `AssureRail` — reconciled case and evidence; never an unapproved competing title record.

Mismatch microcopy:

> A disagreement freezes the affected issue, transfer, settlement release and token movement. The
> trustee directs correction; AssureRail releases only after the operative recordkeeper confirms
> it.

#### Section H — Four-part pilot proof

1. `Completed-deal replay` — one closed conventional DA and PTC.
2. `Parallel shadow` — one live DA and PTC beside the incumbent.
3. `Operational proof` — missing/contradictory data, duplicate events, register/payment failures,
   restore and export.
4. `Controlled conversion` — one new conventional transaction after legal, security, operating and
   partner gates.

CTA: `Nominate a DA and PTC for replay`

#### Section I — Honest status

Use three claim tiers:

| Tier | Web wording |
|---|---|
| `BUILT / GATED` | Institution, DA/PTC replay, lifecycle, primary/secondary, token mirror, integration and operations software deployed behind disabled controls |
| `EVIDENCE OPEN` | Historic transaction replay, customer/trustee/provider acceptance, VAPT, counsel, real connector and DR/exit proof |
| `NOT ACTIVATED` | Controlled-live/production matching, issuance, secondary execution, token-title, custody and settlement |

#### Section J — Closing CTA

**Headline:** `Give us one closed DA, one closed PTC and the people who know where the work really
happens.`

**Body:**

> We will return a transaction/evidence map, baseline scorecard and fixed replay scope. No system
> replacement, no live matching and no production claim.

**CTA:** `Propose the replay workshop`

---

## 5. AssureRail website structure

The first eight route groups below are implemented in the dedicated AssureRail application. Publication
still requires the stated gate. The remaining routes are later additions to be earned through
evidence and participant co-design.

| Route | Customer job | Publication gate |
|---|---|---|
| `/` | Understand the category, boundaries, status and first proof | Implemented; owner claims/publication review open |
| `/replay` | Nominate a completed case without sending transaction data | Implemented; form withheld until INBOUND-01 gates close |
| `/routes/direct-assignment` | Understand conventional DA authority, evidence and replay | Implemented; counsel/customer evidence open |
| `/routes/ptc` | Understand PTC trustee, issue/allotment, record and lifecycle boundaries | Implemented; trustee/counsel/customer evidence open |
| `/for/originators`, `/for/transferees-investors`, `/for/trustees` | Understand participant-specific responsibility and proof | Implemented; participant validation open |
| `/trust` | Understand authority, provider, record and security boundaries | Implemented; Azure/VAPT evidence open |
| `/status` | See effective-dated mode/function claim tiers | Implemented; governed publisher and promotion process open |
| `/resources` | Read effective-dated route/proof/control notes | Implemented; owner publication review open |
| `/for/arrangers-platforms` | Coexistence, referral, integration and licensed-function partnership | Later; incumbent validation required |
| `/integrations` | Public file/API schema, receipts, idempotency, acknowledgements and export | Later; public contract/connector evidence required |
| `/routes/conventional` | Cross-route conventional transaction-control patterns | Later; publish only if it adds clarity beyond DA/PTC pages |
| `/routes/tokenised` | Gated representation adapter and authoritative-record model | Later; legal character, infrastructure and authority status required |

Do not mirror the full AssureLocker navigation on day one. AssureRail earns breadth through route
evidence and participant co-design.

---

## 6. Persona-specific landing copy

### 6.1 Originator

**Headline:** `Turn repeat DA and PTC programmes into a governed, reusable transaction package.`

**Support:** `Version the pool, documents, roles, exceptions and completion evidence once; deliver
each accountable participant the evidence and acknowledgement it needs.`

**CTA:** `Replay a completed programme`

### 6.2 Investor / transferee

**Headline:** `Keep your decision. Improve the evidence and completion trail around it.`

**Support:** `Run your own diligence and approval against versioned facts, controlled terms,
resolved exceptions and the external evidence that makes the transfer or holding operative.`

**CTA:** `Define the acceptance scorecard`

### 6.3 Trustee

**Headline:** `Control the PTC workflow without becoming the technology operator.`

**Support:** `Own appointments and acceptance, reconcile the route-defined holding record, and
receive a complete lifecycle, waterfall, surveillance and exception trail.`

**CTA:** `Co-design the trustee operating model`

### 6.4 Arranger / incumbent platform

**Headline:** `Extend the transaction across participants and lifecycle—not around your platform.`

**Support:** `Use a published hand-off for evidence, roles, terms, completion and external
acknowledgements. Perform regulated functions through the approved partner model.`

**CTA:** `Map the integration boundary`

---

## 7. Objection content for the eventual site

The public FAQ should answer these without reproducing the internal field guide.

### “Do we have to replace our existing platform?”

No. Replay and shadow are deliberately file-first and run beside the incumbent process. Existing
systems remain authoritative. Integration and replacement decisions come only after measured proof.

### “Is AssureRail licensed?”

Do not answer with one generic yes/no after live scope expands. Publish the current readiness and
performer for each function. At replay/shadow stage, state plainly that no live matching, issuance,
secondary execution or authoritative-record write occurs. For live modes, identify the relevant
AssureRail permission or licensed partner.

### “Do we have to use AssurePlane or another AssureLocker product?”

No. The trustee or other accountable party chooses the reviewer. AssureRail accepts any conforming,
signed and scoped evidence object from the appointed provider.

### “Does the trustee override the depository?”

The trustee is final for acceptance/rejection in the AssureRail PTC workflow. Where the route gives
a depository, RTA or another register legal effect, correction must occur and be acknowledged there.
AssureRail freezes on disagreement rather than choosing a competing record.

### “Do we need tokens?”

No. Conventional DA and PTC are first-class product modes and the first shadow workstreams.
Tokenisation is added only where authorised and useful.

### “Does AssureRail make the credit or investment decision?”

No. It organises facts, terms, evidence, approvals and exceptions. The transferee/investor retains
its decision and AssureRail records that authority separately from platform controls or external
opinions.

### “What proves the product works?”

One closed DA and PTC replayed deterministically; the next transactions shadowed beside the
incumbent; failure, restore, reconciliation and export exercised; then one controlled conventional
transaction only after the relevant gates close.

---

## 8. Visual and interaction direction

The eventual site should feel related to AssureLocker but not indistinguishable from it.

- Retain the dark institutional base and rigorous evidence/status conventions.
- Use AssureRail amber/gold as the primary accent; use green for evidenced/current, blue for
  external/partner-controlled and red/clay for gated/prohibited.
- Prefer transaction diagrams, mode matrices, authority/record maps and pilot scorecards over
  generic blockchain, coins, chain links or liquidity imagery.
- Every capability card that could imply regulated availability needs a visible status:
  `REPLAY`, `SHADOW`, `PARTNER-EXECUTED`, `ASSURERAIL-AUTHORISED`, `TOKEN-SANDBOX` or `NOT AVAILABLE`.
- Add a persistent `Scope & status` link near every product CTA.
- Keep the product-family relationship visible but neutral: `AssureLocker is one optional evidence
  provider; AssurePool is one optional DA feeder.`
- Do not draw arrows that require PTC to pass through AssurePool or AssureLocker.
- Do not use token/ledger animation in the hero. The hero should show many participant systems
  converging on a controlled case and returning acknowledgements.

---

## 9. CTA and conversion architecture

### Initial CTAs

1. `Propose a completed-deal replay`
2. `Nominate a DA and PTC case`
3. `Join the design consortium`
4. `Co-design the trustee operating model`
5. `Map an incumbent integration`

### CTAs not appropriate yet

- `Start trading`
- `List a pool`
- `Issue a PTC`
- `Find investors`
- `Tokenise now`
- `Connect to CBDC`
- `Open an account`
- `Go live`

### Replay intake fields

INBOUND-01 deliberately limits the public form to organisation, work email, job role, institution
type, DA/PTC/both, current stage, completed-deal owner status, timing and explicit contact consent.
It has no file or free-text field. Asset class, volume, named counterparties, systems, transaction
references, constraints and problems are collected only in an authorised discovery process after
the appropriate scope and confidentiality steps. Data transfer follows NDA, classification and an
approved channel.

---

## 10. SEO and content themes

Initial educational pages should explain the category without implying legal availability:

- direct assignment transaction workflow in India;
- DA versus PTC: parties, records and lifecycle differences;
- PTC trustee versus depository/RTA records;
- how to shadow a securitisation transaction without replacing the incumbent;
- primary PTC issuance versus secondary SDI trading workflows;
- why a conventional digital transaction is not “manual”;
- tokenised representation versus legally authoritative register;
- transaction evidence, completion evidence and reconciliation;
- provider-neutral assurance in securitisation; and
- how to evaluate a loan-transfer platform pilot.

Every legal/regulatory explainer must have an effective date, primary-source references and a
prominent statement that it is not legal advice.

### 10.1 Primary-source baseline at drafting

The implementation team should deep-link the applicable current source rather than reproduce or
summarise a rule without an effective date. The baseline checked on 30 August 2026 is:

- [RBI Transfer of Loan Exposures Directions, 2021 — page updated 28 December 2023](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12166&Mode=0);
- [RBI Securitisation of Standard Assets Directions, 2021 — page updated 5 December 2022](https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12165&Mode=0);
- [RBI Outsourcing of Information Technology Services Directions, 2023](https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=12486&Mode=0&fn=14);
- [SEBI SDI and Security Receipts Regulations, 2008 — page showing amendment through 6 July 2026](https://www.sebi.gov.in/legal/regulations/jul-2026/securities-and-exchange-board-of-india-issue-and-listing-of-securitised-debt-instruments-and-security-receipts-regulations-2008-last-amended-on-july-06-2026-_102674.html);
- [SEBI Master Circular for issue and listing of NCS, SDI, security receipts, municipal debt and commercial paper, 15 October 2025](https://www.sebi.gov.in/sebi_data/attachdocs/oct-2025/1760532257519.pdf); and
- [Depositories Act, 1996 — India Code consolidation as on 1 June 2026](https://www.indiacode.nic.in/bitstream/123456789/1955/1/aA1996-22.pdf).

This list is a publication baseline, not a complete perimeter memo. Counsel must confirm later
amendments and the sources applicable to the precise asset, participants, placement/listing,
instrument, transfer and product function before release.

---

## 11. Build phases toward an AssureLocker-scale site

### Phase W0 — claims correction

- Remove or supersede the stale AssureRail and Pool-Tokenisation briefings.
- Correct downloads, investor and AssureLocker cross-product references.
- Publish no new product claim.

### Phase W1 — credible foundation

- Build `/assurerail` from §4.
- Build `/assurerail/pilot` around the four-part proof.
- Add `/assurerail/status` from the governed mode/function register.
- Gate the two new HTML decks as appropriate.

### Phase W2 — route and persona depth

- Add DA, PTC, conventional and persona pages after mode cards and design-partner review.
- Publish integration schema/examples only after the file/API contract exists.
- Add public FAQ from §7.

### Phase W3 — regulated-function expansion

- Add matching, primary/secondary and token pages only for specifically approved modes.
- Name licensed partners and exact performer boundaries only with contractual consent.
- Deep-link marketing claims to the current mode-readiness status.

### Phase W4 — full product ecosystem

- AssureRail-specific resource library, integration documentation, participant onboarding, status,
  trust/security, support and transaction-application entry.
- At this point the breadth may resemble AssureLocker, because it will be supported by a real
  product, route evidence, named operating owners and mode-specific permissions.

---

## 12. Acceptance checklist for any AssureRail web change

- [ ] DA and PTC are both represented; neither is routed through AssurePool by default.
- [ ] Conventional modes appear before or equal to tokenised modes.
- [ ] AssureLocker/AssurePool is optional and provider-neutral intake is explicit.
- [ ] The exact claim tier and mode status are visible.
- [ ] “Venue”, “matching”, “secondary”, “issue”, “settle” and “authoritative” identify the performer
      or carry a clear gate.
- [ ] Trustee workflow authority and route-defined legal record are not conflated.
- [ ] No current subsidiary, licence, partner, CBDC, title or production claim is invented.
- [ ] The current tokenised-DA code is described as a demo slice, not the whole product.
- [ ] No unsupported customer, transaction-volume, liquidity or time-saving claim is made.
- [ ] The CTA asks for replay/design work appropriate to the present stage.
- [ ] Regulatory sources are primary, current and effective-dated.
- [ ] Counsel, claims, product-status and security owners approve publication.
