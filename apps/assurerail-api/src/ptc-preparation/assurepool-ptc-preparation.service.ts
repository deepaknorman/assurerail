import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash, createPublicKey, verify } from "node:crypto";
import {
  assertValidNeutralEnvelopeV1,
  buildNeutralIntakeEnvelope,
  sha256Digest,
  toCanonicalValue,
  type CanonicalObject,
  type NeutralIntakeEnvelopeV1,
  type QualificationV1,
  type TransactionDiscriminatorV1,
} from "../contracts/v1";

export const ASSUREPOOL_PTC_PREPARATION_PROFILE = "assurepool.ptc-prep-evidence.v1" as const;
const ASSUREPOOL_PACKAGE_PROFILE = "assurepool.frozen-da-evidence/2.0";
const ASSUREPOOL_PROVIDER_ENVELOPE = "assurepool.provider-envelope/2.0";
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const KEY_ID = /^[a-f0-9]{32}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

type JsonObject = Record<string, unknown>;
type SsaOutcome = "PASS" | "FAIL" | "REVIEW_REQUIRED";
type SsaOverall = "READY" | "REVIEW_REQUIRED" | "FAIL";

interface TrustedKey {
  providerId: string;
  keyId: string;
  publicKeyPem: string;
}

interface ParsedSsaFinding {
  rule: string;
  clause: string;
  basis: "T1_BRIGHT_LINE" | "T2_INTERPRETIVE";
  outcome: SsaOutcome;
  detail: string;
}

interface ParsedSsaPreparation {
  rulesetVersion: string;
  source: {
    instrument: string;
    archivePath: string;
    archiveSha256Prefix: string;
    clausesVerifiedAt: string;
  };
  counselConfirmationPending: boolean;
  requiredMrrBps: 500 | 1000;
  mrrBand: "BAND_5PC" | "BAND_10PC" | "RMBS_5PC";
  mrrBandReason: string;
  findings: ParsedSsaFinding[];
  overall: SsaOverall;
}

interface ParsedPackage {
  canonical: CanonicalObject;
  generatedAt: string;
  poolId: string;
  tapeHash: string;
  sourceManifestDigest: string;
  packageDigest: string;
  ssaPreparation: ParsedSsaPreparation;
}

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be an object`);
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, expected: readonly string[], field: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new BadRequestException(`${field} contains unsupported or missing fields`);
  }
}

function string(value: unknown, field: string, max = 1000): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required`);
  if (value.length > max) throw new BadRequestException(`${field} exceeds ${max} characters`);
  return value;
}

function instant(value: unknown, field: string): string {
  const out = string(value, field, 80);
  if (!ISO_INSTANT.test(out) || Number.isNaN(Date.parse(out))) {
    throw new BadRequestException(`${field} must be a canonical UTC ISO-8601 instant`);
  }
  return out;
}

function date(value: unknown, field: string): string {
  const out = string(value, field, 10);
  const parsed = new Date(`${out}T00:00:00.000Z`);
  if (!ISO_DATE.test(out) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== out) {
    throw new BadRequestException(`${field} must be a calendar-valid YYYY-MM-DD`);
  }
  return out;
}

function digest(value: unknown, field: string): string {
  const out = string(value, field, 80);
  if (!SHA256.test(out)) throw new BadRequestException(`${field} is invalid`);
  return out;
}

