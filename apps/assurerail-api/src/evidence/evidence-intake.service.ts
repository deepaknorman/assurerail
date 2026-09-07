import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { audit } from "../common/audit";
import {
  assertSha256Digest,
  assertValidNeutralEnvelopeV1,
  sha256Digest,
  toCanonicalValue,
  type NeutralIntakeEnvelopeV1,
} from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PersistenceFoundationService } from "../persistence/persistence-foundation.service";
import { PrismaService } from "../store/prisma.service";
import { detectContentType, MAX_EVIDENCE_BYTES, safeFilename } from "./content-policy";
import { MalwareScanner, type MalwareScanResult } from "./malware-scanner.service";
import { EvidenceObjectStore, type RetrievedObject } from "./object-store.service";
import {
  assertConformancePassed,
  assertIntakeProfile,
  parseConnectorSchemaProfiles,
} from "./provider-profiles";
import { parseWebhookEndpoint } from "../platform/webhook-egress.service";

const CLASSIFICATIONS = ["PUBLIC", "INSTITUTION_CONFIDENTIAL", "CASE_CONFIDENTIAL", "RESTRICTED"] as const;
const TRANSPORTS = ["FILE", "API"] as const;
const NON_LIVE_MODES = ["REPLAY", "SHADOW"] as const;

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return trimmed;
}

function optional(value: unknown, name: string, max = 300): string | null {
  return value === undefined || value === null || value === "" ? null : required(value, name, max);
}

function oneOf(value: unknown, name: string, values: readonly string[]): string {
  const candidate = required(value, name, 120);
  if (!values.includes(candidate)) throw new BadRequestException(`${name} must be one of: ${values.join(", ")}`);
  return candidate;
}

