import { assertSha256Digest, canonicalSerialize, sha256Digest } from "./canonical";
import {
  ACKNOWLEDGEMENT_FINALITY,
  ACKNOWLEDGEMENT_STATUSES,
  ENVELOPE_TYPES,
  EVIDENCE_INDEPENDENCE_CLASSES,
  INSTITUTION_KINDS,
  NEUTRAL_CONTRACT_VERSION,
  NEUTRAL_SCHEMA_VERSION,
  QUALIFICATION_SEVERITIES,
  SIGNATURE_SCOPES,
  SIGNATURE_STATUSES,
  type NeutralEnvelopeV1,
  type SignatureProofV1,
} from "./envelopes";
import {
  ASSET_CLASS_TAXONOMY,
  EVIDENCE_RESULT_TAXONOMY,
  FUNCTION_PERFORMER_TAXONOMY,
  LIFECYCLE_LEG_TAXONOMY,
  MARKET_CONTEXT_TAXONOMY,
  OPERATING_MODE_TAXONOMY,
  PLACEMENT_OR_LISTING_TAXONOMY,
  RECONCILIATION_STATE_TAXONOMY,
  REPRESENTATION_TAXONOMY,
  SOURCE_AUTHORITY_TAXONOMY,
  TRANSACTION_ROUTE_TAXONOMY,
  assertTaxonomyValue,
} from "./taxonomy";

export type SchemaFieldKind = "string" | "nullable_string" | "object" | "array";

export interface SchemaFieldV1 {
  readonly presence: "required" | "optional";
  readonly kind: SchemaFieldKind;
  readonly enumValues?: readonly string[];
}

export interface ContractSchemaV1 {
  readonly schemaId: string;
  readonly version: string;
  readonly fields: Readonly<Record<string, SchemaFieldV1>>;
}

export interface SchemaCompatibilityResult {
  readonly compatible: boolean;
  readonly breaking: readonly string[];
}

export interface SchemaValidationResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

const required = (kind: SchemaFieldKind, enumValues?: readonly string[]): SchemaFieldV1 => ({
  presence: "required",
  kind,
  ...(enumValues ? { enumValues } : {}),
});

const BASE_FIELDS: Readonly<Record<string, SchemaFieldV1>> = {
  envelopeId: required("string"),
  envelopeType: required("string", ENVELOPE_TYPES),
  contractVersion: required("string", [NEUTRAL_CONTRACT_VERSION]),
  schemaId: required("string"),
  schemaVersion: required("string", [NEUTRAL_SCHEMA_VERSION]),
  transactionCaseId: required("string"),
  provider: required("object"),
  source: required("object"),
  asOfAt: required("string"),
  expiresAt: required("nullable_string"),
  qualifications: required("array"),
  signature: required("object"),
};

export const NEUTRAL_INTAKE_SCHEMA_V1: ContractSchemaV1 = {
  schemaId: "assurerail.neutral-intake",
  version: NEUTRAL_SCHEMA_VERSION,
  fields: {
    ...BASE_FIELDS,
    idempotencyKey: required("string"),
    receivedAt: required("string"),
    transaction: required("object"),
    payload: required("object"),
    payloadDigest: required("string"),
  },
};

export const NEUTRAL_EVIDENCE_SCHEMA_V1: ContractSchemaV1 = {
  schemaId: "assurerail.neutral-evidence",
  version: NEUTRAL_SCHEMA_VERSION,
  fields: {
    ...BASE_FIELDS,
    evidenceType: required("string"),
    scope: required("object"),
    result: required("string", EVIDENCE_RESULT_TAXONOMY.terms.map((term) => term.code)),
    independence: required("string", EVIDENCE_INDEPENDENCE_CLASSES),
    contentRef: required("nullable_string"),
    contentDigest: required("string"),
  },
};

export const NEUTRAL_ACKNOWLEDGEMENT_SCHEMA_V1: ContractSchemaV1 = {
  schemaId: "assurerail.neutral-acknowledgement",
  version: NEUTRAL_SCHEMA_VERSION,
  fields: {
    ...BASE_FIELDS,
    instructionId: required("string"),
    status: required("string", ACKNOWLEDGEMENT_STATUSES),
    finality: required("string", ACKNOWLEDGEMENT_FINALITY),
    occurredAt: required("string"),
    externalReference: required("nullable_string"),
    reconciliationState: required("string", RECONCILIATION_STATE_TAXONOMY.terms.map((term) => term.code)),
    responseDigest: required("string"),
  },
};

