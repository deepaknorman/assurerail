# AssureRail conventional DA Phase 1 decision register

**Policy version:** `DA-2026-09-16-PILOT-1`
**Release repository:** standalone AssureRail repository
**Status:** founder decisions accepted unless a row says `pilot default`
**Phase boundary:** conventional direct assignment is Phase 1. PTC remains a later discovery and design route.

This register is the human-readable companion to `config/assurerail-da-commercial-policy.json`. Runtime calculations, financial models, quotes, contracts, public copy and generated sales material must identify the policy version they use. A historical accepted quote retains its frozen policy and digest.

## Product and payment stages

| Stage | Accepted commercial rule | Delivery boundary | Payment trigger |
|---|---|---|---|
| Initial Assessment | 30% of the complete standalone fixed-stage quote | Automated and unsigned. No consultant, qualified expert or human merit review. Evidence-linked processing, risk flags, economics and remediation guidance are preliminary. | Upfront, after a binding scope/count/corpus quote and before processing. |
| Portfolio Preparation | Balance of the selected committed or standalone route | Mandatory section sign-off by an eligible CA/financial reviewer and transaction counsel. Asset/technical specialist only when the asset or exception rules require one. | Full remaining fixed-stage balance upfront before work starts. |
| Execution | Seller-specific marginal success fee on actual purchase consideration settled | AssureRail supplies or coordinates only the accepted, itemised services. No buyer approval or successful sale is guaranteed. | On successful completion under the accepted escrow distribution statement. |

The current pilot default includes the first automated Initial Assessment plus three same-scope automated reassessments within 30 days. This remains a visible pilot default until the founder confirms or changes the allowance.

## Fixed-stage pricing

- Primary count: each unique `(seller, loan, borrower or co-borrower)` pair.
- Linked-party count: each separate unique `(loan, linked party)` pair.
- Committed route: ₹500 per primary pair plus ₹250 per linked-party pair, with an ₹8 lakh per-seller minimum.
- Standalone route: ₹650 per primary pair plus ₹325 per linked-party pair, with a ₹10.4 lakh per-seller minimum.
- Initial Assessment invoice: 30% of the complete standalone fixed-stage quote and credited once against either preparation route.
- Aggregate accepted programme corpus above ₹100 crore: 10 bps committed or 13 bps standalone on the excess above ₹100 crore, allocated among sellers by proposed consideration.
- Every declared/admitted count or corpus variance is recalculated. There is no tolerance band.

For a downward reconciliation, the value first remains an institutional customer credit. A cash refund requires formal engagement closure and cannot exceed 20% of the original estimate; the remainder stays as credit under the accepted credit terms. An upward adjustment must be paid before the affected report is released.

## Execution pricing

For each seller, calculate cumulatively across successful partial closings under that seller's accepted mandate:

`max(₹5 lakh, 40 bps on the first ₹25 crore + 30 bps above ₹25 crore)`

The basis is that seller's share of actual purchase consideration successfully settled. Slabs never reset for a later round by the same seller. Separate sellers receive separate ledgers, floors and invoices. A failed or unclosed transaction earns no success fee.

The standalone premium paid for the same scope may be credited once against eligible execution fees if the seller later converts to AssureRail execution. It is capped at execution fees earned, cannot create a cash refund and cannot offset tax or third-party costs. A committed-route top-up applies only to a voluntary switch or withdrawal under an accepted mandate; failed close or buyer rejection alone does not trigger it.

## Additional services and cost governance

