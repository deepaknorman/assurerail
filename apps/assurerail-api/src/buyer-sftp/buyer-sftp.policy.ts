import { createHash } from "node:crypto";
import { sha256Digest } from "../contracts/v1/canonical";

export const BUYER_SFTP_DOCUMENT_FAMILIES = [
  "LOAN_TAPE",
  "DOCUMENT_INDEX",
  "ASSESSMENT_REPORT",
  "EXCEPTION_REGISTER",
  "SUPPORTING_EVIDENCE",
] as const;
export type BuyerSftpDocumentFamily = (typeof BUYER_SFTP_DOCUMENT_FAMILIES)[number];

export const BUYER_SFTP_ROLES = [
  "SELLER_EXPORT_MAKER",
  "ASSURERAIL_EXPORT_CHECKER",
  "ASSURERAIL_INTEGRATION_OPERATOR",
  "BUYER_ACKNOWLEDGER",
] as const;
export type BuyerSftpRole = (typeof BUYER_SFTP_ROLES)[number];

export type BuyerSftpActor = Readonly<{
  userId: string;
  institutionId: string;
  roles: readonly BuyerSftpRole[];
  buyerScopes: readonly string[];
  sellerScopes: readonly string[];
}>;

export type BuyerSftpProfile = Readonly<{
  profileId: string;
  version: number;
  buyerInstitutionId: string;
  environment: "SANDBOX";
  status: "PROPOSED" | "APPROVED" | "SUSPENDED";
  host: string;
  port: number;
  username: string;
  credentialKeyRef: string;
  pinnedHostKeyFingerprint: string;
  outboundRoot: string;
  acknowledgementRoot: string;
  schemaVersion: string;
  allowListedDocumentFamilies: readonly BuyerSftpDocumentFamily[];
  maximumFileBytes: number;
  maximumBatchBytes: number;
  retentionDays: number;
  retryPolicy: Readonly<{
    maximumAttempts: number;
    initialDelaySeconds: number;
    maximumDelaySeconds: number;
  }>;
  proposedByUserId: string;
  approvedByUserId: string | null;
  buyerAcceptanceEvidenceRef: string | null;
  configurationDigest: string;
}>;

export const BUYER_SFTP_BOUNDARY = Object.freeze({
  transport: "SFTP",
  direction: "OUTBOUND_ONLY",
  encryptedInTransit: "SSH_V2_WITH_PINNED_HOST_KEY",
  productionDispatchPermitted: false,
  passwordAuthenticationPermitted: false,
  secretsPersistedInProfile: false,
  uploadConfirmsBuyerAcceptance: false,
  acknowledgementConfirmsSettlement: false,
});

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const HOST = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/;
const USERNAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/;
const ABSOLUTE_FOLDER = /^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/;
const SECRET_REF = /^(?:vault|kms|secret):\/\/[A-Za-z0-9][A-Za-z0-9_./:@-]{0,254}$/;
// OpenSSH displays SHA-256 fingerprints without Base64 padding; a few APIs preserve the trailing
// padding character. Accept both representations while requiring the full 256-bit fingerprint.
const HOST_KEY = /^SHA256:[A-Za-z0-9+/]{43}=?$/;
const EVIDENCE_REF = /^[A-Za-z0-9][A-Za-z0-9_:/.-]{0,255}$/;

export function requireBuyerSftpIdentifier(value: unknown, field: string): string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new Error(`${field} must be a bounded identifier`);
  return value;
}

function requireFolder(value: unknown, field: string): string {
  if (typeof value !== "string" || !ABSOLUTE_FOLDER.test(value) || value.includes("..") || value.includes("//")) {
    throw new Error(`${field} must be a normalised absolute SFTP folder`);
  }
  return value.replace(/\/$/, "");
}

export function buyerSftpProfileConfiguration(input: Omit<BuyerSftpProfile, "status" | "approvedByUserId" | "buyerAcceptanceEvidenceRef" | "configurationDigest">) {
  return {
    profileId: input.profileId,
    version: input.version,
    buyerInstitutionId: input.buyerInstitutionId,
    environment: input.environment,
    host: input.host,
    port: input.port,
    username: input.username,
    credentialKeyRef: input.credentialKeyRef,
    pinnedHostKeyFingerprint: input.pinnedHostKeyFingerprint,
    outboundRoot: input.outboundRoot,
    acknowledgementRoot: input.acknowledgementRoot,
    schemaVersion: input.schemaVersion,
    allowListedDocumentFamilies: [...input.allowListedDocumentFamilies].sort(),
    maximumFileBytes: input.maximumFileBytes,
    maximumBatchBytes: input.maximumBatchBytes,
    retentionDays: input.retentionDays,
    retryPolicy: input.retryPolicy,
    proposedByUserId: input.proposedByUserId,
  };
}

