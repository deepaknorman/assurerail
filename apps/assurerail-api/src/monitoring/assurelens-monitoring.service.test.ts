import assert from "node:assert/strict";
import test from "node:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { sha256Digest, type TransactionDiscriminatorV1 } from "../contracts/v1";
import { AssureLensMonitoringService, ASSURELENS_PROFILE } from "./assurelens-monitoring.service";

const keys = generateKeyPairSync("ed25519");
const keyId = createHash("sha256").update(keys.publicKey.export({ format: "der", type: "spki" })).digest("hex").slice(0, 32);
const providerId = "assurelens.assurelocker";
const env = {
  ARAIL_ASSURELENS_TRUSTED_KEYS_JSON: JSON.stringify([{
    providerId, keyId, publicKeyPem: keys.publicKey.export({ format: "pem", type: "spki" }).toString(),
  }]),
} as NodeJS.ProcessEnv;

const transaction: TransactionDiscriminatorV1 = {
  transactionRoute: "DA", representation: "CONVENTIONAL", jurisdiction: "IND", marketContext: "DOMESTIC",
  placementOrListing: "BILATERAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "MSME_LOAN",
  operatingMode: "SHADOW", extensionProfileRef: null,
  routePack: { routePackId: "da-shadow", version: "0.1.0", status: "REVIEW_PENDING", effectiveAt: null },
  legalRecord: { status: "UNDECLARED", recordType: null, recordkeeperInstitutionRef: null, designationEvidenceRef: null },
};

function payload(overrides: Record<string, unknown> = {}) {
  const issuedAt = new Date(Date.now() - 60_000).toISOString();
  return {
    packageVersion: ASSURELENS_PROFILE, packageId: "lens_pkg_1", providerId, providerBookRef: "book-alpha",
    evaluationRunRef: "lens_run_1", operatingMode: "SHADOW", engineVersion: "assurelens-engine-1.0.0",
    asOfAt: new Date(Date.now() - 120_000).toISOString(), issuedAt,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(), inputDigest: sha256Digest({ submission: "one" }),
    result: "VERIFIED",
    coverage: { suppliedEntityCount: 2, evaluatedEntityCount: 2, unresolvedEntityCount: 0, staleEntityCount: 0, unavailableSourceFamilies: [], coverageBps: 10_000 },
    findings: [], qualifications: [{ code: "INCOMPLETE_UNIVERSE", severity: "LIMITATION", text: "Only authorised supplied sources were evaluated." }],
    boundary: { completeIndebtednessClaim: false, creditDecision: false, automaticTransactionRestriction: false, lenderDecisionRequired: true },
    ...overrides,
  };
}

function envelope(nextPayload = payload()) {
  const payloadDigest = sha256Digest(nextPayload);
  const signingInput = ["assurelens.provider-envelope.v1", providerId, keyId, payloadDigest].join("\n");
  return {
    envelopeVersion: "assurelens.provider-envelope.v1", providerId, algorithm: "Ed25519", keyId, payloadDigest,
    signature: sign(null, Buffer.from(signingInput), keys.privateKey).toString("base64url"), status: "ACTIVE", payload: nextPayload,
  };
}

function map(providerEnvelope: unknown) {
  return new AssureLensMonitoringService().verifyAndMap({
    institutionId: "inst-1", transactionCaseId: "case-1", transaction, providerEnvelope,
    receivedAt: new Date("2026-09-07T12:00:00.000Z"),
  }, env);
}

test("[AR-LENS-01] verifies and maps a signed package without promoting provider result", () => {
  const result = map(envelope());
  assert.equal(result.providerResult, "VERIFIED");
  assert.equal(result.envelope.source.sourceObjectType, "MONITORING_EVIDENCE");
  assert.equal(result.envelope.signature.status, "PRESENT");
  assert.equal((result.envelope.payload.extensions as Record<string, unknown>).profileId, ASSURELENS_PROFILE);
  assert.ok(result.envelope.qualifications.some((entry) => entry.code === "PROVIDER_RESULT_REQUIRES_RAIL_REVIEW"));
});

test("[AR-LENS-01] rejects signature, coverage and boundary tampering", () => {
  const signed = envelope();
  const first = signed.signature.startsWith("A") ? "B" : "A";
  assert.throws(() => map({ ...signed, signature: `${first}${signed.signature.slice(1)}` }), /signature verification failed/);
  assert.throws(() => map(envelope(payload({ coverage: { ...payload().coverage, coverageBps: 9_999 } }))), /coverageBps is inconsistent/);
  assert.throws(() => map(envelope(payload({ boundary: { ...payload().boundary, creditDecision: true } }))), /preserve lender decision authority/);
});

test("[AR-LENS-01] rejects expired, revoked and raw-identifier packages", () => {
  assert.throws(() => map(envelope(payload({ expiresAt: new Date(Date.now() - 1_000).toISOString() }))), /expired/);
  assert.throws(() => map({ ...envelope(), status: "REVOKED" }), /not active/);
  assert.throws(() => map(envelope(payload({ findings: [{
    findingRef: "finding-1", subjectRef: "ABCDE1234F", metric: "REPAYMENT_DRIFT", severity: "HIGH", outcome: "FAIL",
    observedAt: new Date().toISOString(), explanation: { confidence: "MEDIUM", sources: [], triggeringEvents: [], limitations: [] }, evidenceRefs: [],
  }], result: "REVIEW_REQUIRED" }))), /raw entity identifier/);
  assert.throws(() => map(envelope(payload({ findings: [{
    findingRef: "finding-2", subjectRef: "subject_safe", metric: "REPAYMENT_DRIFT", severity: "HIGH", outcome: "FAIL",
    observedAt: new Date().toISOString(), explanation: { confidence: "MEDIUM", sources: [], triggeringEvents: ["PAN ABCDE1234F was supplied"], limitations: [] }, evidenceRefs: [],
  }], result: "REVIEW_REQUIRED" }))), /raw entity identifier/);
  assert.throws(() => map(envelope(payload({ findings: [{
    findingRef: "finding-3", subjectRef: "subject_safe", metric: "REPAYMENT_DRIFT", severity: "HIGH", outcome: "FAIL",
    observedAt: new Date().toISOString(), explanation: { confidence: "MEDIUM", sources: ["did:web:borrower.example"], triggeringEvents: [], limitations: [] }, evidenceRefs: [],
  }], result: "REVIEW_REQUIRED" }))), /raw entity identifier/);
});
