import { randomUUID } from "node:crypto";
import { canonicalSerialize, sha256Digest } from "../contracts/v1/canonical";
import type { BuyerSftpInspectionResult, BuyerSftpTransportAdapter, BuyerSftpTransportBatch, BuyerSftpUploadResult } from "./buyer-sftp.adapter";
import {
  assertBuyerSftpRole,
  assertSafeExportFilename,
  BUYER_SFTP_BOUNDARY,
  buyerSftpProfileConfiguration,
  fileSha256,
  outboundBatchFolder,
  requireBuyerSftpIdentifier,
  validateBuyerSftpProfile,
  type BuyerSftpActor,
  type BuyerSftpDocumentFamily,
  type BuyerSftpProfile,
} from "./buyer-sftp.policy";

export type BuyerSftpAuditEvent = Readonly<{
  sequence: number;
  occurredAt: string;
  eventType: string;
  actorUserId: string;
  actorInstitutionId: string;
  buyerInstitutionId: string;
  sellerInstitutionId: string | null;
  profileId: string;
  batchRef: string | null;
  detailDigest: string;
}>;

export type BuyerSftpManifestFile = Readonly<{
  filename: string;
  documentFamily: BuyerSftpDocumentFamily;
  mediaType: string;
  bytes: number;
  sha256Digest: string;
}>;

export type BuyerSftpManifest = Readonly<{
  manifestVersion: "1.0";
  batchRef: string;
  idempotencyKey: string;
  buyerInstitutionId: string;
  sellerInstitutionId: string;
  engagementId: string;
  caseId: string | null;
  profileId: string;
  profileVersion: number;
  profileConfigurationDigest: string;
  schemaVersion: string;
  createdAt: string;
  retentionUntil: string;
  files: readonly BuyerSftpManifestFile[];
}>;

export type BuyerSftpExportStatus =
  | "PROPOSED"
  | "APPROVED"
  | "DISPATCHING"
  | "AWAITING_ACKNOWLEDGEMENT"
  | "RETRYABLE"
  | "AMBIGUOUS_REQUIRES_RECONCILIATION"
  | "PARTIAL_REQUIRES_RECONCILIATION"
  | "BUYER_ACCEPTED"
  | "BUYER_REJECTED"
  | "FAILED_FINAL";

export type BuyerSftpExportRecord = {
  batchRef: string;
  idempotencyScope: string;
  requestDigest: string;
  profile: BuyerSftpProfile;
  manifest: BuyerSftpManifest;
  manifestDigest: string;
  remoteFolder: string;
  status: BuyerSftpExportStatus;
  proposedByUserId: string;
  approvedByUserId: string | null;
  attempts: number;
  nextRetryAt: string | null;
  providerTransferRef: string | null;
  lastReasonCode: string | null;
  acknowledgementDigest: string | null;
};

export type BuyerSftpAcknowledgement = Readonly<{
  acknowledgementRef: string;
  batchRef: string;
  manifestDigest: string;
  buyerInstitutionId: string;
  status: "ACCEPTED" | "PARTIAL" | "REJECTED";
  acceptedFileDigests: readonly string[];
  rejectedFiles: readonly Readonly<{ fileDigest: string; reasonCode: string }>[];
  buyerObservedAt: string;
}>;

export interface BuyerSftpRepository {
  saveProfile(profile: BuyerSftpProfile): void;
  getProfile(profileId: string, version: number): BuyerSftpProfile | undefined;
  saveExport(record: BuyerSftpExportRecord): void;
  getExport(batchRef: string): BuyerSftpExportRecord | undefined;
  findByIdempotencyScope(scope: string): BuyerSftpExportRecord | undefined;
  appendAudit(event: Omit<BuyerSftpAuditEvent, "sequence">): BuyerSftpAuditEvent;
  auditEvents(): readonly BuyerSftpAuditEvent[];
}

