import assert from "node:assert/strict";
import test from "node:test";
import { sha256Digest } from "../contracts/v1";
import { buildSecondaryReplayPlan, compareSecondaryAuthority, normaliseSecondaryValues, SECONDARY_EVIDENCE_TYPES, type SecondaryEvidenceFact } from "./secondary-route-pack";

function fact(evidenceType: (typeof SECONDARY_EVIDENCE_TYPES)[number], assertionDigest = sha256Digest(evidenceType)): SecondaryEvidenceFact {
  return { id: `e_${evidenceType}`, evidenceType, evidenceResult: "VERIFIED", assertionDigest, providerInstitutionId: "recordkeeper" };
}

const common = SECONDARY_EVIDENCE_TYPES.filter((type) => type !== "TRUSTEE_TRANSACTION_CONTROL").map((type) => fact(type));

test("[PR14][ROUTE] DA secondary plan has nine governed observation legs and no trustee injection", () => {
  const plan = buildSecondaryReplayPlan({ route: "DA", sellerInstitutionId: "seller", buyerInstitutionId: "buyer",
    recordkeeperInstitutionId: "recordkeeper", instrumentDigest: sha256Digest("instrument"), evidence: common });
  assert.equal(plan.length, 9);
  assert.deepEqual(plan.map((leg) => leg.sequence), [10, 20, 30, 40, 50, 60, 70, 90, 100]);
  assert.ok(plan.every((leg) => leg.expectedAssertionDigest.startsWith("sha256:")));
  assert.ok(plan.every((leg) => leg.legType !== "TRUSTEE_TRANSACTION_CONTROL"));
});

test("[PR14][ROUTE] missing or unverified evidence remains an open gate", () => {
  assert.throws(() => buildSecondaryReplayPlan({ route: "DA", sellerInstitutionId: "seller", buyerInstitutionId: "buyer",
    recordkeeperInstitutionId: "recordkeeper", instrumentDigest: sha256Digest("instrument"), evidence: common.filter((item) => item.evidenceType !== "CURRENT_HOLDER") }), /CURRENT_HOLDER evidence remains open/);
  const invalid = common.map((item) => item.evidenceType === "SELLER_AUTHORITY" ? { ...item, evidenceResult: "PARTIALLY_VERIFIED" } : item);
  assert.throws(() => buildSecondaryReplayPlan({ route: "DA", sellerInstitutionId: "seller", buyerInstitutionId: "buyer",
    recordkeeperInstitutionId: "recordkeeper", instrumentDigest: sha256Digest("instrument"), evidence: invalid }), /SELLER_AUTHORITY evidence is not VERIFIED/);
});

test("[PR14][PTC] trustee and recordkeeper conclusions remain separate and disagreement blocks", () => {
  const after = sha256Digest("record-after");
  const evidence = [...common.map((item) => item.evidenceType === "AUTHORITATIVE_RECORD_AFTER" ? { ...item, assertionDigest: after }
    : item.evidenceType === "AUTHORITATIVE_RECORD_BEFORE" ? { ...item, assertionDigest: sha256Digest("record-before") } : item),
    fact("TRUSTEE_TRANSACTION_CONTROL", sha256Digest("different-trustee-decision"))];
  const plan = buildSecondaryReplayPlan({ route: "PTC", sellerInstitutionId: "seller", buyerInstitutionId: "buyer",
    trusteeInstitutionId: "trustee", recordkeeperInstitutionId: "recordkeeper", instrumentDigest: sha256Digest("instrument"), evidence });
  assert.equal(plan.length, 10);
  assert.equal(plan.find((leg) => leg.expectedEvidenceType === "TRUSTEE_TRANSACTION_CONTROL")?.performerInstitutionId, "trustee");
  assert.deepEqual(compareSecondaryAuthority({ route: "PTC", evidence }), {
    matched: false, breakCode: "PTC_TRUSTEE_RECORDKEEPER_DISAGREEMENT",
    expectedDigest: sha256Digest("different-trustee-decision"), observedDigest: after,
  });
});

test("[PR14][VALUES] quantities and consideration are exact positive values", () => {
  assert.deepEqual(normaliseSecondaryValues({ quantity: { unitCode: "PTC_UNITS", units: "100", scale: 0 }, consideration: { currency: "INR", units: "500000", scale: 2 } }), {
    quantity: { unitCode: "PTC_UNITS", units: "100", scale: 0 }, consideration: { currency: "INR", units: "500000", scale: 2 },
  });
  assert.throws(() => normaliseSecondaryValues({ quantity: { unitCode: "PTC_UNITS", units: "0", scale: 0 }, consideration: { currency: "INR", units: "1", scale: 2 } }), /quantity units must be positive/);
});
