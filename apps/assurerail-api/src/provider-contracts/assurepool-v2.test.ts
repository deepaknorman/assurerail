import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import test from "node:test";
import {
  ASSUREPOOL_PERFORMANCE_SNAPSHOT_VERSION,
  ASSUREPOOL_PROVIDER_ENVELOPE_V2,
  ASSUREPOOL_PROVIDER_PROFILE_V2,
  ASSUREPOOL_TAPE_V2_VERSION,
  computePoolManifestV2,
  parseAndVerifyAssurePoolProviderEnvelopeV2,
  providerEnvelopeSigningInput,
  type AssurePoolEvidencePackageV2,
  type AssurePoolProviderEnvelopeV2,
  type AssurePoolTapeLoanV2,
  type AssurePoolTapeV2,
} from "./assurepool-v2";
import { canonicalJson, hashObject } from "./v1";
import { adaptV2TapeToLegacyNoteProjection, readBoundedProviderJson } from "../tape/tape-provider.client";
import { mapVerifiedAssurePoolV2ToNeutralIntake } from "../contracts/v1/mappings";
import { absentSignature } from "../contracts/v1/envelopes";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ format: "pem", type: "spki" }).toString();
const keyId = createHash("sha256")
  .update(publicKey.export({ format: "der", type: "spki" }))
  .digest("hex")
  .slice(0, 32);
const providerId = "ASSUREPOOL_PROVIDER_TEST";

const loans: AssurePoolTapeLoanV2[] = [
  {
    loanRef: "loan-1",
    verdict: "ELIGIBLE",
    overridden: false,
    overrideReason: null,
    includedInTransferSet: true,
    disbursedMinor: "10000",
    originationDate: "2026-01-01",
    classificationBucket: "STANDARD",
    obligorRef: "obligor-1",
    pslTag: "MSME",
    pslEvidenceState: "VERIFIED",
    interestRateBps: 1200,
    product: "MSME_TERM_LOAN",
    stateCode: "MH",
    resolution: { restructured: false, writtenOff: false, settledOts: false },
    encumbrance: {
      onBookStatus: "ON_BOOK",
      regulatoryReportingStatus: "ON_BOOK",
      cersaiChargePresent: true,
      chargeRank: "FIRST",
      crossPoolSeen: false,
      sourceMode: "LIVE",
      asOfAt: "2026-09-07T10:00:00.000Z",
    },
    commitment: `sha256:${"1".repeat(64)}`,
  },
  {
    loanRef: "loan-2",
    verdict: "HARD_EXCLUDE",
    overridden: false,
    overrideReason: null,
    includedInTransferSet: false,
    disbursedMinor: "5000",
    originationDate: "2026-02-01",
    classificationBucket: "NPA",
    obligorRef: "obligor-2",
    pslTag: null,
    pslEvidenceState: "FAILED",
    interestRateBps: null,
    product: "MSME_TERM_LOAN",
    stateCode: "KA",
    resolution: { restructured: null, writtenOff: true, settledOts: false },
    encumbrance: null,
    commitment: `sha256:${"2".repeat(64)}`,
  },
];

function tapeFixture(inputLoans = loans): AssurePoolTapeV2 {
  const body = {
    profileId: ASSUREPOOL_PROVIDER_PROFILE_V2,
    tapeVersion: ASSUREPOOL_TAPE_V2_VERSION,
    poolId: "pool-1",
    sourceArrangementRef: "arrangement-1",
    cutoffDate: "2026-09-06",
    frozenAt: "2026-09-07T10:00:00.000Z",
    sourceLegacyManifestHash: `sha256:${"a".repeat(64)}`,
    manifestHash: computePoolManifestV2(inputLoans),
    aggregates: {
      loanCount: 2,
      includedCount: 1,
      totalMinor: "15000",
      includedMinor: "10000",
      includedShareBps: 6666,
      pslVerifiedMinor: "10000",
      pslVerifiedShareBps: 10000,
      wacBps: 1200,
      wacCoverageBps: 10000,
      productMixMinor: { MSME_TERM_LOAN: "10000" },
      stateMixMinor: { MH: "10000" },
      restructuredMinor: "0",
    },
    loans: inputLoans,
    lock: { state: "CONFIRMED", reference: "lock-1", loanCount: 1 },
    exclusions: [
      "Borrower identity and raw borrower documents are not included.",
      "Source evidence does not authorise, settle or complete the Rail transaction.",
    ],
  } as const;
  return { ...body, tapeHash: `sha256:${hashObject(body)}` };
}

