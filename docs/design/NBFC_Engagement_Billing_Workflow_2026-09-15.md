# NBFC account, engagement and billing workflow

**Current commercial policy (15 September):** ₹500/loan execution-committed (₹8L minimum) or ₹650/loan standalone (₹10.4L minimum) for the combined fixed stages. The common Initial Assessment payment is 30% of the standalone fixed quote: ₹3.12L at the minimum. Choose after Initial Assessment and pay the selected route total less that payment before preparation. Initial Assessment is automated and unsigned, with no consultant review included. Portfolio Preparation requires qualified expert review and sign-off. Execution fees are additional; paid additional services require separate selection and acceptance. Top-up applies only to voluntary switch/withdrawal of an accepted execution mandate, not failed close alone. See the [current policy](../../../../docs/design/AssureRail_Product_Stages_2026-09-15.md) and [commercial pack](../../../../docs/gtm/pitch-pack-2026-09-15/README.md). Runtime migration and acceptance are still required.


15 September 2026. Founder-confirmed product requirements. Implement in the standalone AssureRail customer experience. This records the required behaviour; it does not assert that billing, collections or settlement integrations are complete.

The earlier execution calculator and pricing workbooks must be migrated to this policy before they are used for a new customer quote. This update records requirements and commercial policy; it does not change their runtime calculations or activate payment collection.

## Confirmed commercial policy

| Stage | Pricing | Collection and start condition |
|---|---|---|
| Initial Assessment | 30% of the standalone fixed quote: ₹3.12L minimum; credited once to either route, before tax | Pay upfront. Automated and unsigned; no consultant or qualified expert review is included. Paid processing starts only after receipt reconciliation and allocation to this engagement. |
| Portfolio Preparation | Selected route total less initial payment: committed ₹500/loan (min ₹8L) or standalone ₹650/loan (min ₹10.4L) | Pay the full incremental amount upfront before preparation begins. Qualified expert review and sign-off are included. |
| Buyer Review & Execution | Core Platform Execution & Success Fee: marginal 50/40/35/30 bps at ₹10/50/100cr boundaries; proposed ₹5L minimum. Additional services separately selected and quoted | Calculated on actual purchase consideration successfully settled. Collected from escrow at successful settlement under the accepted distribution schedule. |

The founder expressly selected **actual purchase consideration settled**, rather than loan principal proposed or transferred, as the execution fee base. The success fee is **additional to assessment/preparation fees**: committed-route stage payments do not reduce it; only a standalone-premium conversion credit is eligible. The founder selected the four marginal rates on15September2026. The₹5L minimum is proposed and subject to accepted transaction terms. Freeze the actual rate, basis and completion trigger in the execution quote.

This supersedes the earlier principal-based, all-inclusive Gold pricing illustration for this NBFC journey. Do not carry the earlier 60/35/20 bps tiers, common-programme charges, minima or automatic preparation credits into the new success fee. Other product pricing and already accepted customer contracts require their own scope/change process.

## Account-driven journey

1. **NBFC account and organisation onboarding.** Verify legal entity, user authority and access roles. Invite named colleagues into the same organisation with bounded permissions. Buyer onboarding/MSA is a separate journey.
2. **Billing setup.** Collect legal invoice name, registered/billing address, tax registration and applicable tax-status details, billing contact, invoice delivery destination and purchasing reference where required. Record authorised payment/refund contacts and the agreed tax/withholding treatment. Do not collect card credentials into the AssureRail profile.
3. **Create Initial Assessment engagement.** Capture asset, book, cutoff, record-count band and ownership/data authority; check supported scope before charging. Show fixed fee, applicable taxes, included outputs, review cycles and correction window. Accept the order and processing terms with versioned authority evidence.
4. **Pay and activate.** Offer approved payment link or bank-transfer instructions. Issue the authoritative invoice and reconcile payment to this specific engagement. The paid work queue opens only when the invoice is satisfied under the approved payment and withholding rules.
5. **Upload, assess and improve.** Guided loan-tape/document uploads, saved progress, deterministic checks and source-linked AI findings produce an automated, unsigned Initial Assessment. Included correction/reassessment cycles stay in the account. Failed extraction or low-confidence evidence produces a correction request, not a consultant assignment. A second unrelated book is a new engagement.
6. **Choose route and request Portfolio Preparation.** Show standalone and committed quotes; record route, mandate/scope/term if committed, then issue the accepted scope and invoice with Initial Assessment payment credited once. Collect the full remaining amount upfront, then activate preparation. The seller can retain its paid assessment and decline this stage.
7. **Accept execution engagement.** Show separately the rate in bps and percent, selected consideration base, indicative fee, taxes/withholding, successful-close definition and escrow collection authority. Obtain the seller's buyer-disclosure mandate and the transaction/provider approvals required for execution. There is no upfront execution success-fee charge.
8. **Close and reconcile.** Calculate the fee from the actual successful closing, record the invoice and approved escrow line, and reconcile the fee receipt. Show the seller its closing statement, paid fees and residual cash. Keep incomplete or ambiguous closings pending rather than treating them as successful.

