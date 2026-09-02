# AssureRail AR-25 lifecycle evidence

**Status:** internal software evidence under EX-28; not deployment or production approval
**Date:** 2 September 2026

## Control evidence

| Control | Implemented evidence |
|---|---|
| Route-neutral ownership | New lifecycle plan/obligation/event/break records link to DA or PTC cases, not Notes |
| External perimeter | Observe-only API and UI; no external instruction, payment, notice, token or register dispatch |
| Accountability | Each obligation is bound to an active case function assignment and named institution |
| Evidence accuracy | Canonical digests, exact amount types and current valid/signed/verified case evidence |
| Sequence | Earlier required obligations must be observed before a later fact is accepted |
| Segregation | Event recorder cannot perform independent reconciliation |
| Repair | Replacement facts append a new version; open breaks resolve only after matched independent reconciliation |
| Activation | API/web flags default off and runtime validation rejects controlled-live/production |

## Automated evidence

The API TypeScript build and complete suite passed **329/329**, with **0 failed and 0 skipped**. The
AR-25 web boundary check and production web build passed, including the lifecycle route. The
disposable PostgreSQL rehearsal applied all **28** migrations and exercised the lifecycle service
against the real constraints. It proved rejection for a non-completed case, inactive case party,
expired function assignment, denied route entitlement, non-final acknowledgement and materially
future observation time. It then proved idempotent plan/event/reconciliation commands, an
event-bound mismatch break, append-only corrected observation, revalidation of quarantined evidence
at reconciliation, independent reconciliation, restrictive history and backup/restore. The final
schema delta is additive (**132 insertions, 0 deletions**) rather than a repository-wide formatting
rewrite. Tests distinguish software evidence from external evidence.

The final staged gitleaks scan found no secrets. Semgrep ran the seven repository-pinned offline
security rule sets against the 14 touched TypeScript/JavaScript targets: 128 applicable rules, zero
findings and zero unparsed lines.

## Open external evidence

No participant-authorised lifecycle dataset, assigned-performer acceptance, payment/account
confirmation, trustee/recordkeeper acknowledgement, VAPT, shadow outcome or production acceptance
has been supplied. None is represented by a synthetic fixture.
