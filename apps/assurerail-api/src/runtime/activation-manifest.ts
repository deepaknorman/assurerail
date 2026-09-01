import { createPublicKey, verify } from "node:crypto";
import { canonicalSerialize, sha256Digest, type Sha256Digest } from "../contracts/v1";

export const ACTIVATION_MANIFEST_SCHEMA = "assurerail.activation.v1" as const;

export const ACTIVATION_APPROVAL_ROLES = [
  "ENGINEERING",
  "SECURITY",
  "OPERATIONS",
  "PRODUCT_RISK",
  "LEGAL_REGULATORY",
] as const;

export const CONTROLLED_LIVE_GATE_CODES = [
  "NO_CRITICAL_OR_UNOWNED_HIGH_FINDINGS",
  "INDEPENDENT_SECURITY_REVIEW",
  "BACKUP_RESTORE_RECONCILIATION",
  "FAILOVER_BCP_DR_REHEARSAL",
  "INCIDENT_AND_ESCALATION_REHEARSAL",
  "PARTICIPANT_EVIDENCE_EXPORT",
  "ROUTE_LEGAL_PERMISSION",
  "CONNECTOR_CERTIFICATION",
  "OPERATING_ACCEPTANCE",
] as const;

export const PRODUCTION_ONLY_GATE_CODES = [
  "CONTROLLED_PILOT_ACCEPTANCE",
  "CAPACITY_AND_COVERAGE_ACCEPTANCE",
  "CUSTOMER_EXIT_REHEARSAL",
] as const;

export const EXTERNAL_GATE_CODES = new Set<string>([
  "INDEPENDENT_SECURITY_REVIEW",
  "PARTICIPANT_EVIDENCE_EXPORT",
  "ROUTE_LEGAL_PERMISSION",
  "CONNECTOR_CERTIFICATION",
  "OPERATING_ACCEPTANCE",
  "CONTROLLED_PILOT_ACCEPTANCE",
  "CUSTOMER_EXIT_REHEARSAL",
]);

export interface ActivationCapability {
  id: string;
  transactionRoute: "DA" | "PTC";
  representation: "CONVENTIONAL" | "TOKENISED";
  lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE" | "SECONDARY_TRANSFER_OR_TRADE";
  materialFunction: string;
  performer: "OWNED_AUTHORISED" | "LICENSED_PARTNER" | "PARTICIPANT_OWNED" | "EXTERNAL_AUTHORITY";
  cohortRef: string;
}

export interface ActivationGateEvidence {
  code: string;
  scopeKey: string;
  evidenceClass: "INTERNAL" | "EXTERNAL";
  evidenceRef: string;
  evidenceDigest: Sha256Digest;
  decisionRef: string;
  acceptedAt: string;
  expiresAt: string;
}

export interface ActivationApproval {
  role: (typeof ACTIVATION_APPROVAL_ROLES)[number];
  actorRef: string;
  approvedAt: string;
  evidenceDigest: Sha256Digest;
}

export interface ActivationManifestV1 {
  schemaVersion: typeof ACTIVATION_MANIFEST_SCHEMA;
  manifestId: string;
  environment: string;
  operatingMode: "CONTROLLED_LIVE" | "PRODUCTION";
  buildCommit: string;
  issuedAt: string;
  expiresAt: string;
  capabilities: ActivationCapability[];
  gates: ActivationGateEvidence[];
  approvals: ActivationApproval[];
}

export interface ActivationInspection {
  manifest: ActivationManifestV1 | null;
  manifestDigest: Sha256Digest | null;
  errors: string[];
}

type Environment = Readonly<Record<string, string | undefined>>;

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const BUILD_COMMIT = /^[a-f0-9]{40}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,239}$/;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_ACTIVATION_MS = 31 * 24 * 60 * 60 * 1_000;