## Billing and payment controls

- One organisation billing profile, with an immutable snapshot on each issued invoice. Later address or tax-profile changes must not rewrite an issued document.
- Separate engagement/order/invoice/receipt/allocation references for each stage and book. Payment for one engagement does not silently unlock another.
- A finance user may prepare payment information; only an authorised signatory accepts scope or an execution mandate. Uploaders cannot change pricing or settlement beneficiaries. Manual receipt confirmation uses separate maker/checker roles.
- A redirect from a payment page, a screenshot or a provider acknowledgement is not proof of paid status. Verify the receipt and allocate it exactly once; deduplicate provider events and reconcile bank transfers.
- Partial payments, excess receipts, payer/currency mismatches, approved withholding, credits, reversals and refunds have explicit states. An unexplained shortfall prevents activation. Refunds and reallocations require approval and preserve the audit history.
- Billing completeness and accepted terms are required before invoice/payment activation. Completing billing setup does not itself authorise a debit.
- Included reassessment entitlement belongs to the accepted paid engagement. Additional scope receives a new quote before additional work. Correction of an AssureRail defect does not consume a paid reassessment allowance.

## Success-fee calculation and escrow collection

`execution fee before tax = max(accepted minimum, sum(each eligible settled consideration slice × accepted bps ÷ 10,000))`, with zero success fee if no successful close.

The marginal slices are first₹10cr at50bps, above₹10cr through₹50cr at40bps, above₹50cr through₹100cr at35bps, and above₹100cr at30bps. The eligible base is the buyer's actual purchase consideration for the successfully completed acquisition, before distributions to the seller's existing lender, AssureRail and other payees. It excludes unrelated escrow deposits, unclosed books and cancelled consideration. The transaction quote must define treatment of price adjustments and separately paid accrued-interest items; do not infer the base from an arbitrary escrow credit.

Calculate with exact currency arithmetic and the accepted rounding policy. For multiple successful partial closings, compute the cumulative fee on eligible consideration and subtract the execution fee already accounted for, so rounding and repeat events do not produce duplicate charges. Each seller retains a separate base, invoice and fee balance. If an all-or-nothing closing was agreed, an incomplete batch is not successful merely because one payment message was acknowledged.

Escrow release conditions must align the contractual successful-close trigger with the bank/provider's accepted settlement process. The seller's direction and approved distribution statement authorise the fee line; AssureRail cannot take an unagreed amount. Fee payment is part of the agreed successful closing, not a general account-sweep permission. Unknown payment outcomes require reconciliation before retry. Corrected or reversed transactions follow the agreed adjustment/refund process.

| Actual consideration settled | Execution fee under revised slabs and proposed minimum, before tax |
|---|---:|
| ₹8.40cr | ₹5L |
| ₹10cr | ₹5L |
| ₹25cr | ₹11L |
| ₹50cr | ₹21L |
| ₹100cr | ₹38.50L |
| ₹125cr | ₹46L |

Example under the current minimums: At750loans, Initial Assessment is₹3.12L. Committed Portfolio Preparation requires another₹4.88L, reaching₹8L total fixed fees; standalone preparation requires another₹7.28L, reaching₹10.4L. A subsequent successful ₹10cr committed-route sale adds the separately accepted ₹5L proposed-minimum execution fee. Total committed-route AssureRail fees are₹13L before tax and external expenses.

