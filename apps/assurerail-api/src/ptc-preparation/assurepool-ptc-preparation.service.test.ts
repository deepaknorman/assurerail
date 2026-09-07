import assert from "node:assert/strict";
import test from "node:test";
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { sha256Digest, type TransactionDiscriminatorV1 } from "../contracts/v1";
import {
  ASSUREPOOL_PTC_PREPARATION_PROFILE,
  AssurePoolPtcPreparationService,
} from "./assurepool-ptc-preparation.service";

const providerId = "assurepool.fixture-provider";
const keys = generateKeyPairSync("ed25519");
const otherKeys = generateKeyPairSync("ed25519");

function fingerprint(key: KeyObject): string {
  return createHash("sha256").update(key.export({ format: "der", type: "spki" })).digest("hex").slice(0, 32);
}

const keyId = fingerprint(keys.publicKey);
const trustedEnvironment = {
  ARAIL_ASSUREPOOL_TRUSTED_KEYS_JSON: JSON.stringify([{
    providerId,
    keyId,
    publicKeyPem: keys.publicKey.export({ format: "pem", type: "spki" }).toString(),
  }]),
} as NodeJS.ProcessEnv;

const transaction: TransactionDiscriminatorV1 = {
  transactionRoute: "PTC",
  representation: "CONVENTIONAL",
  jurisdiction: "IND",
  marketContext: "DOMESTIC",
  placementOrListing: "PRIVATE_PLACEMENT",
  lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
  assetClass: "MSME_LOAN",
  operatingMode: "SHADOW",
  extensionProfileRef: null,
  routePack: { routePackId: "ptc-shadow", version: "0.1.0", status: "REVIEW_PENDING", effectiveAt: null },
  legalRecord: { status: "UNDECLARED", recordType: null, recordkeeperInstitutionRef: null, designationEvidenceRef: null },
};

function ssa(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rulesetVersion: "ssa-prep-1",
    source: {
      instrument: "RBI Master Direction — Securitisation of Standard Assets Directions, 2021",
      archivePath: "docs/regulatory-sources/RBI_SSA_Master_Directions_2021_upd_2022-12-05.txt",
      archiveSha256Prefix: "30412fa5697c7ccc",
      clausesVerifiedAt: "2026-09-07",
    },
    counselConfirmationPending: true,
    requiredMrrBps: 500,
    mrrBand: "BAND_5PC",
    mrrBandReason: "all fixture exposures are within the five-percent band",
    findings: [{
      rule: "SSA_COUNSEL_CONFIRMATION",
      clause: "ruleset release",
      basis: "T2_INTERPRETIVE",
      outcome: "REVIEW_REQUIRED",
      detail: "independent counsel confirmation pending",
    }],
    overall: "REVIEW_REQUIRED",
    ...overrides,
  };
}

function packagePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const generatedAt = "2026-09-07T10:00:00.000Z";
  const loans = [{ loanRef: "loan-1", includedInTransferSet: true, commitment: sha256Digest({ fixture: "loan-1" }) }];
  const tapeBody = {
    profileId: "assurepool.frozen-da-evidence/2.0",
    tapeVersion: "2.0",
    poolId: "pool-ptc-prep-1",
    manifestHash: sha256Digest(loans),
    loans,
  };
  const performanceResult = {
    valueBasis: "DISBURSED_VALUE",
    note: "synthetic conformance fixture",
    asOfCycle: null,
    vintages: [],
    unvintaged: 0,
    rolls: [],
    cycleGaps: [],
    par: [],
    parObservedShareBps: 0,
  };
  const body = {
    profileId: "assurepool.frozen-da-evidence/2.0",
    packageVersion: "2.0",
    generatedAt,
    tape: { ...tapeBody, tapeHash: sha256Digest(tapeBody) },
    performance: {
      snapshotVersion: "1.0",
      generatedAt,
      poolId: tapeBody.poolId,
      sourceAsOfCycle: null,
      result: performanceResult,
      resultDigest: sha256Digest(performanceResult),
    },
    preparationRoute: "PTC_PREP",
    ssaPreparation: ssa(),
    ...overrides,
  };
  return { ...body, packageDigest: sha256Digest(body) };
}

function providerEnvelope(options: {
  packageOverrides?: Record<string, unknown>;
  signingKeys?: typeof keys;
  signingKeyId?: string;
  mutateBeforeSigning?: (payload: Record<string, unknown>) => Record<string, unknown>;
  mutateAfterSigning?: (payload: Record<string, unknown>) => Record<string, unknown>;
} = {}): Record<string, unknown> {
  const builtPayload = packagePayload(options.packageOverrides);
  const payload = options.mutateBeforeSigning ? options.mutateBeforeSigning(builtPayload) : builtPayload;
  const signingKeys = options.signingKeys ?? keys;
  const signingKeyId = options.signingKeyId ?? keyId;
  const payloadDigest = sha256Digest(payload);
  const signature = sign(
    null,
    Buffer.from(`assurepool.provider-envelope/2.0|${providerId}|Ed25519|${signingKeyId}|${payloadDigest}`),
    signingKeys.privateKey,
  ).toString("base64url");
  return {
    envelopeVersion: "assurepool.provider-envelope/2.0",
    providerId,
    algorithm: "Ed25519",
    keyId: signingKeyId,
    payloadDigest,
    signature,
    payload: options.mutateAfterSigning ? options.mutateAfterSigning(payload) : payload,
  };
}