function date(value: unknown, name: string): Date {
  const parsed = new Date(required(value, name, 80));
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function optionalDate(value: unknown, name: string): Date | null {
  return value === undefined || value === null || value === "" ? null : date(value, name);
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

function unique(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

function ensureShadow(): void {
  if (inspectPersistenceFlags(process.env).neutralIngress !== "shadow") {
    throw new ForbiddenException("provider-neutral intake is disabled");
  }
}

export interface DocumentMetadata {
  idempotencyKey?: string;
  connectorRegistrationId?: string;
  evidenceObjectId?: string | null;
  transactionCaseId?: string | null;
  evidenceType?: string;
  classification?: string;
  purpose?: string;
  retentionUntilAt?: string;
  title?: string;
  documentType?: string;
  filename?: string;
  contentType?: string;
  schemaId?: string;
  schemaVersion?: string;
  sourceAsOfAt?: string;
  expiresAt?: string | null;
  signatureStatus?: string;
  result?: string;
  profileRef?: string;
  qualifications?: unknown;
}

@Injectable()
export class EvidenceIntakeService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
    private readonly persistence: PersistenceFoundationService,
    private readonly scanner: MalwareScanner,
    private readonly objects: EvidenceObjectStore,
  ) {}

  async listConnectors(actorUserId: string, institutionId: string) {
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "VIEW_INSTITUTION" });
    return this.db.connectorRegistration.findMany({
      where: { institutionId },
      orderBy: { createdAt: "asc" },
      include: { certifications: { orderBy: { createdAt: "desc" } } },
    });
  }

  async registerConnector(actorUserId: string, institutionId: string, body: {
    connectorKey?: string;
    connectorType?: string;
    displayName?: string;
    transport?: string;
    endpoint?: string | null;
    schemaProfiles?: unknown;
    credentialVaultRef?: string | null;
    providerKey?: string;
    providerType?: string;
  }) {
    ensureShadow();
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "OPERATE_CONNECTORS" });
    const connectorKey = required(body.connectorKey, "connectorKey", 120);
    const transport = oneOf(body.transport, "transport", TRANSPORTS);
    const endpoint = optional(body.endpoint, "endpoint", 500);
    if (transport === "API" && !endpoint) throw new BadRequestException("API connectors require an HTTPS endpoint");
    if (transport === "API") parseWebhookEndpoint(endpoint!);
    if (transport === "FILE" && endpoint) throw new BadRequestException("FILE connectors must not declare an endpoint");
    if (body.credentialVaultRef && !String(body.credentialVaultRef).startsWith("vault://")) {
      throw new BadRequestException("credentialVaultRef must be an opaque vault:// reference");
    }
    const schemaProfiles = parseConnectorSchemaProfiles(body.schemaProfiles);
    try {
      const connector = await this.db.$transaction(async (tx) => {
        const provider = await tx.providerReference.upsert({
          where: { providerType_providerKey: {
            providerType: required(body.providerType, "providerType", 120),
            providerKey: required(body.providerKey, "providerKey", 200),
          } },
          create: {
            id: `prv_${randomUUID()}`,
            providerType: required(body.providerType, "providerType", 120),
            providerKey: required(body.providerKey, "providerKey", 200),
            displayName: required(body.displayName, "displayName", 200),
            institutionId,
          },
          update: {},
        });
        if (provider.status !== "ACTIVE" || (provider.institutionId && provider.institutionId !== institutionId)) {
          throw new ConflictException("provider reference is unavailable to this institution");
        }
        return tx.connectorRegistration.create({
          data: {
            id: `conn_${randomUUID()}`,
            institutionId,
            providerReferenceId: provider.id,
            connectorKey,
            connectorType: required(body.connectorType, "connectorType", 120),
            displayName: required(body.displayName, "displayName", 200),
            transport,
            endpoint,
            schemaProfiles: json(schemaProfiles),
            credentialVaultRef: optional(body.credentialVaultRef, "credentialVaultRef", 500),
            createdByUserId: actorUserId,
          },
        });
      });
      audit("rail.connector.registered", { actorUserId, institutionId, connectorId: connector.id, transport });
      return connector;
    } catch (error) {
      if (unique(error)) throw new ConflictException("connectorKey already exists for this institution");
      throw error;
    }
  }

  async proposeCertification(actorUserId: string, institutionId: string, connectorId: string, body: {
    profileRef?: string;
    schemaId?: string;
    schemaVersion?: string;
    operatingMode?: string;
    conformanceEvidenceDigest?: string;
    conformanceResult?: unknown;
    qualifications?: unknown;
    reason?: string;
    expiresAt?: string | null;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    ensureShadow();
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "OPERATE_CONNECTORS" });
    const connector = await this.db.connectorRegistration.findUnique({ where: { id: connectorId } });
    if (!connector || connector.institutionId !== institutionId) throw new NotFoundException("connector not found");
    if (["SUSPENDED", "REVOKED"].includes(connector.status)) throw new ConflictException("connector is not certifiable");
    const operatingMode = oneOf(body.operatingMode, "operatingMode", NON_LIVE_MODES);
    const profileRef = required(body.profileRef, "profileRef", 200);
    const profiles = parseConnectorSchemaProfiles(connector.schemaProfiles);
    if (!profiles.some((profile) => profile.profileRef === profileRef && profile.schemaId === body.schemaId && profile.schemaVersion === body.schemaVersion)) {
      throw new BadRequestException("certification must match a profile declared on the connector");
    }
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException("expiresAt must be in the future");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const certification = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId,
        purpose: "CONNECTOR_CERTIFICATION_PROPOSE", institutionId,
      }, tx);
      return tx.connectorCertification.create({
        data: {
          id: `cert_${randomUUID()}`,
          connectorRegistrationId: connectorId,
          profileRef,
          schemaId: required(body.schemaId, "schemaId", 200),
          schemaVersion: required(body.schemaVersion, "schemaVersion", 80),
          operatingMode,
          conformanceEvidenceDigest: assertSha256Digest(required(body.conformanceEvidenceDigest, "conformanceEvidenceDigest"), "conformanceEvidenceDigest"),
          conformanceResult: json(body.conformanceResult),
          qualifications: json(body.qualifications),
          reason: required(body.reason, "reason", 1000),
          proposedByUserId: actorUserId,
          proposalStepUpId: stepUpEvidenceId,
          expiresAt,
        },
      });
    });
    audit("rail.connector.certification_proposed", { actorUserId, institutionId, connectorId, certificationId: certification.id });
    return certification;
  }

  async reviewCertification(actorUserId: string, certificationId: string, body: {
    approve?: boolean;
    reviewReason?: string;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    ensureShadow();
    await this.requirePlatformAdmin(actorUserId);
    const current = await this.db.connectorCertification.findUnique({
      where: { id: certificationId }, include: { connectorRegistration: true },
    });
    if (!current) throw new NotFoundException("connector certification not found");
    if (current.status !== "PROPOSED") throw new ConflictException("connector certification is already terminal");
    if (current.proposedByUserId === actorUserId) throw new ForbiddenException("maker cannot review their own connector certification");
    if (current.expiresAt && current.expiresAt <= new Date()) throw new ConflictException("connector certification proposal has expired");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const approved = body.approve === true;
    if (approved) assertConformancePassed(current.conformanceResult);
    const reviewed = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId,
        purpose: "CONNECTOR_CERTIFICATION_REVIEW", institutionId: current.connectorRegistration.institutionId,
      }, tx);
      const claimed = await tx.connectorCertification.updateMany({
        where: { id: current.id, status: "PROPOSED", reviewedByUserId: null },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          reviewedByUserId: actorUserId,
          reviewStepUpId: stepUpEvidenceId,
          reviewReason: required(body.reviewReason, "reviewReason", 1000),
          effectiveAt: approved ? new Date() : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("connector certification was concurrently reviewed");
      if (approved) await tx.connectorRegistration.update({
        where: { id: current.connectorRegistrationId }, data: { status: "CERTIFIED_SHADOW" },
      });
      return tx.connectorCertification.findUniqueOrThrow({ where: { id: current.id } });
    });
    audit("rail.connector.certification_reviewed", { actorUserId, certificationId, approved });
    return reviewed;
  }

  async ingestJson(actorUserId: string, institutionId: string, body: {
    connectorRegistrationId?: string;
    evidenceObjectId?: string | null;
    evidenceType?: string;
    classification?: string;
    purpose?: string;
    retentionUntilAt?: string;
    result?: string;
    profileRef?: string;
    qualifications?: unknown;
    envelope?: NeutralIntakeEnvelopeV1;
  }) {
    ensureShadow();
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "MANAGE_EVIDENCE" });
    if (body.result !== undefined && body.result !== "REVIEW_REQUIRED") {
      throw new BadRequestException("intake cannot self-assert an assurance result; REVIEW_REQUIRED is mandatory");
    }
    if (!body.envelope) throw new BadRequestException("envelope is required");
    assertValidNeutralEnvelopeV1(body.envelope);
    await this.requireCaseParticipant(institutionId, body.envelope.transactionCaseId, true);
    const profileRef = required(body.profileRef, "profileRef", 200);
    assertIntakeProfile(profileRef, body.envelope);
    const connector = await this.certifiedConnector(institutionId, body.connectorRegistrationId, profileRef, body.envelope.schemaId, body.envelope.schemaVersion);
    const retentionUntilAt = date(body.retentionUntilAt, "retentionUntilAt");
    if (retentionUntilAt <= new Date()) throw new BadRequestException("retentionUntilAt must be in the future");
    const persisted = await this.persistence.persistIntake(connector.providerReferenceId!, "API", body.envelope);
    let materialized = persisted.replay
      ? await this.db.evidenceVersion.findUnique({
        where: { intakeSubmissionId: persisted.submissionId },
        select: { id: true, evidenceObjectId: true, version: true, intakeSubmission: { select: { sourceReferenceId: true } } },
      })
      : null;
    const existingSourceReferenceId = materialized?.intakeSubmission?.sourceReferenceId;
    if (materialized && existingSourceReferenceId) {
      return {
        ...persisted,
        replay: true,
        evidenceObjectId: materialized.evidenceObjectId,
        evidenceVersionId: materialized.id,
        version: materialized.version,
        sourceReferenceId: existingSourceReferenceId,
      };
    }
    const envelope = body.envelope;
    const source = await this.createOrVerifySourceReference(connector.providerReferenceId!, institutionId, envelope);
    if (existingSourceReferenceId && existingSourceReferenceId !== source.id) {
      throw new ConflictException("intake submission is already bound to a different source reference");
    }
    await this.db.intakeSubmission.update({ where: { id: persisted.submissionId }, data: { sourceReferenceId: source.id, institutionId } });
    if (materialized) {
      return {
        ...persisted,
        replay: true,
        evidenceObjectId: materialized.evidenceObjectId,
        evidenceVersionId: materialized.id,
        version: materialized.version,
        sourceReferenceId: source.id,
      };
    }
    let evidence;
    try {
      evidence = await this.persistJsonEvidence({
        actorUserId,
        institutionId,
        evidenceObjectId: optional(body.evidenceObjectId, "evidenceObjectId", 160),
        transactionCaseId: envelope.transactionCaseId,
        evidenceType: required(body.evidenceType, "evidenceType", 120),
        classification: oneOf(body.classification, "classification", CLASSIFICATIONS),
        purpose: required(body.purpose, "purpose", 200),
        retentionUntilAt,
        result: "REVIEW_REQUIRED",
        qualifications: body.qualifications,
        envelope,
        intakeSubmissionId: persisted.submissionId,
        providerReferenceId: connector.providerReferenceId!,
        sourceReferenceId: source.id,
      });
    } catch (error) {
      if (!unique(error)) throw error;
      // Concurrent identical requests may both observe the durable intake before either has
      // materialised it. The unique intakeSubmissionId constraint selects the winner. Return that
      // winner instead of leaking a storage-level conflict or creating an orphan evidence object.
      materialized = await this.db.evidenceVersion.findUnique({
        where: { intakeSubmissionId: persisted.submissionId },
        select: { id: true, evidenceObjectId: true, version: true, intakeSubmission: { select: { sourceReferenceId: true } } },
      });
      if (!materialized || materialized.intakeSubmission?.sourceReferenceId !== source.id) throw error;
      evidence = { replay: true, evidenceObjectId: materialized.evidenceObjectId, evidenceVersionId: materialized.id, version: materialized.version };
    }
    audit("rail.evidence.json_ingested", { actorUserId, institutionId, evidenceObjectId: evidence.evidenceObjectId, submissionId: persisted.submissionId });
    return { ...persisted, ...evidence, replay: persisted.replay || evidence.replay, sourceReferenceId: source.id };
  }

  async ingestDocument(actorUserId: string, institutionId: string, input: Readable, metadata: DocumentMetadata) {
    ensureShadow();
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "MANAGE_EVIDENCE" });
    if (metadata.result !== undefined && metadata.result !== "REVIEW_REQUIRED") {
      throw new BadRequestException("intake cannot self-assert an assurance result; REVIEW_REQUIRED is mandatory");
    }
    const profileRef = required(metadata.profileRef, "profileRef", 200);
    const transactionCaseId = optional(metadata.transactionCaseId, "transactionCaseId", 160);
    if (transactionCaseId) await this.requireCaseParticipant(institutionId, transactionCaseId, true);
    const connector = await this.certifiedConnector(institutionId, metadata.connectorRegistrationId, profileRef, metadata.schemaId, metadata.schemaVersion);
    const filename = safeFilename(metadata.filename);
    const claimedContentType = required(metadata.contentType, "contentType", 160).toLowerCase();
    const retentionUntilAt = date(metadata.retentionUntilAt, "retentionUntilAt");
    if (retentionUntilAt <= new Date()) throw new BadRequestException("retentionUntilAt must be in the future");
    const sourceAsOfAt = date(metadata.sourceAsOfAt, "sourceAsOfAt");
    const expiresAt = optionalDate(metadata.expiresAt, "expiresAt");
    if (expiresAt && expiresAt <= sourceAsOfAt) throw new BadRequestException("expiresAt must be after sourceAsOfAt");
    const idempotencyKey = required(metadata.idempotencyKey, "idempotencyKey", 200);
    const scratch = await fs.mkdtemp(join(tmpdir(), "assurerail-evidence."));
    const path = join(scratch, "payload");
    let storedRef: string | null = null;
    let command: { recordId: string; requestDigest: string } | null = null;
    let databaseCommitted = false;
    try {
      const spool = await this.spool(input, path);
      const detectedContentType = detectContentType(spool.header, filename, claimedContentType);
      const requestDigest = sha256Digest({ institutionId, metadata, payloadDigest: spool.payloadDigest });
      const started = await this.persistence.beginIdempotentCommand({
        scope: `evidence-document:${institutionId}`, key: idempotencyKey, requestDigest, institutionId,
      });
      if (started.replay) {
        if (started.status === "COMPLETED" && started.response) return started.response;
        throw new ConflictException(`document command is already ${started.status}`);
      }
      command = { recordId: started.recordId, requestDigest };
      const scan = await this.scanner.scan(path);
      let stored: { storageRef: string; objectVersionRef: string | null } | null = null;
      if (scan.status === "CLEAN") {
        const objectKey = `evidence/${institutionId}/${new Date().getUTCFullYear()}/${randomUUID()}-${spool.payloadDigest.slice(0, 16)}`;
        stored = await this.objects.put({ key: objectKey, path, size: spool.size, contentType: detectedContentType, digestHex: spool.payloadDigest });
        storedRef = stored.storageRef;
      }
      const response = await this.persistDocumentEvidence({
        actorUserId, institutionId, metadata, connectorProviderReferenceId: connector.providerReferenceId!,
        filename, detectedContentType, size: spool.size, payloadDigest: spool.payloadDigest,
        retentionUntilAt, sourceAsOfAt, expiresAt, scan, stored,
      });
      databaseCommitted = true;
      if (response.replay && storedRef) {
        await this.objects.delete(storedRef).catch(() => undefined);
        storedRef = null;
      }
      await this.persistence.completeIdempotentCommand(command.recordId, command.requestDigest, response);
      audit("rail.evidence.document_ingested", { actorUserId, institutionId, evidenceObjectId: response.evidenceObjectId, validationStatus: response.validationStatus });
      return response;
    } catch (error) {
      if (storedRef && !databaseCommitted) await this.objects.delete(storedRef).catch(() => undefined);
      if (command && !databaseCommitted) await this.persistence.failIdempotentCommand(command.recordId, command.requestDigest, {
        code: (error as { name?: string }).name ?? "ERROR", message: (error as Error).message.slice(0, 500),
      });
      throw error;
    } finally {
      await fs.rm(scratch, { recursive: true, force: true });
    }
  }

  async listEvidence(actorUserId: string, actingInstitutionId: string) {
    await this.access.requireHuman({ userId: actorUserId, institutionId: actingInstitutionId, action: "VIEW_EVIDENCE" });
    const now = new Date();
    const caseScopeEnforced = inspectPersistenceFlags(process.env).transactionCase === "shadow";
    const allowedCaseIds = caseScopeEnforced ? await this.allowedCaseIds(actingInstitutionId) : [];
    const ownership: Prisma.EvidenceObjectWhereInput = { OR: [
      { institutionId: actingInstitutionId },
      { grants: { some: { granteeInstitutionId: actingInstitutionId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
    ] };
    return this.db.evidenceObject.findMany({
      where: caseScopeEnforced
        ? { AND: [ownership, { OR: [{ transactionCaseId: null }, { transactionCaseId: { in: allowedCaseIds } }] }] }
        : ownership,
      orderBy: { createdAt: "desc" },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1, include: { documentVersion: true } },
        documentFamily: true,
      },
    });
  }

  async getEvidence(actorUserId: string, actingInstitutionId: string, evidenceObjectId: string) {
    const evidence = await this.authoriseRead(actorUserId, actingInstitutionId, evidenceObjectId);
    await this.recordAccess(evidence.id, evidence.versions[0]?.id ?? null, actorUserId, actingInstitutionId, "VIEW", evidence.purpose);
    return evidence;
  }

  async download(actorUserId: string, actingInstitutionId: string, evidenceObjectId: string): Promise<{
    object: RetrievedObject;
    filename: string;
    contentType: string;
  }> {
    const evidence = await this.authoriseRead(actorUserId, actingInstitutionId, evidenceObjectId);
    const version = evidence.versions[0];
    const document = version?.documentVersion;
    if (!version || version.validationStatus !== "VALID" || evidence.status !== "AVAILABLE" || !document || document.malwareStatus !== "CLEAN") {
      throw new ForbiddenException("evidence is not available for download");
    }
    const object = await this.objects.get(document.storageRef);
    await this.recordAccess(evidence.id, version.id, actorUserId, actingInstitutionId, "DOWNLOAD_REQUESTED", evidence.purpose);
    return { object, filename: document.filename, contentType: document.detectedContentType };
  }

  async grantAccess(actorUserId: string, institutionId: string, evidenceObjectId: string, body: {
    granteeInstitutionId?: string;
    purpose?: string;
    classification?: string;
    expiresAt?: string | null;
  }) {
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "MANAGE_EVIDENCE" });
    const evidence = await this.db.evidenceObject.findUnique({ where: { id: evidenceObjectId } });
    if (!evidence || evidence.institutionId !== institutionId) throw new NotFoundException("evidence object not found");
    const granteeInstitutionId = required(body.granteeInstitutionId, "granteeInstitutionId", 160);
    const grantee = await this.db.institution.findUnique({ where: { id: granteeInstitutionId }, include: { admission: true } });
    if (!grantee || grantee.status !== "ACTIVE" || grantee.admission?.status !== "ADMITTED") {
      throw new BadRequestException("grantee must be an admitted institution");
    }
    if (evidence.transactionCaseId) await this.requireCaseParticipant(granteeInstitutionId, evidence.transactionCaseId, false);
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException("expiresAt must be in the future");
    const purpose = required(body.purpose, "purpose", 200);
    if (purpose !== evidence.purpose) throw new BadRequestException("grant purpose must match the evidence purpose");
    const classification = oneOf(body.classification, "classification", CLASSIFICATIONS);
    if (classification !== evidence.classification) throw new BadRequestException("grant classification must match the evidence classification");
    const grant = await this.db.evidenceAccessGrant.upsert({
      where: { evidenceObjectId_granteeInstitutionId_purpose: { evidenceObjectId, granteeInstitutionId, purpose } },
      create: { id: `egrant_${randomUUID()}`, evidenceObjectId, granteeInstitutionId, purpose, classification, expiresAt, grantedByUserId: actorUserId },
      update: { status: "ACTIVE", classification, expiresAt, grantedByUserId: actorUserId, revokedAt: null },
    });
    audit("rail.evidence.access_granted", { actorUserId, institutionId, evidenceObjectId, granteeInstitutionId, purpose });
    return grant;
  }

  async setLegalHold(actorUserId: string, evidenceObjectId: string, body: {
    legalHold?: boolean;
    reason?: string;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    ensureShadow();
    const admin = await this.requirePlatformAdmin(actorUserId);
    const evidence = await this.db.evidenceObject.findUnique({ where: { id: evidenceObjectId } });
    if (!evidence) throw new NotFoundException("evidence object not found");
    const legalHold = body.legalHold === true;
    if (!legalHold && admin.platformRole !== "SUPERADMIN") {
      throw new ForbiddenException("legal hold release requires a platform superadministrator");
    }
    if (evidence.legalHold === legalHold) throw new ConflictException("evidence legal hold already has the requested state");
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const occurredAt = new Date();
    const eventDigest = sha256Digest({
      evidenceObjectId, action: legalHold ? "LEGAL_HOLD_SET" : "LEGAL_HOLD_RELEASED",
      reason, actorUserId, stepUpEvidenceId, priorLegalHold: evidence.legalHold,
      resultingLegalHold: legalHold, occurredAt: occurredAt.toISOString(),
    });
    const event = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId,
        purpose: "EVIDENCE_LEGAL_HOLD_CHANGE", institutionId: evidence.institutionId,
      }, tx);
      const changed = await tx.evidenceObject.updateMany({
        where: { id: evidence.id, legalHold: evidence.legalHold },
        data: { legalHold, status: legalHold ? "RETAINED" : evidence.status },
      });
      if (changed.count !== 1) throw new ConflictException("evidence legal hold was concurrently changed");
      return tx.evidenceRetentionEvent.create({ data: {
        id: `eret_${randomUUID()}`, evidenceObjectId, action: legalHold ? "LEGAL_HOLD_SET" : "LEGAL_HOLD_RELEASED",
        reason, actorUserId, stepUpEvidenceId, priorLegalHold: evidence.legalHold,
        resultingLegalHold: legalHold, eventDigest, occurredAt,
      } });
    });
    audit("rail.evidence.legal_hold_changed", { actorUserId, evidenceObjectId, legalHold, eventDigest });
    return event;
  }

  private async certifiedConnector(institutionId: string, connectorIdValue: unknown, profileRefValue: unknown, schemaIdValue: unknown, schemaVersionValue: unknown) {
    const connectorId = required(connectorIdValue, "connectorRegistrationId", 160);
    const profileRef = required(profileRefValue, "profileRef", 200);
    const schemaId = required(schemaIdValue, "schemaId", 200);
    const schemaVersion = required(schemaVersionValue, "schemaVersion", 80);
    const connector = await this.db.connectorRegistration.findUnique({
      where: { id: connectorId },
      include: { certifications: { where: { status: "APPROVED", profileRef, schemaId, schemaVersion }, orderBy: { effectiveAt: "desc" } } },
    });
    if (!connector || connector.institutionId !== institutionId || connector.status !== "CERTIFIED_SHADOW" || !connector.providerReferenceId) {
      throw new ForbiddenException("connector is not certified for this institution");
    }
    const certification = connector.certifications.find((item) => !item.expiresAt || item.expiresAt > new Date());
    if (!certification || !NON_LIVE_MODES.includes(certification.operatingMode as typeof NON_LIVE_MODES[number])) {
      throw new ForbiddenException("connector schema certification is absent, expired or outside replay/shadow");
    }
    return connector;
  }

  private async createOrVerifySourceReference(providerReferenceId: string, institutionId: string, envelope: NeutralIntakeEnvelopeV1) {
    const identity = {
      providerReferenceId,
      sourceSystem: envelope.source.sourceSystemRef,
      sourceObjectType: envelope.source.sourceObjectType,
      sourceObjectId: envelope.source.sourceObjectRef,
      sourceVersion: envelope.source.sourceSchemaVersion,
    };
    try {
      return await this.db.sourceReference.create({
        data: {
          id: `src_${randomUUID()}`, ...identity,
          schemaId: envelope.source.sourceSchemaId,
          schemaVersion: envelope.source.sourceSchemaVersion,
          payloadDigest: envelope.source.sourcePayloadDigest,
          authoritativeStatus: envelope.source.authorityClass,
          institutionId,
        },
      });
    } catch (error) {
      if (!unique(error)) throw error;
      const existing = await this.db.sourceReference.findUniqueOrThrow({
        where: { providerReferenceId_sourceSystem_sourceObjectType_sourceObjectId_sourceVersion: identity },
      });
      if (existing.payloadDigest !== envelope.source.sourcePayloadDigest || existing.schemaId !== envelope.source.sourceSchemaId) {
        throw new ConflictException("source object version was already recorded with different content");
      }
      return existing;
    }
  }

  private async persistJsonEvidence(input: {
    actorUserId: string; institutionId: string; evidenceObjectId: string | null; transactionCaseId: string;
    evidenceType: string; classification: string; purpose: string; retentionUntilAt: Date; result: string;
    qualifications: unknown; envelope: NeutralIntakeEnvelopeV1; intakeSubmissionId: string;
    providerReferenceId: string; sourceReferenceId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const object = input.evidenceObjectId
        ? await tx.evidenceObject.findUnique({ where: { id: input.evidenceObjectId } })
        : await tx.evidenceObject.create({ data: {
          id: `evo_${randomUUID()}`, institutionId: input.institutionId, transactionCaseId: input.transactionCaseId,
          evidenceType: input.evidenceType, classification: input.classification, purpose: input.purpose,
          retentionUntilAt: input.retentionUntilAt, createdByUserId: input.actorUserId,
        } });
      if (!object || object.institutionId !== input.institutionId) throw new NotFoundException("evidence object not found");
      if (object.transactionCaseId !== input.transactionCaseId) throw new ConflictException("evidence version cannot change transaction case scope");
      if (object.evidenceType !== input.evidenceType || object.classification !== input.classification || object.purpose !== input.purpose) {
        throw new ConflictException("new evidence version cannot change type, classification or purpose");
      }
      const existing = await tx.evidenceVersion.findUnique({
        where: { evidenceObjectId_payloadDigest: { evidenceObjectId: object.id, payloadDigest: input.envelope.payloadDigest } },
      });
      if (existing) return { replay: true, evidenceObjectId: object.id, evidenceVersionId: existing.id, version: existing.version };
      const version = object.currentVersion + 1;
      const signatureStatus = input.envelope.signature.status === "PRESENT" ? "PRESENT_UNVERIFIED" : input.envelope.signature.status;
      const evidenceVersion = await tx.evidenceVersion.create({ data: {
        id: `evv_${randomUUID()}`, evidenceObjectId: object.id, version,
        providerReferenceId: input.providerReferenceId, intakeSubmissionId: input.intakeSubmissionId,
        schemaId: input.envelope.schemaId, schemaVersion: input.envelope.schemaVersion,
        payloadDigest: input.envelope.payloadDigest, signatureStatus, result: input.result,
        sourceAsOfAt: new Date(input.envelope.asOfAt), expiresAt: input.envelope.expiresAt ? new Date(input.envelope.expiresAt) : null,
        qualifications: json(input.qualifications ?? input.envelope.qualifications),
        validationStatus: "VALID", validationDetail: json({ sourceReferenceId: input.sourceReferenceId, signatureCryptographicallyVerified: false }),
        supersedesVersionId: object.currentVersion ? (await tx.evidenceVersion.findUnique({ where: { evidenceObjectId_version: { evidenceObjectId: object.id, version: object.currentVersion } } }))?.id ?? null : null,
        createdByUserId: input.actorUserId,
      } });
      const changed = await tx.evidenceObject.updateMany({
        where: { id: object.id, currentVersion: object.currentVersion },
        data: { currentVersion: version, status: "AVAILABLE", retentionUntilAt: input.retentionUntilAt },
      });
      if (changed.count !== 1) throw new ConflictException("evidence object was concurrently versioned");
      return { replay: false, evidenceObjectId: object.id, evidenceVersionId: evidenceVersion.id, version };
    });
  }

  private async persistDocumentEvidence(input: {
    actorUserId: string; institutionId: string; metadata: DocumentMetadata; connectorProviderReferenceId: string;
    filename: string; detectedContentType: string; size: number; payloadDigest: string;
    retentionUntilAt: Date; sourceAsOfAt: Date; expiresAt: Date | null; scan: MalwareScanResult;
    stored: { storageRef: string; objectVersionRef: string | null } | null;
  }) {
    return this.db.$transaction(async (tx) => {
      let object = input.metadata.evidenceObjectId
        ? await tx.evidenceObject.findUnique({ where: { id: required(input.metadata.evidenceObjectId, "evidenceObjectId", 160) } })
        : null;
      let family = object ? await tx.railDocumentFamily.findUnique({ where: { evidenceObjectId: object.id } }) : null;
      if (!object) {
        object = await tx.evidenceObject.create({ data: {
          id: `evo_${randomUUID()}`, institutionId: input.institutionId,
          transactionCaseId: optional(input.metadata.transactionCaseId, "transactionCaseId", 160),
          evidenceType: required(input.metadata.evidenceType, "evidenceType", 120),
          classification: oneOf(input.metadata.classification, "classification", CLASSIFICATIONS),
          purpose: required(input.metadata.purpose, "purpose", 200), retentionUntilAt: input.retentionUntilAt,
          createdByUserId: input.actorUserId,
        } });
        family = await tx.railDocumentFamily.create({ data: {
          id: `dfam_${randomUUID()}`, evidenceObjectId: object.id, institutionId: input.institutionId,
          transactionCaseId: object.transactionCaseId, title: required(input.metadata.title, "title", 240),
          documentType: required(input.metadata.documentType, "documentType", 120),
        } });
      }
      if (object.institutionId !== input.institutionId || !family) throw new NotFoundException("document evidence object not found");
      const requestedCaseId = optional(input.metadata.transactionCaseId, "transactionCaseId", 160);
      if (object.transactionCaseId !== requestedCaseId || family.transactionCaseId !== requestedCaseId) {
        throw new ConflictException("document version cannot change transaction case scope");
      }
      if (object.evidenceType !== input.metadata.evidenceType || object.classification !== input.metadata.classification || object.purpose !== input.metadata.purpose) {
        throw new ConflictException("new document version cannot change evidence type, classification or purpose");
      }
      const existing = await tx.evidenceVersion.findUnique({ where: { evidenceObjectId_payloadDigest: { evidenceObjectId: object.id, payloadDigest: input.payloadDigest } } });
      if (existing) return { replay: true, evidenceObjectId: object.id, evidenceVersionId: existing.id, version: existing.version, validationStatus: existing.validationStatus };
      const version = object.currentVersion + 1;
      const validationStatus = input.scan.status === "CLEAN" && input.stored ? "VALID" : "QUARANTINED";
      const previous = object.currentVersion ? await tx.evidenceVersion.findUnique({ where: { evidenceObjectId_version: { evidenceObjectId: object.id, version: object.currentVersion } } }) : null;
      const evidenceVersion = await tx.evidenceVersion.create({ data: {
        id: `evv_${randomUUID()}`, evidenceObjectId: object.id, version,
        providerReferenceId: input.connectorProviderReferenceId,
        schemaId: required(input.metadata.schemaId, "schemaId", 200), schemaVersion: required(input.metadata.schemaVersion, "schemaVersion", 80),
        payloadDigest: input.payloadDigest,
        signatureStatus: oneOf(input.metadata.signatureStatus ?? "NOT_PROVIDED", "signatureStatus", ["NOT_PROVIDED", "NOT_APPLICABLE"]),
        result: "REVIEW_REQUIRED", sourceAsOfAt: input.sourceAsOfAt,
        expiresAt: input.expiresAt, qualifications: json(input.metadata.qualifications), validationStatus,
        validationDetail: json({ malware: input.scan, claimedContentType: input.metadata.contentType, detectedContentType: input.detectedContentType }),
        supersedesVersionId: previous?.id ?? null, createdByUserId: input.actorUserId,
      } });
      if (input.stored) await tx.railDocumentVersion.create({ data: {
        id: `dver_${randomUUID()}`, documentFamilyId: family.id, evidenceVersionId: evidenceVersion.id, version,
        filename: input.filename, claimedContentType: required(input.metadata.contentType, "contentType", 160),
        detectedContentType: input.detectedContentType, sizeBytes: input.size, storageRef: input.stored.storageRef,
        malwareStatus: input.scan.status, malwareEngine: input.scan.engine, malwareSignature: input.scan.signature,
        encryptionClass: "SSE_KMS", objectVersionRef: input.stored.objectVersionRef,
      } });
      const changed = await tx.evidenceObject.updateMany({
        where: { id: object.id, currentVersion: object.currentVersion },
        data: { currentVersion: version, status: validationStatus === "VALID" ? "AVAILABLE" : "QUARANTINED", retentionUntilAt: input.retentionUntilAt },
      });
      if (changed.count !== 1) throw new ConflictException("evidence object was concurrently versioned");
      if (validationStatus === "VALID") await tx.railDocumentFamily.update({ where: { id: family.id }, data: { currentVersion: version } });
      return { replay: false, evidenceObjectId: object.id, evidenceVersionId: evidenceVersion.id, documentFamilyId: family.id, version, validationStatus, malwareStatus: input.scan.status };
    });
  }

  private async spool(input: Readable, path: string): Promise<{ size: number; payloadDigest: string; header: Buffer }> {
    let size = 0;
    const digest = createHash("sha256");
    const headers: Buffer[] = [];
    let headerBytes = 0;
    const inspect = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > MAX_EVIDENCE_BYTES) return callback(new BadRequestException(`file exceeds ${MAX_EVIDENCE_BYTES} bytes`));
        digest.update(chunk);
        if (headerBytes < 8192) {
          const part = chunk.subarray(0, Math.min(chunk.length, 8192 - headerBytes));
          headers.push(part); headerBytes += part.length;
        }
        callback(null, chunk);
      },
    });
    await pipeline(input, inspect, createWriteStream(path, { flags: "wx", mode: 0o600 }));
    if (size === 0) throw new BadRequestException("document body is empty");
    return { size, payloadDigest: digest.digest("hex"), header: Buffer.concat(headers) };
  }

  private async authoriseRead(actorUserId: string, actingInstitutionId: string, evidenceObjectId: string) {
    await this.access.requireHuman({ userId: actorUserId, institutionId: actingInstitutionId, action: "VIEW_EVIDENCE" });
    const evidence = await this.db.evidenceObject.findUnique({
      where: { id: evidenceObjectId },
      include: { versions: { orderBy: { version: "desc" }, include: { documentVersion: true } }, documentFamily: true },
    });
    if (!evidence) throw new NotFoundException("evidence object not found");
    if (evidence.institutionId !== actingInstitutionId) {
      const grant = await this.db.evidenceAccessGrant.findUnique({
        where: { evidenceObjectId_granteeInstitutionId_purpose: { evidenceObjectId, granteeInstitutionId: actingInstitutionId, purpose: evidence.purpose } },
      });
      if (!grant || grant.status !== "ACTIVE" || (grant.expiresAt && grant.expiresAt <= new Date()) || grant.classification !== evidence.classification) {
        throw new NotFoundException("evidence object not found");
      }
    }
    if (evidence.transactionCaseId) await this.requireCaseParticipant(actingInstitutionId, evidence.transactionCaseId, false);
    return evidence;
  }

  private async allowedCaseIds(institutionId: string): Promise<string[]> {
    if (inspectPersistenceFlags(process.env).transactionCase !== "shadow") return [];
    const cases = await this.db.transactionCase.findMany({
      where: { OR: [
        { ownerInstitutionId: institutionId },
        { parties: { some: { institutionId, status: "ACTIVE" } } },
      ] },
      select: { id: true },
    });
    return cases.map((item) => item.id);
  }

  private async requireCaseParticipant(institutionId: string, transactionCaseId: string, forWrite: boolean): Promise<void> {
    if (inspectPersistenceFlags(process.env).transactionCase !== "shadow") return;
    const transactionCase = await this.db.transactionCase.findUnique({
      where: { id: transactionCaseId },
      select: {
        ownerInstitutionId: true,
        status: true,
        parties: { where: { institutionId, status: "ACTIVE" }, select: { id: true }, take: 1 },
      },
    });
    if (!transactionCase
      || (transactionCase.ownerInstitutionId !== institutionId && transactionCase.parties.length === 0)) {
      throw new NotFoundException("transaction case not found");
    }
    if (forWrite && !["DRAFT", "INTAKE_OPEN"].includes(transactionCase.status)) {
      throw new ConflictException("case evidence is immutable after evidence lock");
    }
  }

  private async recordAccess(evidenceObjectId: string, evidenceVersionId: string | null, actorUserId: string, actingInstitutionId: string, action: string, purpose: string) {
    const occurredAt = new Date();
    const requestDigest = sha256Digest({ evidenceObjectId, evidenceVersionId, actorUserId, actingInstitutionId, action, purpose, occurredAt: occurredAt.toISOString() });
    await this.db.evidenceAccessReceipt.create({ data: {
      id: `erec_${randomUUID()}`, evidenceObjectId, evidenceVersionId, actorUserId, actingInstitutionId,
      action, purpose, requestDigest, receiptDigest: sha256Digest({ requestDigest, kind: "EVIDENCE_ACCESS_RECEIPT_V1" }), occurredAt,
    } });
  }

  private async requirePlatformAdmin(userId: string) {
    const user = await this.db.venueUser.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE" || !["ADMIN", "SUPERADMIN"].includes(user.platformRole ?? "")) {
      throw new ForbiddenException("active platform administrator required");
    }
    return user;
  }
}
