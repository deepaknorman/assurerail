# AssureRail PR-06 transaction-case verification record

**Executed:** 30 August 2026

**Classification:** engineering evidence for replay/shadow case capability; not production acceptance

## Results

| Check | Result |
|---|---|
| Prisma format/validate/client generation | Pass |
| AssureRail API TypeScript build and full test suite | Pass: 156 tests, 0 failed, 0 skipped |
| PR-06 state/guard/replay tests | Pass |
| PR-06 endpoint/schema/migration/boundary tests | Pass |
| Participant authority scope regression | Pass: institution-wide child scope and exact case scope both tested |
| Runtime claim guard | Pass: case shadow mode rejected outside REPLAY/SHADOW |
| Disposable PostgreSQL fresh migration | Pass: 12 migrations, 9 PR-06 tables |
| Database uniqueness/foreign-key rehearsal | Pass: duplicate case version rejected; case history resisted parent deletion |
| Legacy upgrade rehearsal | Pass: existing inline evidence bytes remained byte-identical |
| PostgreSQL custom-format backup/restore and migration status | Pass: one neutral case restored |
| AssureRail web build | Pass: 12 static routes and 2 dynamic institution routes |
| Shell syntax for PR-06 rehearsal | Pass |

The first database attempt inside the restricted sandbox failed because local PostgreSQL could not
allocate a System V shared-memory segment. It was rerun outside the sandbox against a disposable
temporary cluster only and passed. The first web build could not reach the configured Google Fonts
through restricted networking; the same build was rerun with network access and passed. Neither
rerun accessed the shared AssureRail box, a configured database or a customer system.

## Controls directly exercised

- case APIs contain no pool, CLA, Note or token identifier and use `/v1/rail/cases`;
- route/representation/market/lifecycle/asset/operating dimensions remain explicit;
- unknown lifecycle transitions, skipped stages, bad evidence, prohibited functions, unresolved
  conditions and absent independent approvals fail closed;
- execution and completion remain impossible without later saga/reconciliation facts;
- state replay accepts legitimate aggregate gaps from non-transition mutations but detects broken
  state continuity, invalid transition versions and final-status mismatch;
- review/approval and recovery recheck current evidence and target-state guards; decision review
  fails after any intervening aggregate mutation;
- case creation and transitions bind idempotency keys to request digests;
- evidence intake/read/grant checks active case-party scope after the PR-06 flag is active;
- evidence and case specification become immutable after evidence lock;
- institution-wide case authority is allowed only after object ownership/party scope is proven, and
  case-specific mandates remain exact; and
- migrations are additive and backup/restore retains the new governed history.

## Not executed or not claimed

- no live payment, ledger, RTA, depository, trustee, lender-core or source-register adapter ran;
- no real DA or PTC route pack was asserted complete;
- no external saga or legally effective completion exists, so the kernel cannot reach execution;
- no legacy transfer-room read/write authority changed and no room data was migrated;
- no dedicated participant case/room UI was introduced; PR-07 owns that surface;
- no controlled-live or production flag was enabled; and
- no deployment or push occurred under the current hold.
