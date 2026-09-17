# AssureRail Phase 1 DA settlement-provider selection

**Version:** 1.0 — 17 September 2026

**Classification:** `INTERNAL`

**Status:** provider discovery and selection baseline. No provider is appointed or production-live.

## Decision

Castler is no longer the assumed settlement provider. Its public material still describes an Escrow Banking product and a Digital Escrow ID API, but its current primary product positioning emphasises software, data and recoverability escrow. AssureRail will not design the Phase 1 DA closing around Castler unless it supplies a written, bank-backed solution that passes every gate in this document.

Run these routes in parallel:

1. **Axis Bank directly** — request a transaction-banking and escrow design session alongside buyer alignment.
2. **HDFC Bank directly** — ask the buyer and transaction-banking teams whether HDFC can operate the closing account and controlled payout workflow.
3. **TBX, formerly TransBnk** — assess it as a provider-neutral orchestration and bank-integration layer, with the account bank and legal responsibilities named explicitly.

Do not select a payment aggregator, marketplace split-payment product or virtual-account vendor merely because it can produce a VAN. A VAN identifies and reconciles money; it does not by itself create an escrow, impose closing conditions or authorise the distribution waterfall.

## Required operating model

For a successful DA closing, the accepted solution must support this result:

```text
buyer-approved purchase consideration
  -> bank-held deal account or other counsel-approved settlement route
  -> verified receipt and exact amount reconciliation
  -> locked, seller-authorised distribution schedule
       -> existing lender payoff / release amount, if applicable
       -> each seller's net proceeds
       -> earned AssureRail execution fee and tax
       -> approved professional, registry or settlement amounts
  -> leg-by-leg bank acknowledgement and final reconciliation
```

The account bank or appointed settlement provider moves the money. AssureRail prepares and verifies the agreed schedule, obtains the required approvals, sends or facilitates the accepted instruction and reconciles evidence. Gross purchase consideration must not pass through AssureRail's operating account. A technology provider does not become the account bank, trustee or regulated payment intermediary merely by supplying APIs.

## Non-negotiable qualification gates

| Gate | Required evidence |
|---|---|
| Legal capacity | Named scheduled commercial bank, account title, contracting parties, trustee/escrow agent if any, and counsel-confirmed permitted purpose |
| DA use-case acceptance | Written confirmation that purchase consideration for assignment of loan receivables is accepted, including a multi-seller pool where applicable |
| Transaction scale | Confirmed ability to receive and distribute ₹50–300 crore closing amounts through the agreed RTGS/account route without consumer-payment or per-transaction limits |
| Deal and seller segregation | Deal-specific account or identifier and seller-level sub-ledger/VAN/reconciliation without commingling with AssureRail funds |
| Conditional release | Versioned closing conditions, maker-checker controls and a frozen distribution schedule that cannot be changed by AssureRail alone |
| Multi-leg payout | Existing lender payoff, seller net proceeds, AssureRail fee/tax and approved third-party legs, with beneficiary validation and bank acknowledgements |
| Failure safety | Idempotent instruction, status inquiry, ambiguous-outcome hold, repair/reversal process and no blind retry |
| Connectivity | Portal/file route for the pilot plus API or H2H option; signed callbacks or bank-authenticated status and statement retrieval |
| Audit and retention | Actor, approval, instruction, bank reference, time, amount, beneficiary and final status evidence with agreed retention and export |
| Security | Institution-scoped identities, MFA, service credential custody, encryption, IP/network policy, rotation, incident and access-recertification process |
| Operations | Named implementation and closing owners, cut-offs, support/escalation, first-event supervision and disaster/recovery procedure |
| Commercial | Account opening, annual, VAN, API/H2H, transaction, trustee, amendment, exception and closure charges itemised before appointment |

A provider failing any legal-capacity, DA-use-case, scale, conditional-release, failure-safety or audit gate is unsuitable regardless of API quality.

## Evidence-based shortlist

| Route | Evidence of fit | Open proof required | Current position |
|---|---|---|---|
| Axis Bank direct | Axis publicly offers escrow for sale and purchase transactions, fintech and payout businesses, centralised operations, Paypro/Power Access and API-based ePower escrow payments. Its NBFC coverage includes escrow, security trustee and API/H2H integration. | DA purchase-consideration acceptance; five-seller structure; VAN/sub-ledger; exact multi-beneficiary payout; buyer/seller contracting; limits, SLA and price | **Priority 1.** Best public match and already part of buyer outreach |
| HDFC Bank direct | HDFC's developer portal exposes corporate RTGS/NEFT/IMPS/A2A initiation, transaction status and reconciliation capabilities. | A bank-owned DA closing/escrow product is not established by the public API material; obtain confirmation from the financial-institutions and transaction-banking teams | **Priority 1 in parallel.** Strongest if HDFC is the buyer and can own the closing rail |
| TBX / TransBnk plus named bank | TBX describes institutional transaction banking, escrow and regulated accounts, a digital ledger with virtual accounts and fund allocation, multi-bank integration, and co-lending escrow/reconciliation. | Name the account bank and contracting entity; establish that TBX never holds the funds; confirm DA use case, ₹300 crore scale, waterfall controls, production references, liability and exit | **Priority 2.** Strong neutral integration candidate |
| Castler | Castler separately advertises enterprise escrow banking, partner banks, APIs and Digital Escrow IDs/VANs. | Current product ownership and roadmap; bank-backed DA acceptance; scale; waterfall and acknowledgement capability; contractual and operational fit | **Hold / fallback.** Do not assume fit from legacy escrow claims |
| ICICI or another transaction bank direct | Corporate API suites can support payments, accounts and reconciliation. | Named escrow/settlement product and full DA operating acceptance | **Contingency.** Approach if the buyer's bank cannot support the closing |

