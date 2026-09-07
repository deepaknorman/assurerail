import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash, createPublicKey, verify } from "node:crypto";
import {
  assertValidNeutralEnvelopeV1,
  buildNeutralIntakeEnvelope,
  sha256Digest,
  toCanonicalValue,
  type NeutralIntakeEnvelopeV1,
  type QualificationV1,
  type TransactionDiscriminatorV1,
} from "../contracts/v1";

export const ASSURELENS_PROFILE = "assurelens.monitoring-evidence.v1" as const;
const PROVIDER_ENVELOPE = "assurelens.provider-envelope.v1";
const RESULTS = new Set(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "FAILED", "EXPIRED", "REVIEW_REQUIRED"]);
const MODES = new Set(["REPLAY", "SHADOW", "PRODUCTION"]);
const SEVERITIES = new Set(["INFO", "WARNING", "HIGH", "CRITICAL"]);
const OUTCOMES = new Set(["PASS", "FAIL", "UNKNOWN"]);
const QUALIFICATION_SEVERITIES = new Set(["INFORMATION", "LIMITATION", "EXCEPTION", "REVIEW_REQUIRED"]);
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const RAW_IDENTIFIER_KEYS = /^(identifiers?|pan|gstin|cin|llpin|udyam|lei|taxId|borrowerId|customerId|externalEntityRef|entityRef)$/i;
const PAN = /(?:^|[^A-Z0-9])[A-Z]{5}[0-9]{4}[A-Z](?:$|[^A-Z0-9])/;
const GSTIN = /(?:^|[^A-Z0-9])[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z](?:$|[^A-Z0-9])/;
const CIN = /(?:^|[^A-Z0-9])[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}(?:$|[^A-Z0-9])/;
const LLPIN = /(?:^|[^A-Z0-9])(?:[A-Z]{3}-[0-9]{4}|[A-Z]{2,3}-[0-9]{5})(?:$|[^A-Z0-9])/;
const UDYAM = /(?:^|[^A-Z0-9])UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}(?:$|[^A-Z0-9])/;
const LEI = /(?:^|[^A-Z0-9])[A-Z0-9]{18}[0-9]{2}(?:$|[^A-Z0-9])/;
const DID = /(?:^|\s)did:[a-z0-9]+:[^\s]+(?:$|\s)/i;
const CONFIDENCE = new Set(["HIGH", "MEDIUM", "LOW"]);

type JsonObject = Record<string, unknown>;
type Result = "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "FAILED" | "EXPIRED" | "REVIEW_REQUIRED";