/** Sandbox repository only. Production integration must provide durable, transactional persistence. */
export class InMemoryBuyerSftpRepository implements BuyerSftpRepository {
  private readonly profiles = new Map<string, BuyerSftpProfile>();
  private readonly exports = new Map<string, BuyerSftpExportRecord>();
  private readonly idempotency = new Map<string, string>();
  private readonly events: BuyerSftpAuditEvent[] = [];
  saveProfile(profile: BuyerSftpProfile): void { this.profiles.set(`${profile.profileId}:${profile.version}`, structuredClone(profile)); }
  getProfile(profileId: string, version: number): BuyerSftpProfile | undefined { const value = this.profiles.get(`${profileId}:${version}`); return value && structuredClone(value); }
  saveExport(record: BuyerSftpExportRecord): void { this.exports.set(record.batchRef, structuredClone(record)); this.idempotency.set(record.idempotencyScope, record.batchRef); }
  getExport(batchRef: string): BuyerSftpExportRecord | undefined { const value = this.exports.get(batchRef); return value && structuredClone(value); }
  findByIdempotencyScope(scope: string): BuyerSftpExportRecord | undefined { const ref = this.idempotency.get(scope); return ref ? this.getExport(ref) : undefined; }
  appendAudit(event: Omit<BuyerSftpAuditEvent, "sequence">): BuyerSftpAuditEvent { const saved = { ...event, sequence: this.events.length + 1 }; this.events.push(saved); return saved; }
  auditEvents(): readonly BuyerSftpAuditEvent[] { return structuredClone(this.events); }
}

type ProposedProfile = Omit<BuyerSftpProfile, "status" | "approvedByUserId" | "buyerAcceptanceEvidenceRef" | "configurationDigest" | "proposedByUserId">;
type ExportFileInput = Readonly<{ filename: string; documentFamily: BuyerSftpDocumentFamily; mediaType: string; content: Uint8Array }>;

export class BuyerSftpExportCoordinator {
  constructor(private readonly repository: BuyerSftpRepository, private readonly adapter: BuyerSftpTransportAdapter, private readonly now: () => Date = () => new Date()) {}

  proposeProfile(actor: BuyerSftpActor, input: ProposedProfile): BuyerSftpProfile {
    assertBuyerSftpRole(actor, "ASSURERAIL_INTEGRATION_OPERATOR", input.buyerInstitutionId);
    const base = { ...input, proposedByUserId: actor.userId };
    const profile: BuyerSftpProfile = {
      ...base,
      status: "PROPOSED",
      approvedByUserId: null,
      buyerAcceptanceEvidenceRef: null,
      configurationDigest: sha256Digest(buyerSftpProfileConfiguration(base)),
    };
    validateBuyerSftpProfile(profile);
    if (this.repository.getProfile(profile.profileId, profile.version)) throw new Error("profile version already exists");
    this.repository.saveProfile(profile);
    this.audit(actor, profile, null, "BUYER_SFTP_PROFILE_PROPOSED", { configurationDigest: profile.configurationDigest });
    return profile;
  }

  approveProfile(actor: BuyerSftpActor, profileId: string, version: number, buyerAcceptanceEvidenceRef: string): BuyerSftpProfile {
    const proposed = this.requireProfile(profileId, version);
    assertBuyerSftpRole(actor, "ASSURERAIL_EXPORT_CHECKER", proposed.buyerInstitutionId);
    if (proposed.status !== "PROPOSED") throw new Error("only a proposed profile can be approved");
    const approved = validateBuyerSftpProfile({ ...proposed, status: "APPROVED", approvedByUserId: actor.userId, buyerAcceptanceEvidenceRef });
    this.repository.saveProfile(approved);
    this.audit(actor, approved, null, "BUYER_SFTP_PROFILE_APPROVED", { buyerAcceptanceEvidenceRef });
    return approved;
  }

  suspendProfile(actor: BuyerSftpActor, profileId: string, version: number, reasonCode: string): BuyerSftpProfile {
    const current = this.requireProfile(profileId, version);
    assertBuyerSftpRole(actor, "ASSURERAIL_EXPORT_CHECKER", current.buyerInstitutionId);
    if (current.status !== "APPROVED") throw new Error("only an approved profile can be suspended");
    if (!/^[A-Z][A-Z0-9_]{1,79}$/.test(reasonCode)) throw new Error("a structured suspension reason is required");
    const suspended: BuyerSftpProfile = { ...current, status: "SUSPENDED" };
    this.repository.saveProfile(suspended);
    this.audit(actor, suspended, null, "BUYER_SFTP_PROFILE_SUSPENDED", { reasonCode });
    return suspended;
  }

