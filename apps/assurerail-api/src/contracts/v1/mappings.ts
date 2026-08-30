import type { CoLending } from "@code/shared";
import { sha256Digest, toCanonicalValue, type CanonicalObject } from "./canonical";
import {
  buildNeutralIntakeEnvelope,
  type InstitutionReferenceV1,
  type LegalRecordDeclarationV1,
  type NeutralIntakeEnvelopeV1,
  type RoutePackReferenceV1,
  type SignatureProofV1,
} from "./envelopes";
import { exactMoney } from "./exact-values";
import { assertValidNeutralEnvelopeV1 } from "./schema-registry";
import type {
  AssetClass,
  LifecycleLeg,
  MarketContext,
  OperatingMode,
  PlacementOrListing,
  Representation,
} from "./taxonomy";

export interface NeutralMappingContextV1 {
  readonly envelopeId: string;
  readonly transactionCaseId: string;
  readonly provider: InstitutionReferenceV1;
  readonly sourceSystemRef: string;
  readonly receivedAt: string;
  readonly idempotencyKey: string;
  readonly representation: Representation;
  readonly operatingMode: OperatingMode;
  readonly jurisdiction: string;
  readonly marketContext: MarketContext;
  readonly placementOrListing: PlacementOrListing;
  readonly lifecycleLeg: LifecycleLeg;
  readonly extensionProfileRef: string | null;
  readonly routePack: RoutePackReferenceV1;
  readonly legalRecord: LegalRecordDeclarationV1;
  readonly signature: SignatureProofV1;
  readonly currency: string;
  readonly currencyScale: number;
}

export interface AssurePoolMappingContextV1 extends NeutralMappingContextV1 {
  readonly assetClass: AssetClass;
}

function sourceRecord(value: unknown): CanonicalObject {
  const converted = toCanonicalValue(value);
  if (!converted || typeof converted !== "object" || Array.isArray(converted)) throw new Error("source record must be a JSON object");
  return converted as CanonicalObject;
}

function totalMinor(values: readonly (string | undefined)[]): string {
  return values.reduce<bigint>((sum, value) => sum + BigInt(value ?? "0"), 0n).toString();
}

/** AssurePool stays a DA-only optional source profile; the neutral envelope does not require it. */
export function mapAssurePoolTapeToNeutralIntake(
  tape: CoLending.AssurePoolTape,
  context: AssurePoolMappingContextV1,
): NeutralIntakeEnvelopeV1 {
  const original = sourceRecord(tape);
  const money = exactMoney({
    currency: context.currency,
    units: tape.aggregates.totalMinor,
    scale: context.currencyScale,
  });
  const payload = sourceRecord({
    normalized: {
      assetCount: tape.aggregates.loanCount,
      eligibleOrQualifiedAssetCount: tape.aggregates.mintableCount,
      grossAmount: money,
      sourceManifestDigest: tape.manifestHash,
      sourceRecordDigest: sha256Digest(original),
    },
    extensions: {
      profileId: "assurepool.frozen-da-tape",
      profileVersion: tape.tapeVersion,
      sourceRecord: original,
    },
  });
  const envelope = buildNeutralIntakeEnvelope({
    envelopeId: context.envelopeId,
    transactionCaseId: context.transactionCaseId,
    provider: context.provider,
    source: {
      providerInstitutionRef: context.provider.institutionRef,
      sourceSystemRef: context.sourceSystemRef,
      sourceObjectType: "FROZEN_ASSET_TAPE",
      sourceObjectRef: tape.poolId,
      sourceSchemaId: "assurepool.frozen-tape",
      sourceSchemaVersion: tape.tapeVersion,
      sourcePayloadDigest: sha256Digest(original),
      authorityClass: "EVIDENTIARY",
    },
    asOfAt: tape.cutoffDate,
    expiresAt: null,
    qualifications: [{
      code: "SOURCE_SCOPE_EXCLUSIONS_DECLARED",
      severity: "INFORMATION",
      text: tape.excludes,
      evidenceRef: null,
    }],
    signature: context.signature,
    idempotencyKey: context.idempotencyKey,
    receivedAt: context.receivedAt,
    transaction: {
      transactionRoute: "DA",
      representation: context.representation,
      jurisdiction: context.jurisdiction,
      marketContext: context.marketContext,
      placementOrListing: context.placementOrListing,
      lifecycleLeg: context.lifecycleLeg,
      assetClass: context.assetClass,
      operatingMode: context.operatingMode,
      extensionProfileRef: context.extensionProfileRef,
      routePack: context.routePack,
      legalRecord: context.legalRecord,
    },
    payload,
  });
  assertValidNeutralEnvelopeV1(envelope);
  return envelope;
}

/** AssureTransfer contributes receivables evidence; it does not become Rail's case authority. */
export function mapAssureTransferToNeutralIntake(
  transaction: CoLending.TransferTransaction,
  manifest: CoLending.FrozenReceivablesManifest,
  context: NeutralMappingContextV1,
): NeutralIntakeEnvelopeV1 {
  if (transaction.transferId !== manifest.transferId || transaction.tenantId !== manifest.tenantId) {
    throw new Error("AssureTransfer transaction and manifest identity do not match");
  }
  const original = sourceRecord({ transaction, manifest });
  const grossAmount = exactMoney({
    currency: context.currency,
    units: totalMinor(transaction.exposures.map((exposure) => exposure.faceAmountMinor)),
    scale: context.currencyScale,
  });
  const payload = sourceRecord({
    normalized: {
      assetCount: transaction.exposures.length,
      grossAmount,
      sourceManifestDigest: manifest.manifestHash,
      sourceRecordDigest: sha256Digest(original),
    },
    extensions: {
      profileId: "assuretransfer.receivables-da",
      profileVersion: String(manifest.version),
      sourceRecord: original,
    },
  });
  const envelope = buildNeutralIntakeEnvelope({
    envelopeId: context.envelopeId,
    transactionCaseId: context.transactionCaseId,
    provider: context.provider,
    source: {
      providerInstitutionRef: context.provider.institutionRef,
      sourceSystemRef: context.sourceSystemRef,
      sourceObjectType: "RECEIVABLES_TRANSFER_MANIFEST",
      sourceObjectRef: transaction.transferId,
      sourceSchemaId: "assuretransfer.receivables-transfer",
      sourceSchemaVersion: String(manifest.version),
      sourcePayloadDigest: sha256Digest(original),
      authorityClass: "EVIDENTIARY",
    },
    asOfAt: transaction.transactionDate,
    expiresAt: null,
    qualifications: [{
      code: "EVIDENCE_PRODUCT_NOT_CASE_AUTHORITY",
      severity: "INFORMATION",
      text: "The source provides transfer facts and evidence; it does not open, settle, complete or authorise the AssureRail case.",
      evidenceRef: null,
    }],
    signature: context.signature,
    idempotencyKey: context.idempotencyKey,
    receivedAt: context.receivedAt,
    transaction: {
      transactionRoute: "DA",
      representation: context.representation,
      jurisdiction: context.jurisdiction,
      marketContext: context.marketContext,
      placementOrListing: context.placementOrListing,
      lifecycleLeg: context.lifecycleLeg,
      assetClass: "TRADE_RECEIVABLE",
      operatingMode: context.operatingMode,
      extensionProfileRef: context.extensionProfileRef,
      routePack: context.routePack,
      legalRecord: context.legalRecord,
    },
    payload,
  });
  assertValidNeutralEnvelopeV1(envelope);
  return envelope;
}