For five sellers each using the ₹8L committed fixed-stage minimum and each settling ₹10cr under the revised execution schedule, total AssureRail fees would be₹65L before tax: ₹40L fixed stages plus ₹25L execution. Recalculate margins and break-even from this policy and actual accepted rates; do not retain the old ₹50L headline silently.

## Account dashboard and implementation acceptance

Show stage, engagement reference, accepted scope/quote, amount due, paid/credited amounts, payment status, owner, next action, outstanding documents, report versions and remaining included reviews. Use separate commercial and delivery states: “payment pending” is not “under review”, and “execution terms accepted” is not “sale completed”.

Acceptance requires proving that: unpaid or partially paid stages cannot begin; payment events cannot unlock the wrong organisation/book/stage; credits cannot be consumed twice; included reruns are not re-invoiced; execution uses settled consideration rather than principal; failed/unclosed sales create no success fee; committed preparation fees do not reduce execution; standalone-premium credit is capped and applied once; partial closings and duplicate receipts cannot double charge; and the seller statement reconciles the approved fee and actual escrow receipt.

The customer interface belongs in AssureRail. Reused assessment capabilities operate behind its governed integration. The NBFC should not need an AssureLocker account, a developer key or access to a developer portal to purchase and complete these stages.

## Route and review acceptance additions

- Do not start preparation without an accepted route and full reconciled balance: for 3,000 loans, initial ₹5.85L; next ₹9.15L committed or ₹13.65L standalone. The common initial is 30% of the standalone quote, not a fixed percentage of the committed route.
- Freeze both alternative quotes and loan scope. A committed order needs an explicit mandate, scope, term and responsibilities. Existing buyers do not automatically trigger a buyer-arrangement add-on. Core fee and additional scopes need explicit acceptance.
- A voluntary execution switch/withdrawal can create only the accepted fixed-price difference, less prior top-ups. Failed close, adverse findings, market delay, expiry or a system timeout alone must not auto-invoice a top-up. Partial scope and provider-default exceptions need review. No double minimum, blocked report export or automatic sweep.
- Initial Assessment is automatically released as preliminary, unsigned output. It cannot contain a professional assurance, legal opinion, buyer approval or expert sign-off. Portfolio Preparation alone needs a named qualified expert release. Track automated coverage, source citations, model/rule versions, uncertainty and actual preparation-review hours.
- Monitoring and query/dispute coordination are optional bounded services. Do not imply legal representation, adjudication or guaranteed dispute resolution. Additional charges require accepted scopes and prices.

These are requirements added to the commercial handoff; this documentation change does not prove these states are implemented in the running application.


## Standalone conversion credit

Standalone conversion: the full 30% premium actually paid for the same agreed scope is credited against eligible AssureRail execution fees at successful closing, capped at cumulative fees earned and applied once across partial closes. No cash refund or tax/external-cost offset. For 3,000 loans: ₹19.5L standalone fixed fees, ₹4.5L credit; ₹98.5L gross base execution becomes ₹94L collected, giving ₹113.5L combined fees. The committed route has no additional fixed-stage credit. This replaces the earlier 50% preparation-credit suggestion. Agree the execution scope, credit validity, eligible scope and treatment of refunds/reversals before conversion. No standalone conversion uptake or withdrawal recovery is assumed in the aggregate forecast.

## Current modular execution proposal

The founder agreed **Platform Execution & Success Fee + Additional Services**. Customer-facing metal tiers are superseded; additional-service rates still need accepted quotes. The existing marginal50/40/35/30bps schedule is the core success fee, charged once. Itemise optional arrangement, managed escrow coordination, custom buyer LMS/ERP integration, recurring technical feeds and monitoring/support. Buyer requirements describe outcomes; they do not auto-select paid services or remove the seller's acceptable provider choices. Nothing paid is preselected. Qualified expert review is included only in Portfolio Preparation; Initial Assessment remains automated and unsigned. Standard buyer-format export is included within core scope; custom connectors are separately quoted after reuse review.

The detailed service proposal and cost justification are in the [additional-service specification](../../../../docs/design/AssureRail_Execution_And_Additional_Services_2026-09-15.md). New add-on rates remain recommendations. The30%standalone premium conversion credit offsets only the core fee once; no additional-service uptake is assumed in the aggregate forecast. Production billing, buyer-system integration and recurring service activation still require implementation and acceptance.
