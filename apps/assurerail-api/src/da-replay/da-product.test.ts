import assert from "node:assert/strict";
import test from "node:test";
import { deriveDaProductJourney, type DaProductJourneyInput } from "./da-product";

const base: DaProductJourneyInput = {
  canViewEvidence: true, canViewRooms: true, sourceCount: 0, evidenceCount: 0,
  validEvidenceCount: 0, roomCount: 0, hasOpenRoom: false, hasCompletedRoom: false, creditEvidenceSatisfied: false,
  documentEvidenceSatisfied: false, caseStatus: "DRAFT", requiredPartiesActive: false,
  authorisationStatus: null, sagaPresent: false, requiredLegCount: 0,
  observedLegCount: 0, reconciledLegCount: 0, openBreakCount: 0,
  recordkeeperReconciled: false,
};

test("[AR23][JOURNEY] absent evidence remains action-required and later legs remain blocked", () => {
  const result = deriveDaProductJourney(base);
  assert.equal(result.stages.find((item) => item.code === "INTAKE")?.state, "ACTION_REQUIRED");
  assert.equal(result.stages.find((item) => item.code === "CREDIT_DECISION")?.state, "ACTION_REQUIRED");
  assert.equal(result.stages.find((item) => item.code === "PARTNER_EXECUTION")?.state, "BLOCKED");
  assert.equal(result.openExternalGates.at(-1)?.state, "OPEN");
});

test("[AR23][JOURNEY] unavailable evidence authority is not rendered as zero or failed", () => {
  const result = deriveDaProductJourney({ ...base, canViewEvidence: false, canViewRooms: false });
  assert.equal(result.stages.find((item) => item.code === "INTAKE")?.state, "UNAVAILABLE");
  assert.match(result.stages.find((item) => item.code === "INTAKE")?.summary ?? "", /VIEW_EVIDENCE/);
  assert.equal(result.stages.find((item) => item.code === "DILIGENCE")?.state, "UNAVAILABLE");
});

test("[AR23][JOURNEY] all internal observations still leave controlled-live acceptance open", () => {
  const result = deriveDaProductJourney({
    ...base, sourceCount: 2, evidenceCount: 5, validEvidenceCount: 5, roomCount: 1, hasCompletedRoom: true, creditEvidenceSatisfied: true,
    documentEvidenceSatisfied: true, caseStatus: "COMPLETION_PENDING", requiredPartiesActive: true,
    authorisationStatus: "APPROVED", sagaPresent: true, requiredLegCount: 7,
    observedLegCount: 7, reconciledLegCount: 7, recordkeeperReconciled: true,
  });
  assert.equal(result.stages.find((item) => item.code === "RECONCILIATION")?.state, "COMPLETE");
  assert.equal(result.openExternalGates.find((item) => item.code === "CONTROLLED_LIVE_ACCEPTANCE")?.state, "OPEN");
  assert.equal(result.openExternalGates.find((item) => item.code === "COUNSEL_ROUTE_PACK")?.state, "EXTERNAL_EVIDENCE_REQUIRED");
  assert.equal(result.openExternalGates.find((item) => item.code === "PARTICIPANT_AUTHORISATION")?.state, "INTERNAL_APPROVAL_RECORDED_EXTERNAL_ACCEPTANCE_OPEN");
});

test("[AR23][JOURNEY] empty leg plans and merely open rooms cannot be called complete", () => {
  const result = deriveDaProductJourney({
    ...base, sourceCount: 1, evidenceCount: 1, roomCount: 1, hasOpenRoom: true,
    sagaPresent: true,
  });
  assert.equal(result.stages.find((item) => item.code === "INTAKE")?.state, "IN_PROGRESS");
  assert.equal(result.stages.find((item) => item.code === "DILIGENCE")?.state, "IN_PROGRESS");
  assert.equal(result.stages.find((item) => item.code === "PARTNER_EXECUTION")?.state, "ACTION_REQUIRED");
  assert.equal(result.stages.find((item) => item.code === "RECONCILIATION")?.state, "ACTION_REQUIRED");
});
