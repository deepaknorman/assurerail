# AssureRail PR-10 persistence-foundation evidence

**Executed:** 1 September 2026

**Scope:** domestic conventional PTC replay persistence, `REPLAY/SHADOW` and `OBSERVE_ONLY` only

**Result:** passed; this is a foundation checkpoint, not a completed historic PTC replay or live
route acceptance

## Evidence executed

| Check | Result | What it establishes |
|---|---:|---|
| `npm test` in `apps/assurerail-api` | 210 passed, 0 failed/skipped | Full Rail regression, including the existing DA replay, runtime invariants, PTC route pack and new schema/perimeter checks |
| `npm run build` | passed | Prisma client generation and TypeScript compilation against the additive schema |
| `npx prisma validate --schema=prisma/schema.prisma` | passed | Prisma relationship and schema validity |
| `bash -n scripts/assurerail-pr10-db-rehearsal.sh` | passed | Rehearsal script syntax |
| `npm run db:rehearse:pr10` | passed | Disposable PostgreSQL fresh migration, actual planning-service transaction/idempotency, synthetic PTC storage, restrictive evidence history, legacy DA upgrade/backfill, schema parity, dump/restore and migration-ledger parity |

## Facts proved by the database rehearsal

1. All migrations apply to an empty disposable database.
2. A conventional PTC `SettlementSaga` can retain ordered trustee-control evidence through
   `SagaEvidenceLink` without inventing any of the three DA-specific evidence references.
3. Duplicate evidence roles for the same saga fail at the database boundary.
4. Referenced evidence cannot be deleted because relationships use restrictive history semantics.
5. A pre-PR-10 DA saga is classified as `DA`; its route-evidence digest is deterministically
   backfilled from its retained plan digest; and all three prior DA evidence object IDs are unchanged.
6. The fresh database matches the Prisma definitions for all PR-10 tables/fields.
7. The actual planning service writes one 11-leg/19-evidence-link saga atomically, replays an
   identical command, rejects changed content under the same key and leaves one saga/audit record.
8. A custom-format backup restores with all 20 service/fixture evidence links intact and the
   migration ledger remains current.

The rehearsal creates its own local temporary PostgreSQL cluster, never reads the configured
`DATABASE_URL`, and removes the temporary data on exit.

## Explicit limits and open gates

- No PTC controller, UI, external connector or live instruction path is mounted.
- No money, issue/allotment, register, depository/RTA, notice or lifecycle action is dispatched.
- The route pack and database fixture are synthetic structural evidence only.
- The named historic transaction owner, permissioned closing evidence, trustee decision and actual
  RTA/depository/register acknowledgements are still required before a completed historic PTC replay
  can be accepted.
- `ARAIL_PTC_REPLAY_V1` is not enabled by this checkpoint.
- Nothing was deployed.