- Base, Premium and Full are presentation views. Every additional service remains itemised, actively selected and separately contracted.
- Routine managed third-party services use a published AssureRail customer rate. The internal planning allowance is supplier cost plus 25%; AssureRail retains delivery efficiency and absorbs ordinary in-scope overruns.
- Statutory charges, duties and exceptional actual-cost items remain separately identified.
- A standard accepted point-to-point secure-file connection is ₹50,000 for setup, testing and validation. APIs are quoted on request.
- Contractor planning is ₹25,000 per person-day. A person who works is charged for a full day, and the same day may be shared across engagements.
- Optional ongoing monitoring must be selected. For DA, the seller funds year 1; the buyer funds year 2 onward unless the seller remains servicer or the contract says otherwise.
- The approximate 60 bps service-rich AssureRail-owned revenue benchmark is internal quote governance. It is neither a public promise nor an invoice formula.

## Referral and data-preparation boundaries

- Referral base: 8.5%, negotiable only with founder approval.
- Eligible basis: collected AssureRail fees for Initial Assessment, Portfolio Preparation and core Execution only.
- Excluded: additional services, integrations, programme supplement, monitoring, statutory or third-party pass-throughs, GST, refunds and credits.
- Paid quarterly in arrears, subject to invoice and TDS treatment.
- An accepted registration lasts six months and lapses if no evidenced qualifying introduction is made within 60 days.
- A referral partner has no seller-workspace access merely because it made an introduction.
- A Data Preparer may format and upload assigned seller data at the seller's direct expense. It cannot attest, accept a quote, submit an assessment, see buyer-private data, approve a report or make an execution decision.

## Pre-live operating boundary

Until AssureRail Private Limited is incorporated and its bank, GST and Razorpay live setup are ready, AssureRail may develop the product, accept applications, qualify prospective portfolios, run buyer-design discussions and demonstrate synthetic or authorised historical material. It must not collect a paid assessment, accept a live execution mandate, move customer money or claim live settlement.

The approved public status line is:

> Initial Assessment applications are open for approved NBFC portfolios. Live transfer, funds movement and settlement services remain subject to separate institutional activation.

## DA participant control principle

Every participant receives the smallest workspace, document and action scope required for its appointed function. A participant's commercial involvement does not grant case-wide access. Buyer requirements guide preparation but do not automatically purchase a seller-paid service.

The Phase 1 role map must explicitly cover the seller/originator, its existing lender or charge-holder, buyer, seller counsel, buyer counsel, CA/financial reviewer, bureau provider, escrow provider, settlement/VAN bank, collection-account bank, ROC/NeSL/RTO and other registry agents, servicer, field verifier, technical reviewer, Data Preparer, referral partner, and AssureRail commercial, diligence, finance, operations, security and approval personnel.

## Open founder decisions

These items do not block current build work; the system uses the stated pilot default until changed.

| Decision | Pilot default | Why it matters |
|---|---|---|
| Included automated reassessments | Three within 30 days for the same accepted book and scope | Controls AI/OCR cost and customer expectations. |
| Referral treatment of the large-programme supplement | Excluded from the 8.5% referral basis | The supplement pays for additional audit, legal, compliance and field-work capacity, while the referral basis is intended to cover the three core stage fees. |
| Post-assessment credit validity | 12 months at institution level after formal closure, subject to the refund cap | Determines liability ageing and conversion incentive. |
| Bureau operating model | Seller or buyer performs the pull under its permitted purpose; AssureRail ingests the result unless separately authorised | Avoids AssureRail assuming an unsupported bureau purpose. |
| Post-DA servicing | Originator continues as servicer unless buyer terms require transition | Drives collection-account, monitoring and borrower-communication work. |
| Registry access | Assigned provider or authorised seller representative files; AssureRail orchestrates and records evidence | Avoids implying AssureRail holds statutory filing authority. |

## Change discipline

1. Record the founder decision here and in the machine policy.
2. Regenerate the API and web policy snapshots.
3. Update calculators and their invariant tests.
4. Regenerate models, decks, HTML/PDF and download manifests from source.
5. Run public-exposure scans for retired rates, human-reviewed Initial Assessment claims, Phase 1 PTC claims and internal benchmark leakage.
6. Preserve previously accepted quotes by policy version and digest; never mutate them in place.
