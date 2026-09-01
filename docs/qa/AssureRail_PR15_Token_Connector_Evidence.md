# AssureRail PR-15 internal evidence

**Date:** 2 September 2026

**Exception:** EX-27

**Evidence class:** internal software/structural evidence only

## Implemented and checked

- provider-neutral, two-person connector/custody binding;
- external key reference and policy digest without private-key storage;
- exact candidate capability per mint, transfer, anchor and burn action, with payment kept behind a
  separate settlement-provider boundary;
- PR-12 activation guard before durable instruction creation and again before dispatch;
- idempotent durable worker with stale-lease recovery and bounded retry;
- Vault-referenced HMAC request signing and SSRF-protected HTTPS egress;
- signed, exact-instruction, exact-expected-result, successful-final acknowledgement validation;
- mandatory post-action authoritative-record reconciliation and safe-pause semantics;
- live foundation runtime modes while retaining replay-only gates for DA/PTC replay, primary
  commercial interaction and conventional secondary replay; and
- candidate capabilities excluded from the live registry pending external evidence.

## Executed evidence

- schema validation and Prisma client generation passed;
- TypeScript typecheck/build passed;
- AssureRail API suite: **259 passed, 0 failed, 0 skipped**;
- acknowledgement success, tamper, wrong instruction, non-final result and future-time tests passed;
- runtime foundation/manifest-gate tests passed;
- `bash -n scripts/assurerail-pr15-db-rehearsal.sh` passed; and
- disposable PostgreSQL rehearsal applied all **22 migrations**, proved the binding model and
  restrictive action relationship, schema parity, backup and restore (`1|1`).

The first sandboxed database attempt failed because Postgres could not allocate shared memory. The
same repository script then passed outside that sandbox. This is an execution-environment fact, not
a product defect.

## Open external gates

- real connector conformance and finality evidence for every candidate action;
- real custody/key ceremony and recovery evidence;
- route counsel conclusion and authoritative-record acceptance;
- payment-provider finality evidence where payment is activated;
- independent security review;
- participant/trustee/recordkeeper operating acceptance;
- controlled-pilot, BCP/DR and production acceptance; and
- a later reviewed registry change plus exact PR-12 signed activation.

All remain open. No synthetic fixture is counted as completion.