interface TrustedKey { providerId: string; keyId: string; publicKeyPem: string }
interface ParsedQualification { code: string; severity: QualificationV1["severity"]; text: string }
interface ParsedMonitoringPackage {
  packageVersion: typeof ASSURELENS_PROFILE;
  packageId: string;
  providerId: string;
  providerBookRef: string;
  evaluationRunRef: string;
  operatingMode: "REPLAY" | "SHADOW" | "PRODUCTION";
  engineVersion: string;
  asOfAt: string;
  issuedAt: string;
  expiresAt: string;
  inputDigest: string;
  result: Result;
  coverage: { suppliedEntityCount: number; evaluatedEntityCount: number; unresolvedEntityCount: number; staleEntityCount: number; unavailableSourceFamilies: string[]; coverageBps: number };
  findings: Array<{ findingRef: string; subjectRef: string; metric: string; severity: string; outcome: string; observedAt: string; explanation: JsonObject; evidenceRefs: string[] }>;
  qualifications: ParsedQualification[];
  boundary: { completeIndebtednessClaim: false; creditDecision: false; automaticTransactionRestriction: false; lenderDecisionRequired: true };
}
interface ParsedProviderEnvelope {
  envelopeVersion: typeof PROVIDER_ENVELOPE;
  providerId: string;
  algorithm: "Ed25519";
  keyId: string;
  payloadDigest: string;
  signature: string;
  payload: ParsedMonitoringPackage;
}

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException(`${field} must be an object`);
  return value as JsonObject;
}
function string(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required`);
  const out = value.trim();
  if (out.length > max) throw new BadRequestException(`${field} exceeds ${max} characters`);
  return out;
}
function timestamp(value: unknown, field: string): string {
  const out = string(value, field, 80);
  const parsed = new Date(out);
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${field} must be ISO-8601`);
  return parsed.toISOString();
}
function integer(value: unknown, field: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new BadRequestException(`${field} must be an integer from ${min} to ${max}`);
  }
  return value as number;
}
function stringArray(value: unknown, field: string, max = 1000): string[] {
  if (!Array.isArray(value) || value.length > max) throw new BadRequestException(`${field} must be a bounded array`);
  return value.map((entry, index) => string(entry, `${field}[${index}]`, 500));
}
function signingInput(providerId: string, keyId: string, payloadDigest: string): string {
  return [PROVIDER_ENVELOPE, providerId, keyId, payloadDigest].join("\n");
}
function assertNoRawIdentifiers(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) return value.forEach((entry, index) => assertNoRawIdentifiers(entry, `${path}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as JsonObject)) {
      if (RAW_IDENTIFIER_KEYS.test(key)) throw new BadRequestException(`${path}.${key} is not permitted in provider monitoring output`);
      assertNoRawIdentifiers(nested, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (PAN.test(normalized) || GSTIN.test(normalized) || CIN.test(normalized) || LLPIN.test(normalized)
      || UDYAM.test(normalized) || LEI.test(normalized) || DID.test(normalized)) {
      throw new BadRequestException(`${path} appears to contain a raw entity identifier`);
    }
  }
}

function parseCoverage(value: unknown): ParsedMonitoringPackage["coverage"] {
  const row = object(value, "payload.coverage");
  const suppliedEntityCount = integer(row.suppliedEntityCount, "payload.coverage.suppliedEntityCount", 0, 10_000_000);
  const evaluatedEntityCount = integer(row.evaluatedEntityCount, "payload.coverage.evaluatedEntityCount", 0, suppliedEntityCount);
  const unresolvedEntityCount = integer(row.unresolvedEntityCount, "payload.coverage.unresolvedEntityCount", 0, suppliedEntityCount);
  const staleEntityCount = integer(row.staleEntityCount, "payload.coverage.staleEntityCount", 0, evaluatedEntityCount);
  const coverageBps = integer(row.coverageBps, "payload.coverage.coverageBps", 0, 10_000);
  if (unresolvedEntityCount !== suppliedEntityCount - evaluatedEntityCount) throw new BadRequestException("coverage unresolved count is inconsistent");
  const expectedBps = suppliedEntityCount ? Math.floor(evaluatedEntityCount * 10_000 / suppliedEntityCount) : 0;
  if (coverageBps !== expectedBps) throw new BadRequestException("coverageBps is inconsistent with supplied/evaluated counts");
  return { suppliedEntityCount, evaluatedEntityCount, unresolvedEntityCount, staleEntityCount, unavailableSourceFamilies: stringArray(row.unavailableSourceFamilies, "payload.coverage.unavailableSourceFamilies", 100), coverageBps };
}

function parsePackage(value: unknown): ParsedMonitoringPackage {
  const row = object(value, "payload");
  if (row.packageVersion !== ASSURELENS_PROFILE) throw new BadRequestException("unsupported AssureLens monitoring package version");
  const result = string(row.result, "payload.result", 40) as Result;
  const operatingMode = string(row.operatingMode, "payload.operatingMode", 40) as ParsedMonitoringPackage["operatingMode"];
  if (!RESULTS.has(result)) throw new BadRequestException("payload.result is unsupported");
  if (!MODES.has(operatingMode)) throw new BadRequestException("payload.operatingMode is unsupported");
  const boundaryRow = object(row.boundary, "payload.boundary");
  if (boundaryRow.completeIndebtednessClaim !== false || boundaryRow.creditDecision !== false
    || boundaryRow.automaticTransactionRestriction !== false || boundaryRow.lenderDecisionRequired !== true) {
    throw new BadRequestException("provider boundary does not preserve lender decision authority");
  }
  const coverage = parseCoverage(row.coverage);
  const findings = Array.isArray(row.findings) ? row.findings.map((value, index) => {
    const finding = object(value, `payload.findings[${index}]`);
    const severity = string(finding.severity, `payload.findings[${index}].severity`, 40);
    const outcome = string(finding.outcome, `payload.findings[${index}].outcome`, 40);
    if (!SEVERITIES.has(severity) || !OUTCOMES.has(outcome)) throw new BadRequestException(`payload.findings[${index}] classification is unsupported`);
    const explanationRow = object(finding.explanation, `payload.findings[${index}].explanation`);
    const confidence = string(explanationRow.confidence, `payload.findings[${index}].explanation.confidence`, 20);
    if (!CONFIDENCE.has(confidence)) throw new BadRequestException(`payload.findings[${index}].explanation.confidence is unsupported`);
    const explanation = {
      confidence,
      sources: stringArray(explanationRow.sources, `payload.findings[${index}].explanation.sources`, 50),
      triggeringEvents: stringArray(explanationRow.triggeringEvents, `payload.findings[${index}].explanation.triggeringEvents`, 100),
      limitations: stringArray(explanationRow.limitations, `payload.findings[${index}].explanation.limitations`, 100),
    };
    return {
      findingRef: string(finding.findingRef, `payload.findings[${index}].findingRef`, 200),
      subjectRef: string(finding.subjectRef, `payload.findings[${index}].subjectRef`, 200),
      metric: string(finding.metric, `payload.findings[${index}].metric`, 120), severity, outcome,
      observedAt: timestamp(finding.observedAt, `payload.findings[${index}].observedAt`), explanation,
      evidenceRefs: stringArray(finding.evidenceRefs, `payload.findings[${index}].evidenceRefs`, 100),
    };
  }) : (() => { throw new BadRequestException("payload.findings must be an array"); })();
  const qualifications = Array.isArray(row.qualifications) ? row.qualifications.map((value, index) => {
    const qualification = object(value, `payload.qualifications[${index}]`);
    const severity = string(qualification.severity, `payload.qualifications[${index}].severity`, 40) as QualificationV1["severity"];
    if (!QUALIFICATION_SEVERITIES.has(severity)) throw new BadRequestException(`payload.qualifications[${index}].severity is unsupported`);
    return { code: string(qualification.code, `payload.qualifications[${index}].code`, 120), severity, text: string(qualification.text, `payload.qualifications[${index}].text`, 2000) };
  }) : (() => { throw new BadRequestException("payload.qualifications must be an array"); })();
  const asOfAt = timestamp(row.asOfAt, "payload.asOfAt");
  const issuedAt = timestamp(row.issuedAt, "payload.issuedAt");
  const expiresAt = timestamp(row.expiresAt, "payload.expiresAt");
  if (new Date(asOfAt) > new Date(issuedAt)) throw new BadRequestException("payload.asOfAt must not be after issuedAt");
  if (new Date(expiresAt) <= new Date(issuedAt)) throw new BadRequestException("payload.expiresAt must be after issuedAt");
  if (new Date(expiresAt) <= new Date()) throw new BadRequestException("AssureLens monitoring package has expired");
  if (!SHA256.test(String(row.inputDigest ?? ""))) throw new BadRequestException("payload.inputDigest is invalid");
  if (result === "VERIFIED" && (coverage.coverageBps !== 10_000 || coverage.staleEntityCount !== 0 || findings.some((finding) => finding.outcome !== "PASS"))) {
    throw new BadRequestException("VERIFIED is incompatible with incomplete, stale or adverse monitoring evidence");
  }
  const parsed: ParsedMonitoringPackage = {
    packageVersion: ASSURELENS_PROFILE,
    packageId: string(row.packageId, "payload.packageId", 200), providerId: string(row.providerId, "payload.providerId", 200),
    providerBookRef: string(row.providerBookRef, "payload.providerBookRef", 300), evaluationRunRef: string(row.evaluationRunRef, "payload.evaluationRunRef", 200),
    operatingMode, engineVersion: string(row.engineVersion, "payload.engineVersion", 120), asOfAt, issuedAt, expiresAt,
    inputDigest: String(row.inputDigest), result, coverage, findings, qualifications,
    boundary: { completeIndebtednessClaim: false, creditDecision: false, automaticTransactionRestriction: false, lenderDecisionRequired: true },
  };
  assertNoRawIdentifiers(parsed);
  return parsed;
}

function trustedKeys(env: NodeJS.ProcessEnv): TrustedKey[] {
  const raw = env.ARAIL_ASSURELENS_TRUSTED_KEYS_JSON?.trim();
  if (!raw) throw new ServiceUnavailableException("AssureLens trusted provider keys are not configured");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new ServiceUnavailableException("AssureLens trusted provider keys JSON is invalid"); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) throw new ServiceUnavailableException("AssureLens trusted provider keys must contain 1 to 20 entries");
  const keys = parsed.map((entry, index) => {
    const row = object(entry, `trustedKeys[${index}]`);
    return { providerId: string(row.providerId, `trustedKeys[${index}].providerId`, 200), keyId: string(row.keyId, `trustedKeys[${index}].keyId`, 80), publicKeyPem: string(row.publicKeyPem, `trustedKeys[${index}].publicKeyPem`, 5000).replace(/\\n/g, "\n") };
  });
  if (new Set(keys.map((key) => `${key.providerId}|${key.keyId}`)).size !== keys.length) throw new ServiceUnavailableException("AssureLens trusted provider key entries must be unique");
  return keys;
}

@Injectable()
export class AssureLensMonitoringService {
  verifyAndMap(input: {
    institutionId: string;
    transactionCaseId: string;
    transaction: TransactionDiscriminatorV1;
    providerEnvelope: unknown;
    receivedAt?: Date;
  }, env: NodeJS.ProcessEnv = process.env): { envelope: NeutralIntakeEnvelopeV1; providerResult: Result } {
    string(input.institutionId, "institutionId", 200);
    const outer = object(input.providerEnvelope, "providerEnvelope");
    if (outer.envelopeVersion !== PROVIDER_ENVELOPE || outer.algorithm !== "Ed25519") throw new BadRequestException("unsupported AssureLens provider envelope or algorithm");
    if (outer.status !== undefined && outer.status !== "ACTIVE") throw new BadRequestException("AssureLens provider envelope is not active");
    const providerId = string(outer.providerId, "providerEnvelope.providerId", 200);
    const keyId = string(outer.keyId, "providerEnvelope.keyId", 80);
    const payloadDigest = string(outer.payloadDigest, "providerEnvelope.payloadDigest", 80);
    if (!SHA256.test(payloadDigest)) throw new BadRequestException("providerEnvelope.payloadDigest is invalid");
    const signature = string(outer.signature, "providerEnvelope.signature", 1000);
    const payload = parsePackage(outer.payload);
    if (payload.providerId !== providerId) throw new BadRequestException("provider identity differs between envelope and payload");
    const calculated = sha256Digest(payload);
    if (calculated !== payloadDigest) throw new BadRequestException("provider payload digest mismatch");
    const trusted = trustedKeys(env).find((key) => key.providerId === providerId && key.keyId === keyId);
    if (!trusted) throw new BadRequestException("provider signing key is not trusted");
    let publicKey;
    try {
      publicKey = createPublicKey(trusted.publicKeyPem);
      if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("key is not Ed25519");
      const fingerprint = createHash("sha256").update(publicKey.export({ format: "der", type: "spki" })).digest("hex").slice(0, 32);
      if (fingerprint !== keyId) throw new Error("keyId does not match the Ed25519 public-key fingerprint");
    } catch (error) { throw new ServiceUnavailableException(`trusted AssureLens public key is invalid: ${(error as Error).message}`); }
    let signatureBytes: Buffer;
    if (!/^[A-Za-z0-9_-]+$/.test(signature)) throw new BadRequestException("provider signature is not base64url");
    try { signatureBytes = Buffer.from(signature, "base64url"); } catch { throw new BadRequestException("provider signature is not base64url"); }
    if (signatureBytes.length !== 64 || !verify(null, Buffer.from(signingInput(providerId, keyId, payloadDigest)), publicKey, signatureBytes)) {
      throw new BadRequestException("AssureLens provider signature verification failed");
    }
    const receivedAt = (input.receivedAt ?? new Date()).toISOString();
    const qualifications: QualificationV1[] = payload.qualifications.map((entry) => ({ ...entry, evidenceRef: null }));
    qualifications.push({ code: "PROVIDER_RESULT_REQUIRES_RAIL_REVIEW", severity: "REVIEW_REQUIRED", text: `Provider result ${payload.result} is retained as evidence and does not determine a Rail transaction outcome.`, evidenceRef: null });
    const normalized = toCanonicalValue({
      packageId: payload.packageId, payloadDigest, providerBookRef: payload.providerBookRef,
      evaluationRunRef: payload.evaluationRunRef, operatingMode: payload.operatingMode,
      engineVersion: payload.engineVersion, result: payload.result, coverage: payload.coverage,
      findings: payload.findings, boundary: payload.boundary,
    });
    const envelope = buildNeutralIntakeEnvelope({
      envelopeId: `lens:${providerId}:${payload.packageId}`,
      transactionCaseId: string(input.transactionCaseId, "transactionCaseId", 200),
      provider: { institutionRef: `provider:${providerId}`, kind: "SERVICE_PROVIDER", jurisdiction: "IND", identifiers: [{ scheme: "PROVIDER_ID", value: providerId }] },
      source: {
        providerInstitutionRef: `provider:${providerId}`, sourceSystemRef: providerId,
        sourceObjectType: "MONITORING_EVIDENCE", sourceObjectRef: payload.packageId,
        sourceSchemaId: ASSURELENS_PROFILE, sourceSchemaVersion: "1.0.0",
        sourcePayloadDigest: calculated, authorityClass: "EVIDENTIARY",
      },
      asOfAt: payload.asOfAt, expiresAt: payload.expiresAt, qualifications,
      signature: { status: "PRESENT", scope: "SOURCE_PAYLOAD", signedDigest: calculated, algorithm: "Ed25519", keyRef: `${providerId}#${keyId}`, signature, signedAt: payload.issuedAt },
      idempotencyKey: `assurelens:${providerId}:${payload.packageId}:${payloadDigest}`,
      receivedAt, transaction: input.transaction,
      payload: toCanonicalValue({ normalized, extensions: { profileId: ASSURELENS_PROFILE } }) as never,
    });
    assertValidNeutralEnvelopeV1(envelope);
    return { envelope, providerResult: payload.result };
  }
}
