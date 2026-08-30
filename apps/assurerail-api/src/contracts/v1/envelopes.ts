import type { CanonicalObject, Sha256Digest } from "./canonical";
import { sha256Digest } from "./canonical";
import type { ExactMoney, ExactUnitQuantity } from "./exact-values";
import type {
  AssetClass,
  EvidenceResult,
  FunctionPerformer,
  LifecycleLeg,
  MarketContext,
  MaterialFunction,
  OperatingMode,
  PlacementOrListing,
  ReconciliationState,
  Representation,
  SourceAuthorityClass,
  TransactionRoute,
} from "./taxonomy";

export const NEUTRAL_CONTRACT_VERSION = "1.0.0" as const;
export const NEUTRAL_SCHEMA_VERSION = "1.0.0" as const;

export const ENVELOPE_TYPES = ["INTAKE", "EVIDENCE", "ACKNOWLEDGEMENT", "EVENT"] as const;
export type EnvelopeType = (typeof ENVELOPE_TYPES)[number];

export const INSTITUTION_KINDS = [
  "REGULATED_ENTITY",
  "TRUST_OR_SPE",
  "MARKET_INFRASTRUCTURE",
  "SERVICE_PROVIDER",
  "GOVERNMENT_OR_STATUTORY_AUTHORITY",
  "OTHER_APPROVED_INSTITUTION",
] as const;
export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];

export interface InstitutionIdentifierV1 {
  readonly scheme: string;
  readonly value: string;
}

/** Stable Rail reference plus provider-declared identifiers; a DID or AssureLocker ID is not required. */
export interface InstitutionReferenceV1 {
  readonly institutionRef: string;
  readonly kind: InstitutionKind;
  readonly jurisdiction: string;
  readonly identifiers: readonly InstitutionIdentifierV1[];
}

export interface SourceReferenceV1 {
  readonly providerInstitutionRef: string;
  readonly sourceSystemRef: string;
  readonly sourceObjectType: string;
  readonly sourceObjectRef: string;
  readonly sourceSchemaId: string;
  readonly sourceSchemaVersion: string;
  readonly sourcePayloadDigest: Sha256Digest;
  readonly authorityClass: SourceAuthorityClass;
}

export const SIGNATURE_STATUSES = ["PRESENT", "NOT_PROVIDED", "NOT_APPLICABLE"] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];
export const SIGNATURE_SCOPES = [
  "SOURCE_PAYLOAD",
  "INTAKE_PAYLOAD",
  "EVIDENCE_CONTENT",
  "ACKNOWLEDGEMENT_RESPONSE",
  "EVENT_PAYLOAD",
] as const;
export type SignatureScope = (typeof SIGNATURE_SCOPES)[number];

/** Signature absence is explicit and machine-visible; it is never inferred from omitted fields. */
export interface SignatureProofV1 {
  readonly status: SignatureStatus;
  readonly scope: SignatureScope | null;
  readonly signedDigest: Sha256Digest | null;
  readonly algorithm: string | null;
  readonly keyRef: string | null;
  readonly signature: string | null;
  readonly signedAt: string | null;
}

export const QUALIFICATION_SEVERITIES = ["INFORMATION", "LIMITATION", "EXCEPTION", "REVIEW_REQUIRED"] as const;
export type QualificationSeverity = (typeof QUALIFICATION_SEVERITIES)[number];

export interface QualificationV1 {
  readonly code: string;
  readonly severity: QualificationSeverity;
  readonly text: string;
  readonly evidenceRef: string | null;
}

export interface RoutePackReferenceV1 {
  readonly routePackId: string;
  readonly version: string;
  readonly status: "REVIEW_PENDING" | "APPROVED";
  readonly effectiveAt: string | null;
}

export interface LegalRecordDeclarationV1 {
  readonly status: "DECLARED" | "UNDECLARED";
  readonly recordType: string | null;
  readonly recordkeeperInstitutionRef: string | null;
  readonly designationEvidenceRef: string | null;
}