Public product pages are discovery evidence only. They are not provider acceptance, legal advice or proof of a production connection.

## Provider RFI

Send the same questions to every shortlisted provider so responses are comparable.

1. Which regulated bank holds the funds, and in whose name is the account opened?
2. Who are the contracting parties and who acts as escrow agent or trustee, if anyone?
3. Will the bank accept purchase consideration for a direct assignment of loan receivables from one buyer and distribute it across five sellers?
4. Can a ₹50 crore pilot and later ₹125–300 crore closings be processed through RTGS without payment-aggregator or consumer-payment limits?
5. Can each deal and seller receive a unique VAN, sub-ledger or equivalent reconciliation identifier while money remains in the bank-held account?
6. Can the same closing pay an existing lender directly, then seller net proceeds, AssureRail's earned fee/tax and approved third-party amounts?
7. What signed agreement and approvals freeze the distribution schedule? Who can amend, approve, suspend and release it?
8. Can AssureRail submit a schedule without possessing unilateral authority to release or redirect funds?
9. Which maker-checker, beneficiary validation, sanctions/fraud and high-value transaction controls apply?
10. What API, H2H, SFTP, portal and webhook/status interfaces are available? Supply sandbox documentation and sample acknowledgements.
11. How are duplicate, timeout, unknown, partial, returned and failed payout states reconciled? Is every instruction idempotent?
12. What bank references, signed statements and closing evidence are available for every leg?
13. What are the onboarding/KYC, account-opening, agreement, UAT and production-approval steps?
14. Itemise setup, account, VAN, transaction, API/H2H, trustee, amendment, exception, statement and closure charges plus tax.
15. Provide the named implementation owner, closing-day escalation route, cut-offs, support coverage and two comparable institutional references.

## Pilot proof required

The selected provider must first complete a synthetic or provider-approved sandbox rehearsal using AssureRail's five-seller structure. Test exact funding, overfunding, underfunding, seller-specific allocation, lender payoff, fee/tax deduction, invalid beneficiary, duplicate instruction, partial payout, timeout after submission, status inquiry, returned funds, schedule suspension, amended schedule and final evidence export.

The sandbox result does not authorise live money. Production begins only after the executed agreements, corporate/KYC readiness, bank account, security acceptance, UAT, maker-checker assignments, support route and controlled first-event plan are approved.

## Integration boundary

AssureRail retains one provider-neutral settlement contract and implements a provider adapter only after selection. The canonical objects are:

- closing pack and immutable digest;
- buyer funding requirement and observed receipt;
- seller-specific settled consideration;
- seller-authorised distribution schedule and version;
- payout leg, beneficiary reference, purpose, amount and tax treatment;
- provider instruction and idempotency reference;
- provider observation, acknowledgement and bank reference;
- exception, repair and final reconciliation state.

Provider-specific account numbers, credentials, callback secrets and bank instructions remain in approved secret/configuration stores. They do not enter source control, general planning documents, browser configuration or sales material.

## Contact routes

| Organisation | Contact route | Discussion request |
|---|---|---|
| Axis Bank | `escrow_rera.products@axis.bank.in`; use the existing Axis relationship to request the Financial Institutions, Transaction Banking, Escrow/ePower and CMS teams | DA sale/purchase closing account, VAN/reconciliation, multi-beneficiary RTGS and API/H2H sandbox |
| TBX / TransBnk | `partnership@transbnk.co.in` | Bank-backed Escrow & Regulated Accounts and Digital Ledger design for a ₹50 crore five-seller DA pilot |
| HDFC Bank | Existing buyer contact; request Financial Institutions and Transaction Banking/Cash Management participation | Bank-operated closing route plus corporate payment/status/reconciliation APIs |
| Castler | `money@castler.com` only if retained as fallback | Written confirmation of current fund-escrow product, bank, DA acceptance, scale and API ownership |

## Current sources

- [Axis Bank escrow services](https://www.axis.bank.in/corporate/custodial-capital-account/escrow-services)
- [Axis Bank services for NBFCs](https://www.axis.bank.in/corporate/financial-institutions/nbfcs)
- [Axis Bank API developer portal](https://apiportal.axis.bank.in/portal/)
- [HDFC Bank corporate payment APIs](https://developer.hdfc.bank.in/payments)
- [TBX institutional transaction-banking profile](https://www.tbx.co.in/about-us)
- [TBX digital-ledger and virtual-account product](https://www.tbx.co.in/products/digital-ledger-code)
- [TBX co-lending escrow platform](https://www.tbx.co.in/products/co-lending-platform)
- [TBX contact page](https://www.tbx.co.in/contact-us)
- [Castler enterprise escrow-banking page](https://castler.com/escrow-account)
- [Castler Digital Escrow ID API](https://developer.ncome.in/reference/create-escrow)