function parseSsaPreparation(value: unknown): ParsedSsaPreparation {
  const row = object(value, "payload.ssaPreparation");
  exactKeys(row, [
    "rulesetVersion", "source", "counselConfirmationPending", "requiredMrrBps", "mrrBand",
    "mrrBandReason", "findings", "overall",
  ], "payload.ssaPreparation");
  const source = object(row.source, "payload.ssaPreparation.source");
  exactKeys(source, ["instrument", "archivePath", "archiveSha256Prefix", "clausesVerifiedAt"], "payload.ssaPreparation.source");
  const archiveSha256Prefix = string(source.archiveSha256Prefix, "payload.ssaPreparation.source.archiveSha256Prefix", 64);
  if (!/^[a-f0-9]{16,64}$/.test(archiveSha256Prefix)) {
    throw new BadRequestException("payload.ssaPreparation.source.archiveSha256Prefix is invalid");
  }
  if (typeof row.counselConfirmationPending !== "boolean") {
    throw new BadRequestException("payload.ssaPreparation.counselConfirmationPending must be boolean");
  }
  if (row.requiredMrrBps !== 500 && row.requiredMrrBps !== 1000) {
    throw new BadRequestException("payload.ssaPreparation.requiredMrrBps must be 500 or 1000");
  }
  if (!new Set(["BAND_5PC", "BAND_10PC", "RMBS_5PC"]).has(String(row.mrrBand))) {
    throw new BadRequestException("payload.ssaPreparation.mrrBand is unsupported");
  }
  if (!Array.isArray(row.findings) || row.findings.length < 1 || row.findings.length > 100) {
    throw new BadRequestException("payload.ssaPreparation.findings must contain 1 to 100 findings");
  }
  const findings = row.findings.map((entry, index): ParsedSsaFinding => {
    const finding = object(entry, `payload.ssaPreparation.findings[${index}]`);
    exactKeys(finding, ["rule", "clause", "basis", "outcome", "detail"], `payload.ssaPreparation.findings[${index}]`);
    const basis = string(finding.basis, `payload.ssaPreparation.findings[${index}].basis`, 40);
    const outcome = string(finding.outcome, `payload.ssaPreparation.findings[${index}].outcome`, 40);
    if (basis !== "T1_BRIGHT_LINE" && basis !== "T2_INTERPRETIVE") {
      throw new BadRequestException(`payload.ssaPreparation.findings[${index}].basis is unsupported`);
    }
    if (outcome !== "PASS" && outcome !== "FAIL" && outcome !== "REVIEW_REQUIRED") {
      throw new BadRequestException(`payload.ssaPreparation.findings[${index}].outcome is unsupported`);
    }
    return {
      rule: string(finding.rule, `payload.ssaPreparation.findings[${index}].rule`, 120),
      clause: string(finding.clause, `payload.ssaPreparation.findings[${index}].clause`, 200),
      basis,
      outcome,
      detail: string(finding.detail, `payload.ssaPreparation.findings[${index}].detail`, 4000),
    };
  });
  if (new Set(findings.map((finding) => finding.rule)).size !== findings.length) {
    throw new BadRequestException("payload.ssaPreparation.findings contains duplicate rule identifiers");
  }
  const overall = string(row.overall, "payload.ssaPreparation.overall", 40) as SsaOverall;
  if (!new Set(["READY", "REVIEW_REQUIRED", "FAIL"]).has(overall)) {
    throw new BadRequestException("payload.ssaPreparation.overall is unsupported");
  }
  const derivedOverall: SsaOverall = findings.some((finding) => finding.outcome === "FAIL")
    ? "FAIL"
    : findings.some((finding) => finding.outcome === "REVIEW_REQUIRED")
      ? "REVIEW_REQUIRED"
      : "READY";
  if (overall !== derivedOverall) {
    throw new BadRequestException(`payload.ssaPreparation.overall ${overall} is inconsistent with finding outcomes`);
  }
  if (row.counselConfirmationPending && overall === "READY") {
    throw new BadRequestException("payload.ssaPreparation cannot be READY while counsel confirmation is pending");
  }
  if (row.counselConfirmationPending && !findings.some((finding) =>
    finding.rule === "SSA_COUNSEL_CONFIRMATION" && finding.outcome === "REVIEW_REQUIRED")) {
    throw new BadRequestException("pending counsel confirmation requires an explicit REVIEW_REQUIRED finding");
  }
  const mrrBand = row.mrrBand as ParsedSsaPreparation["mrrBand"];
  const expectedMrrBps = mrrBand === "BAND_10PC" ? 1000 : 500;
  if (row.requiredMrrBps !== expectedMrrBps) {
    throw new BadRequestException("payload.ssaPreparation.requiredMrrBps is inconsistent with mrrBand");
  }
  return {
    rulesetVersion: string(row.rulesetVersion, "payload.ssaPreparation.rulesetVersion", 120),
    source: {
      instrument: string(source.instrument, "payload.ssaPreparation.source.instrument", 1000),
      archivePath: string(source.archivePath, "payload.ssaPreparation.source.archivePath", 1000),
      archiveSha256Prefix,
      clausesVerifiedAt: date(source.clausesVerifiedAt, "payload.ssaPreparation.source.clausesVerifiedAt"),
    },
    counselConfirmationPending: row.counselConfirmationPending,
    requiredMrrBps: row.requiredMrrBps,
    mrrBand,
    mrrBandReason: string(row.mrrBandReason, "payload.ssaPreparation.mrrBandReason", 4000),
    findings,
    overall,
  };
}