export interface TransactionDiscriminatorV1 {
  readonly transactionRoute: TransactionRoute;
  readonly representation: Representation;
  readonly jurisdiction: string;
  readonly marketContext: MarketContext;
  readonly placementOrListing: PlacementOrListing;
  readonly lifecycleLeg: LifecycleLeg;
  readonly assetClass: AssetClass;
  readonly operatingMode: OperatingMode;
  /** Required when any governed classifier uses an OTHER_APPROVED extension value. */
  readonly extensionProfileRef: string | null;
  readonly routePack: RoutePackReferenceV1;
  readonly legalRecord: LegalRecordDeclarationV1;
}

export interface FunctionAssignmentV1 {
  readonly function: MaterialFunction;
  readonly performer: FunctionPerformer;
  readonly performerInstitutionRef: string | null;
  readonly authorityEvidenceRef: string | null;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
}

interface NeutralEnvelopeBaseV1<TType extends EnvelopeType> {
  readonly envelopeId: string;
  readonly envelopeType: TType;
  readonly contractVersion: typeof NEUTRAL_CONTRACT_VERSION;
  readonly schemaId: string;
  readonly schemaVersion: typeof NEUTRAL_SCHEMA_VERSION;
  readonly transactionCaseId: string;
  readonly provider: InstitutionReferenceV1;
  readonly source: SourceReferenceV1;
  readonly asOfAt: string;
  readonly expiresAt: string | null;
  readonly qualifications: readonly QualificationV1[];
  readonly signature: SignatureProofV1;
}

export interface NeutralIntakeEnvelopeV1 extends NeutralEnvelopeBaseV1<"INTAKE"> {
  readonly idempotencyKey: string;
  readonly receivedAt: string;
  readonly transaction: TransactionDiscriminatorV1;
  readonly payload: CanonicalObject;
  readonly payloadDigest: Sha256Digest;
}

export const EVIDENCE_INDEPENDENCE_CLASSES = [
  "INDEPENDENT_APPOINTED",
  "RELATED_PARTY_DISCLOSED",
  "PARTICIPANT_PROVIDED",
  "AUTHORITY_SOURCE",
  "NOT_ASSESSED",
] as const;
export type EvidenceIndependenceClass = (typeof EVIDENCE_INDEPENDENCE_CLASSES)[number];

export interface EvidenceScopeV1 {
  readonly subjectRefs: readonly string[];
  readonly claimCodes: readonly string[];
  readonly fromAt: string | null;
  readonly toAt: string | null;
}

export interface NeutralEvidenceEnvelopeV1 extends NeutralEnvelopeBaseV1<"EVIDENCE"> {
  readonly evidenceType: string;
  readonly scope: EvidenceScopeV1;
  readonly result: EvidenceResult;
  readonly independence: EvidenceIndependenceClass;
  readonly contentRef: string | null;
  readonly contentDigest: Sha256Digest;
}

export const ACKNOWLEDGEMENT_STATUSES = ["RECEIVED", "ACCEPTED", "REJECTED", "PENDING", "FINALISED"] as const;
export type AcknowledgementStatus = (typeof ACKNOWLEDGEMENT_STATUSES)[number];
export const ACKNOWLEDGEMENT_FINALITY = ["NON_FINAL", "FINAL", "UNKNOWN"] as const;
export type AcknowledgementFinality = (typeof ACKNOWLEDGEMENT_FINALITY)[number];

export interface NeutralAcknowledgementEnvelopeV1 extends NeutralEnvelopeBaseV1<"ACKNOWLEDGEMENT"> {
  readonly instructionId: string;
  readonly status: AcknowledgementStatus;
  readonly finality: AcknowledgementFinality;
  readonly occurredAt: string;
  readonly externalReference: string | null;
  readonly reconciliationState: ReconciliationState;
  readonly responseDigest: Sha256Digest;
}

