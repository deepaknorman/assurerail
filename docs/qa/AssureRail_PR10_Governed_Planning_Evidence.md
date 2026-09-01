# AssureRail PR-10 governed-planning evidence

**Executed:** 1 September 2026

**Result:** planning checkpoint passed. Observation/reconciliation was subsequently implemented and
is evidenced separately; historic replay and live-route acceptance remain open

## Checks

| Check | Result |
|---|---:|
| API build / Prisma generation / TypeScript compile | passed |
| Focused feature-flag, runtime, endpoint, schema, route-pack and perimeter tests | 33 passed |
| Full `apps/assurerail-api` suite | 212 passed, 0 failed, 0 skipped |
| Enhanced disposable PostgreSQL PR-10 rehearsal | passed |
| `git diff --check` for the phase files | passed |

## Boundaries proved

- The PTC module defaults off and is accepted only with the neutral case and required observe-only
  saga foundation in `REPLAY/SHADOW`.
- At this checkpoint, its five routes were case-scoped and limited to authorisation and saga
  planning.
- The service imports no settlement, token, anchor, webhook-egress or external-dispatch adapter.
- Saga writes explicitly set `transactionRoute=PTC` and `executionMode=OBSERVE_ONLY`.
- Planning validates exact route dimensions, active case parties, maker/checker allow-listing,
  optimistic version, function assignments and retained evidence versions/digests.
- Trustee transaction control, issue/allotment observation and authoritative-record acknowledgement
  are separate ordered plan facts.
- The actual planning service atomically persisted one synthetic saga with 11 legs, 19 evidence
  links, null DA-only evidence references, one authoritative declaration and one governed audit.
- Identical command replay returned the same saga; changed content under the same key was rejected;
  only one saga remained; all 20 combined service/fixture evidence links survived dump/restore.

## Not established

- Observation/reconciliation was deliberately absent from this checkpoint and was added only in the
  separately tested follow-on phase; break repair remains absent.
- No participant-authorised historic PTC evidence pack has been replayed.
- No external action, deployment, production readiness or regulatory permission is claimed.

Follow-on evidence: `docs/qa/AssureRail_PR10_Observation_Reconciliation_Evidence.md`.