function map(providerEnvelopeValue: unknown, transactionValue = transaction, env = trustedEnvironment) {
  return new AssurePoolPtcPreparationService().verifyAndMap({
    institutionId: "institution-1",
    transactionCaseId: "case-ptc-1",
    transaction: transactionValue,
    providerEnvelope: providerEnvelopeValue,
    receivedAt: new Date("2026-09-07T10:01:00.000Z"),
  }, env);
}

test("[PTC-PREP][VALID] signed source evidence maps losslessly and remains REVIEW_REQUIRED", () => {
  const result = map(providerEnvelope());
  assert.equal(result.providerResult, "REVIEW_REQUIRED");
  assert.equal(result.envelope.source.sourceSchemaId, ASSUREPOOL_PTC_PREPARATION_PROFILE);
  assert.equal(result.envelope.source.sourceObjectType, "PTC_PREPARATION_EVIDENCE");
  assert.equal(result.envelope.transaction.transactionRoute, "PTC");
  assert.equal(result.envelope.transaction.representation, "CONVENTIONAL");
  assert.ok(result.envelope.qualifications.some((entry) => entry.code === "PROVIDER_RESULT_REQUIRES_RAIL_REVIEW"));
  assert.ok(result.envelope.qualifications.some((entry) => entry.code === "SSA_COUNSEL_CONFIRMATION_PENDING"));
  const extensions = result.envelope.payload.extensions as Record<string, unknown>;
  assert.equal(extensions.profileId, ASSUREPOOL_PTC_PREPARATION_PROFILE);
  assert.ok(extensions.sourcePackage);
});

test("[PTC-PREP][CHOKE] READY is rejected while counsel confirmation remains pending", () => {
  assert.throws(() => map(providerEnvelope({ packageOverrides: {
    ssaPreparation: ssa({
      overall: "READY",
      findings: [{ rule: "SSA_MRR_BAND", clause: "Cl. 12", basis: "T1_BRIGHT_LINE", outcome: "PASS", detail: "pass" }],
    }),
  } })), /cannot be READY while counsel confirmation is pending/);
});

test("[PTC-PREP][CONSISTENCY] FAIL findings cannot be represented by a non-FAIL overall", () => {
  assert.throws(() => map(providerEnvelope({ packageOverrides: {
    ssaPreparation: ssa({
      overall: "REVIEW_REQUIRED",
      findings: [{ rule: "SSA_MRR_RETENTION", clause: "Cl. 12", basis: "T1_BRIGHT_LINE", outcome: "FAIL", detail: "failed" }],
    }),
  } })), /overall REVIEW_REQUIRED is inconsistent with finding outcomes/);
});

test("[PTC-PREP][MRR] MRR bps must agree with the declared SSA band", () => {
  assert.throws(() => map(providerEnvelope({ packageOverrides: {
    ssaPreparation: ssa({ requiredMrrBps: 1000, mrrBand: "BAND_5PC" }),
  } })), /requiredMrrBps is inconsistent with mrrBand/);
});

test("[PTC-PREP][ROUTE] DA source packages and non-conventional PTC cases are rejected", () => {
  assert.throws(() => map(providerEnvelope({ packageOverrides: { preparationRoute: "DA" } })), /preparationRoute must be PTC_PREP/);
  assert.throws(() => map(providerEnvelope(), { ...transaction, transactionRoute: "DA" }), /requires a conventional PTC Rail case/);
  assert.throws(() => map(providerEnvelope(), { ...transaction, representation: "TOKENISED" }), /requires a conventional PTC Rail case/);
});

test("[PTC-PREP][CRYPTO] tamper, digest, signature and trusted-key failures are fail-closed", () => {
  assert.throws(() => map(providerEnvelope({
    mutateAfterSigning: (payload) => ({ ...payload, ssaPreparation: { ...(payload.ssaPreparation as object), requiredMrrBps: 1000 } }),
  })), /packageDigest mismatch/);

  const badPackageDigest = providerEnvelope({
    mutateBeforeSigning: (payload) => ({ ...payload, packageDigest: `sha256:${"0".repeat(64)}` }),
  });
  assert.throws(() => map(badPackageDigest), /packageDigest mismatch/);

  const invalidSignature = providerEnvelope();
  invalidSignature.signature = "A".repeat(86);
  assert.throws(() => map(invalidSignature), /signature verification failed/);

  const otherKeyId = fingerprint(otherKeys.publicKey);
  assert.throws(() => map(providerEnvelope({ signingKeys: otherKeys, signingKeyId: otherKeyId })), /signing key is not trusted/);
  assert.throws(() => map(providerEnvelope(), transaction, {} as NodeJS.ProcessEnv), /trusted provider keys are not configured/);
});
