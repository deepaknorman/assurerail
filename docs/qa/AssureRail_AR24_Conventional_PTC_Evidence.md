# AssureRail AR-24 conventional-PTC evidence

**Status:** internal implementation evidence under EX-28; not deployment, historic-transaction
acceptance or production approval
**Date:** 2 September 2026

## 1. Internal control evidence

| Control | Evidence |
|---|---|
| Route boundary | Overview reuses the exact PR-10 domestic private-placement conventional-PTC assertion |
| Operating boundary | API/UI declare `OBSERVE_ONLY`; flags accept only off/shadow |
| Function separation | Programme/trust, transfer, reviews, documents, subscription/cash, trustee control, allotment, recordkeeper and lifecycle legs remain distinct |
| Authority | Trustee workflow control and route-defined legal record are separately displayed and reconciled |
| Provider neutrality | Rating/assurance stages depend on retained route requirements; AssurePlane is not compulsory |
| Tenant access | Active case participation and `VIEW_CASE` precede the overview; sources require ownership; evidence and rooms retain grant filters |
| Evidence truth | Preflight uses only visible current, valid, signed, verified, unexpired evidence; hidden evidence is unavailable |
| Multi-review correctness | A review stage/gate completes only when every required `REQUIRED_REVIEW` leg reconciles |
| Information minimisation | Aggregate omits payload bodies, storage/secret/step-up references and repair replacements |
| Idempotency/repair | Client keys survive ambiguous retry; repairs append and retain original observations |
| Honest activation | Internal reconciliation leaves external customer/trustee/provider/recordkeeper acceptance open |

## 2. Automated evidence

Interim executed evidence before final commit:

- API TypeScript build passed;
- complete API unit/contract/configuration suite passed **320/320**, with **0 failed, 0 skipped**;
- AR-24, AR-23, AR-22, AR-21 and PR-18 web boundary checks passed; and
- production web build passed, including `/workspace/cases/[caseId]/ptc`; and
- disposable PR-10 PostgreSQL rehearsal passed after all **27** migrations: the service created an
  atomic/idempotent **11-leg** PTC saga bound to **19** generic evidence links and proved rejection,
  append-only repair, reconciliation, restrictive history, DA-upgrade retention, schema parity and
  backup/restore.

Staged diff whitespace passed; gitleaks found no staged secrets; and Semgrep ran **128** local rules
over **9** changed application files with **0 findings**.

## 3. Open external evidence

- No named originator/trustee has authorised an all-leg completed historic PTC dataset.
- No trustee, counsel, rating agency, assurance provider, servicer, RTA or depository has accepted
  this workflow or evidence mapping.
- No VAPT, live shadow, connector conformance or PR-12 controlled-live acceptance is supplied.
- No money, PTC issuance/allotment, notice, register, title or custody action was dispatched.
- Synthetic PR-10 fixtures cannot close any of these gates.