function decodeStrictBase64(raw: string, label: string): Buffer {
  if (raw.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) {
    throw new Error(`${label} is not canonical base64`);
  }
  const decoded = Buffer.from(raw, "base64");
  if (decoded.toString("base64") !== raw) throw new Error(`${label} is not canonical base64`);
  return decoded;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string, errors: string[]): void {
  const expectedSet = new Set(expected);
  for (const key of Object.keys(value)) if (!expectedSet.has(key)) errors.push(`${path}.${key} is not allowed`);
  for (const key of expected) if (!(key in value)) errors.push(`${path}.${key} is required`);
}

function text(value: unknown, path: string, errors: string[], pattern = IDENTIFIER): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    errors.push(`${path} is invalid`);
    return "";
  }
  return value;
}

function instant(value: unknown, path: string, errors: string[]): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    errors.push(`${path} must be an ISO-8601 UTC timestamp`);
    return new Date(Number.NaN);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")) {
    errors.push(`${path} is not a canonical timestamp`);
  }
  return parsed;
}

function digest(value: unknown, path: string, errors: string[]): Sha256Digest {
  if (typeof value !== "string" || !SHA256.test(value)) errors.push(`${path} must be lowercase sha256:<64 hex>`);
  return value as Sha256Digest;
}

function decodeManifest(raw: string | undefined, errors: string[]): unknown {
  if (!raw?.trim()) {
    errors.push("ARAIL_ACTIVATION_MANIFEST_B64 is required for controlled-live or production");
    return null;
  }
  try {
    const bytes = decodeStrictBase64(raw.trim(), "activation manifest");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MANIFEST_BYTES) throw new Error("size");
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    errors.push("ARAIL_ACTIVATION_MANIFEST_B64 must be bounded base64-encoded JSON");
    return null;
  }
}