function packageFixture(tape = tapeFixture()): AssurePoolEvidencePackageV2 {
  const result = {
    valueBasis: "DISBURSED_VALUE",
    note: "Disbursed-value fixture; no inference or interpolation.",
    asOfCycle: "2026-08",
    vintages: [{
      cohort: "2026-01",
      loanCount: 1,
      valueMinor: "10000",
      curve: [{ monthOnBook: 7, d30ShareBps: 0, d90ShareBps: 0, observedShareBps: 10000 }],
    }],
    unvintaged: 0,
    rolls: [],
    cycleGaps: [],
    par: [{ thresholdDays: 30, parBps: 0, valueMinor: "0" }],
    parObservedShareBps: 6666,
  } as const;
  const performance = {
    snapshotVersion: ASSUREPOOL_PERFORMANCE_SNAPSHOT_VERSION,
    generatedAt: "2026-09-07T10:00:00.000Z",
    poolId: tape.poolId,
    sourceAsOfCycle: "2026-08",
    result,
    resultDigest: `sha256:${hashObject(result)}`,
  };
  const body = {
    profileId: ASSUREPOOL_PROVIDER_PROFILE_V2,
    packageVersion: "2.0" as const,
    generatedAt: "2026-09-07T10:00:00.000Z",
    tape,
    performance,
  };
  return { ...body, packageDigest: `sha256:${hashObject(body)}` };
}

function signedEnvelope(payload = packageFixture()): AssurePoolProviderEnvelopeV2 {
  const payloadDigest = `sha256:${hashObject(payload)}`;
  return {
    envelopeVersion: ASSUREPOOL_PROVIDER_ENVELOPE_V2,
    providerId,
    algorithm: "Ed25519",
    keyId,
    payloadDigest,
    signature: sign(
      null,
      Buffer.from(providerEnvelopeSigningInput(providerId, keyId, payloadDigest), "utf8"),
      privateKey
    ).toString("base64url"),
    payload,
  };
}

const options = {
  expectedProviderId: providerId,
  publicKeysById: { [keyId]: publicPem },
  operatingMode: "SHADOW" as const,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("[ASSUREPOOL_V2][BOUNDARY] a correctly signed, reconciled package verifies", () => {
  const result = parseAndVerifyAssurePoolProviderEnvelopeV2(signedEnvelope(), options);
  assert.equal(result.ok, true, result.reasons.join("; "));
  assert.equal(result.envelope?.payload.tape.poolId, "pool-1");
});

test("[ASSUREPOOL_V2][BOUNDARY] unrecognised fields fail the strict wire schema", () => {
  const input = clone(signedEnvelope()) as unknown as { unexpected: boolean };
  input.unexpected = true;
  const result = parseAndVerifyAssurePoolProviderEnvelopeV2(input, options);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("; "), /extra: unexpected/);
});

