# NBFC account, engagement and billing workflow

15 September 2026. Founder-confirmed product requirements. Implement in the standalone AssureRail customer experience. This records the required behaviour; it does not assert that billing, collections or settlement integrations are complete.

The earlier execution calculator and pricing workbooks must be migrated to this policy before they are used for a new customer quote. This update records requirements and commercial policy; it does not change their runtime calculations or activate payment collection.

## Confirmed commercial policy

| Stage | Pricing | Collection and start condition |
|---|---|---|
| Initial Assessment | Fixed accepted engagement quote; current bands ₹50,000 / ₹75,000 / ₹1,00,000 before tax | Pay the full amount due upfront. Paid processing starts only after receipt reconciliation and allocation to this engagement. |
| Portfolio Preparation | Separate fixed engagement quote; preserve an explicitly agreed credit for reusable Initial Assessment work | Pay the full incremental amount due upfront before preparation begins. No automatic upgrade or collection deferred to execution. |
| Buyer Review & Execution | Separate success fee; approximately 30 bps as the quote baseline | Calculated on actual purchase consideration successfully settled. Collected from escrow at successful settlement under the accepted distribution schedule. |

The founder expressly selected **actual purchase consideration settled**, rather than loan principal proposed or transferred, as the execution fee base. The success fee is **additional to assessment/preparation fees**: earlier stage payments do not reduce it. Thirty bps is a proposed starting rate, not an industry tariff or a rate automatically accepted by every customer. Freeze the actual rate, basis and completion trigger in the execution quote.

This supersedes the earlier principal-based, all-inclusive Gold pricing illustration for this NBFC journey. Do not carry the earlier 60/35/20 bps tiers, common-programme charges, minima or automatic preparation credits into the new success fee. Other product pricing and already accepted customer contracts require their own scope/change process.

## Account-driven journey

1. **NBFC account and organisation onboarding.** Verify legal entity, user authority and access roles. Invite named colleagues into the same organisation with bounded permissions. Buyer onboarding/MSA is a separate journey.
2. **Billing setup.** Collect legal invoice name, registered/billing address, tax registration and applicable tax-status details, billing contact, invoice delivery destination and purchasing reference where required. Record authorised payment/refund contacts and the agreed tax/withholding treatment. Do not collect card credentials into the AssureRail profile.
3. **Create Initial Assessment engagement.** Capture asset, book, cutoff, record-count band and ownership/data authority; check supported scope before charging. Show fixed fee, applicable taxes, included outputs, review cycles and correction window. Accept the order and processing terms with versioned authority evidence.
4. **Pay and activate.** Offer approved payment link or bank-transfer instructions. Issue the authoritative invoice and reconcile payment to this specific engagement. The paid work queue opens only when the invoice is satisfied under the approved payment and withholding rules.
5. **Upload, assess and improve.** Guided loan-tape/document uploads, saved progress, checks, source-linked questions, reviewer release and included correction/reassessment cycles stay in the account. A second unrelated book is a new engagement. Do not charge again for an included same-scope run.
6. **Request Portfolio Preparation.** Issue a separate accepted scope and invoice, showing any applicable Initial Assessment credit exactly once. Collect the full remaining amount upfront, then activate preparation. The seller can retain its paid assessment and decline this stage.
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

`execution fee before tax = eligible actual settled purchase consideration × accepted bps ÷ 10,000`

At 30 bps, the rate is 0.30%. The eligible base is the buyer's actual purchase consideration for the successfully completed acquisition, before distributions to the seller's existing lender, AssureRail and other payees. It excludes unrelated escrow deposits, unclosed books and cancelled consideration. The transaction quote must define treatment of price adjustments and separately paid accrued-interest items; do not infer the base from an arbitrary escrow credit.

Calculate with exact currency arithmetic and the accepted rounding policy. For multiple successful partial closings, compute the cumulative fee on eligible consideration and subtract the execution fee already accounted for, so rounding and repeat events do not produce duplicate charges. Each seller retains a separate base, invoice and fee balance. If an all-or-nothing closing was agreed, an incomplete batch is not successful merely because one payment message was acknowledged.

Escrow release conditions must align the contractual successful-close trigger with the bank/provider's accepted settlement process. The seller's direction and approved distribution statement authorise the fee line; AssureRail cannot take an unagreed amount. Fee payment is part of the agreed successful closing, not a general account-sweep permission. Unknown payment outcomes require reconciliation before retry. Corrected or reversed transactions follow the agreed adjustment/refund process.

| Actual consideration settled | Execution fee at 30 bps, before tax |
|---|---:|
| ₹8.40cr | ₹2.52L |
| ₹10cr | ₹3L |
| ₹25cr | ₹7.50L |
| ₹50cr | ₹15L |

Example with the existing full-preparation price assumption: ₹50,000 Initial Assessment plus ₹2.50L upfront on upgrade reaches ₹3L total preparation fees. A subsequent successful ₹10cr sale adds a ₹3L execution fee. Total AssureRail fees are ₹6L before tax and external expenses. Earlier fees are already paid; only the due execution invoice and other separately authorised payables enter the closing distribution.

For five sellers each using that ₹3L preparation scope and each settling ₹10cr at 30 bps, total AssureRail fees would be ₹30L before tax, not the earlier ₹50L cohort illustration. Recalculate margins and break-even from this policy and actual accepted rates; do not retain the old revenue assumptions silently.

## Account dashboard and implementation acceptance

Show stage, engagement reference, accepted scope/quote, amount due, paid/credited amounts, payment status, owner, next action, outstanding documents, report versions and remaining included reviews. Use separate commercial and delivery states: “payment pending” is not “under review”, and “execution terms accepted” is not “sale completed”.

Acceptance requires proving that: unpaid or partially paid stages cannot begin; payment events cannot unlock the wrong organisation/book/stage; credits cannot be consumed twice; included reruns are not re-invoiced; execution uses settled consideration rather than principal; failed/unclosed sales create no success fee; prior preparation fees do not reduce the execution fee; partial closings and duplicate receipts cannot double charge; and the seller statement reconciles the approved fee and actual escrow receipt.

The customer interface belongs in AssureRail. Reused assessment capabilities operate behind its governed integration. The NBFC should not need an AssureLocker account, a developer key or access to a developer portal to purchase and complete these stages.