export interface EventPerformerV1 {
  readonly performer: FunctionPerformer;
  readonly institutionRef: string | null;
  readonly actorRef: string | null;
  readonly authorityEvidenceRef: string | null;
}

export interface NeutralEventEnvelopeV1 extends NeutralEnvelopeBaseV1<"EVENT"> {
  readonly eventType: string;
  readonly occurredAt: string;
  readonly observedAt: string;
  readonly causationId: string | null;
  readonly correlationId: string;
  readonly performer: EventPerformerV1;
  readonly payload: CanonicalObject;
  readonly payloadDigest: Sha256Digest;
}

export type NeutralEnvelopeV1 =
  | NeutralIntakeEnvelopeV1
  | NeutralEvidenceEnvelopeV1
  | NeutralAcknowledgementEnvelopeV1
  | NeutralEventEnvelopeV1;

type IntakeBuildInput = Omit<NeutralIntakeEnvelopeV1, "contractVersion" | "schemaId" | "schemaVersion" | "envelopeType" | "payloadDigest">;
type EvidenceBuildInput = Omit<NeutralEvidenceEnvelopeV1, "contractVersion" | "schemaId" | "schemaVersion" | "envelopeType">;
type AcknowledgementBuildInput = Omit<NeutralAcknowledgementEnvelopeV1, "contractVersion" | "schemaId" | "schemaVersion" | "envelopeType">;
type EventBuildInput = Omit<NeutralEventEnvelopeV1, "contractVersion" | "schemaId" | "schemaVersion" | "envelopeType" | "payloadDigest">;

export function buildNeutralIntakeEnvelope(input: IntakeBuildInput): NeutralIntakeEnvelopeV1 {
  return {
    ...input,
    envelopeType: "INTAKE",
    contractVersion: NEUTRAL_CONTRACT_VERSION,
    schemaId: "assurerail.neutral-intake",
    schemaVersion: NEUTRAL_SCHEMA_VERSION,
    payloadDigest: sha256Digest(input.payload),
  };
}

export function buildNeutralEventEnvelope(input: EventBuildInput): NeutralEventEnvelopeV1 {
  return {
    ...input,
    envelopeType: "EVENT",
    contractVersion: NEUTRAL_CONTRACT_VERSION,
    schemaId: "assurerail.neutral-event",
    schemaVersion: NEUTRAL_SCHEMA_VERSION,
    payloadDigest: sha256Digest(input.payload),
  };
}

export function buildNeutralEvidenceEnvelope(input: EvidenceBuildInput): NeutralEvidenceEnvelopeV1 {
  return {
    ...input,
    envelopeType: "EVIDENCE",
    contractVersion: NEUTRAL_CONTRACT_VERSION,
    schemaId: "assurerail.neutral-evidence",
    schemaVersion: NEUTRAL_SCHEMA_VERSION,
  };
}

export function buildNeutralAcknowledgementEnvelope(
  input: AcknowledgementBuildInput,
): NeutralAcknowledgementEnvelopeV1 {
  return {
    ...input,
    envelopeType: "ACKNOWLEDGEMENT",
    contractVersion: NEUTRAL_CONTRACT_VERSION,
    schemaId: "assurerail.neutral-acknowledgement",
    schemaVersion: NEUTRAL_SCHEMA_VERSION,
  };
}

export function absentSignature(status: Exclude<SignatureStatus, "PRESENT">): SignatureProofV1 {
  return {
    status,
    scope: null,
    signedDigest: null,
    algorithm: null,
    keyRef: null,
    signature: null,
    signedAt: null,
  };
}

/** Amount and quantity pair used by route-specific payload profiles without floating-point values. */
export interface ExactValueBundleV1 {
  readonly money: readonly ExactMoney[];
  readonly quantities: readonly ExactUnitQuantity[];
}
