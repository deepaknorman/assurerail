# AssureRail PR-10 governed-repair evidence

**Executed:** 1 September 2026

**Result:** append-only maker/checker repair checkpoint passed; a participant-authorised historic
PTC replay across every required leg remains open

## Checks

| Check | Result |
|---|---:|
| API build / Prisma generation / TypeScript compile | passed |
| Full `apps/assurerail-api` suite | 213 passed, 0 failed, 0 skipped |
| Enhanced disposable PostgreSQL PR-10 service rehearsal | passed |
| Fresh migration, additive DA upgrade, schema parity, constraints and dump/restore | passed |
| `git diff --check` for the phase files | passed |

## Behaviour proved

- The existing generic reconciliation-break, repair-action and observation-version records support
  PTC repair without a new migration, PTC-only status blob or destructive data rewrite.
- The module remains off by default, case-scoped, `OBSERVE_ONLY`, and available only in
  `REPLAY/SHADOW` with the full neutral-case foundation.
- Only the accountable break-owner institution can propose or review a repair. Proposal and review
  have separate idempotency keys, retained authority, reasons, mandates and step-up ceremonies.
- The repair maker cannot review their own proposal. A rejected proposal becomes terminal and the
  break reopens without losing the rejected record.
- Approval revalidates the replacement against the latest current, signed, valid, verified,
  institution-owned evidence version. A replacement that still differs cannot be applied.
- The synthetic rehearsal retains the mismatched observation as version 1 and appends the exact
  corrected observation as version 2. The original expected/observed digests remain inspectable.
- Repair application, corrected observation, resolved break, leg/saga/case state and governed audit
  commit atomically and replay idempotently.
- A repair checker cannot also reconcile the corrected leg. The rehearsal uses a third authorised
  human to complete independent reconciliation.
- The final synthetic state has two reconciled legs, zero open breaks, nine unobserved later legs,
  one rejected repair, one applied repair and an evidence pack containing both repair trails.
  Dump/restore retains all history.
- An authoritative-record `AFTER` snapshot can arise from a repair only when the corrected
  recordkeeper-owned evidence exactly matches the retained authoritative-record expectation.

## Deliberate limits

- No participant-authorised historic PTC evidence pack has been replayed across all 11 required
  legs.
- No issue, allotment, cash, notice, RTA/depository/register, token, settlement, external-dispatch or
  webhook-egress adapter is imported or called.
- No UI, deployment, production readiness, regulatory permission or public capability is claimed.
