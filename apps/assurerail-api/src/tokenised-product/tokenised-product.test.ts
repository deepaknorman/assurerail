import assert from "node:assert/strict";
import test from "node:test";
import { deriveTokenisedDaJourney, deriveTokenisedPtcJourney } from "./tokenised-product";

test("[AR28][DA] tokenised DA exposes mirror, observation and four-way reconciliation stages", () => {
  const open = deriveTokenisedDaJourney({ linked: true, representationStatus: "BREAK_OPEN", activeBindingCount: 0,
    actionCount: 2, reconciledActionCount: 1, reconciliationState: "BREAK_OPEN", openBreakCount: 1,
    canOperateRoute: true, canViewEvidence: true });
  assert.equal(open.route, "DA");
  assert.equal(open.stages.find((stage) => stage.code === "FOUR_WAY_RECONCILIATION")?.state, "ACTION_REQUIRED");
  assert.equal(open.stages.find((stage) => stage.code === "TOKEN_LIFECYCLE")?.state, "BLOCKED");
  assert.ok(open.openExternalGates.some((gate) => gate.code === "TOKEN_LEGAL_FINALITY" && gate.state === "OPEN"));
  const matched = deriveTokenisedDaJourney({ linked: true, representationStatus: "RECONCILED", activeBindingCount: 1,
    actionCount: 2, reconciledActionCount: 2, reconciliationState: "MATCHED", openBreakCount: 0,
    canOperateRoute: false, canViewEvidence: true });
  assert.equal(matched.stages.find((stage) => stage.code === "FOUR_WAY_RECONCILIATION")?.state, "COMPLETE");
  assert.equal(matched.openExternalGates.find((gate) => gate.code === "CONTROLLED_LIVE_ACCEPTANCE")?.state, "OPEN");
});

test("[AR28][PTC] tokenised PTC stays separate and shadow plans cannot outrun evidence", () => {
  const partial = deriveTokenisedPtcJourney({ proposed: true, representationStatus: "EVIDENCE_OPEN",
    verifiedGateCount: 13, requiredGateCount: 14, shadowReadyActionCount: 0, requiredActionCount: 5,
    trusteeRecordReconciled: false, canOperateRoute: true, canViewEvidence: true });
  assert.equal(partial.route, "PTC");
  assert.equal(partial.stages.find((stage) => stage.code === "EXTERNAL_EVIDENCE_GATES")?.state, "ACTION_REQUIRED");
  assert.equal(partial.stages.find((stage) => stage.code === "DORMANT_ACTION_PLANS")?.state, "BLOCKED");
  const ready = deriveTokenisedPtcJourney({ proposed: true, representationStatus: "SHADOW_READY",
    verifiedGateCount: 14, requiredGateCount: 14, shadowReadyActionCount: 5, requiredActionCount: 5,
    trusteeRecordReconciled: true, canOperateRoute: false, canViewEvidence: true });
  assert.equal(ready.stages.find((stage) => stage.code === "TOKEN_LIFECYCLE")?.state, "AVAILABLE");
  assert.equal(ready.openExternalGates.find((gate) => gate.code === "TOKEN_LEGAL_FINALITY")?.state, "OPEN");
});
