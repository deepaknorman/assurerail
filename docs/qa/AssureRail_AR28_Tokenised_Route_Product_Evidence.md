# AssureRail AR-28 tokenised-route product evidence

**Status:** implementation evidence; external gates remain open
**Date:** 3 September 2026
**Authority:** EX-28; commit and push permitted; deployment prohibited

## Scope checked

- fail-closed API/web feature contract and dependency validation;
- institution-scoped tokenised case register;
- separate DA and PTC derived journey semantics;
- case and evidence-authority redaction boundaries;
- mirror-only/no-dispatch source invariants;
- customer register, case cockpit and governed mutation routing;
- API compile/test, web boundary checks and production build; and
- cumulative PR-01 through AR-28 regression checks.

## Focused evidence

| Check | Expected result |
|---|---|
| AR-28 pure route tests | DA four-way breaks block lifecycle; PTC evidence gates block dormant plans; legal-finality and PR-12 gates stay open |
| Endpoint contract | exactly three new GET endpoints; no mint/issue/allot/transfer/burn/dispatch endpoint |
| Perimeter source check | product service creates or updates no external instruction and performs no egress |
| Access source check | owner/active-party case scope; `VIEW_EVIDENCE` required for pack; non-participant receives not-found |
| Runtime configuration | incomplete dependencies rejected; complete replay/shadow dependency set accepted; live runtime rejected |
| Web boundary check | register, separate journey controls, no-dispatch copy, case/workspace links and off-default container wiring present |

## Executed results

- cumulative API compile and test corpus: **349/349 passed**, **0 failed**, **0 skipped**;
- web boundary suites: **9/9 passed** (`PR-18`, AR-21 through AR-28);
- AssureRail production web build: **passed**, **23 generated routes/pages**, including the tokenised
  register and dynamic tokenised case cockpit;
- static architecture, secret/env, endpoint, database-segregation and adapter invariants: **passed**;
- shell syntax and scoped diff hygiene: **passed**;
- disposable PR-11 database rehearsal: all **30 migrations** from zero, governed linkage,
  observe-only instruction/acknowledgement, idempotency, match/break reconciliation, restrictive
  mirror relationships and restore: **passed**;
- disposable PR-16 database rehearsal: all **30 migrations** from zero, separate PTC mirror,
  evidence-open/dormant-action state, schema parity and restore: **passed**; and
- deployment: **not performed**.

The complete code gate ended with
`PASS mode=--code external-evidence=not-tested external-gates=remain-open deployment=not-performed`.
A passing row is software evidence only. No synthetic record can satisfy an external gate.

## Gates intentionally not tested or closed

- real token legal-finality opinion and approved route pack;
- live connector certification and counterparty conformance acceptance;
- custody/key ceremony, finality, reversal and provider-exit evidence;
- participant, trustee, RTA/depository/register and assurance-provider acceptance;
- historic participant/trustee-authorised PTC replay;
- VAPT and independent security remediation closure; and
- signed PR-12 controlled-live or production acceptance.

## Rollback

Set both API and web AR-28 product flags to `off` and rebuild/restart the web only if it had been
deployed. No new schema exists and no existing PR-11/15/16 data is rewritten. Disabling AR-28 does
not reverse or delete any external fact, representation, evidence, observation or reconciliation.