test("[ASSUREPOOL_V2][BOUNDARY] canonicalisation treats prototype-shaped keys as inert data", () => {
  const input = JSON.parse('{"safe":1,"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.equal(canonicalJson(input), '{"__proto__":{"polluted":true},"safe":1}');
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test("[ASSUREPOOL_V2][TRANSPORT] response media type and actual bytes are bounded before JSON parsing", async () => {
  await assert.rejects(
    () => readBoundedProviderJson(new Response("{}", { headers: { "content-type": "text/plain" } }), "https://provider.invalid", 10),
    /not application\/json/
  );
  await assert.rejects(
    () => readBoundedProviderJson(new Response('{"long":true}', { headers: { "content-type": "application/json" } }), "https://provider.invalid", 5),
    /exceeds the configured byte limit/
  );
  assert.deepEqual(
    await readBoundedProviderJson(new Response('{"ok":true}', { headers: { "content-type": "application/json; charset=utf-8" } }), "https://provider.invalid", 20),
    { ok: true }
  );
});

test("[ASSUREPOOL_V2][BOUNDARY] payload, package, manifest and aggregate drift cannot pass", () => {
  const input = clone(signedEnvelope());
  (input.payload.tape.loans[0] as { product: string }).product = "TAMPERED";
  (input.payload.tape.aggregates as { includedMinor: string }).includedMinor = "9999";
  const result = parseAndVerifyAssurePoolProviderEnvelopeV2(input, options);
  assert.equal(result.ok, false);
  const reasons = result.reasons.join("; ");
  assert.match(reasons, /payloadDigest mismatch/);
  assert.match(reasons, /packageDigest mismatch/);
  assert.match(reasons, /tapeHash mismatch/);
  assert.match(reasons, /manifestHash mismatch/);
  assert.match(reasons, /aggregate mismatch/);
});

test("[ASSUREPOOL_V2][BOUNDARY] provider and trusted key are independently pinned", () => {
  const wrongProvider = parseAndVerifyAssurePoolProviderEnvelopeV2(signedEnvelope(), {
    ...options,
    expectedProviderId: "ANOTHER_PROVIDER",
  });
  assert.equal(wrongProvider.ok, false);
  assert.match(wrongProvider.reasons.join("; "), /not the configured provider/);

  const unknownKey = parseAndVerifyAssurePoolProviderEnvelopeV2(signedEnvelope(), {
    ...options,
    publicKeysById: {},
  });
  assert.equal(unknownKey.ok, false);
  assert.match(unknownKey.reasons.join("; "), /is not trusted/);
});

test("[ASSUREPOOL_V2][BOUNDARY] DEMO encumbrance evidence is rejected in controlled-live and production", () => {
  const demoLoans = clone(loans);
  (demoLoans[0].encumbrance as { sourceMode: "LIVE" | "DEMO" }).sourceMode = "DEMO";
  const envelope = signedEnvelope(packageFixture(tapeFixture(demoLoans)));
  const result = parseAndVerifyAssurePoolProviderEnvelopeV2(envelope, {
    ...options,
    operatingMode: "PRODUCTION",
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("; "), /DEMO encumbrance evidence is prohibited/);
});

test("[ASSUREPOOL_V2][BOUNDARY] production refuses missing live source facts and override-only inclusion", () => {
  const unsafeLoans = clone(loans);
  (unsafeLoans[0] as unknown as { encumbrance: null }).encumbrance = null;
  (unsafeLoans[0].resolution as { writtenOff: boolean | null }).writtenOff = null;
  (unsafeLoans[1] as unknown as { overridden: boolean }).overridden = true;
  (unsafeLoans[1] as unknown as { overrideReason: string | null }).overrideReason = "test-only unsafe override";
  (unsafeLoans[1] as unknown as { includedInTransferSet: boolean }).includedInTransferSet = true;
  const unsafeTape = tapeFixture(unsafeLoans);
  const { tapeHash: _oldTapeHash, ...unsafeTapeBody } = unsafeTape;
  const resealedTapeBody = {
    ...unsafeTapeBody,
    aggregates: {
      ...unsafeTape.aggregates,
      includedCount: 2,
      includedMinor: "15000",
      includedShareBps: 10000,
      pslVerifiedShareBps: 6666,
      wacCoverageBps: 6666,
      productMixMinor: { MSME_TERM_LOAN: "15000" },
      stateMixMinor: { KA: "5000", MH: "10000" },
    },
    lock: { state: "CONFIRMED", reference: "lock-unsafe", loanCount: 2 },
  };
  const envelope = signedEnvelope(packageFixture({
    ...resealedTapeBody,
    tapeHash: `sha256:${hashObject(resealedTapeBody)}`,
  }));
  const result = parseAndVerifyAssurePoolProviderEnvelopeV2(envelope, {
    ...options,
    operatingMode: "CONTROLLED_LIVE",
  });
  assert.equal(result.ok, false);
  const reasons = result.reasons.join("; ");
  assert.match(reasons, /current encumbrance evidence is required/);
  assert.match(reasons, /written-off and OTS status must be explicitly clear/);
  assert.match(reasons, /override alone cannot include HARD_EXCLUDE/);
});

test("[ASSUREPOOL_V2][COMPAT] the Note projection preserves amounts while retaining neutral v2 terminology at the boundary", () => {
  const tape = tapeFixture();
  const projection = adaptV2TapeToLegacyNoteProjection(tape);
  assert.equal(projection.aggregates.mintableMinor, tape.aggregates.includedMinor);
  assert.equal(projection.loans[0]?.mintable, tape.loans[0]?.includedInTransferSet);
  assert.equal(projection.manifestHash, tape.manifestHash);
  assert.equal(projection.tapeHash, tape.tapeHash);
});

test("[ASSUREPOOL_V2][MAPPING] the complete signed source maps into neutral intake without becoming case authority", () => {
  const providerEnvelope = parseAndVerifyAssurePoolProviderEnvelopeV2(signedEnvelope(), options).envelope;
  assert.ok(providerEnvelope);
  const envelope = mapVerifiedAssurePoolV2ToNeutralIntake(providerEnvelope, {
    envelopeId: "intake-pool-1",
    transactionCaseId: "case-1",
    provider: {
      institutionRef: "institution-assurepool-provider",
      kind: "SERVICE_PROVIDER",
      jurisdiction: "IN",
      identifiers: [{ scheme: "PROVIDER_INTERNAL", value: providerId }],
    },
    sourceSystemRef: "assurepool-provider-v2",
    receivedAt: "2026-09-07T10:01:00.000Z",
    idempotencyKey: "assurepool-v2:pool-1:package-1",
    representation: "CONVENTIONAL",
    operatingMode: "SHADOW",
    jurisdiction: "IN",
    marketContext: "DOMESTIC",
    placementOrListing: "BILATERAL",
    lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
    assetClass: "MSME_LOAN",
    extensionProfileRef: null,
    routePack: { routePackId: "in-da-review", version: "0.0.0-review", status: "REVIEW_PENDING", effectiveAt: null },
    legalRecord: { status: "UNDECLARED", recordType: null, recordkeeperInstitutionRef: null, designationEvidenceRef: null },
    signature: absentSignature("NOT_PROVIDED"),
    currency: "INR",
    currencyScale: 2,
  });
  assert.equal(envelope.source.sourceObjectType, "FROZEN_DA_EVIDENCE_PACKAGE");
  assert.equal(envelope.source.authorityClass, "EVIDENTIARY");
  assert.equal(envelope.source.sourcePayloadDigest, providerEnvelope.payloadDigest);
  assert.equal(envelope.signature.status, "PRESENT");
  assert.equal(envelope.signature.keyRef, keyId);
  assert.equal((envelope.payload.extensions as Record<string, unknown>).profileId, ASSUREPOOL_PROVIDER_PROFILE_V2);
  assert.equal((envelope.payload.normalized as Record<string, unknown>).performanceResultDigest, providerEnvelope.payload.performance.resultDigest);
});
