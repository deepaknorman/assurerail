# AssureRail Phase 1 DA participant register and RACI

**Version:** 1.0 — 16 September 2026
**Classification:** `INTERNAL`
**Legend:** `A` accountable decision owner; `R` performs the work; `C` consulted before completion; `I` receives the resulting record. Each activity has one primary `A`.

## Participant and authority register

| Participant or internal role | Appointment or admission evidence | Permitted responsibility | Express boundary |
|---|---|---|---|
| Seller / originator | KYC, board or delegated authority, workspace membership, accepted order or mandate | Supply and attest seller data; select scope; remediate; accept seller obligations; authorise settlement distribution | Cannot approve buyer decision or another seller's data |
| Existing lender / charge-holder | Debt and charge record; authorised payoff or release contact | Confirm payoff, release conditions and release evidence | No portfolio-wide access beyond the affected debt/security |
| Buyer / direct assignee | Buyer MSA, onboarded institution, approved users, requirement profile | State requirements; conduct diligence; approve, price, condition or reject purchase | Buyer requirements do not silently buy seller-paid work |
| Seller counsel | Engagement or work order and conflict clearance | Seller-side legal review, schedules, representations and closing deliverables | Signs only its opinion or work product |
| Buyer counsel | Buyer appointment or accepted seller-borne scope | Buyer-side legal diligence and closing advice | Separate from seller counsel; no duplicated charge without approved scope |
| CA / financial reviewer | Qualification, independence and work order | Review and sign assigned financial, factual or reconciliation section | No whole-case assurance unless expressly engaged |
| Bureau provider / authorised puller | Permitted-purpose evidence and provider terms | Produce authorised borrower or account report | AssureRail normally ingests; it does not invent a bureau purpose |
| Escrow provider / settlement bank / VAN bank | Bank agreement, account/VAN identifiers and authorised signatories | Receive, identify and distribute settlement money under operative instructions | AssureRail cannot hold, commingle or unilaterally redirect money |
| Collection-account bank | Account mandate and servicing/collection terms | Receive post-transfer collections and produce statements | Distinct from closing settlement unless expressly combined |
| ROC / NeSL / RTO / other registry agent | Filing authority, credentials and work order | Perform authorised search, filing, satisfaction, assignment or hypothecation action | Registry remains authoritative; AssureRail records evidence only |
| Servicer | Servicing appointment and data/access schedule | Collections, allocation, borrower service, arrears and performance reporting | No change to ownership or settlement authority |
| Field verifier / technical reviewer | Scope, method, geography, sample or population and work order | Perform assigned physical, collateral or technical checks | Findings limited to checked scope and effective date |
| Data Preparer | Seller appointment, NDA and scoped workspace role | Format and upload assigned seller data at seller expense | Cannot attest, contract, pay, submit, approve or see buyer-private data |
| Referral partner | Accepted referral registration and addendum | Evidence a qualifying introduction and assist scheduling | No workspace access, representation authority or fee collection |
| AssureRail Commercial Approver | Internal assignment and approval limit | Approve quote, discount and scope position | Cannot self-approve settlement or supplier acceptance |
| AssureRail Engagement Operations | Scoped case assignment | Run intake, requests, clocks, hand-offs and workspace administration | Cannot make seller attestations or buyer purchase decision |
| Automated Assessment Service | Versioned rule/model configuration and run receipt | Process admitted records, index evidence, flag gaps and produce unsigned preliminary output | Not a human reviewer or professional signatory |
| AssureRail Portfolio Preparation Lead | Scoped case assignment | Coordinate remediation, model, schedules and reviewer pack | Cannot sign the CA, legal or technical section |
| AssureRail Reviewer Coordinator | Approved-provider register and case assignment | Check conflicts, qualifications, work orders and deliverable receipt | Cannot alter a reviewer's signed conclusion |
| AssureRail Finance Maker | Scoped finance role | Prepare invoices, ledger entries, distribution schedule draft and reconciliation | Cannot approve own payment or distribution schedule |
| AssureRail Finance Checker | Independent finance assignment | Verify invoice, credit, received amount and distribution math | Cannot originate and approve the same item |
| AssureRail Settlement Coordinator | Case appointment and provider access | Coordinate closing checklist, provider acknowledgements and evidence | No custody, unilateral release or change to authorised instructions |
| AssureRail Integration Operator | Scoped connector assignment | Configure and validate accepted SFTP/API or file exchange | Cannot alter source data or read unrelated cases |
| AssureRail Security / Privacy | Internal security assignment | Access control, incident, retention and privacy oversight | No routine commercial or case approval |
| AssureRail Risk / Compliance | Internal oversight assignment | Conflict, exception, complaint and control review | No buyer credit decision or registry act |
| AssureRail Final Release Approver | Independent scoped assignment | Confirm gate evidence and release the AssureRail deliverable | Does not sign another professional's section or guarantee closing |

