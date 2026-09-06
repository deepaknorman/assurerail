import assert from "node:assert/strict";
import test from "node:test";
import { buildNeutralIntakeEnvelope, sha256Digest, toCanonicalValue } from "../contracts/v1";
import { assertConformancePassed, assertIntakeProfile, parseConnectorSchemaProfiles } from "./provider-profiles";

function envelope(profileId = "assurepool.frozen-da-tape") {
  const sourceRecord = toCanonicalValue({ poolId: "pool-1" });
  return buildNeutralIntakeEnvelope({
    envelopeId: "env-1", transactionCaseId: "case-1",
    provider: { institutionRef: "inst-1", kind: "REGULATED_ENTITY", jurisdiction: "IN", identifiers: [] },
    source: {
      providerInstitutionRef: "inst-1", sourceSystemRef: "source-1", sourceObjectType: "FROZEN_ASSET_TAPE",
      sourceObjectRef: "pool-1", sourceSchemaId: "assurepool.frozen-tape", sourceSchemaVersion: "1",
      sourcePayloadDigest: sha256Digest(sourceRecord), authorityClass: "EVIDENTIARY",
    },
    asOfAt: "2026-08-30T00:00:00Z", expiresAt: null, qualifications: [],
    signature: { status: "NOT_PROVIDED", scope: null, signedDigest: null, algorithm: null, keyRef: null, signature: null, signedAt: null },
    idempotencyKey: "intake-1", receivedAt: "2026-08-30T00:01:00Z",
    transaction: {
      transactionRoute: "DA", representation: "CONVENTIONAL", jurisdiction: "IN", marketContext: "DOMESTIC",
      placementOrListing: "BILATERAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "MSME_LOAN",
      operatingMode: "SHADOW", extensionProfileRef: null,
      routePack: { routePackId: "review", version: "0", status: "REVIEW_PENDING", effectiveAt: null },
      legalRecord: { status: "UNDECLARED", recordType: null, recordkeeperInstitutionRef: null, designationEvidenceRef: null },
    },
    payload: toCanonicalValue({
      normalized: { sourceManifestDigest: sha256Digest({ loans: [] }) },
      extensions: { profileId, sourceRecord },
    }) as never,
  });
}

test("[PR05][CONNECTOR] schema profile declarations are bounded, typed and unique", () => {
  assert.deepEqual(parseConnectorSchemaProfiles([{ profileRef: "assurepool.frozen-da-tape", schemaId: "assurerail.neutral-intake", schemaVersion: "1.0.0" }]), [
    { profileRef: "assurepool.frozen-da-tape", schemaId: "assurerail.neutral-intake", schemaVersion: "1.0.0" },
  ]);
  assert.throws(() => parseConnectorSchemaProfiles([{ profileRef: "vendor.magic", schemaId: "x", schemaVersion: "1" }]), /unsupported/);
  assert.throws(() => parseConnectorSchemaProfiles([
    { profileRef: "assurerail.neutral-intake.v1", schemaId: "x", schemaVersion: "1" },
    { profileRef: "assurerail.neutral-intake.v1", schemaId: "x", schemaVersion: "1" },
  ]), /duplicate/);
});

test("[PR08][SEP01][CONNECTOR] source completion remains an integration profile while the legacy room proxy is retired", () => {
  assert.doesNotThrow(() => parseConnectorSchemaProfiles([
    { profileRef: "assurepool.completion-ack.v1", schemaId: "assurerail.source-completion.instruction", schemaVersion: "1.0.0" },
  ]));
  assert.throws(() => parseConnectorSchemaProfiles([
    { profileRef: "assurerail.legacy-room-proxy.v1", schemaId: "assurerail.legacy-room-proxy.command", schemaVersion: "1.0.0" },
  ]), /unsupported/);
  assert.throws(() => assertIntakeProfile("assurepool.completion-ack.v1", envelope()), /unsupported intake profile/);
});

test("[PR05][CONNECTOR] connector approval fails closed on incomplete conformance evidence", () => {
  assert.doesNotThrow(() => assertConformancePassed({ passed: true, executedTests: 8, criticalFailures: [] }));
  assert.throws(() => assertConformancePassed({ passed: false, executedTests: 8, criticalFailures: [] }), /not passed/);
  assert.throws(() => assertConformancePassed({ passed: true, executedTests: 8, criticalFailures: ["signature"] }), /critical failures/);
  assert.throws(() => assertConformancePassed({ passed: true, executedTests: 0, criticalFailures: [] }), /at least one/);
});

test("[PR05][PROFILE] source-specific evidence cannot enter under another certified profile", () => {
  assert.doesNotThrow(() => assertIntakeProfile("assurepool.frozen-da-tape", envelope()));
  assert.throws(() => assertIntakeProfile("common-lender-registry.v1", envelope()), /does not match/);
  const wrongRoute = { ...envelope(), transaction: { ...envelope().transaction, transactionRoute: "PTC" as const } };
  assert.throws(() => assertIntakeProfile("assurepool.frozen-da-tape", wrongRoute), /restricted to frozen DA tapes/);
});