export const NEUTRAL_EVENT_SCHEMA_V1: ContractSchemaV1 = {
  schemaId: "assurerail.neutral-event",
  version: NEUTRAL_SCHEMA_VERSION,
  fields: {
    ...BASE_FIELDS,
    eventType: required("string"),
    occurredAt: required("string"),
    observedAt: required("string"),
    causationId: required("nullable_string"),
    correlationId: required("string"),
    performer: required("object"),
    payload: required("object"),
    payloadDigest: required("string"),
  },
};

export const NEUTRAL_CONTRACT_SCHEMAS_V1 = [
  NEUTRAL_INTAKE_SCHEMA_V1,
  NEUTRAL_EVIDENCE_SCHEMA_V1,
  NEUTRAL_ACKNOWLEDGEMENT_SCHEMA_V1,
  NEUTRAL_EVENT_SCHEMA_V1,
] as const;

function kindOf(value: unknown): SchemaFieldKind | "null" | "other" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return "string";
  if (typeof value === "object") return "object";
  return "other";
}

function nonEmptyString(value: unknown, path: string, issues: string[]): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${path} must be a non-empty string`);
    return false;
  }
  return true;
}

function assertIsoDateOrInstant(value: unknown, path: string, issues: string[], nullable = false): void {
  if (nullable && value === null) return;
  if (!nonEmptyString(value, path, issues)) return;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const instantMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(value);
  const parts = dateMatch ?? instantMatch;
  let validCalendarDate = false;
  if (parts) {
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const calendar = new Date(0);
    calendar.setUTCHours(0, 0, 0, 0);
    calendar.setUTCFullYear(year, month - 1, day);
    validCalendarDate = calendar.getUTCFullYear() === year
      && calendar.getUTCMonth() === month - 1
      && calendar.getUTCDate() === day;
  }
  const validDate = Boolean(dateMatch && validCalendarDate);
  const validInstant = Boolean(
    instantMatch
    && validCalendarDate
    && Number(instantMatch[4]) <= 23
    && Number(instantMatch[5]) <= 59
    && Number(instantMatch[6]) <= 59,
  );
  if (!validDate && !validInstant) issues.push(`${path} must be an ISO date or UTC instant`);
}

function temporalValue(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertNotBefore(later: unknown, earlier: unknown, path: string, referencePath: string, issues: string[]): void {
  const laterValue = temporalValue(later);
  const earlierValue = temporalValue(earlier);
  if (laterValue !== null && earlierValue !== null && laterValue < earlierValue) {
    issues.push(`${path} cannot be before ${referencePath}`);
  }
}

function validateSignature(value: unknown, issues: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const signature = value as Partial<SignatureProofV1>;
  const exactKeys = ["algorithm", "keyRef", "scope", "signature", "signedAt", "signedDigest", "status"];
  for (const key of exactKeys) if (!(key in signature)) issues.push(`$.signature.${key} is required`);
  for (const key of Object.keys(signature)) if (!exactKeys.includes(key)) issues.push(`$.signature.${key} is not in schema v1`);
  if (!SIGNATURE_STATUSES.includes(signature.status as (typeof SIGNATURE_STATUSES)[number])) {
    issues.push("$.signature.status is unknown");
    return;
  }
  if (signature.status === "PRESENT") {
    for (const key of ["algorithm", "keyRef", "signature", "signedAt"] as const) {
      nonEmptyString(signature[key], `$.signature.${key}`, issues);
    }
    if (!SIGNATURE_SCOPES.includes(signature.scope as (typeof SIGNATURE_SCOPES)[number])) issues.push("$.signature.scope is unknown");
    try { assertSha256Digest(signature.signedDigest, "$.signature.signedDigest"); } catch (error) { issues.push((error as Error).message); }
    assertIsoDateOrInstant(signature.signedAt, "$.signature.signedAt", issues);
  } else if ([signature.algorithm, signature.keyRef, signature.scope, signature.signature, signature.signedAt, signature.signedDigest].some((entry) => entry !== null)) {
    issues.push("$.signature absent status requires all signature material fields to be null");
  }
}

function validateSignatureTarget(record: Record<string, unknown>, issues: string[]): void {
  const signature = record.signature as Partial<SignatureProofV1> | undefined;
  if (signature?.status !== "PRESENT") return;
  const sourceDigest = (record.source as Record<string, unknown> | undefined)?.sourcePayloadDigest;
  const targets: Partial<Record<NonNullable<SignatureProofV1["scope"]>, unknown>> = {
    SOURCE_PAYLOAD: sourceDigest,
    INTAKE_PAYLOAD: record.envelopeType === "INTAKE" ? record.payloadDigest : undefined,
    EVIDENCE_CONTENT: record.envelopeType === "EVIDENCE" ? record.contentDigest : undefined,
    ACKNOWLEDGEMENT_RESPONSE: record.envelopeType === "ACKNOWLEDGEMENT" ? record.responseDigest : undefined,
    EVENT_PAYLOAD: record.envelopeType === "EVENT" ? record.payloadDigest : undefined,
  };
  const expected = signature.scope ? targets[signature.scope] : undefined;
  if (expected === undefined) {
    issues.push(`$.signature.scope ${String(signature.scope)} is not valid for ${String(record.envelopeType)} envelopes`);
  } else if (signature.signedDigest !== expected) {
    issues.push("$.signature.signedDigest does not match the digest selected by $.signature.scope");
  }
}

function validateProvider(value: unknown, issues: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const provider = value as Record<string, unknown>;
  const keys = ["institutionRef", "kind", "jurisdiction", "identifiers"];
  for (const key of keys) {
    if (!(key in provider)) issues.push(`$.provider.${key} is required`);
  }
  for (const key of Object.keys(provider)) if (!keys.includes(key)) issues.push(`$.provider.${key} is not in schema v1`);
  nonEmptyString(provider.institutionRef, "$.provider.institutionRef", issues);
  nonEmptyString(provider.jurisdiction, "$.provider.jurisdiction", issues);
  if (!INSTITUTION_KINDS.includes(provider.kind as (typeof INSTITUTION_KINDS)[number])) issues.push("$.provider.kind is unknown");
  if (!Array.isArray(provider.identifiers)) {
    issues.push("$.provider.identifiers must be an array");
  } else {
    provider.identifiers.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        issues.push(`$.provider.identifiers[${index}] must be an object`);
        return;
      }
      const identifier = entry as Record<string, unknown>;
      for (const key of ["scheme", "value"]) if (!(key in identifier)) issues.push(`$.provider.identifiers[${index}].${key} is required`);
      for (const key of Object.keys(identifier)) if (key !== "scheme" && key !== "value") issues.push(`$.provider.identifiers[${index}].${key} is not in schema v1`);
      nonEmptyString(identifier.scheme, `$.provider.identifiers[${index}].scheme`, issues);
      nonEmptyString(identifier.value, `$.provider.identifiers[${index}].value`, issues);
    });
  }
}

function validateSource(value: unknown, providerRef: unknown, issues: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const source = value as Record<string, unknown>;
  const keys = ["providerInstitutionRef", "sourceSystemRef", "sourceObjectType", "sourceObjectRef", "sourceSchemaId", "sourceSchemaVersion", "sourcePayloadDigest", "authorityClass"];
  for (const key of keys) {
    if (!(key in source)) issues.push(`$.source.${key} is required`);
  }
  for (const key of Object.keys(source)) if (!keys.includes(key)) issues.push(`$.source.${key} is not in schema v1`);
  for (const key of ["providerInstitutionRef", "sourceSystemRef", "sourceObjectType", "sourceObjectRef", "sourceSchemaId", "sourceSchemaVersion"]) {
    nonEmptyString(source[key], `$.source.${key}`, issues);
  }
  if (source.providerInstitutionRef !== providerRef) issues.push("$.source.providerInstitutionRef must match $.provider.institutionRef");
  try { assertSha256Digest(source.sourcePayloadDigest, "$.source.sourcePayloadDigest"); } catch (error) { issues.push((error as Error).message); }
  try { assertTaxonomyValue(SOURCE_AUTHORITY_TAXONOMY, source.authorityClass, "$.source.authorityClass"); } catch (error) { issues.push((error as Error).message); }
}

function validateQualifications(value: unknown, issues: string[]): void {
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push(`$.qualifications[${index}] must be an object`);
      return;
    }
    const row = entry as Record<string, unknown>;
    const keys = ["code", "severity", "text", "evidenceRef"];
    for (const key of keys) if (!(key in row)) issues.push(`$.qualifications[${index}].${key} is required`);
    for (const key of Object.keys(row)) if (!keys.includes(key)) issues.push(`$.qualifications[${index}].${key} is not in schema v1`);
    nonEmptyString(row.code, `$.qualifications[${index}].code`, issues);
    nonEmptyString(row.text, `$.qualifications[${index}].text`, issues);
    if (!QUALIFICATION_SEVERITIES.includes(row.severity as (typeof QUALIFICATION_SEVERITIES)[number])) issues.push(`$.qualifications[${index}].severity is unknown`);
    if (row.evidenceRef !== null && typeof row.evidenceRef !== "string") issues.push(`$.qualifications[${index}].evidenceRef must be string or null`);
  });
}

function validateTransaction(value: unknown, issues: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const transaction = value as Record<string, unknown>;
  const transactionKeys = ["transactionRoute", "representation", "jurisdiction", "marketContext", "placementOrListing", "lifecycleLeg", "assetClass", "operatingMode", "extensionProfileRef", "routePack", "legalRecord"];
  for (const key of transactionKeys) if (!(key in transaction)) issues.push(`$.transaction.${key} is required`);
  for (const key of Object.keys(transaction)) if (!transactionKeys.includes(key)) issues.push(`$.transaction.${key} is not in schema v1`);
  const checks = [
    [TRANSACTION_ROUTE_TAXONOMY, transaction.transactionRoute, "$.transaction.transactionRoute"],
    [REPRESENTATION_TAXONOMY, transaction.representation, "$.transaction.representation"],
    [MARKET_CONTEXT_TAXONOMY, transaction.marketContext, "$.transaction.marketContext"],
    [PLACEMENT_OR_LISTING_TAXONOMY, transaction.placementOrListing, "$.transaction.placementOrListing"],
    [LIFECYCLE_LEG_TAXONOMY, transaction.lifecycleLeg, "$.transaction.lifecycleLeg"],
    [ASSET_CLASS_TAXONOMY, transaction.assetClass, "$.transaction.assetClass"],
    [OPERATING_MODE_TAXONOMY, transaction.operatingMode, "$.transaction.operatingMode"],
  ] as const;
  for (const [taxonomy, candidate, path] of checks) {
    try { assertTaxonomyValue(taxonomy, candidate, path); } catch (error) { issues.push((error as Error).message); }
  }
  nonEmptyString(transaction.jurisdiction, "$.transaction.jurisdiction", issues);
  const usesExtension = transaction.marketContext === "OTHER_APPROVED"
    || transaction.placementOrListing === "OTHER_APPROVED"
    || transaction.assetClass === "OTHER_APPROVED_EXPOSURE";
  if (usesExtension) nonEmptyString(transaction.extensionProfileRef, "$.transaction.extensionProfileRef", issues);
  else if (transaction.extensionProfileRef !== null && typeof transaction.extensionProfileRef !== "string") {
    issues.push("$.transaction.extensionProfileRef must be string or null");
  }
  if (!transaction.routePack || typeof transaction.routePack !== "object" || Array.isArray(transaction.routePack)) {
    issues.push("$.transaction.routePack is required");
  } else {
    const routePack = transaction.routePack as Record<string, unknown>;
    const keys = ["routePackId", "version", "status", "effectiveAt"];
    for (const key of keys) if (!(key in routePack)) issues.push(`$.transaction.routePack.${key} is required`);
    for (const key of Object.keys(routePack)) if (!keys.includes(key)) issues.push(`$.transaction.routePack.${key} is not in schema v1`);
    nonEmptyString(routePack.routePackId, "$.transaction.routePack.routePackId", issues);
    nonEmptyString(routePack.version, "$.transaction.routePack.version", issues);
    if (routePack.status !== "REVIEW_PENDING" && routePack.status !== "APPROVED") issues.push("$.transaction.routePack.status is unknown");
    assertIsoDateOrInstant(routePack.effectiveAt, "$.transaction.routePack.effectiveAt", issues, true);
    if (routePack.status === "APPROVED" && routePack.effectiveAt === null) {
      issues.push("$.transaction.routePack.effectiveAt is required when status is APPROVED");
    }
  }
  if (!transaction.legalRecord || typeof transaction.legalRecord !== "object" || Array.isArray(transaction.legalRecord)) {
    issues.push("$.transaction.legalRecord is required");
  } else {
    const legalRecord = transaction.legalRecord as Record<string, unknown>;
    const keys = ["status", "recordType", "recordkeeperInstitutionRef", "designationEvidenceRef"];
    for (const key of keys) if (!(key in legalRecord)) issues.push(`$.transaction.legalRecord.${key} is required`);
    for (const key of Object.keys(legalRecord)) if (!keys.includes(key)) issues.push(`$.transaction.legalRecord.${key} is not in schema v1`);
    if (legalRecord.status !== "DECLARED" && legalRecord.status !== "UNDECLARED") issues.push("$.transaction.legalRecord.status is unknown");
    if (legalRecord.status === "DECLARED") {
      for (const key of ["recordType", "recordkeeperInstitutionRef", "designationEvidenceRef"]) nonEmptyString(legalRecord[key], `$.transaction.legalRecord.${key}`, issues);
    } else if ([legalRecord.recordType, legalRecord.recordkeeperInstitutionRef, legalRecord.designationEvidenceRef].some((entry) => entry !== null)) {
      issues.push("$.transaction.legalRecord UNDECLARED status requires all declaration fields to be null");
    }
  }
}

function validateEnvelopeSemantics(record: Record<string, unknown>, issues: string[]): void {
  for (const key of ["envelopeId", "transactionCaseId", "schemaId", "schemaVersion", "contractVersion"]) {
    nonEmptyString(record[key], `$.${key}`, issues);
  }
  validateProvider(record.provider, issues);
  validateSource(record.source, (record.provider as Record<string, unknown> | undefined)?.institutionRef, issues);
  validateSignature(record.signature, issues);
  validateSignatureTarget(record, issues);
  validateQualifications(record.qualifications, issues);
  assertIsoDateOrInstant(record.asOfAt, "$.asOfAt", issues);
  assertIsoDateOrInstant(record.expiresAt, "$.expiresAt", issues, true);
  if (record.expiresAt !== null) assertNotBefore(record.expiresAt, record.asOfAt, "$.expiresAt", "$.asOfAt", issues);

  if (record.envelopeType === "INTAKE") {
    if (record.schemaId !== NEUTRAL_INTAKE_SCHEMA_V1.schemaId) issues.push("$.schemaId does not match INTAKE envelopeType");
    nonEmptyString(record.idempotencyKey, "$.idempotencyKey", issues);
    validateTransaction(record.transaction, issues);
    assertIsoDateOrInstant(record.receivedAt, "$.receivedAt", issues);
    try { assertSha256Digest(record.payloadDigest, "$.payloadDigest"); } catch (error) { issues.push((error as Error).message); }
    if (record.payload && typeof record.payload === "object") {
      try {
        if (sha256Digest(record.payload) !== record.payloadDigest) issues.push("$.payloadDigest does not match canonical payload bytes");
      } catch (error) { issues.push(`$.payload is not canonical: ${(error as Error).message}`); }
    }
  } else if (record.envelopeType === "EVIDENCE") {
    if (record.schemaId !== NEUTRAL_EVIDENCE_SCHEMA_V1.schemaId) issues.push("$.schemaId does not match EVIDENCE envelopeType");
    nonEmptyString(record.evidenceType, "$.evidenceType", issues);
    try { assertTaxonomyValue(EVIDENCE_RESULT_TAXONOMY, record.result, "$.result"); } catch (error) { issues.push((error as Error).message); }
    try { assertSha256Digest(record.contentDigest, "$.contentDigest"); } catch (error) { issues.push((error as Error).message); }
    if (record.contentRef !== null) nonEmptyString(record.contentRef, "$.contentRef", issues);
    if (!record.scope || typeof record.scope !== "object" || Array.isArray(record.scope)) {
      issues.push("$.scope must be an object");
    } else {
      const scope = record.scope as Record<string, unknown>;
      const keys = ["subjectRefs", "claimCodes", "fromAt", "toAt"];
      for (const key of keys) if (!(key in scope)) issues.push(`$.scope.${key} is required`);
      for (const key of Object.keys(scope)) if (!keys.includes(key)) issues.push(`$.scope.${key} is not in schema v1`);
      for (const arrayKey of ["subjectRefs", "claimCodes"] as const) {
        if (!Array.isArray(scope[arrayKey]) || scope[arrayKey].length === 0) {
          issues.push(`$.scope.${arrayKey} must be a non-empty array`);
        } else {
          scope[arrayKey].forEach((entry, index) => nonEmptyString(entry, `$.scope.${arrayKey}[${index}]`, issues));
        }
      }
      assertIsoDateOrInstant(scope.fromAt, "$.scope.fromAt", issues, true);
      assertIsoDateOrInstant(scope.toAt, "$.scope.toAt", issues, true);
      if (scope.fromAt !== null && scope.toAt !== null) assertNotBefore(scope.toAt, scope.fromAt, "$.scope.toAt", "$.scope.fromAt", issues);
    }
    if (record.result === "PARTIALLY_VERIFIED" && Array.isArray(record.qualifications) && record.qualifications.length === 0) {
      issues.push("$.qualifications must explain PARTIALLY_VERIFIED evidence");
    }
  } else if (record.envelopeType === "ACKNOWLEDGEMENT") {
    if (record.schemaId !== NEUTRAL_ACKNOWLEDGEMENT_SCHEMA_V1.schemaId) issues.push("$.schemaId does not match ACKNOWLEDGEMENT envelopeType");
    nonEmptyString(record.instructionId, "$.instructionId", issues);
    try { assertTaxonomyValue(RECONCILIATION_STATE_TAXONOMY, record.reconciliationState, "$.reconciliationState"); } catch (error) { issues.push((error as Error).message); }
    try { assertSha256Digest(record.responseDigest, "$.responseDigest"); } catch (error) { issues.push((error as Error).message); }
    assertIsoDateOrInstant(record.occurredAt, "$.occurredAt", issues);
    if (record.externalReference !== null) nonEmptyString(record.externalReference, "$.externalReference", issues);
    if (record.status === "FINALISED" && record.finality !== "FINAL") issues.push("$.finality must be FINAL when status is FINALISED");
  } else if (record.envelopeType === "EVENT") {
    if (record.schemaId !== NEUTRAL_EVENT_SCHEMA_V1.schemaId) issues.push("$.schemaId does not match EVENT envelopeType");
    const performer = record.performer as Record<string, unknown> | undefined;
    try { assertTaxonomyValue(FUNCTION_PERFORMER_TAXONOMY, performer?.performer, "$.performer.performer"); } catch (error) { issues.push((error as Error).message); }
    nonEmptyString(record.eventType, "$.eventType", issues);
    nonEmptyString(record.correlationId, "$.correlationId", issues);
    if (!performer || typeof performer !== "object" || Array.isArray(performer)) {
      issues.push("$.performer must be an object");
    } else {
      const keys = ["performer", "institutionRef", "actorRef", "authorityEvidenceRef"];
      for (const key of keys) if (!(key in performer)) issues.push(`$.performer.${key} is required`);
      for (const key of Object.keys(performer)) if (!keys.includes(key)) issues.push(`$.performer.${key} is not in schema v1`);
      if (performer.performer === "PROHIBITED") issues.push("$.performer.performer cannot be PROHIBITED for an emitted event");
      for (const key of ["institutionRef", "actorRef", "authorityEvidenceRef"] as const) {
        if (performer[key] !== null) nonEmptyString(performer[key], `$.performer.${key}`, issues);
      }
    }
    assertIsoDateOrInstant(record.occurredAt, "$.occurredAt", issues);
    assertIsoDateOrInstant(record.observedAt, "$.observedAt", issues);
    assertNotBefore(record.observedAt, record.occurredAt, "$.observedAt", "$.occurredAt", issues);
    try { assertSha256Digest(record.payloadDigest, "$.payloadDigest"); } catch (error) { issues.push((error as Error).message); }
    if (record.payload && typeof record.payload === "object") {
      try {
        if (sha256Digest(record.payload) !== record.payloadDigest) issues.push("$.payloadDigest does not match canonical payload bytes");
      } catch (error) { issues.push(`$.payload is not canonical: ${(error as Error).message}`); }
    }
  }
}

export function checkSchemaCompatibility(previous: ContractSchemaV1, next: ContractSchemaV1): SchemaCompatibilityResult {
  const breaking: string[] = [];
  if (previous.schemaId !== next.schemaId) breaking.push(`schema id changed from ${previous.schemaId} to ${next.schemaId}`);
  for (const [name, prior] of Object.entries(previous.fields)) {
    const candidate = next.fields[name];
    if (!candidate) {
      breaking.push(`removed field '${name}'`);
      continue;
    }
    if (prior.kind !== candidate.kind) breaking.push(`field '${name}' changed kind ${prior.kind}->${candidate.kind}`);
    if (prior.presence === "optional" && candidate.presence === "required") breaking.push(`field '${name}' optional->required`);
    if (prior.enumValues) {
      const removed = prior.enumValues.filter((value) => !candidate.enumValues?.includes(value));
      if (removed.length) breaking.push(`field '${name}' removed enum value(s): ${removed.join(", ")}`);
    }
  }
  for (const [name, candidate] of Object.entries(next.fields)) {
    if (!(name in previous.fields) && candidate.presence === "required") breaking.push(`added required field '${name}'`);
  }
  return { compatible: breaking.length === 0, breaking };
}

export class ContractSchemaRegistry {
  private readonly schemas = new Map<string, ContractSchemaV1>();

  register(schema: ContractSchemaV1): void {
    const key = `${schema.schemaId}@${schema.version}`;
    if (this.schemas.has(key)) throw new Error(`schema already registered: ${key}`);
    this.schemas.set(key, schema);
  }

  get(schemaId: string, version: string): ContractSchemaV1 {
    const schema = this.schemas.get(`${schemaId}@${version}`);
    if (!schema) throw new Error(`unknown schema ${schemaId}@${version}`);
    return schema;
  }

  validate(value: unknown): SchemaValidationResult {
    const issues: string[] = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, issues: ["$ must be an object"] };
    const record = value as Record<string, unknown>;
    if (!("schemaId" in record)) issues.push("$.schemaId is required");
    if (!("schemaVersion" in record)) issues.push("$.schemaVersion is required");
    if (!nonEmptyString(record.schemaId, "$.schemaId", issues) || !nonEmptyString(record.schemaVersion, "$.schemaVersion", issues)) {
      return { ok: false, issues };
    }
    let schema: ContractSchemaV1;
    try { schema = this.get(record.schemaId, record.schemaVersion); } catch (error) { return { ok: false, issues: [...issues, (error as Error).message] }; }
    for (const [name, field] of Object.entries(schema.fields)) {
      if (!(name in record)) {
        if (field.presence === "required") issues.push(`$.${name} is required`);
        continue;
      }
      const actual = kindOf(record[name]);
      const kindMatches = field.kind === "nullable_string" ? actual === "string" || actual === "null" : actual === field.kind;
      if (!kindMatches) issues.push(`$.${name} must be ${field.kind}`);
      if (field.enumValues && typeof record[name] === "string" && !field.enumValues.includes(record[name] as string)) issues.push(`$.${name} is unknown`);
    }
    for (const name of Object.keys(record)) if (!(name in schema.fields)) issues.push(`$.${name} is not in ${schema.schemaId}@${schema.version}`);
    validateEnvelopeSemantics(record, issues);
    try { canonicalSerialize(record); } catch (error) { issues.push(`$ is not canonicalizable: ${(error as Error).message}`); }
    return { ok: issues.length === 0, issues };
  }
}

export function createNeutralContractRegistryV1(): ContractSchemaRegistry {
  const registry = new ContractSchemaRegistry();
  for (const schema of NEUTRAL_CONTRACT_SCHEMAS_V1) registry.register(schema);
  return registry;
}

export function assertValidNeutralEnvelopeV1(value: unknown): asserts value is NeutralEnvelopeV1 {
  const result = createNeutralContractRegistryV1().validate(value);
  if (!result.ok) throw new Error(`invalid neutral envelope v1:\n- ${result.issues.join("\n- ")}`);
}