function parsePackage(value: unknown): ParsedPackage {
  const row = object(value, "providerEnvelope.payload");
  exactKeys(row, [
    "profileId", "packageVersion", "generatedAt", "tape", "performance", "preparationRoute",
    "ssaPreparation", "packageDigest",
  ], "providerEnvelope.payload");
  if (row.profileId !== ASSUREPOOL_PACKAGE_PROFILE || row.packageVersion !== "2.0") {
    throw new BadRequestException("unsupported AssurePool evidence package profile");
  }
  if (row.preparationRoute !== "PTC_PREP") {
    throw new BadRequestException("AssurePool package preparationRoute must be PTC_PREP for a PTC case");
  }
  const generatedAt = instant(row.generatedAt, "providerEnvelope.payload.generatedAt");
  const tape = object(row.tape, "providerEnvelope.payload.tape");
  const performance = object(row.performance, "providerEnvelope.payload.performance");
  if (tape.profileId !== ASSUREPOOL_PACKAGE_PROFILE || tape.tapeVersion !== "2.0") {
    throw new BadRequestException("unsupported AssurePool tape profile");
  }
  const poolId = string(tape.poolId, "providerEnvelope.payload.tape.poolId", 200);
  const tapeHash = digest(tape.tapeHash, "providerEnvelope.payload.tape.tapeHash");
  const sourceManifestDigest = digest(tape.manifestHash, "providerEnvelope.payload.tape.manifestHash");
  const tapeBody = { ...tape };
  delete tapeBody.tapeHash;
  if (sha256Digest(tapeBody) !== tapeHash) throw new BadRequestException("AssurePool tapeHash mismatch");
  if (!Array.isArray(tape.loans) || sha256Digest(tape.loans) !== sourceManifestDigest) {
    throw new BadRequestException("AssurePool source manifest does not match the published loans");
  }
  if (performance.snapshotVersion !== "1.0" || performance.poolId !== poolId || performance.generatedAt !== generatedAt) {
    throw new BadRequestException("AssurePool performance snapshot is inconsistent with the package");
  }
  const performanceResult = object(performance.result, "providerEnvelope.payload.performance.result");
  if (performanceResult.valueBasis !== "DISBURSED_VALUE") {
    throw new BadRequestException("AssurePool performance value basis is unsupported");
  }
  if (digest(performance.resultDigest, "providerEnvelope.payload.performance.resultDigest") !== sha256Digest(performanceResult)) {
    throw new BadRequestException("AssurePool performance resultDigest mismatch");
  }
  const packageDigest = digest(row.packageDigest, "providerEnvelope.payload.packageDigest");
  const packageBody = { ...row };
  delete packageBody.packageDigest;
  if (sha256Digest(packageBody) !== packageDigest) throw new BadRequestException("AssurePool packageDigest mismatch");
  const ssaPreparation = parseSsaPreparation(row.ssaPreparation);
  let canonical: CanonicalObject;
  try {
    canonical = toCanonicalValue(row) as CanonicalObject;
  } catch (error) {
    throw new BadRequestException(`AssurePool package is not canonical JSON: ${(error as Error).message}`);
  }
  return { canonical, generatedAt, poolId, tapeHash, sourceManifestDigest, packageDigest, ssaPreparation };
}

