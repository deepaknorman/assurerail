import assert from "node:assert/strict";
import test from "node:test";
import { sha256Digest } from "./canonical";
import {
  absentSignature,
  buildNeutralAcknowledgementEnvelope,
  buildNeutralEventEnvelope,
  buildNeutralEvidenceEnvelope,
  buildNeutralIntakeEnvelope,
  type NeutralIntakeEnvelopeV1,
} from "./envelopes";
import {
  NEUTRAL_CONTRACT_SCHEMAS_V1,
  NEUTRAL_INTAKE_SCHEMA_V1,
  checkSchemaCompatibility,
  createNeutralContractRegistryV1,
} from "./schema-registry";

function validIntake(): NeutralIntakeEnvelopeV1 {
  const payload = { normalized: { assetCount: 1 }, extensions: {} };
  return buildNeutralIntakeEnvelope({
    envelopeId: "env_01",
    transactionCaseId: "case_01",
    provider: {
      institutionRef: "institution_provider_01",
      kind: "REGULATED_ENTITY",
      jurisdiction: "IN",
      identifiers: [{ scheme: "LEI", value: "TESTONLY000000000001" }],
    },
    source: {
      providerInstitutionRef: "institution_provider_01",
      sourceSystemRef: "source_system_01",
      sourceObjectType: "FROZEN_ASSET_TAPE",
      sourceObjectRef: "object_01",
      sourceSchemaId: "provider.asset-tape",
      sourceSchemaVersion: "3.2.0",
      sourcePayloadDigest: sha256Digest({ fixture: true }),
      authorityClass: "EVIDENTIARY",
    },
    asOfAt: "2026-08-30",
    expiresAt: null,
    qualifications: [],
    signature: absentSignature("NOT_PROVIDED"),
    idempotencyKey: "provider:object_01:3.2.0",
    receivedAt: "2026-08-30T12:00:00Z",
    transaction: {
      transactionRoute: "DA",
      representation: "CONVENTIONAL",
      jurisdiction: "IN",
      marketContext: "DOMESTIC",
      placementOrListing: "BILATERAL",
      lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
      assetClass: "MSME_LOAN",
      operatingMode: "SHADOW",
      extensionProfileRef: null,
      routePack: { routePackId: "routepack_da_in", version: "0.0.0-review", status: "REVIEW_PENDING", effectiveAt: null },
      legalRecord: { status: "UNDECLARED", recordType: null, recordkeeperInstitutionRef: null, designationEvidenceRef: null },
    },
    payload,
  });
}

test("[PR01][SCHEMA] the exact v1 intake envelope validates", () => {
  const envelope = validIntake();
  const result = createNeutralContractRegistryV1().validate(envelope);
  assert.deepEqual(result, { ok: true, issues: [] });
  assert.equal(envelope.payloadDigest, sha256Digest(envelope.payload));
});

test("[PR01][SCHEMA] evidence, acknowledgement and event envelopes share the explicit neutral provenance contract", () => {
  const intake = validIntake();
  const base = {
    envelopeId: "env_other_01",
    transactionCaseId: intake.transactionCaseId,
    provider: intake.provider,
    source: intake.source,
    asOfAt: "2026-08-30T12:00:00Z",
    expiresAt: null,
    qualifications: [],
    signature: absentSignature("NOT_PROVIDED"),
  };
  const evidence = buildNeutralEvidenceEnvelope({
    ...base,
    evidenceType: "POOL_MANIFEST_INTEGRITY",
    scope: { subjectRefs: ["pool_01"], claimCodes: ["MANIFEST_MATCHED"], fromAt: null, toAt: "2026-08-30T12:00:00Z" },
    result: "VERIFIED",
    independence: "PARTICIPANT_PROVIDED",
    contentRef: "restricted://evidence/01",
    contentDigest: sha256Digest({ evidence: "fixture" }),
  });
  const acknowledgement = buildNeutralAcknowledgementEnvelope({
    ...base,
    envelopeId: "env_other_02",
    instructionId: "instruction_01",
    status: "PENDING",
    finality: "NON_FINAL",
    occurredAt: "2026-08-30T12:01:00Z",
    externalReference: "provider-ref-01",
    reconciliationState: "PENDING",
    responseDigest: sha256Digest({ response: "fixture" }),
  });
  const event = buildNeutralEventEnvelope({
    ...base,
    envelopeId: "env_other_03",
    eventType: "SOURCE_RECORD_OBSERVED",
    occurredAt: "2026-08-30T12:00:00Z",
    observedAt: "2026-08-30T12:02:00Z",
    causationId: null,
    correlationId: "case_01:source_01",
    performer: { performer: "PARTICIPANT_OWNED", institutionRef: intake.provider.institutionRef, actorRef: null, authorityEvidenceRef: null },
    payload: { sourceObjectRef: "object_01" },
  });
  const registry = createNeutralContractRegistryV1();
  for (const envelope of [evidence, acknowledgement, event]) {
    assert.deepEqual(registry.validate(envelope), { ok: true, issues: [] });
  }
});

