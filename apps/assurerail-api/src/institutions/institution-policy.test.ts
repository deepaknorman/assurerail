import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInstitutionAuthority,
  evaluateInstitutionEvidence,
  evaluateRouteEntitlement,
  type AuthorityPolicyInput,
} from "./institution-policy";

const NOW = new Date("2026-08-30T12:00:00.000Z");

const activeAuthority: AuthorityPolicyInput = {
  now: NOW,
  institutionStatus: "ACTIVE",
  admissionStatus: "ADMITTED",
  admissionEffectiveAt: new Date("2026-08-01T00:00:00.000Z"),
  admissionExpiresAt: new Date("2027-08-01T00:00:00.000Z"),
  memberStatus: "ACTIVE",
  memberEffectiveAt: new Date("2026-08-01T00:00:00.000Z"),
  memberExpiresAt: null,
  mandateStatus: "ACTIVE",
  mandateEffectiveAt: new Date("2026-08-01T00:00:00.000Z"),
  mandateExpiresAt: null,
  mandateAction: "ADMINISTER_MEMBERS",
  mandateScopeType: "INSTITUTION",
  mandateScopeRef: null,
  requestedAction: "ADMINISTER_MEMBERS",
  requestedScopeType: "INSTITUTION",
};

test("[PR03][AUTHORITY] active institution, admission, member and exact mandate authorise", () => {
  assert.deepEqual(evaluateInstitutionAuthority(activeAuthority), { allowed: true, code: "AUTHORISED" });
});

test("[PR03][AUTHORITY] every suspended or legacy-projected layer fails immediately", () => {
  assert.equal(evaluateInstitutionAuthority({ ...activeAuthority, institutionStatus: "SUSPENDED" }).code, "INSTITUTION_NOT_ACTIVE");
  assert.equal(evaluateInstitutionAuthority({ ...activeAuthority, admissionStatus: "SUSPENDED" }).code, "PARTICIPANT_NOT_ADMITTED");
  assert.equal(evaluateInstitutionAuthority({ ...activeAuthority, memberStatus: "LEGACY_PROJECTED" }).code, "MEMBERSHIP_NOT_ACTIVE");
  assert.equal(evaluateInstitutionAuthority({ ...activeAuthority, mandateStatus: "REVOKED" }).code, "MANDATE_NOT_ACTIVE");
});

test("[PR03][AUTHORITY] mandate scope and expiry fail closed", () => {
  assert.equal(evaluateInstitutionAuthority({ ...activeAuthority, mandateScopeRef: "case-a", requestedScopeRef: "case-b" }).code, "SCOPE_REFERENCE_MISMATCH");
  assert.equal(evaluateInstitutionAuthority({ ...activeAuthority, mandateExpiresAt: NOW }).code, "MANDATE_OUTSIDE_EFFECTIVE_PERIOD");
});

test("[PR03][EVIDENCE] provider outage does not erase retained evidence, but expiry still fails", () => {
  const retained = {
    now: NOW,
    result: "VERIFIED",
    signatureStatus: "VERIFIED",
    expiresAt: new Date("2026-09-30T00:00:00.000Z"),
    crossCheckExpected: {},
    crossCheckAchieved: {},
  };
  assert.equal(evaluateInstitutionEvidence(retained).allowed, true);
  assert.equal(evaluateInstitutionEvidence({ ...retained, expiresAt: NOW }).code, "EVIDENCE_EXPIRED");
});

test("[PR03][EVIDENCE] an expected provider cross-check is not promoted into achieved evidence", () => {
  assert.equal(evaluateInstitutionEvidence({
    now: NOW,
    result: "VERIFIED",
    signatureStatus: "VERIFIED",
    expiresAt: new Date("2026-09-30T00:00:00.000Z"),
    crossCheckExpected: { pan: true },
    crossCheckAchieved: {},
  }).code, "EXPECTED_CROSS_CHECK_NOT_ACHIEVED");
  assert.equal(evaluateInstitutionEvidence({
    now: NOW,
    result: "VERIFIED",
    signatureStatus: "VERIFIED",
    expiresAt: new Date("2026-09-30T00:00:00.000Z"),
    crossCheckExpected: { pan: true, lei: true },
    crossCheckAchieved: { pan: "VERIFIED", unrelated: "VERIFIED" },
  }).code, "EXPECTED_CROSS_CHECK_NOT_ACHIEVED");
});

test("[PR03][ENTITLEMENT] exact route/function/mode passes and prohibited functions fail", () => {
  const input = {
    now: NOW,
    status: "ACTIVE",
    effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
    expiresAt: null,
    transactionRoute: "DA",
    representation: "CONVENTIONAL",
    assetClass: "TRADE_RECEIVABLE",
    lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
    materialFunction: "TRANSFER_ORCHESTRATION",
    functionPerformer: "PARTICIPANT_OWNED",
    operatingModes: ["REPLAY", "SHADOW"],
    requested: {
      transactionRoute: "DA",
      representation: "CONVENTIONAL",
      assetClass: "TRADE_RECEIVABLE",
      lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
      materialFunction: "TRANSFER_ORCHESTRATION",
      operatingMode: "SHADOW",
    },
  };
  assert.equal(evaluateRouteEntitlement(input).allowed, true);
  assert.equal(evaluateRouteEntitlement({ ...input, functionPerformer: "PROHIBITED" }).code, "FUNCTION_PROHIBITED");
  assert.equal(evaluateRouteEntitlement({ ...input, requested: { ...input.requested, operatingMode: "PRODUCTION" } }).code, "OPERATING_MODE_NOT_ENTITLED");
});
