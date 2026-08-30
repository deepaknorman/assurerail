# AssureRail PR-07 case-room verification record

**Executed:** 31 August 2026

**Classification:** engineering evidence for replay/shadow migration comparison; not cutover or
production acceptance

## Results

| Check | Result |
|---|---|
| Prisma format/validate/client generation | Pass |
| AssureRail API TypeScript type-check | Pass |
| AssureRail API full suite | Pass: 166 tests, 0 failed, 0 skipped |
| PR-07 deterministic export/hash/refresh tests | Pass |
| PR-07 endpoint/policy/schema tests | Pass |
| Runtime claim guard | Pass: compare requires PR-06 shadow foundation; Rail read rejected before PR-08 |
| Disposable PostgreSQL fresh migration | Pass: 13 migrations, 7 PR-07 tables |
| Database precision/constraints | Pass: access sequence above JavaScript safe integer retained; duplicate sequence and import version rejected; restrictive history enforced |
| Versioned import persistence | Pass: two immutable import versions coexist for one room and retain one declared root batch |
| Additive upgrade rehearsal | Pass: pre-existing PR-06 case remained `DRAFT` |
| PostgreSQL custom-format backup/restore | Pass: two import versions restored; migration ledger current |
| AssureRail web build | Pass: 13 routes, including `/cases` and dynamic room migration workspace |
| Shell syntax for PR-07 rehearsal | Pass |
| Existing legacy transfer-room golden suite | Pass: 26 tests, 0 failed, 0 skipped |

The first database attempt in the restricted sandbox could not allocate a System V shared-memory
segment. The disposable rehearsal was rerun outside the sandbox and passed. The web build required
network access only for the app's configured Google Fonts and passed when rerun. Neither action
accessed the shared AssureRail box, a configured database, a customer system or a live adapter.

## Controls directly exercised

- deterministic export ordering and canonical digest;
- exact legacy hash-chain recomputation, link/sequence verification and tail preservation;
- invite-token rejection, duplicate/cross-room child rejection, positive exact sequence and active
  declaration/reliance gate;
- immutable-prefix refresh and forward-only room/invite states;
- dark imported grants and reusable root batches with unique per-room/version receipts;
- passive-only purpose mapping and recursive commercial-key redaction;
- versioned import schema, exact `BIGINT` access sequence and restrictive foreign keys;
- compare-only endpoints with no room/invite/message/close write API;
- runtime rejection of premature Rail read/cutover; and
- web TypeScript/static generation for case/room/parity/repair controls.

## Not executed or not claimed

- no legacy production/database export ran and no customer room was imported;
- no existing transfer-room caller or UI was redirected;
- no Rail participant received room access and no Rail room write occurred;
- no AssurePool permanent lock/completion acknowledgement ran;
- no payment, ownership/register, trustee, RTA or depository adapter ran;
- no conventional DA/PTC route was asserted complete;
- no controlled-live/production flag, deployment or push occurred; and
- PR-08/09 gates remain required before cutover or DA replay claims.