test("[PR01][SCHEMA] version, signature status, expiry and qualifications are mandatory and explicit", () => {
  const fixture = validIntake() as unknown as Record<string, unknown>;
  for (const field of ["contractVersion", "schemaVersion", "signature", "expiresAt", "qualifications"]) {
    const mutated = { ...fixture };
    delete mutated[field];
    const result = createNeutralContractRegistryV1().validate(mutated);
    assert.equal(result.ok, false, field);
    assert.ok(result.issues.some((issue) => issue.includes(`$.${field} is required`)), `${field}: ${result.issues.join(" | ")}`);
  }
});

test("[PR01][SCHEMA] unknown values, DEMO evidence mode, digest drift and v1 top-level extras fail closed", () => {
  const fixture = validIntake();
  const bad = {
    ...fixture,
    unexpectedTrust: true,
    transaction: { ...fixture.transaction, operatingMode: "DEMO", representation: "TRADITIONAL" },
    payload: { ...fixture.payload, normalized: { assetCount: 2 } },
  };
  const result = createNeutralContractRegistryV1().validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes("unexpectedTrust")));
  assert.ok(result.issues.some((issue) => issue.includes("operatingMode")));
  assert.ok(result.issues.some((issue) => issue.includes("representation")));
  assert.ok(result.issues.some((issue) => issue.includes("payloadDigest does not match")));
});

test("[PR01][SCHEMA] incomplete signatures and legal-record declarations cannot imply authority", () => {
  const fixture = validIntake();
  const bad = {
    ...fixture,
    signature: {
      status: "PRESENT",
      scope: "SOURCE_PAYLOAD",
      signedDigest: fixture.source.sourcePayloadDigest,
      algorithm: "EdDSA",
      keyRef: null,
      signature: null,
      signedAt: null,
    },
    transaction: {
      ...fixture.transaction,
      legalRecord: {
        status: "DECLARED",
        recordType: "TRUSTEE_DESIGNATED_REGISTER",
        recordkeeperInstitutionRef: null,
        designationEvidenceRef: null,
      },
    },
  };
  const result = createNeutralContractRegistryV1().validate(bad);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes("signature.keyRef")));
  assert.ok(result.issues.some((issue) => issue.includes("recordkeeperInstitutionRef")));
  assert.ok(result.issues.some((issue) => issue.includes("designationEvidenceRef")));
});

test("[PR01][SCHEMA] a present signature is bound to the declared digest scope", () => {
  const fixture = validIntake();
  const signedSource = {
    ...fixture,
    signature: {
      status: "PRESENT",
      scope: "SOURCE_PAYLOAD",
      signedDigest: fixture.source.sourcePayloadDigest,
      algorithm: "EdDSA",
      keyRef: "provider-key-01",
      signature: "test-signature-material",
      signedAt: "2026-08-30T11:59:00Z",
    },
  };
  assert.deepEqual(createNeutralContractRegistryV1().validate(signedSource), { ok: true, issues: [] });

  const wrongScope = {
    ...signedSource,
    signature: { ...signedSource.signature, scope: "INTAKE_PAYLOAD" },
  };
  const result = createNeutralContractRegistryV1().validate(wrongScope);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes("signedDigest does not match")));
});

