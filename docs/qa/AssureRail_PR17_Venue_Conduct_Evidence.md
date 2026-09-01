# AssureRail PR-17 venue conduct evidence

**Date:** 2 September 2026
**Exception:** EX-27
**Deployment:** none

## Executed evidence

| Check | Result |
|---|---|
| Prisma schema validation and generated-client TypeScript check | Pass |
| Full AssureRail API suite | 274 passed, 0 failed, 0 skipped |
| PR-17 pure policy tests | Pass: review-only classification, missing facts fail closed, fair/allocation/communications controls, exact capacity and bounded control windows |
| Endpoint contract | Pass: 18 internal endpoints; no execution, settlement, mint, burn or title-transfer surface |
| Schema/perimeter checks | Pass: nine explicit models, additive migration, no external adapter or autonomous legal-result path |
| Disposable PostgreSQL migration | Pass: 24 migrations applied from empty |
| Structural exercise | Pass: approved policy, review-required signal, open alert, complaint, append-only correction, approved shadow safe pause, hard-limit capacity observation |
| Schema parity | Pass for PR-17 objects |
| Backup/restore | Pass: `1|1|1|1|1|1|1` retained |
| Shell syntax | Pass: `bash -n scripts/assurerail-pr17-db-rehearsal.sh` |
| External mutation | None |

## What this evidence proves

- unknown/ambiguous conduct facts enter human review;
- conduct output cannot claim an autonomous legal conclusion;
- policy and material control actions use distinct maker/checker steps;
- complaints, correction digests, legal hold, queue ownership and SLA dates are durable;
- capacity values use exact integer strings and preserve warning versus hard-limit state; and
- the new module is off by default and shadow-only.

## What remains open

This evidence is internal software and structural database evidence. It does not close:

- approval of a real conduct policy or prohibited-action catalogue;
- counsel/regulatory interpretation;
- participant, trustee or recordkeeper acceptance;
- real authorised-channel connector certification;
- actual pilot capacity thresholds or staffing/SLA acceptance;
- a controlled-live route command integration for approved safe pauses/sanctions; or
- any prior PR-10, PR-15 or PR-16 external evidence gate.

The database rehearsal uses fixture references solely to exercise structure. They are not accepted by
the service evidence validator and must never be presented as production evidence.
