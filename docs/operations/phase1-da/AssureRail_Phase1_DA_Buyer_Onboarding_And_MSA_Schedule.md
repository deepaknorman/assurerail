# AssureRail Phase 1 DA buyer onboarding and MSA schedule

**Version:** 1.0 — 16 September 2026
**Classification:** `AUTHENTICATED`
**Status:** buyer onboarding baseline and MSA drafting schedule; it is not an executed buyer agreement.

## Entry rule

A buyer workspace is created only after the formal buyer MSA is signed and AssureRail approves the institution's activation. AssureRail then invites the buyer's nominated administrators. No public self-registration creates buyer authority, data access or transaction rights.

Before AssureRail Private Limited is incorporated and its live-readiness gate is passed, buyer activity is limited to non-binding design discussions and synthetic or authorised historical demonstrations. No pre-incorporation discussion creates a live workspace, paid obligation, mandate or settlement authority.

The MSA and onboarding record distinguish the buyer's diligence and purchase responsibilities from AssureRail's platform, preparation, Q&A and settlement-coordination services. Buyer requirements guide seller preparation but do not automatically add a seller-paid service.

## Buyer MSA schedule

| Heading | Minimum agreement point |
|---|---|
| Institution and authority | Legal identity, regulated status where applicable, authorised signatory and ability to appoint users |
| Platform role | AssureRail coordinates the accepted workflow and evidence; buyer retains credit, legal, compliance, valuation, pricing and purchase decisions |
| Eligibility and requirements | Buyer may define structured criteria; acceptance of a profile does not commit it to purchase a portfolio |
| Confidentiality and data | Seller-private, buyer-private, shared-case, privileged and personal-data handling; permitted purpose; retention and export |
| Users and access | Buyer administrator duties, MFA, joiner/mover/leaver process, periodic recertification and case-scoped RBAC |
| Diligence and Q&A | Request format, priority, response clocks, reliance limits, professional questions and closure record |
| Providers and costs | Buyer-appointed and seller-borne work must be explicit; no duplicated counsel or review cost without scope approval |
| Integration | Secure file exchange is the default; API work is optional, separately scoped and subject to security acceptance |
| Settlement | Buyer funding instruction, bank/VAN evidence, cut-offs, failed/unmatched funds and acknowledgement boundaries |
| Monitoring | Optional scope, year-based payer allocation and servicer dependency stated in each mandate |
| Liability and outcome | No seller quality, eligibility, price, registry result or closing guarantee; each professional/provider owns its act |
| Audit, incident and complaints | Access and action evidence, security response, operational escalation and dispute contacts |

## Onboarding journey

1. MSA executed and buyer institution approved.
2. Buyer names a Primary Administrator and backup administrator.
3. Administrators complete identity, MFA, authority and contact validation.
4. Buyer selects its requirement profile using controlled fields.
5. AssureRail reviews the profile for consistency, unsupported requirements and seller-cost implications.
6. Buyer approves the versioned profile and user-role assignments.
7. AssureRail runs a workspace and notification test with synthetic data.
8. AssureRail invites buyer users to a specific case only after seller authority and case-sharing gates pass.

## Structured requirement profile

Free text is limited to a bounded note or exception explanation. Use checkboxes whenever choices can coexist, and ranges or controlled dropdowns only when choices are mutually exclusive.

| Section | Field treatment | Examples |
|---|---|---|
| Asset families | Multi-select checkboxes | EV/vehicle; residential housing; education; gold-backed; other approved family |
| Originator acceptance | Multi-select checkboxes | Previously approved; new subject to onboarding; buyer review before preparation |
| Corpus and concentration | Numeric ranges | minimum/maximum corpus; seller/region/OEM/borrower concentration limits |
| Seasoning and remaining tenor | Numeric ranges plus unit | minimum seasoning; remaining-month bands |
| Performance | Numeric ranges | DPD, roll rate, vintage, loss, recovery and prepayment thresholds |
| Documentation | Multi-select requirements | loan/security documents, KYC, insurance, charge/release and authority evidence |
| Diligence method | Controlled choice plus conditional checkboxes | population computation, professional sample, field sample, independent certificate |
| Professional review | Multi-select checkboxes | legal, CA/factual, collateral/technical, field verification |
| Settlement | Controlled choices and ranges | bank/VAN route, cut-off, payoff/release dependencies, required acknowledgements |
| Servicing and monitoring | Multi-select and ranges | originator servicing, collection account, frequency, metrics, alert thresholds |

Complex terms receive concise hover definitions and a link to the agreed glossary. Selection cards and dropdowns use compact spacing while section headings retain clear top separation.

## Buyer RBAC

| Role | May do | Cannot do |
|---|---|---|
| Buyer Primary Administrator | Invite/remove buyer users, assign buyer roles, approve profile version, recertify access | Approve own exceptional access or see another buyer workspace |
| Buyer Deal Lead | View assigned case, coordinate diligence, propose conditions and decision record | Change institution settings or settlement accounts |
| Buyer Credit Reviewer | View permitted financial/performance evidence and record credit analysis | View privileged legal material unless separately assigned |
| Buyer Legal Reviewer | View permitted legal documents, raise legal questions and record legal conditions | Change credit decision or seller data |
| Buyer Operations / Settlement | View closing checklist, bank/VAN instructions and acknowledgements | Change purchase approval or unilaterally release funds |
| Buyer Monitoring User | View selected post-close reports and queries for its monitoring period | View pre-close privileged material by default |
| Buyer Auditor / Read-only | View approved immutable records and exports within scope | Edit, invite, approve or submit |

Permissions are institution-, workspace-, case-, portfolio-, document-class- and action-scoped. Maker-checker applies to administrators, settlement details and final decision records. The system records invitations, grants, expiry, exports and revocation.

## Case invitation and operating response

The buyer receives only the seller-approved buyer pack and later evidence expressly released to it. Buyer questions are acknowledged within one business day. A standard substantive response target is five business days when no new external evidence, professional opinion or third-party act is required. The buyer's own response or qualification target is ten business days, subject to its MSA and the case timetable.

AssureRail records questions, sources, respondent, reviewer involvement, status and closure. The buyer remains free to condition or reject a transaction.
