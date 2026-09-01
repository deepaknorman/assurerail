import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConventionalPtcFunctionAssignments,
  buildConventionalPtcReplayPlan,
  comparePtcReplayObservation,
  CONVENTIONAL_PTC_REPLAY_ROUTE_PACK,
  derivePtcSagaState,
} from "./ptc-route-pack";
import { SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1 } from "./fixtures/synthetic-conventional-ptc-replay-v1";

test("[PR10][PTC] route pack is domestic, conventional and strictly non-mutating", () => {
  assert.deepEqual(CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.operatingModes, ["REPLAY", "SHADOW"]);
  assert.equal(CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.executionMode, "OBSERVE_ONLY");
  assert.equal(CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.representation, "CONVENTIONAL");
  assert.equal(CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.placementOrListing, "PRIVATE_PLACEMENT");
  assert.ok(CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.requiredMaterialFunctions.includes("TRUSTEE_TRANSACTION_CONTROL"));
  assert.ok(CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.requiredMaterialFunctions.includes("AUTHORITATIVE_REGISTER_UPDATE"));
});

test("[PR10][PTC] trustee control and authoritative record acknowledgement are separate, ordered facts", () => {
  const plan = buildConventionalPtcReplayPlan(SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1);
  const trusteeControl = plan.find((leg) => leg.legType === "TRUSTEE_TRANSACTION_CONTROL")!;
  const record = plan.find((leg) => leg.legType === "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT")!;
  assert.equal(trusteeControl.participantOwnerInstitutionId, "inst_trustee_synthetic");
  assert.equal(record.participantOwnerInstitutionId, "inst_recordkeeper_synthetic");
  assert.ok(trusteeControl.sequence < record.sequence);
  assert.notEqual(trusteeControl.expectedDigest, record.expectedDigest);
});

test("[PR10][PTC] trustee-appointed assurance is provider-neutral and not an AssureLocker/AssurePlane requirement", () => {
  const plan = buildConventionalPtcReplayPlan(SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1);
  const assurance = plan.find((leg) => leg.legKey === "trustee-appointed-assurance")!;
  assert.equal(assurance.participantOwnerInstitutionId, "inst_assurance_synthetic");
  assert.equal(assurance.performerClass, "EXTERNAL_AUTHORITY");
  assert.deepEqual(
    buildConventionalPtcFunctionAssignments(SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1)
      .filter((assignment) => assignment.materialFunction === "ASSURANCE_OR_REVIEW")
      .map((assignment) => assignment.performerInstitutionId),
    ["inst_assurance_synthetic"],
  );
  assert.deepEqual(
    buildConventionalPtcFunctionAssignments(SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1)
      .filter((assignment) => ["LEGAL_REVIEW_OR_OPINION", "RATING_OR_EXTERNAL_REVIEW"].includes(assignment.materialFunction))
      .map((assignment) => assignment.performerInstitutionId)
      .sort(),
    ["inst_counsel_synthetic", "inst_rating_synthetic"],
  );
});

test("[PR10][PTC] observations are immutable comparisons and a difference remains a break", () => {
  const plan = buildConventionalPtcReplayPlan(SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1);
  const record = plan.find((leg) => leg.legType === "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT")!;
  assert.equal(comparePtcReplayObservation(record.expected, record.expected).result, "MATCHED");
  assert.equal(comparePtcReplayObservation(record.expected, { recordReference: "incorrect" }).result, "BREAK_OPEN");
});

test("[PR10][PTC] saga state fails closed on breaks and completes only after every required reconciliation", () => {
  assert.equal(derivePtcSagaState([{ required: true, state: "PLANNED" }], 0), "READY");
  assert.equal(derivePtcSagaState([
    { required: true, state: "RECONCILED" },
    { required: true, state: "PLANNED" },
  ], 0), "EXECUTING");
  assert.equal(derivePtcSagaState([
    { required: true, state: "RECONCILED" },
    { required: true, state: "OBSERVED" },
  ], 0), "OBSERVED");
  assert.equal(derivePtcSagaState([
    { required: true, state: "RECONCILED" },
    { required: true, state: "RECONCILED" },
  ], 0), "RECONCILED");
  assert.equal(derivePtcSagaState([{ required: true, state: "RECONCILED" }], 1), "BREAK_OPEN");
});

test("[PR10][PTC] unsafe partial lifecycle ownership and invalid exact values fail closed", () => {
  assert.throws(() => buildConventionalPtcReplayPlan({
    ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1,
    lifecycleSetup: { ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup, collectionAccountEvidenceDigest: undefined },
  }), /must be supplied together/);
  assert.throws(() => buildConventionalPtcReplayPlan({
    ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1,
    issue: { ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.issue, consideration: { currency: "INR", units: "0", scale: 2 } },
  }), /must be positive/);
});

test("[PR10][PTC] function assignments remain one-per-material-function and never invent a reviewer identity", () => {
  const assignments = buildConventionalPtcFunctionAssignments(SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1);
  assert.equal(new Set(assignments.map((assignment) => assignment.materialFunction)).size, assignments.length);
  assert.throws(() => buildConventionalPtcReplayPlan({
    ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1,
    requiredReviews: {
      ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews,
      rating: { providerInstitutionId: "", evidenceDigest: SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.rating!.evidenceDigest },
    },
  }), /providerInstitutionId is required/);
  assert.throws(() => buildConventionalPtcFunctionAssignments({
    ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1,
    lifecycleSetup: { ...SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup, collectionAccountEvidenceDigest: undefined },
  }), /must be supplied together/);
});
