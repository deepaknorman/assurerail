# AssureRail AR-23 conventional-DA evidence

**Status:** internal implementation evidence under EX-28; not deployment, historic-deal acceptance
or production approval
**Date:** 2 September 2026

## 1. Internal control evidence

| Control | Evidence |
|---|---|
| Route boundary | Product overview reuses the exact PR-09 domestic bilateral conventional-DA route assertion |
| Operating boundary | API and UI declare `OBSERVE_ONLY`; runtime and build flags accept only off/shadow |
| Dependency gate | DA product requires AR-22 shadow, PR-09 allow-list/required saga and Rail/compare rooms in replay/shadow runtime |
| Tenant access | Active case participation and `VIEW_CASE` precede the overview; sources require source ownership, while evidence and rooms have separate exact action/grant filters |
| Evidence truth | Credit/document stages require current valid, signed, verified and unexpired visible evidence |
| Fail-closed stage truth | Open rooms remain in progress; inactive required parties, invalid intake evidence and empty required-leg plans cannot become complete |
| Information minimisation | Aggregate overview excludes evidence bytes/storage, secret/step-up references and expected/observed payload bodies |
| Authority | Existing PR-09 case-owner, participant-leg-owner, mandate and maker/checker commands remain authoritative |
| Idempotency | UI retains an action key across ambiguous failure and clears it only after a successful response |
| Repair | Corrected facts append through governed repair; original observations are retained |
| Dossier | Authenticated comparison CSV and JSON evidence pack use retained saga records |
| Honest activation | Counsel, performer, recordkeeper and PR-12 acceptance stay separate external gates |

## 2. Automated evidence

Executed results:

- API TypeScript build passed; complete unit/contract/configuration suite passed **312/312**, with
  **0 failed, 0 skipped**;
- AR-23 pure journey-state tests for absent, unavailable and fully reconciled internal states;
- endpoint/access/perimeter static contracts;
- AR-23, AR-22, AR-21 and PR-18 web checks passed;
- production web build passed, including `/workspace/cases/[caseId]/da`;
- PR-09 disposable PostgreSQL rehearsal passed after applying all **27** current migrations: one
  plan/idempotency constraints, append-only observation history, restrictive evidence references,
  additive upgrade, schema parity and one-observation backup/restore were verified; and
- staged diff whitespace passed; gitleaks found no staged secrets; and Semgrep ran **128** local
  rules over **9** changed application files with **0 findings**.

## 3. Open evidence

- No named customer has supplied and authorised a completed historic DA dataset in this stage.
- No transferor/transferee has accepted the stage wording or operated the journey.
- No counsel-ratified live route pack, provider acknowledgement, VAPT result or PR-12 live acceptance
  has been supplied.
- No funds, title, notice, source record or authoritative register was mutated.
- Synthetic fixtures remain software-test evidence only and cannot close any external gate.
