import assert from "node:assert/strict";
import test from "node:test";
import { assertBoundedControlWindow, capacityState, evaluateConductSignal } from "./venue-conduct-policy";

test("[PR17][EVIDENCE] conduct evaluation can request review but never emit an autonomous legal conclusion", () => {
  const conflict = evaluateConductSignal("CONFLICT", { conflictDeclared: true });
  assert.deepEqual({ result: conflict.result, code: conflict.alertCode, legal: conflict.autonomousLegalConclusion }, {
    result: "REVIEW_REQUIRED", code: "CONFLICT_DECLARED", legal: false,
  });
  assert.equal(evaluateConductSignal("RELATED_PARTY", { relatedParty: true }).result, "REVIEW_REQUIRED");
  assert.equal(evaluateConductSignal("PROHIBITED_ACTION", { prohibitedActionCode: "SELF_DEALING" }).severity, "CRITICAL");
});

test("[PR17][FAIL_CLOSED] missing or ambiguous surveillance facts require review", () => {
  for (const [type, facts] of [
    ["CONFLICT", {}], ["RELATED_PARTY", {}], ["FAIR_ACCESS", {}], ["ALLOCATION", {}], ["COMMUNICATION", {}], ["PROHIBITED_ACTION", {}],
  ] as const) {
    const result = evaluateConductSignal(type, facts);
    assert.equal(result.result, "REVIEW_REQUIRED");
    assert.equal(result.evidentialClassification, "REVIEW_REQUIRED");
  }
});

test("[PR17][FAIRNESS] only explicit non-indicator facts can produce NO_ALERT evidence", () => {
  assert.equal(evaluateConductSignal("FAIR_ACCESS", { eligibleParticipantDenied: false }).result, "NO_ALERT");
  assert.equal(evaluateConductSignal("ALLOCATION", { allocationBasisDocumented: true, allocationOverride: false }).result, "NO_ALERT");
  assert.equal(evaluateConductSignal("COMMUNICATION", { authorisedChannelCaptured: true }).result, "NO_ALERT");
  assert.equal(evaluateConductSignal("ALLOCATION", { allocationBasisDocumented: false, allocationOverride: false }).result, "REVIEW_REQUIRED");
});

test("[PR17][CAPACITY] exact integer thresholds classify warning and hard-limit states", () => {
  assert.equal(capacityState("79", "80", "100"), "WITHIN");
  assert.equal(capacityState("80", "80", "100"), "WARNING");
  assert.equal(capacityState("100", "80", "100"), "HARD_LIMIT");
  assert.throws(() => capacityState("1.5", "80", "100"), /canonical/);
  assert.throws(() => capacityState("0", "100", "80"), /0 < warning < hard/);
});

test("[PR17][CONTROL] safe-pause and sanction proposals are time bounded", () => {
  assert.doesNotThrow(() => assertBoundedControlWindow(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-15T00:00:00Z")));
  assert.throws(() => assertBoundedControlWindow(new Date("2026-09-01T00:00:00Z"), new Date("2026-11-01T00:00:00Z")), /31 days/);
  assert.throws(() => assertBoundedControlWindow(new Date("2026-09-02T00:00:00Z"), new Date("2026-09-01T00:00:00Z")), /follow effective/);
});