function trustedKeys(env: NodeJS.ProcessEnv): TrustedKey[] {
  const raw = env.ARAIL_ASSUREPOOL_TRUSTED_KEYS_JSON?.trim();
  if (!raw) throw new ServiceUnavailableException("AssurePool trusted provider keys are not configured");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new ServiceUnavailableException("AssurePool trusted provider keys JSON is invalid"); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) {
    throw new ServiceUnavailableException("AssurePool trusted provider keys must contain 1 to 20 entries");
  }
  const keys = parsed.map((entry, index): TrustedKey => {
    const row = object(entry, `trustedKeys[${index}]`);
    exactKeys(row, ["providerId", "keyId", "publicKeyPem"], `trustedKeys[${index}]`);
    const keyId = string(row.keyId, `trustedKeys[${index}].keyId`, 32);
    if (!KEY_ID.test(keyId)) throw new ServiceUnavailableException(`trustedKeys[${index}].keyId is invalid`);
    return {
      providerId: string(row.providerId, `trustedKeys[${index}].providerId`, 200),
      keyId,
      publicKeyPem: string(row.publicKeyPem, `trustedKeys[${index}].publicKeyPem`, 5000).replace(/\\n/g, "\n"),
    };
  });
  if (new Set(keys.map((key) => `${key.providerId}|${key.keyId}`)).size !== keys.length) {
    throw new ServiceUnavailableException("AssurePool trusted provider key entries must be unique");
  }
  return keys;
}

function signingInput(providerId: string, keyId: string, payloadDigest: string): string {
  return `${ASSUREPOOL_PROVIDER_ENVELOPE}|${providerId}|Ed25519|${keyId}|${payloadDigest}`;
}

