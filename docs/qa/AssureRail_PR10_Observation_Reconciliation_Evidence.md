# AssureRail PR-10 observation and reconciliation evidence

**Executed:** 1 September 2026

**Result:** append-only observation and independent-reconciliation checkpoint passed; break repair
and a participant-authorised historic PTC replay remain open

## Checks

| Check | Result |
|---|---:|
| API build / Prisma generation / TypeScript compile | passed |
| Full `apps/assurerail-api` suite | 213 passed, 0 failed, 0 skipped |
| Enhanced disposable PostgreSQL PR-10 service rehearsal | passed |
| Fresh migration, upgrade, schema parity, constraints and dump/restore | passed |
| `git diff --check` for the phase files | passed |

## Behaviour proved

- The PTC module remains off by default, case-scoped, `OBSERVE_ONLY`, and limited to `REPLAY` or
  `SHADOW` with all prerequisite neutral-case controls enabled.
- The surface contains ten endpoints: five governance/planning routes, two governed mutation routes
  for initial observation and exact-result reconciliation, and three read routes for breaks,
  comparison and the evidence pack.
- Only the declared owner institution can record a leg, and the observed canonical digest must equal
  the latest current, signed, valid and verified retained evidence digest.
- An identical observation retry returns the retained observation without duplication; changed
  content under the same idempotency key is rejected.
- Exact facts move a leg to `OBSERVED`; a different authorised human at the same institution can
  independently move it to `RECONCILED`. The observation recorder cannot self-reconcile.
- Mismatched facts atomically move the leg and saga to `BREAK_OPEN`, retain field-level differences,
  and create one critical `CASE_COMPLETION` reconciliation break.
- The comparison reports one matched/reconciled leg, one broken leg and the remaining unobserved
  legs in the synthetic rehearsal. The evidence pack has a stable SHA-256 digest and explicitly
  states that no money, issue, allotment, register or notice action was dispatched.
- The authoritative `AFTER` snapshot is available only on an exact recordkeeper-owned
  acknowledgement; trustee control remains a separate plan leg.
- The enhanced database rehearsal retains the planning invariant: one 11-leg PTC saga, 19
  role-bound evidence links, null DA-only evidence references, atomic governed audit and durable
  dump/restore history.

## Deliberate limits

- No break-repair endpoint exists, so the synthetic mismatch remains visibly unresolved.
- No participant-authorised historic PTC evidence pack has been replayed across all required legs.
- No issue, allotment, cash, notice, RTA/depository/register, token, settlement, external-dispatch or
  webhook-egress adapter is imported or called.
- No UI, deployment, production readiness, regulatory permission or public capability is claimed.
