# AssureRail Phase 1 DA stage gates and service levels

**Version:** 1.0 — 16 September 2026
**Classification:** `INTERNAL`
**Clock convention:** India business days, measured to 5:00 PM IST. A clock starts only when its listed inputs are complete and pauses for an evidenced customer, buyer, provider or authority dependency.

## Gate sequence

| Gate | Required inputs | AssureRail output | Accountable acceptance | Service level or timing | Stop / hold conditions |
|---|---|---|---|---|---|
| G0 — corporate and provider readiness | Incorporation evidence; bank and GST readiness; live checkout approval; security and support owners | Signed readiness record | Final Release Approver | Before any paid or live work | If not passed, accept applications and use synthetic or authorised historical demonstrations only |
| G1 — application qualified | Seller identity and authority; asset class; declared corpus; counts; sample schema; purpose | Qualification outcome and missing-input list | Commercial Approver | One business day for complete application triage | Unsupported asset, authority gap, prohibited data route or no credible buyer path |
| G2 — quote accepted and IA paid | Binding declared scope; unique-pair counts; linked parties; corpus; selected services; accepted terms; payment receipt | Versioned order, admitted-upload instructions and workspace | Finance Checker | Quote expires at 5:00 PM IST on the first Monday after 20 calendar days from issue | Quote expiry, unpaid amount or changed scope requiring requote |
| G3 — intake admitted | Validated tape; mandatory documents; control totals; upload manifest; seller attestation | Admitted scope, evidence index, exclusions and reconciliation adjustment | Engagement Operations | One business day after complete validation | Malware, unreadable/encrypted evidence, control-total break or unauthorised personal data |
| G4 — Initial Assessment released | G2 and G3 complete; upward adjustment paid if applicable | Automated, unsigned assessment; rule outcomes; gaps; indicative economics; remediation plan | Final Release Approver | Three business days | No human merit review; material unresolved processing or provenance exception blocks release |
| G5 — reassessment released | Corrected same-scope evidence; validation complete; run allowance available | Versioned automated reassessment and change summary | Final Release Approver | Two business days | Changed asset/book/scope moves to reconciliation or requote; workspace remains open |
| G6 — Portfolio Preparation starts | Proceed instruction; remaining fixed-stage payment; complete evidence; reviewer conflicts cleared; work orders accepted | Preparation plan, reviewer sections and target buyer pack | Portfolio Preparation Lead | Clock begins only when all inputs complete | Missing payment/evidence, reviewer conflict or unsupported reliance request |
| G7 — Portfolio Preparation released | Reconciled admitted pool; exceptions dispositioned; CA/financial section signed; counsel section signed; technical section if triggered | Buyer-ready pack, schedules, limitations and signed sections | Final Release Approver | Twelve business days from G6 start | Customer/provider dependency pauses clock; no AssureRail whole-case professional sign-off |
| G8 — buyer-ready mandate | Buyer profile/requirements; seller execution mandate; selected itemised services; provider responsibility map | Case timetable, Q&A protocol, closing checklist and cost schedule | Seller | Buyer qualification response target: ten business days | Buyer requirement outside mandate; unaccepted seller cost; authority or conflict gap |
| G9 — providers activated | Accepted providers; contracts/work orders; data routes; permitted purpose; maker-checker roles | Activation register and test receipts | Settlement Coordinator | Per accepted work order; complete before dependent activity | Failed conformance test, missing professional cover or no authorised filer/puller |
| G10 — buyer diligence complete | Buyer requests; controlled evidence access; answered Q&A; conditions tracker | Diligence record and final unresolved-items list | Buyer | Acknowledge question in one business day; standard substantive response in five business days if no new external evidence/opinion is needed | Buyer controls decision and may reject; new external work needs revised timing/scope |
| G11 — settlement authorised | Executed transaction documents; buyer approval; payoff/release figures; settlement distribution schedule; bank acknowledgements; fee/tax invoices | Locked closing checklist and authorised distribution instruction | Seller | Closing timetable agreed by all operative parties | No unilateral AssureRail instruction; any mismatch or expired figure stops release |
| G12 — settlement reconciled | Bank receipts; distribution confirmations; debt/charge release evidence or controlled post-close condition; registry evidence | Closing statement, evidence bundle and exception register | Finance Checker | Same day where confirmations arrive before cut-off; otherwise next business day | Gross money never enters an AssureRail account; unmatched amount remains with appointed provider |
| G13 — baseline and monitoring choice | Final pool; closing data; servicing and collection-account setup; selected monitoring scope | One-time closing baseline; optional monitoring activation record | Seller and buyer for their allocated periods | Baseline within five business days of complete closing evidence | No ongoing monitoring unless selected and funded |

## Clock and change rules

1. A service level is a delivery target, not a guarantee of buyer, provider, authority or registry action.
2. The case record identifies clock start, pause reason, dependency owner, restart evidence and actual completion.
3. Any declared/admitted loan count, linked-party count or corpus variance is recalculated. There is no tolerance band.
4. The accepted unit rate and policy version remain fixed for the quote validity and accepted order, while verified quantities, corpus and selected scope determine the revised total.
5. The workspace remains open during inactivity. At 90 days, evidence dates, cut-off data, provider quotes and buyer requirements must be refreshed before further reliance.
6. A seller may continue remediation after its included reassessment allowance by accepting a new run charge or revised order. An expired allowance does not delete its workspace or evidence history.

## Pre-live release checklist

The G0 approver records evidence for each item:

- Certificate of Incorporation and authorised signatories;
- PAN, GST position and invoice configuration;
- AssureRail operating bank account and reconciled live checkout route;
- approved seller MSA, orders, execution mandate and privacy/data terms;
- approved buyer MSA/onboarding/RBAC route;
- maker-checker finance and settlement assignments;
- approved provider register with at least two eligible CA/financial reviewers and two eligible transaction-counsel reviewers before Portfolio Preparation is sold;
- incident, complaint, privacy and customer-support owners;
- synthetic end-to-end and fail-closed settlement rehearsal evidence; and
- public availability text matching the recorded activation state.
