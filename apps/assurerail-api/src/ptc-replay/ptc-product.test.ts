import assert from "node:assert/strict";
import test from "node:test";
import { derivePtcProductJourney, type PtcProductJourneyInput } from "./ptc-product";

const base: PtcProductJourneyInput = {
  canViewEvidence: true,
  canViewRooms: true,
  visibleEvidenceTypes: [],
  roomCount: 0,
  hasOpenRoom: false,
  hasCompletedRoom: false,
  caseStatus: "DRAFT",
  requiredPartiesActive: false,
  authorisationStatus: null,
  sagaPresent: false,
  legs: [],
  openBreakCount: 0,
};

test("[AR24][JOURNEY] absent visible evidence is unavailable and later work fails closed", () => {
  const result = derivePtcProductJourney(base);
  assert.equal(result.stages.find((item) => item.code === "PROGRAMME_TRUST")?.state, "UNAVAILABLE");
  assert.equal(result.stages.find((item) => item.code === "RECONCILIATION")?.state, "BLOCKED");
  assert.equal(result.stages.find((item) => item.code === "DOSSIER")?.state, "BLOCKED");
});

test("[AR24][JOURNEY] hidden evidence and open diligence are not complete", () => {
  const result = derivePtcProductJourney({ ...base, canViewEvidence: false, roomCount: 1, hasOpenRoom: true });
  assert.equal(result.stages.find((item) => item.code === "PROGRAMME_TRUST")?.state, "UNAVAILABLE");
  assert.equal(result.stages.find((item) => item.code === "DILIGENCE")?.state, "IN_PROGRESS");
});

test("[AR24][JOURNEY] full internal reconciliation leaves all external acceptance explicit", () => {
  const requiredLegTypes = ["PROGRAMME_TRUST_AND_APPOINTMENT", "POOL_TRANSFER_AND_ELIGIBILITY", "REQUIRED_REVIEW", "EXECUTED_DOCUMENTS_AND_TRANCHE", "SUBSCRIPTION_AND_CONSIDERATION", "TRUSTEE_TRANSACTION_CONTROL", "ISSUE_OR_ALLOTMENT", "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT", "LIFECYCLE_AND_NOTICE_SETUP"];
  const result = derivePtcProductJourney({
    ...base,
    hasCompletedRoom: true,
    roomCount: 1,
    caseStatus: "COMPLETION_PENDING",
    requiredPartiesActive: true,
    authorisationStatus: "APPROVED",
    sagaPresent: true,
    legs: requiredLegTypes.map((legType) => ({ legType, required: true, state: "RECONCILED" })),
  });
  assert.equal(result.stages.find((item) => item.code === "RECONCILIATION")?.state, "COMPLETE");
  assert.equal(result.externalGates.find((item) => item.code === "CONTROLLED_LIVE_ACCEPTANCE")?.state, "OPEN");
  assert.equal(result.externalGates.find((item) => item.code === "TRUSTEE_TRANSACTION_CONTROL")?.state, "INTERNAL_RECONCILIATION_RECORDED_EXTERNAL_ACCEPTANCE_OPEN");
});

test("[AR24][JOURNEY] one open break blocks its function and aggregate reconciliation", () => {
  const result = derivePtcProductJourney({
    ...base,
    sagaPresent: true,
    legs: [{ legType: "TRUSTEE_TRANSACTION_CONTROL", required: true, state: "BREAK_OPEN" }],
    openBreakCount: 1,
  });
  assert.equal(result.stages.find((item) => item.code === "TRUSTEE_CONTROL")?.state, "BLOCKED");
  assert.equal(result.stages.find((item) => item.code === "RECONCILIATION")?.state, "BLOCKED");
});