export function validateBuyerSftpProfile(profile: BuyerSftpProfile): BuyerSftpProfile {
  requireBuyerSftpIdentifier(profile.profileId, "profileId");
  requireBuyerSftpIdentifier(profile.buyerInstitutionId, "buyerInstitutionId");
  requireBuyerSftpIdentifier(profile.proposedByUserId, "proposedByUserId");
  if (!["PROPOSED", "APPROVED", "SUSPENDED"].includes(profile.status)) throw new Error("profile status is invalid");
  if (!Number.isSafeInteger(profile.version) || profile.version < 1) throw new Error("version must be a positive integer");
  if (profile.environment !== "SANDBOX") throw new Error("production SFTP is not enabled");
  if (!HOST.test(profile.host) || profile.host.toLowerCase() === "localhost") throw new Error("host must be a valid buyer sandbox hostname");
  if (!Number.isInteger(profile.port) || profile.port < 1 || profile.port > 65535) throw new Error("port must be valid");
  if (!USERNAME.test(profile.username)) throw new Error("username must be bounded");
  if (!SECRET_REF.test(profile.credentialKeyRef)) throw new Error("credentialKeyRef must be an opaque secret-manager reference");
  if (!HOST_KEY.test(profile.pinnedHostKeyFingerprint)) throw new Error("a pinned SHA256 host-key fingerprint is required");
  requireFolder(profile.outboundRoot, "outboundRoot");
  requireFolder(profile.acknowledgementRoot, "acknowledgementRoot");
  if (profile.outboundRoot === profile.acknowledgementRoot) throw new Error("outbound and acknowledgement folders must be distinct");
  requireBuyerSftpIdentifier(profile.schemaVersion, "schemaVersion");
  const families = profile.allowListedDocumentFamilies;
  if (!families.length || new Set(families).size !== families.length || families.some((family) => !BUYER_SFTP_DOCUMENT_FAMILIES.includes(family))) {
    throw new Error("one or more unique allow-listed document families are required");
  }
  if (!Number.isSafeInteger(profile.maximumFileBytes) || profile.maximumFileBytes < 1 || profile.maximumFileBytes > 100 * 1024 * 1024) {
    throw new Error("maximumFileBytes must be between 1 byte and 100 MiB");
  }
  if (!Number.isSafeInteger(profile.maximumBatchBytes) || profile.maximumBatchBytes < profile.maximumFileBytes || profile.maximumBatchBytes > 1024 * 1024 * 1024) {
    throw new Error("maximumBatchBytes must be at least maximumFileBytes and no more than 1 GiB");
  }
  if (!Number.isInteger(profile.retentionDays) || profile.retentionDays < 1 || profile.retentionDays > 90) throw new Error("retentionDays must be 1 to 90");
  const retry = profile.retryPolicy;
  if (!Number.isInteger(retry.maximumAttempts) || retry.maximumAttempts < 1 || retry.maximumAttempts > 5) throw new Error("maximumAttempts must be 1 to 5");
  if (!Number.isInteger(retry.initialDelaySeconds) || retry.initialDelaySeconds < 30 || retry.initialDelaySeconds > 3600) throw new Error("initialDelaySeconds must be 30 to 3600");
  if (!Number.isInteger(retry.maximumDelaySeconds) || retry.maximumDelaySeconds < retry.initialDelaySeconds || retry.maximumDelaySeconds > 86400) throw new Error("maximumDelaySeconds must be between the initial delay and 86400");
  if (!profile.configurationDigest.startsWith("sha256:")) throw new Error("configurationDigest is required");
  const expected = sha256Digest(buyerSftpProfileConfiguration(profile));
  if (profile.configurationDigest !== expected) throw new Error("configurationDigest does not match the profile");
  if (profile.status === "PROPOSED" && (profile.approvedByUserId || profile.buyerAcceptanceEvidenceRef)) throw new Error("a proposed profile cannot contain approval evidence");
  if (profile.status !== "PROPOSED") {
    requireBuyerSftpIdentifier(profile.approvedByUserId, "approvedByUserId");
    if (profile.approvedByUserId === profile.proposedByUserId) throw new Error("profile maker cannot approve their own proposal");
    if (typeof profile.buyerAcceptanceEvidenceRef !== "string" || !EVIDENCE_REF.test(profile.buyerAcceptanceEvidenceRef)) throw new Error("buyer acceptance evidence is required");
  }
  return profile;
}

export function parseBuyerSftpProfiles(json: string | undefined): readonly BuyerSftpProfile[] {
  if (!json?.trim()) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error("buyer SFTP profile JSON is invalid"); }
  if (!Array.isArray(parsed)) throw new Error("buyer SFTP profiles must be an array");
  const profiles = parsed.map((entry) => validateBuyerSftpProfile(entry as BuyerSftpProfile));
  const identities = profiles.map((profile) => `${profile.buyerInstitutionId}:${profile.profileId}:${profile.version}`);
  if (new Set(identities).size !== identities.length) throw new Error("buyer SFTP profile versions must be unique");
  return profiles;
}

export function assertBuyerSftpRole(actor: BuyerSftpActor, role: BuyerSftpRole, buyerInstitutionId: string, sellerInstitutionId?: string): void {
  requireBuyerSftpIdentifier(actor.userId, "actor.userId");
  requireBuyerSftpIdentifier(actor.institutionId, "actor.institutionId");
  if (!actor.roles.includes(role)) throw new Error(`actor lacks ${role}`);
  if (!actor.buyerScopes.includes(buyerInstitutionId)) throw new Error("actor is outside the buyer scope");
  if (sellerInstitutionId && !actor.sellerScopes.includes(sellerInstitutionId)) throw new Error("actor is outside the seller scope");
  if (role === "BUYER_ACKNOWLEDGER" && actor.institutionId !== buyerInstitutionId) throw new Error("acknowledgement actor must belong to the buyer");
  if (role === "SELLER_EXPORT_MAKER" && actor.institutionId !== sellerInstitutionId) throw new Error("request actor must belong to the seller");
}

export function fileSha256(content: Uint8Array): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function outboundBatchFolder(profile: BuyerSftpProfile, sellerInstitutionId: string, engagementId: string, batchRef: string): string {
  const seller = requireBuyerSftpIdentifier(sellerInstitutionId, "sellerInstitutionId");
  const engagement = requireBuyerSftpIdentifier(engagementId, "engagementId");
  const batch = requireBuyerSftpIdentifier(batchRef, "batchRef");
  return `${profile.outboundRoot}/${seller}/${engagement}/${batch}`;
}

export function assertSafeExportFilename(filename: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(filename) || filename.includes("..")) throw new Error("filename must be a safe basename");
  return filename;
}