test("[PR01][SCHEMA] OTHER_APPROVED classifications require a named extension profile", () => {
  const fixture = validIntake();
  const missing = createNeutralContractRegistryV1().validate({
    ...fixture,
    transaction: { ...fixture.transaction, assetClass: "OTHER_APPROVED_EXPOSURE", extensionProfileRef: null },
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((issue) => issue.includes("extensionProfileRef")));

  const extended = createNeutralContractRegistryV1().validate({
    ...fixture,
    transaction: { ...fixture.transaction, assetClass: "OTHER_APPROVED_EXPOSURE", extensionProfileRef: "asset-profile:approved:1.0.0" },
  });
  assert.deepEqual(extended, { ok: true, issues: [] });
});

test("[PR01][SCHEMA] syntactically shaped but impossible dates fail closed", () => {
  const fixture = validIntake();
  const result = createNeutralContractRegistryV1().validate({
    ...fixture,
    asOfAt: "2026-02-30",
    receivedAt: "2026-08-30T25:00:00Z",
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes("$.asOfAt")));
  assert.ok(result.issues.some((issue) => issue.includes("$.receivedAt")));
});

test("[PR01][SCHEMA] expiry cannot precede the facts it qualifies", () => {
  const fixture = validIntake();
  const result = createNeutralContractRegistryV1().validate({
    ...fixture,
    expiresAt: "2026-08-29T23:59:59Z",
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes("$.expiresAt cannot be before $.asOfAt")));
});

test("[PR01][SCHEMA] an approved route pack requires an effective date", () => {
  const fixture = validIntake();
  const result = createNeutralContractRegistryV1().validate({
    ...fixture,
    transaction: {
      ...fixture.transaction,
      routePack: { ...fixture.transaction.routePack, status: "APPROVED", effectiveAt: null },
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.includes("effectiveAt is required")));
});

test("[PR01][SCHEMA] additive optional evolution is compatible; removals, tightening and enum narrowing are not", () => {
  const compatible = {
    ...NEUTRAL_INTAKE_SCHEMA_V1,
    version: "1.1.0",
    fields: { ...NEUTRAL_INTAKE_SCHEMA_V1.fields, providerTrace: { presence: "optional" as const, kind: "string" as const } },
  };
  assert.deepEqual(checkSchemaCompatibility(NEUTRAL_INTAKE_SCHEMA_V1, compatible), { compatible: true, breaking: [] });

  const { signature: _removed, ...withoutSignature } = NEUTRAL_INTAKE_SCHEMA_V1.fields;
  const breaking = {
    ...NEUTRAL_INTAKE_SCHEMA_V1,
    version: "2.0.0",
    fields: {
      ...withoutSignature,
      envelopeType: { presence: "required" as const, kind: "string" as const, enumValues: [] },
      newRequired: { presence: "required" as const, kind: "string" as const },
    },
  };
  const result = checkSchemaCompatibility(NEUTRAL_INTAKE_SCHEMA_V1, breaking);
  assert.equal(result.compatible, false);
  assert.ok(result.breaking.some((issue) => issue.includes("removed field 'signature'")));
  assert.ok(result.breaking.some((issue) => issue.includes("removed enum value")));
  assert.ok(result.breaking.some((issue) => issue.includes("added required field 'newRequired'")));
});

test("[PR01][NEUTRALITY] canonical schemas mandate no product, provider, trustee, token or CLA field", () => {
  const requiredFieldNames = NEUTRAL_CONTRACT_SCHEMAS_V1.flatMap((schema) =>
    Object.entries(schema.fields).filter(([, field]) => field.presence === "required").map(([name]) => name.toLowerCase()),
  );
  const forbidden = ["assurepool", "assurelocker", "assuretransfer", "idbi", "trustee", "token", "cla"];
  for (const word of forbidden) {
    assert.equal(requiredFieldNames.some((field) => field.includes(word)), false, `${word} leaked into mandatory schema fields`);
  }
});