function validateCapability(value: unknown, index: number, errors: string[]): ActivationCapability | null {
  const path = `activation.capabilities[${index}]`;
  if (!record(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }
  exactKeys(value, ["id", "transactionRoute", "representation", "lifecycleLeg", "materialFunction", "performer", "cohortRef"], path, errors);
  const capability = {
    id: text(value.id, `${path}.id`, errors),
    transactionRoute: value.transactionRoute,
    representation: value.representation,
    lifecycleLeg: value.lifecycleLeg,
    materialFunction: text(value.materialFunction, `${path}.materialFunction`, errors),
    performer: value.performer,
    cohortRef: text(value.cohortRef, `${path}.cohortRef`, errors),
  } as ActivationCapability;
  if (!["DA", "PTC"].includes(String(capability.transactionRoute))) errors.push(`${path}.transactionRoute is invalid`);
  if (!["CONVENTIONAL", "TOKENISED"].includes(String(capability.representation))) errors.push(`${path}.representation is invalid`);
  if (!["INITIAL_TRANSFER_OR_ISSUE", "SECONDARY_TRANSFER_OR_TRADE"].includes(String(capability.lifecycleLeg))) errors.push(`${path}.lifecycleLeg is invalid`);
  if (!["OWNED_AUTHORISED", "LICENSED_PARTNER", "PARTICIPANT_OWNED", "EXTERNAL_AUTHORITY"].includes(String(capability.performer))) errors.push(`${path}.performer is invalid`);
  return capability;
}

function validateGate(value: unknown, index: number, now: Date, errors: string[]): ActivationGateEvidence | null {
  const path = `activation.gates[${index}]`;
  if (!record(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }
  exactKeys(value, ["code", "scopeKey", "evidenceClass", "evidenceRef", "evidenceDigest", "decisionRef", "acceptedAt", "expiresAt"], path, errors);
  const code = text(value.code, `${path}.code`, errors, /^[A-Z][A-Z0-9_]{2,119}$/);
  const gate = {
    code,
    scopeKey: text(value.scopeKey, `${path}.scopeKey`, errors),
    evidenceClass: value.evidenceClass,
    evidenceRef: text(value.evidenceRef, `${path}.evidenceRef`, errors),
    evidenceDigest: digest(value.evidenceDigest, `${path}.evidenceDigest`, errors),
    decisionRef: text(value.decisionRef, `${path}.decisionRef`, errors),
    acceptedAt: String(value.acceptedAt ?? ""),
    expiresAt: String(value.expiresAt ?? ""),
  } as ActivationGateEvidence;
  if (!["INTERNAL", "EXTERNAL"].includes(String(gate.evidenceClass))) errors.push(`${path}.evidenceClass is invalid`);
  if (EXTERNAL_GATE_CODES.has(code) && gate.evidenceClass !== "EXTERNAL") {
    errors.push(`${path} requires external evidence; synthetic or internal evidence cannot close ${code}`);
  }
  const acceptedAt = instant(value.acceptedAt, `${path}.acceptedAt`, errors);
  const expiresAt = instant(value.expiresAt, `${path}.expiresAt`, errors);
  if (acceptedAt > now) errors.push(`${path}.acceptedAt cannot be in the future`);
  if (expiresAt <= now) errors.push(`${path} is expired`);
  if (expiresAt <= acceptedAt) errors.push(`${path}.expiresAt must follow acceptedAt`);
  return gate;
}

function validateApproval(value: unknown, index: number, issuedAt: Date, errors: string[]): ActivationApproval | null {
  const path = `activation.approvals[${index}]`;
  if (!record(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }
  exactKeys(value, ["role", "actorRef", "approvedAt", "evidenceDigest"], path, errors);
  const approval = {
    role: value.role,
    actorRef: text(value.actorRef, `${path}.actorRef`, errors),
    approvedAt: String(value.approvedAt ?? ""),
    evidenceDigest: digest(value.evidenceDigest, `${path}.evidenceDigest`, errors),
  } as ActivationApproval;
  if (!(ACTIVATION_APPROVAL_ROLES as readonly unknown[]).includes(approval.role)) errors.push(`${path}.role is invalid`);
  const approvedAt = instant(value.approvedAt, `${path}.approvedAt`, errors);
  if (approvedAt > issuedAt) errors.push(`${path}.approvedAt cannot follow manifest issuance`);
  return approval;
}

export function inspectActivationManifest(env: Environment, now = new Date()): ActivationInspection {
  const errors: string[] = [];
  const decoded = decodeManifest(env.ARAIL_ACTIVATION_MANIFEST_B64, errors);
  if (!record(decoded)) return { manifest: null, manifestDigest: null, errors };
  exactKeys(decoded, ["schemaVersion", "manifestId", "environment", "operatingMode", "buildCommit", "issuedAt", "expiresAt", "capabilities", "gates", "approvals"], "activation", errors);
  const issuedAt = instant(decoded.issuedAt, "activation.issuedAt", errors);
  const expiresAt = instant(decoded.expiresAt, "activation.expiresAt", errors);
  const manifest = {
    schemaVersion: decoded.schemaVersion,
    manifestId: text(decoded.manifestId, "activation.manifestId", errors),
    environment: text(decoded.environment, "activation.environment", errors),
    operatingMode: decoded.operatingMode,
    buildCommit: text(decoded.buildCommit, "activation.buildCommit", errors, BUILD_COMMIT),
    issuedAt: String(decoded.issuedAt ?? ""),
    expiresAt: String(decoded.expiresAt ?? ""),
    capabilities: Array.isArray(decoded.capabilities)
      ? decoded.capabilities.map((entry, index) => validateCapability(entry, index, errors)).filter((entry): entry is ActivationCapability => Boolean(entry))
      : [],
    gates: Array.isArray(decoded.gates)
      ? decoded.gates.map((entry, index) => validateGate(entry, index, now, errors)).filter((entry): entry is ActivationGateEvidence => Boolean(entry))
      : [],
    approvals: Array.isArray(decoded.approvals)
      ? decoded.approvals.map((entry, index) => validateApproval(entry, index, issuedAt, errors)).filter((entry): entry is ActivationApproval => Boolean(entry))
      : [],
  } as ActivationManifestV1;
  if (manifest.schemaVersion !== ACTIVATION_MANIFEST_SCHEMA) errors.push(`activation.schemaVersion must be ${ACTIVATION_MANIFEST_SCHEMA}`);
  if (!["CONTROLLED_LIVE", "PRODUCTION"].includes(String(manifest.operatingMode))) errors.push("activation.operatingMode is invalid");
  if (issuedAt > now) errors.push("activation.issuedAt cannot be in the future");
  if (expiresAt <= now) errors.push("activation manifest is expired");
  if (expiresAt <= issuedAt) errors.push("activation.expiresAt must follow issuedAt");
  if (expiresAt.getTime() - issuedAt.getTime() > MAX_ACTIVATION_MS) errors.push("activation manifest validity cannot exceed 31 days");
  if (manifest.environment !== env.ASSURERAIL_ENVIRONMENT?.trim()) errors.push("activation.environment must match ASSURERAIL_ENVIRONMENT");
  if (manifest.operatingMode !== env.ASSURERAIL_OPERATING_MODE?.trim().toUpperCase()) errors.push("activation.operatingMode must match ASSURERAIL_OPERATING_MODE");
  if (manifest.buildCommit !== env.ASSURERAIL_BUILD_COMMIT?.trim()) errors.push("activation.buildCommit must match ASSURERAIL_BUILD_COMMIT");
  if (manifest.capabilities.length === 0) errors.push("activation.capabilities must contain at least one allow-listed route/function/cohort");
  const capabilityIds = manifest.capabilities.map((entry) => entry.id);
  if (new Set(capabilityIds).size !== capabilityIds.length) errors.push("activation capability IDs must be unique");
  const requiredGates = [
    ...CONTROLLED_LIVE_GATE_CODES,
    ...(manifest.operatingMode === "PRODUCTION" ? PRODUCTION_ONLY_GATE_CODES : []),
  ];
  const gateCodes = manifest.gates.map((entry) => entry.code);
  for (const code of requiredGates) if (!gateCodes.includes(code)) errors.push(`activation gate ${code} is required`);
  if (new Set(gateCodes).size !== gateCodes.length) errors.push("activation gate codes must be unique");
  const approvalRoles = manifest.approvals.map((entry) => entry.role);
  for (const role of ACTIVATION_APPROVAL_ROLES) if (!approvalRoles.includes(role)) errors.push(`activation approval ${role} is required`);
  if (new Set(approvalRoles).size !== approvalRoles.length) errors.push("activation approval roles must be unique");
  const approvalActors = manifest.approvals.map((entry) => entry.actorRef);
  if (new Set(approvalActors).size !== approvalActors.length) errors.push("activation approvals require distinct accountable people");

  const manifestDigest = sha256Digest(manifest);
  const publicKey = env.ARAIL_ACTIVATION_PUBLIC_KEY_B64?.trim();
  const signature = env.ARAIL_ACTIVATION_SIGNATURE_B64?.trim();
  if (!publicKey) errors.push("ARAIL_ACTIVATION_PUBLIC_KEY_B64 is required");
  if (!signature) errors.push("ARAIL_ACTIVATION_SIGNATURE_B64 is required");
  if (publicKey && signature) {
    try {
      const key = createPublicKey({ key: decodeStrictBase64(publicKey, "activation public key"), format: "der", type: "spki" });
      const valid = verify(
        null,
        Buffer.from(canonicalSerialize(manifest), "utf8"),
        key,
        decodeStrictBase64(signature, "activation signature"),
      );
      if (!valid) errors.push("activation manifest signature is invalid");
    } catch {
      errors.push("activation public key or signature encoding is invalid");
    }
  }
  return { manifest, manifestDigest, errors };
}