  proposeExport(actor: BuyerSftpActor, input: {
    profileId: string; profileVersion: number; sellerInstitutionId: string; engagementId: string; caseId?: string | null;
    idempotencyKey: string; files: readonly ExportFileInput[];
  }): BuyerSftpExportRecord {
    const profile = this.requireProfile(input.profileId, input.profileVersion);
    if (profile.status !== "APPROVED") throw new Error("an approved buyer SFTP profile is required");
    assertBuyerSftpRole(actor, "SELLER_EXPORT_MAKER", profile.buyerInstitutionId, input.sellerInstitutionId);
    requireBuyerSftpIdentifier(input.idempotencyKey, "idempotencyKey");
    requireBuyerSftpIdentifier(input.engagementId, "engagementId");
    if (input.caseId) requireBuyerSftpIdentifier(input.caseId, "caseId");
    if (!input.files.length || input.files.length > 1000) throw new Error("one to 1000 files are required");
    const names = new Set<string>();
    let totalBytes = 0;
    const manifestFiles = input.files.map((file) => {
      const filename = assertSafeExportFilename(file.filename);
      if (names.has(filename)) throw new Error("filenames must be unique within a batch");
      names.add(filename);
      if (!profile.allowListedDocumentFamilies.includes(file.documentFamily)) throw new Error(`document family ${file.documentFamily} is not allow-listed`);
      if (!(file.content instanceof Uint8Array) || file.content.byteLength < 1 || file.content.byteLength > profile.maximumFileBytes) throw new Error("file size is outside the approved profile");
      totalBytes += file.content.byteLength;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > profile.maximumBatchBytes) throw new Error("batch size is outside the approved profile");
      if (!/^[a-z]+\/[a-z0-9.+-]+$/.test(file.mediaType)) throw new Error("mediaType must be explicit and bounded");
      return { filename, documentFamily: file.documentFamily, mediaType: file.mediaType, bytes: file.content.byteLength, sha256Digest: fileSha256(file.content) };
    });
    const requestDigest = sha256Digest({ profileDigest: profile.configurationDigest, sellerInstitutionId: input.sellerInstitutionId, engagementId: input.engagementId, caseId: input.caseId ?? null, files: manifestFiles });
    const idempotencyScope = `${profile.buyerInstitutionId}:${input.sellerInstitutionId}:${profile.profileId}:${input.idempotencyKey}`;
    const existing = this.repository.findByIdempotencyScope(idempotencyScope);
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new Error("idempotency key was already used with a different export request");
      return existing;
    }
    const createdAt = this.now();
    const batchRef = `sftp_${randomUUID().replaceAll("-", "")}`;
    const manifest: BuyerSftpManifest = {
      manifestVersion: "1.0", batchRef, idempotencyKey: input.idempotencyKey,
      buyerInstitutionId: profile.buyerInstitutionId, sellerInstitutionId: input.sellerInstitutionId,
      engagementId: input.engagementId, caseId: input.caseId ?? null, profileId: profile.profileId,
      profileVersion: profile.version, profileConfigurationDigest: profile.configurationDigest,
      schemaVersion: profile.schemaVersion, createdAt: createdAt.toISOString(),
      retentionUntil: new Date(createdAt.getTime() + profile.retentionDays * 86400_000).toISOString(), files: manifestFiles,
    };
    const record: BuyerSftpExportRecord = {
      batchRef, idempotencyScope, requestDigest, profile, manifest, manifestDigest: sha256Digest(manifest),
      remoteFolder: outboundBatchFolder(profile, input.sellerInstitutionId, input.engagementId, batchRef), status: "PROPOSED",
      proposedByUserId: actor.userId, approvedByUserId: null, attempts: 0, nextRetryAt: null,
      providerTransferRef: null, lastReasonCode: null, acknowledgementDigest: null,
    };
    this.repository.saveExport(record);
    this.audit(actor, profile, record, "BUYER_SFTP_EXPORT_PROPOSED", { requestDigest, manifestDigest: record.manifestDigest });
    return record;
  }

  approveExport(actor: BuyerSftpActor, batchRef: string, expectedManifestDigest: string): BuyerSftpExportRecord {
    const record = this.requireExport(batchRef);
    assertBuyerSftpRole(actor, "ASSURERAIL_EXPORT_CHECKER", record.profile.buyerInstitutionId, record.manifest.sellerInstitutionId);
    if (actor.userId === record.proposedByUserId) throw new Error("export maker cannot approve their own proposal");
    if (record.status !== "PROPOSED" || record.manifestDigest !== expectedManifestDigest) throw new Error("export is not an unchanged proposal");
    record.status = "APPROVED"; record.approvedByUserId = actor.userId;
    this.repository.saveExport(record);
    this.audit(actor, record.profile, record, "BUYER_SFTP_EXPORT_APPROVED", { manifestDigest: record.manifestDigest });
    return record;
  }

  async dispatch(actor: BuyerSftpActor, batchRef: string, files: readonly ExportFileInput[]): Promise<BuyerSftpExportRecord> {
    const record = this.requireExport(batchRef);
    assertBuyerSftpRole(actor, "ASSURERAIL_INTEGRATION_OPERATOR", record.profile.buyerInstitutionId, record.manifest.sellerInstitutionId);
    const currentProfile = this.requireProfile(record.profile.profileId, record.profile.version);
    if (currentProfile.status !== "APPROVED" || currentProfile.configurationDigest !== record.profile.configurationDigest) throw new Error("buyer SFTP profile is no longer approved for dispatch");
    if (!BUYER_SFTP_BOUNDARY.productionDispatchPermitted && record.profile.environment !== "SANDBOX") throw new Error("production dispatch is fail-closed");
    if (!record.approvedByUserId || actor.userId === record.proposedByUserId) throw new Error("approved maker-checker export required");
    if (!["APPROVED", "RETRYABLE"].includes(record.status)) throw new Error("export is not dispatchable; reconcile ambiguous outcomes first");
    if (record.status === "RETRYABLE" && record.nextRetryAt && this.now() < new Date(record.nextRetryAt)) throw new Error("retry backoff has not elapsed");
    if (record.attempts >= record.profile.retryPolicy.maximumAttempts) throw new Error("maximum dispatch attempts reached");
    if (this.now() >= new Date(record.manifest.retentionUntil)) throw new Error("export retention window has expired");
    const transportFiles = this.validateDispatchFiles(record, files);
    record.status = "DISPATCHING"; record.attempts += 1; record.nextRetryAt = null; this.repository.saveExport(record);
    this.audit(actor, record.profile, record, "BUYER_SFTP_DISPATCH_ATTEMPTED", { attempt: record.attempts });
    const manifestBytes = Buffer.from(canonicalSerialize(record.manifest), "utf8");
    const batch: BuyerSftpTransportBatch = { batchRef, remoteFolder: record.remoteFolder, manifestFilename: `${batchRef}.manifest.json`, manifestBytes, manifestDigest: record.manifestDigest, files: transportFiles };
    let result: BuyerSftpUploadResult;
    try {
      result = await this.adapter.upload(record.profile, batch);
      this.validateUploadResult(result);
    } catch {
      record.status = "AMBIGUOUS_REQUIRES_RECONCILIATION";
      record.lastReasonCode = "ADAPTER_EXCEPTION";
      this.repository.saveExport(record);
      this.audit(actor, record.profile, record, "BUYER_SFTP_DISPATCH_OBSERVED", { outcome: "AMBIGUOUS", status: record.status, attempt: record.attempts });
      return record;
    }
    if (result.outcome === "UPLOADED") {
      record.status = "AWAITING_ACKNOWLEDGEMENT"; record.providerTransferRef = result.providerTransferRef; record.lastReasonCode = null;
    } else if (result.outcome === "AMBIGUOUS") {
      record.status = "AMBIGUOUS_REQUIRES_RECONCILIATION"; record.lastReasonCode = result.reasonCode;
    } else {
      record.lastReasonCode = result.reasonCode;
      if (result.retriable && record.attempts < record.profile.retryPolicy.maximumAttempts) {
        record.status = "RETRYABLE";
        const delay = Math.min(record.profile.retryPolicy.initialDelaySeconds * 2 ** (record.attempts - 1), record.profile.retryPolicy.maximumDelaySeconds);
        record.nextRetryAt = new Date(this.now().getTime() + delay * 1000).toISOString();
      } else record.status = "FAILED_FINAL";
    }
    this.repository.saveExport(record);
    this.audit(actor, record.profile, record, "BUYER_SFTP_DISPATCH_OBSERVED", { outcome: result.outcome, status: record.status, attempt: record.attempts });
    return record;
  }

  async reconcileAmbiguous(actor: BuyerSftpActor, batchRef: string): Promise<BuyerSftpExportRecord> {
    const record = this.requireExport(batchRef);
    assertBuyerSftpRole(actor, "ASSURERAIL_INTEGRATION_OPERATOR", record.profile.buyerInstitutionId, record.manifest.sellerInstitutionId);
    if (record.status !== "AMBIGUOUS_REQUIRES_RECONCILIATION") throw new Error("only an ambiguous export can be reconciled");
    let result: BuyerSftpInspectionResult;
    try {
      result = await this.adapter.inspect(record.profile, record.remoteFolder, record.manifestDigest);
      this.validateInspectionResult(result);
    } catch {
      record.lastReasonCode = "RECONCILIATION_EXCEPTION";
      this.repository.saveExport(record);
      this.audit(actor, record.profile, record, "BUYER_SFTP_AMBIGUOUS_RECONCILED", { outcome: "UNKNOWN", status: record.status });
      return record;
    }
    if (result.outcome === "PRESENT") {
      if (result.manifestDigest !== record.manifestDigest) throw new Error("remote manifest digest does not match");
      record.status = "AWAITING_ACKNOWLEDGEMENT"; record.providerTransferRef = result.providerTransferRef; record.lastReasonCode = null;
    } else if (result.outcome === "ABSENT") {
      record.status = record.attempts < record.profile.retryPolicy.maximumAttempts ? "RETRYABLE" : "FAILED_FINAL";
      record.nextRetryAt = record.status === "RETRYABLE" ? this.now().toISOString() : null;
      record.lastReasonCode = "RECONCILED_ABSENT";
    } else {
      record.lastReasonCode = result.reasonCode;
    }
    this.repository.saveExport(record);
    this.audit(actor, record.profile, record, "BUYER_SFTP_AMBIGUOUS_RECONCILED", { outcome: result.outcome, status: record.status });
    return record;
  }

  recordAcknowledgement(actor: BuyerSftpActor, acknowledgement: BuyerSftpAcknowledgement): BuyerSftpExportRecord {
    const record = this.requireExport(acknowledgement.batchRef);
    assertBuyerSftpRole(actor, "BUYER_ACKNOWLEDGER", record.profile.buyerInstitutionId, record.manifest.sellerInstitutionId);
    const acknowledgementDigest = sha256Digest(acknowledgement);
    if (record.acknowledgementDigest) {
      if (record.acknowledgementDigest === acknowledgementDigest) return record;
      throw new Error("a different acknowledgement is already recorded for this batch state");
    }
    if (!["AWAITING_ACKNOWLEDGEMENT", "PARTIAL_REQUIRES_RECONCILIATION"].includes(record.status)) throw new Error("export is not awaiting buyer acknowledgement");
    if (acknowledgement.buyerInstitutionId !== record.profile.buyerInstitutionId || acknowledgement.manifestDigest !== record.manifestDigest) throw new Error("acknowledgement is outside the batch scope");
    requireBuyerSftpIdentifier(acknowledgement.acknowledgementRef, "acknowledgementRef");
    const buyerObservedAt = Date.parse(acknowledgement.buyerObservedAt);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(acknowledgement.buyerObservedAt) || !Number.isFinite(buyerObservedAt) || buyerObservedAt < Date.parse(record.manifest.createdAt) || buyerObservedAt > this.now().getTime() + 5 * 60_000) throw new Error("buyerObservedAt must be a plausible ISO timestamp for this batch");
    const expected = new Set(record.manifest.files.map((file) => file.sha256Digest));
    const accepted = new Set(acknowledgement.acceptedFileDigests);
    const rejected = new Map(acknowledgement.rejectedFiles.map((file) => [file.fileDigest, file.reasonCode]));
    if (accepted.size !== acknowledgement.acceptedFileDigests.length || rejected.size !== acknowledgement.rejectedFiles.length) throw new Error("acknowledgement file digests must be unique");
    for (const digest of [...accepted, ...rejected.keys()]) if (!expected.has(digest)) throw new Error("acknowledgement contains an unknown file digest");
    for (const digest of accepted) if (rejected.has(digest)) throw new Error("a file cannot be accepted and rejected");
    if (accepted.size + rejected.size !== expected.size) throw new Error("acknowledgement must account for every file");
    if (acknowledgement.rejectedFiles.some((file) => !/^[A-Z][A-Z0-9_]{1,79}$/.test(file.reasonCode))) throw new Error("rejection reason codes must be structured");
    if (acknowledgement.status === "ACCEPTED" && rejected.size === 0 && accepted.size === expected.size) record.status = "BUYER_ACCEPTED";
    else if (acknowledgement.status === "PARTIAL" && accepted.size > 0 && rejected.size > 0) record.status = "PARTIAL_REQUIRES_RECONCILIATION";
    else if (acknowledgement.status === "REJECTED" && accepted.size === 0 && rejected.size === expected.size) record.status = "BUYER_REJECTED";
    else throw new Error("acknowledgement status does not match file outcomes");
    record.acknowledgementDigest = acknowledgementDigest;
    this.repository.saveExport(record);
    this.audit(actor, record.profile, record, "BUYER_SFTP_ACKNOWLEDGEMENT_RECORDED", { status: record.status, acknowledgementDigest: record.acknowledgementDigest });
    return record;
  }

  private validateDispatchFiles(record: BuyerSftpExportRecord, files: readonly ExportFileInput[]) {
    if (files.length !== record.manifest.files.length) throw new Error("dispatch files do not match the approved manifest");
    const supplied = new Map(files.map((file) => [file.filename, file]));
    return record.manifest.files.map((expected) => {
      const file = supplied.get(expected.filename);
      if (!file || file.documentFamily !== expected.documentFamily || file.mediaType !== expected.mediaType || file.content.byteLength !== expected.bytes || fileSha256(file.content) !== expected.sha256Digest) throw new Error("dispatch files do not match the approved manifest");
      return { filename: expected.filename, content: file.content, digest: expected.sha256Digest };
    });
  }

  private requireProfile(profileId: string, version: number): BuyerSftpProfile { const value = this.repository.getProfile(profileId, version); if (!value) throw new Error("buyer SFTP profile not found"); return validateBuyerSftpProfile(value); }
  private requireExport(batchRef: string): BuyerSftpExportRecord { const value = this.repository.getExport(batchRef); if (!value) throw new Error("buyer SFTP export not found"); return value; }
  private requireReasonCode(reasonCode: string): void { if (!/^[A-Z][A-Z0-9_]{1,79}$/.test(reasonCode)) throw new Error("adapter reasonCode must be structured"); }
  private validateUploadResult(result: BuyerSftpUploadResult): void {
    if (result.outcome === "UPLOADED") requireBuyerSftpIdentifier(result.providerTransferRef, "providerTransferRef");
    else this.requireReasonCode(result.reasonCode);
  }
  private validateInspectionResult(result: BuyerSftpInspectionResult): void {
    if (result.outcome === "PRESENT") requireBuyerSftpIdentifier(result.providerTransferRef, "providerTransferRef");
    else if (result.outcome === "UNKNOWN") this.requireReasonCode(result.reasonCode);
  }
  private audit(actor: BuyerSftpActor, profile: BuyerSftpProfile, record: BuyerSftpExportRecord | null, eventType: string, detail: unknown): void {
    this.repository.appendAudit({ occurredAt: this.now().toISOString(), eventType, actorUserId: actor.userId, actorInstitutionId: actor.institutionId, buyerInstitutionId: profile.buyerInstitutionId, sellerInstitutionId: record?.manifest.sellerInstitutionId ?? null, profileId: profile.profileId, batchRef: record?.batchRef ?? null, detailDigest: sha256Digest(detail) });
  }
}
