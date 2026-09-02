# AssureRail AR-26 primary venue evidence

**Status:** internal software evidence under EX-28; not deployment, legal permission, customer
acceptance or production approval
**Date:** 2 September 2026

## Control evidence

| Control | Implemented evidence |
|---|---|
| Named perimeter | Listing and detail queries are owner or named-institution scoped |
| Exact commercial version | Handoff binds the current immutable term and accepted allocation by ID and digest |
| Admission and function | Counterparty admission, allocation entitlement and case function assignment fail closed |
| Fresh authority | Opportunity, term, allocation, audience and case state are checked before and inside the transaction |
| Separate acceptance | Owner records handoff; counterparty separately accepts the proposed case role |
| Least disclosure | Current participants see only their records; handoff-only access sees only frozen handoff evidence |
| Idempotency | Identical retry returns one receipt; changed content under the key conflicts |
| History | Foreign keys are restrictive; allocation, grant, term, case and party evidence is retained |
| Perimeter | No payment, title, issue, allotment, register, token, matching or external instruction |
| Activation | API/web flags default off, accept only shadow and fail outside replay/shadow runtime |

## Automated evidence

The complete API compile/test corpus, all AssureRail web boundary checks and the production web build
are recorded in `AssureRail_PR01_AR26_Integrated_Release_Audit.md`. The disposable AR-26 PostgreSQL
rehearsal applies all 29 migrations, exercises the real `CommercialService` and `CasesService`, and
proves:

- no handoff before counterparty allocation acceptance;
- no handoff while the opportunity is paused;
- one idempotent immutable handoff and one proposed case party;
- audience-grant and route-decision binding;
- no counterparty case-role activation until its separate acceptance;
- retained handoff access after grant revocation or opportunity withdrawal without disclosure of a
  later owner-only term, interests, RFQs or threads;
- minimised API projection with no step-up or request digest;
- restrictive allocation history; and
- schema parity and backup/restore.

Synthetic fixtures prove software controls only.

## Open gates

Counsel permission for each displayed/solicited/allocated function, licensed/participant performer
assignment, participant acceptance, VAPT, conduct calibration, historic/live shadow evidence and
PR-12 controlled-live/production acceptance remain open.
