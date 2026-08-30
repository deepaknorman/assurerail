import assert from "node:assert/strict";
import test from "node:test";
import { CoLending } from "@code/shared";
import { canonicalSerialize, sha256Digest, toCanonicalValue, type CanonicalObject } from "./canonical";
import { absentSignature } from "./envelopes";
import { inspectNeutralTaxonomyFlag } from "./feature-flag";
import { mapAssurePoolTapeToNeutralIntake, mapAssureTransferToNeutralIntake } from "./mappings";

const CONTEXT = {
  envelopeId: "env_mapping_01",
  transactionCaseId: "case_mapping_01",
  provider: {
    institutionRef: "institution_source_01",
    kind: "SERVICE_PROVIDER" as const,
    jurisdiction: "IN",
    identifiers: [{ scheme: "PROVIDER_INTERNAL", value: "source-01" }],
  },
  sourceSystemRef: "source-system-01",
  receivedAt: "2026-08-30T12:00:00Z",
  idempotencyKey: "mapping:fixture:01",
  representation: "CONVENTIONAL" as const,
  operatingMode: "SHADOW" as const,
  jurisdiction: "IN",
  marketContext: "DOMESTIC" as const,
  placementOrListing: "BILATERAL" as const,
  lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE" as const,
  assetClass: "MSME_LOAN" as const,
  extensionProfileRef: null,
  routePack: { routePackId: "in_da_pending", version: "0.0.0-review", status: "REVIEW_PENDING" as const, effectiveAt: null },
  legalRecord: { status: "UNDECLARED" as const, recordType: null, recordkeeperInstitutionRef: null, designationEvidenceRef: null },
  signature: absentSignature("NOT_PROVIDED"),
  currency: "INR",
  currencyScale: 2,
};

function extensionSourceRecord(payload: CanonicalObject): CanonicalObject {
  const extensions = payload.extensions as CanonicalObject;
  return extensions.sourceRecord as CanonicalObject;
}

test("[PR01][MAPPING][ASSUREPOOL] the DA tape maps without wire loss and stays inside its source profile", () => {
  const loans: CoLending.TapeInputLoan[] = [
    { loanRef: "loan_01", verdict: "ELIGIBLE", overridden: false, disbursedMinor: "125000", originationDate: "2025-01-01", classificationBucket: "STANDARD" },
    { loanRef: "loan_02", verdict: "WARNING", overridden: false, disbursedMinor: "75000", originationDate: "2025-02-01", classificationBucket: "SMA-1" },
  ];
  const tape = CoLending.buildAssurePoolTape({
    poolId: "pool_01",
    claId: "arrangement_01",
    cutoffDate: "2026-08-29",
    manifestHash: CoLending.computePoolManifest(loans),
    frozenAt: "2026-08-30T00:00:00Z",
  }, loans);
  const envelope = mapAssurePoolTapeToNeutralIntake(tape, CONTEXT);
  assert.equal(envelope.transaction.transactionRoute, "DA");
  assert.equal(envelope.source.authorityClass, "EVIDENTIARY");
  assert.equal(canonicalSerialize(extensionSourceRecord(envelope.payload)), canonicalSerialize(toCanonicalValue(tape)));
  assert.equal(envelope.source.sourcePayloadDigest, sha256Digest(extensionSourceRecord(envelope.payload)));
  assert.equal((envelope.payload.extensions as CanonicalObject).profileId, "assurepool.frozen-da-tape");
});

test("[PR01][MAPPING][ASSURETRANSFER] receivables facts and manifest map without becoming case authority", () => {
  const exposures: CoLending.TapeReceivable[] = [{
    tenantId: "tenant_01",
    exposureRef: "invoice_01",
    exposureType: "FACTORING_RECEIVABLE_ASSIGNMENT",
    supplierIdentifier: { type: "GSTIN", value: "27TESTONLY0001Z1" },
    draweeIdentifier: { type: "GSTIN", value: "29TESTONLY0002Z1" },
    invoiceNumber: "INV-TEST-01",
    invoiceDate: "2026-07-01",
    faceAmountMinor: "250000",
    acceptanceState: "EXPLICITLY_ACCEPTED",
    originationDate: "2026-07-01",
    dueDate: "2026-09-30",
    priorTransfers: [],
  }];
  const transaction: CoLending.TransferTransaction = {
    tenantId: "tenant_01",
    transferId: "transfer_01",
    transactionDate: "2026-08-30",
    transferor: { partyId: "institution_transferor", role: "TRANSFEROR", governingRuleSetId: "ROUTE_REVIEW_REQUIRED" },
    transferee: { partyId: "institution_transferee", role: "TRANSFEREE", governingRuleSetId: "ROUTE_REVIEW_REQUIRED" },
    exposures,
  };
  const manifest = CoLending.buildReceivablesManifest(transaction.tenantId, transaction.transferId, exposures);
  const envelope = mapAssureTransferToNeutralIntake(transaction, manifest, {
    ...CONTEXT,
    envelopeId: "env_mapping_02",
    idempotencyKey: "mapping:fixture:02",
  });
  assert.equal(envelope.transaction.assetClass, "TRADE_RECEIVABLE");
  assert.equal(envelope.source.authorityClass, "EVIDENTIARY");
  assert.equal(canonicalSerialize(extensionSourceRecord(envelope.payload)), canonicalSerialize(toCanonicalValue({ transaction, manifest })));
  assert.match(envelope.qualifications[0].text, /does not open, settle, complete or authorise/);
});

test("[PR01][MAPPING] mismatched AssureTransfer identities fail before a neutral envelope is emitted", () => {
  const transaction = {
    tenantId: "tenant_01",
    transferId: "transfer_01",
    transactionDate: "2026-08-30",
    transferor: { partyId: "a", role: "TRANSFEROR" as const, governingRuleSetId: "ROUTE_REVIEW_REQUIRED" as const },
    transferee: { partyId: "b", role: "TRANSFEREE" as const, governingRuleSetId: "ROUTE_REVIEW_REQUIRED" as const },
    exposures: [],
  };
  const manifest: CoLending.FrozenReceivablesManifest = {
    version: 1,
    tenantId: "tenant_01",
    transferId: "another_transfer",
    exposureRefs: [],
    fingerprintDigests: [],
    tapeDigests: [],
    manifestHash: sha256Digest({ fixture: "manifest" }),
  };
  assert.throws(() => mapAssureTransferToNeutralIntake(transaction, manifest, CONTEXT), /identity do not match/);
});

test("[PR01][FLAG] the package is off by default and can only be enabled read-only", () => {
  assert.deepEqual(inspectNeutralTaxonomyFlag({}), { value: "off" });
  assert.deepEqual(inspectNeutralTaxonomyFlag({ ARAIL_NEUTRAL_TAXONOMY_V1: "read-only" }), { value: "read_only" });
  const rejected = inspectNeutralTaxonomyFlag({ ARAIL_NEUTRAL_TAXONOMY_V1: "write" });
  assert.equal(rejected.value, "off");
  assert.match(rejected.error ?? "", /no write\/enforcement mode/);
});