## End-to-end RACI

Abbreviations: `S` seller; `EL` existing lender; `B` buyer; `SC` seller counsel; `BC` buyer counsel; `CA` reviewer; `BK` settlement/collection bank as applicable; `REG` registry agent; `SV` servicer; `FT` field/technical reviewer; `DP` Data Preparer; `AR-C` AssureRail Commercial; `AR-O` Operations; `AR-P` Preparation; `AR-F` Finance; `AR-X` Settlement/Integration; `AR-R` Risk/Release.

| Activity | A | R | C | I |
|---|---|---|---|---|
| Application, seller authority and declared scope | S | S, AR-O | DP | AR-C |
| Binding quote and selected service lines | AR-C | AR-C, AR-F | S, AR-O | DP |
| Data formatting and upload | S | S or DP | AR-O | AR-P |
| Automated Initial Assessment | AR-R | Automated Assessment Service, AR-O | S for clarification | AR-C |
| Seller remediation and reassessment | S | S or DP; Automated Assessment Service | AR-O | AR-P |
| Admitted pool and control-total reconciliation | AR-P | AR-P | S, CA | AR-R |
| Financial / factual section review | CA | CA | S, AR-P | B when released |
| Seller legal section review and schedules | SC | SC | S, AR-P | B when released |
| Asset / field review when triggered | FT | FT | S, AR-P | CA, SC, B as scoped |
| Buyer onboarding and requirement profile | B | B, AR-O | BC, AR-C | S for accepted case requirements |
| Execution mandate and provider selection | S | S, AR-C | B, SC, AR-X | selected providers |
| Existing debt payoff and charge release | EL | EL, S | SC, BK, REG, AR-X | B |
| Bureau pull when authorised | S or B, according to permitted purpose | authorised puller / bureau | AR-P | CA, B as permitted |
| Buyer diligence and purchase decision | B | B, BC | CA, SC, AR-P | S |
| Buyer questions and evidence response | S | AR-O, AR-P, S, relevant reviewer | B, counsel | AR-R |
| Registry actions | authorised filer named in closing checklist | REG or authorised seller representative | SC, BC, AR-X | S, B |
| Settlement distribution schedule | S | AR-F, S | B, EL, BK, SC | AR-R |
| Funding and settlement distribution | BK | BK | S, B, EL, AR-X | AR-F, counsel |
| Closing evidence and one-time monitoring baseline | AR-R | AR-X, AR-O | S, B, BK, SV | authorised case users |
| Post-close servicing and collections | SV | SV, collection bank | S, B | monitoring users |
| Optional ongoing monitoring | party named in mandate | AR-O, SV, collection bank | S, B | authorised monitoring users |
| Fee, supplier and referral reconciliation | AR-F | AR-F maker | independent AR-F checker, AR-C | eligible supplier/referral partner |

## Access rule

RACI participation never grants automatic data access. Access is separately approved for the institution, case, purpose, document class and action. Buyer-private materials remain inaccessible to sellers, Data Preparers and referral partners. A provider sees only the inputs necessary to perform its accepted work order.