@Injectable()
export class AssurePoolPtcPreparationService {
  verifyAndMap(input: {
    institutionId: string;
    transactionCaseId: string;
    transaction: TransactionDiscriminatorV1;
    providerEnvelope: unknown;
    receivedAt?: Date;
  }, env: NodeJS.ProcessEnv = process.env): {
    envelope: NeutralIntakeEnvelopeV1;
    providerResult: SsaOverall;
  } {
    string(input.institutionId, "institutionId", 200);
    string(input.transactionCaseId, "transactionCaseId", 200);
    if (input.transaction?.transactionRoute !== "PTC" || input.transaction.representation !== "CONVENTIONAL") {
      throw new BadRequestException("AssurePool PTC preparation evidence requires a conventional PTC Rail case");
    }
    const outer = object(input.providerEnvelope, "providerEnvelope");
    exactKeys(outer, ["envelopeVersion", "providerId", "algorithm", "keyId", "payloadDigest", "signature", "payload"], "providerEnvelope");
    if (outer.envelopeVersion !== ASSUREPOOL_PROVIDER_ENVELOPE || outer.algorithm !== "Ed25519") {
      throw new BadRequestException("unsupported AssurePool provider envelope or algorithm");
    }
    const providerId = string(outer.providerId, "providerEnvelope.providerId", 200);
    const keyId = string(outer.keyId, "providerEnvelope.keyId", 32);
    if (!KEY_ID.test(keyId)) throw new BadRequestException("providerEnvelope.keyId is invalid");
    const payloadDigest = digest(outer.payloadDigest, "providerEnvelope.payloadDigest");
    const signature = string(outer.signature, "providerEnvelope.signature", 1000);
    const payload = parsePackage(outer.payload);
    const calculatedPayloadDigest = sha256Digest(payload.canonical);
    if (calculatedPayloadDigest !== payloadDigest) throw new BadRequestException("AssurePool provider payload digest mismatch");
    const trusted = trustedKeys(env).find((key) => key.providerId === providerId && key.keyId === keyId);
    if (!trusted) throw new BadRequestException("AssurePool provider signing key is not trusted");
    let publicKey;
    try {
      publicKey = createPublicKey(trusted.publicKeyPem);
      if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("key is not Ed25519");
      const fingerprint = createHash("sha256").update(publicKey.export({ format: "der", type: "spki" })).digest("hex").slice(0, 32);
      if (fingerprint !== keyId) throw new Error("keyId does not match the Ed25519 public-key fingerprint");
    } catch (error) {
      throw new ServiceUnavailableException(`trusted AssurePool public key is invalid: ${(error as Error).message}`);
    }
    if (!/^[A-Za-z0-9_-]+$/.test(signature)) throw new BadRequestException("provider signature is not base64url");
    const signatureBytes = Buffer.from(signature, "base64url");
    if (signatureBytes.length !== 64 || !verify(
      null,
      Buffer.from(signingInput(providerId, keyId, payloadDigest)),
      publicKey,
      signatureBytes,
    )) {
      throw new BadRequestException("AssurePool provider signature verification failed");
    }
    const qualifications: QualificationV1[] = [{
      code: "PROVIDER_RESULT_REQUIRES_RAIL_REVIEW",
      severity: "REVIEW_REQUIRED",
      text: `AssurePool SSA preparation result ${payload.ssaPreparation.overall} is retained as source evidence and does not determine a Rail transaction outcome.`,
      evidenceRef: null,
    }];
    if (payload.ssaPreparation.counselConfirmationPending) {
      qualifications.push({
        code: "SSA_COUNSEL_CONFIRMATION_PENDING",
        severity: "REVIEW_REQUIRED",
        text: "The source ruleset records independent counsel confirmation as pending.",
        evidenceRef: null,
      });
    }
    const envelope = buildNeutralIntakeEnvelope({
      envelopeId: `assurepool-ptc-prep:${providerId}:${payload.poolId}:${payloadDigest}`,
      transactionCaseId: input.transactionCaseId,
      provider: {
        institutionRef: `provider:${providerId}`,
        kind: "SERVICE_PROVIDER",
        jurisdiction: "IND",
        identifiers: [{ scheme: "PROVIDER_ID", value: providerId }],
      },
      source: {
        providerInstitutionRef: `provider:${providerId}`,
        sourceSystemRef: providerId,
        sourceObjectType: "PTC_PREPARATION_EVIDENCE",
        sourceObjectRef: payload.poolId,
        sourceSchemaId: ASSUREPOOL_PTC_PREPARATION_PROFILE,
        sourceSchemaVersion: "1.0.0",
        sourcePayloadDigest: calculatedPayloadDigest,
        authorityClass: "EVIDENTIARY",
      },
      asOfAt: payload.generatedAt,
      expiresAt: null,
      qualifications,
      signature: {
        status: "PRESENT",
        scope: "SOURCE_PAYLOAD",
        signedDigest: calculatedPayloadDigest,
        algorithm: "Ed25519",
        keyRef: `${providerId}#${keyId}`,
        signature,
        signedAt: payload.generatedAt,
      },
      idempotencyKey: `assurepool-ptc-prep:${providerId}:${payload.poolId}:${payloadDigest}`,
      receivedAt: (input.receivedAt ?? new Date()).toISOString(),
      transaction: input.transaction,
      payload: toCanonicalValue({
        normalized: {
          poolId: payload.poolId,
          sourceManifestDigest: payload.sourceManifestDigest,
          tapeHash: payload.tapeHash,
          packageDigest: payload.packageDigest,
          preparationRoute: "PTC_PREP",
          providerResult: payload.ssaPreparation.overall,
          counselConfirmationPending: payload.ssaPreparation.counselConfirmationPending,
          requiredMrrBps: payload.ssaPreparation.requiredMrrBps,
          mrrBand: payload.ssaPreparation.mrrBand,
        },
        extensions: {
          profileId: ASSUREPOOL_PTC_PREPARATION_PROFILE,
          sourcePackage: payload.canonical,
        },
      }) as CanonicalObject,
    });
    assertValidNeutralEnvelopeV1(envelope);
    return { envelope, providerResult: payload.ssaPreparation.overall };
  }
}
