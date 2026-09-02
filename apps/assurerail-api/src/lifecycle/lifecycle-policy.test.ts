import assert from "node:assert/strict";
import test from "node:test";
import { compareLifecycleObservation, deriveLifecyclePlanState, lifecycleFunction, normaliseLifecycleObligation } from "./lifecycle-policy";

test("[AR25][POLICY] all lifecycle acts map to explicit material functions", () => {
  assert.equal(lifecycleFunction("COLLECTION_RECEIPT"), "SERVICING_AND_COLLECTION_ACCOUNT");
  assert.equal(lifecycleFunction("WATERFALL_CALCULATION"), "LIFECYCLE_CALCULATION");
  assert.equal(lifecycleFunction("MATURITY_REDEMPTION"), "AUTHORITATIVE_REGISTER_UPDATE");
  assert.throws(() => lifecycleFunction("UNKNOWN"), /eventType must be one of/);
});
test("[AR25][ACCURACY] lifecycle comparison uses exact canonical values", () => {
  const obligation = normaliseLifecycleObligation({ obligationKey: "collection-1", eventType: "COLLECTION_RECEIPT", sequence: 1, accountableInstitutionId: "inst-1", performerClass: "PARTICIPANT_OWNED", dueAt: "2026-09-30T00:00:00.000Z", expected: { amount: { currency: "INR", units: "100", scale: 2 } }, amount: { currency: "INR", units: "100", scale: 2 } });
  assert.equal(compareLifecycleObservation(obligation.expectedDigest, { amount: { scale: 2, units: "100", currency: "INR" } }).comparisonResult, "MATCHED");
  assert.equal(compareLifecycleObservation(obligation.expectedDigest, { amount: { scale: 2, units: "101", currency: "INR" } }).comparisonResult, "BREAK_OPEN");
  assert.throws(() => normaliseLifecycleObligation({ ...obligation, dueAt: "bad", expected: {} } as never), /dueAt/);
});

test("[AR25][STATE] breaks dominate and all required obligations must reconcile", () => {
  assert.equal(deriveLifecyclePlanState([{ required: true, state: "RECONCILED" }], 0), "RECONCILED");
  assert.equal(deriveLifecyclePlanState([{ required: true, state: "OBSERVED" }], 0), "ACTIVE");
  assert.equal(deriveLifecyclePlanState([{ required: true, state: "RECONCILED" }], 1), "BREAK_OPEN");
  assert.equal(deriveLifecyclePlanState([{ required: false, state: "RECONCILED" }], 0), "ACTIVE");
});
