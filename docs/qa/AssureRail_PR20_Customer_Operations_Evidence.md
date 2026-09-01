# AssureRail PR-20 customer-operations evidence

**Date:** 2 September 2026
**Scope:** internal software, structural and migration evidence only

## Executed evidence

| Check | Result |
|---|---|
| API compile/typecheck | Passed |
| Full AssureRail API suite | 290 passed, 0 failed, 0 skipped |
| Exact fee tests | Passed for 30/50 bps, agreed INR PTC examples, rounding, minima/maxima and malformed values |
| Boundary tests | Passed for participant/internal separation, maker-checker, no transaction dispatch and active-grant exit filtering |
| Runtime/flag tests | Passed: off by default, exact shadow dependencies and rejection in live modes |
| Internal RBAC tests | Passed: manager maker, risk/compliance reviewer and bounded support roles |
| AssureRail web production build | Passed; `/workspace/operations` generated |
| Shell syntax | Passed for `scripts/assurerail-pr20-db-rehearsal.sh` |
| Disposable PostgreSQL rehearsal | 26 migrations applied; PR-20 schema parity passed; uniqueness/restrictive history exercised; backup/restore returned `1|2|1|1|1` |

The first sandboxed web build could not reach Google Fonts; the same build passed after only network
access was allowed. The first database rehearsal could not allocate local PostgreSQL shared memory
inside the sandbox; it passed outside that sandbox after an index name was made explicit. Neither
exception involved deployment or a configured database.

## What this evidence does not prove

- a signed customer contract, accepted rate card or realised transaction volume;
- tax/GST, accounting, collections or revenue-recognition treatment;
- correctness of any upstream event or notional supplied by a real transaction route;
- customer reconciliation of an issued statement;
- production access isolation, security, capacity, availability or support coverage;
- a live customer exit including separately downloaded document bytes; or
- controlled-live/production approval for DA, PTC, conventional or tokenised functions.

## Open external gates

- legal/customer acceptance of the contract and renewal/suspension/termination process;
- finance, tax/GST, invoice, credit-note and accounting-system approval;
- real route event-to-meter reconciliation and independent customer statement acceptance;
- real participant cross-tenant and mandate/access test;
- support SLA, escalation, complaint and out-of-hours operating rehearsal;
- customer evidence/data exit and document-download rehearsal;
- privacy, retention and legal-hold acceptance; and
- independent security, controlled-pilot and production readiness evidence required by PR-12.

All remain open. Synthetic evidence cannot close them.
