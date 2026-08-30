import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCaseTransition, replayCaseTransitions, type CaseGuardFacts } from "./case-state";

const FACTS: CaseGuardFacts = {
  activePartyCount: 2, functionAssignmentCount: 3, prohibitedFunctionCount: 0,
  evidenceCount: 2, unavailableEvidenceCount: 0, openPrecedentConditionCount: 0,
  approvedCaseDecisionCount: 1, externalSagaReady: false, externalSagaObserved: false, completionReconciled: false,
  cancellationApproved: false, blockReasonPresent: false, recoveryTarget: null,
};

test("[PR06][STATE] the common spine is fail-closed and evidence labels cannot skip stages", () => {
  assert.equal(evaluateCaseTransition("DRAFT", "INTAKE_OPEN", FACTS).allowed, true);
  assert.equal(evaluateCaseTransition("DRAFT", "COMPLETED", FACTS).code, "ILLEGAL_CASE_TRANSITION");
  assert.equal(evaluateCaseTransition("INTAKE_OPEN", "EVIDENCE_LOCKED", { ...FACTS, unavailableEvidenceCount: 1 }).allowed, false);
  assert.equal(evaluateCaseTransition("EVIDENCE_LOCKED", "REVIEW_PENDING", { ...FACTS, unavailableEvidenceCount: 1 }).allowed, false);
  assert.equal(evaluateCaseTransition("REVIEW_PENDING", "APPROVED_FOR_EXECUTION", { ...FACTS, approvedCaseDecisionCount: 0 }).allowed, false);
});

test("[PR06][STATE] execution and completion remain blocked until later saga/reconciliation facts exist", () => {
  assert.equal(evaluateCaseTransition("APPROVED_FOR_EXECUTION", "EXECUTION_PENDING", FACTS).allowed, false);
  assert.equal(evaluateCaseTransition("APPROVED_FOR_EXECUTION", "EXECUTION_PENDING", { ...FACTS, externalSagaReady: true }).allowed, true);
  assert.equal(evaluateCaseTransition("EXECUTION_PENDING", "COMPLETION_PENDING", { ...FACTS, externalSagaReady: true }).allowed, false);
  assert.equal(evaluateCaseTransition("EXECUTION_PENDING", "COMPLETION_PENDING", { ...FACTS, externalSagaObserved: true }).allowed, true);
  assert.equal(evaluateCaseTransition("COMPLETION_PENDING", "COMPLETED", { ...FACTS, completionReconciled: false }).allowed, false);
  assert.equal(evaluateCaseTransition("COMPLETION_PENDING", "COMPLETED", { ...FACTS, completionReconciled: true }).allowed, true);
});

test("[PR06][STATE] block, cancel and recovery require explicit evidence", () => {
  assert.equal(evaluateCaseTransition("INTAKE_OPEN", "BLOCKED", FACTS).allowed, false);
  assert.equal(evaluateCaseTransition("INTAKE_OPEN", "BLOCKED", { ...FACTS, blockReasonPresent: true }).allowed, true);
  assert.equal(evaluateCaseTransition("BLOCKED", "INTAKE_OPEN", { ...FACTS, recoveryTarget: "INTAKE_OPEN" }).allowed, true);
  assert.equal(evaluateCaseTransition("BLOCKED", "INTAKE_OPEN", { ...FACTS, activePartyCount: 1, recoveryTarget: "INTAKE_OPEN" }).allowed, false);
  assert.equal(evaluateCaseTransition("INTAKE_OPEN", "CANCELLED", { ...FACTS, cancellationApproved: true }).allowed, true);
});

test("[PR06][REPLAY] transition replay permits aggregate gaps but rejects broken state or transition versions", () => {
  const valid = replayCaseTransitions([
    { id: "t1", fromStatus: "DRAFT", toStatus: "INTAKE_OPEN", expectedVersion: 4, resultingVersion: 5 },
    { id: "t2", fromStatus: "INTAKE_OPEN", toStatus: "EVIDENCE_LOCKED", expectedVersion: 8, resultingVersion: 9 },
  ], "EVIDENCE_LOCKED");
  assert.deepEqual(valid.failures, []);
  const broken = replayCaseTransitions([
    { id: "t1", fromStatus: "DRAFT", toStatus: "INTAKE_OPEN", expectedVersion: 4, resultingVersion: 6 },
    { id: "t2", fromStatus: "DRAFT", toStatus: "EVIDENCE_LOCKED", expectedVersion: 8, resultingVersion: 9 },
  ], "REVIEW_PENDING");
  assert.deepEqual(broken.failures, ["t1", "t2", "TERMINAL_STATUS_MISMATCH"]);
});
