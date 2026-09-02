# AssureRail AR-29 enterprise integration evidence

**Status:** implementation evidence; external provider and production gates remain open
**Date:** 3 September 2026
**Authority:** EX-28; commit and push permitted; deployment performed only by the other coder

## Scope

- additive schema/migration for versioned profiles, gates, case bindings and health observations;
- 11-class connector taxonomy and deterministic gate catalogue;
- strict separation of software conformance, external acceptance and case authority;
- current signed evidence, active provider/admission and 24-hour health evaluation;
- institution/case-scoped APIs, purpose-bound step-up, idempotency and maker/checker;
- customer integration register and case binding screen;
- fail-closed API/web/container flags; and
- migration/service/backup/restore rehearsal.

## Expected acceptance evidence

| Check | Expected result |
|---|---|
| Pure taxonomy/readiness tests | every class has software plus external gates; software alone cannot pass; expiry/degraded health safe-pauses |
| Source boundary | no egress, external instruction, secret or provider-certification claim |
| Profile approval | independent reviewer, all current external evidence and current healthy observation required |
| Case binding | exact active function assignment, route/representation and performer institution required |
| Currentness | later quarantine/suspension/expiry/stale health reopens readiness and returns binding `SAFE_PAUSED` |
| Migration rehearsal | all migrations from zero, real service flow, schema parity, backup/restore and zero external instruction |

## Executed results

- complete AssureRail API corpus: **357/357 passed**, **0 failed**, **0 skipped**;
- web boundary checks: **10/10 passed** (PR-18 and AR-21 through AR-29);
- production web build: **passed**, **24 generated routes/pages**;
- static architecture, secret/env, endpoint, database-segregation and adapter invariants: **passed**;
- shell syntax and scoped diff hygiene: **passed** (`shellcheck` was unavailable);
- disposable AR-29 PostgreSQL rehearsal: all **31 migrations** applied from zero; real profile,
  nine-gate lender-registry example, software-only conformance, current signed gate evidence,
  maker/checker profile and case-binding review, idempotent health observation, later evidence
  quarantine and binding safe-pause, zero external instruction, schema parity, backup and restore:
  **passed**; and
- deployment: **not performed**.

The first database pass exposed and prevented a raw-relation export problem: date canonicalisation
failed and the raw connector relation contained its Vault reference. The final implementation uses
explicit response/export allow-lists, strips security/idempotency fields and passed the repeated
service, export and restore rehearsal. Synthetic fixtures prove software behaviour only and are
never counted as provider/customer/counsel acceptance.

## External evidence not supplied

No lender, trustee, RTA/depository, payment, signing/stamping, rating, servicer, finance/tax, CRM or
notification provider was certified by this stage. No VAPT report, customer UAT, counsel opinion,
authoritative-register acknowledgement, payment-finality evidence, executed exit rehearsal or
PR-12 acceptance was supplied or closed.
