import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { sha256Digest } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";

export const LEGACY_PROXY_ACTIONS = [
  "LIST_ROOMS", "CREATE_ROOM", "INVITE", "INVITATION_CONTEXT", "ACCEPT_INVITATION",
  "READ_ROOM", "READ_SOURCE", "READ_MESSAGES", "POST_MESSAGE", "CLOSE_ROOM", "EXPORT_DOSSIER",
] as const;
export type LegacyProxyAction = (typeof LEGACY_PROXY_ACTIONS)[number];

function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim(); if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function date(value: unknown, name: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const result = new Date(required(value, name, 80));
  if (!Number.isFinite(result.getTime()) || result <= new Date()) throw new BadRequestException(`${name} must be a future ISO-8601 timestamp`);
  return result;
}

function actions(value: unknown): LegacyProxyAction[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException("allowedActions must be a non-empty array");
  const result = [...new Set(value.map((item) => required(item, "allowedActions[]", 80) as LegacyProxyAction))];
  if (result.some((item) => !LEGACY_PROXY_ACTIONS.includes(item))) throw new BadRequestException("allowedActions contains an unsupported proxy action");
  return result;
}

@Injectable()
export class ConnectorSubjectMappingService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly stepUp: StepUpService) {}

  async list(actor: RoomActor, connectorId: string) {
    const connector = await this.requireConnectorOwner(actor, connectorId, "VIEW_EVIDENCE");
    return this.db.connectorSubjectMapping.findMany({ where: { connectorRegistrationId: connector.id }, orderBy: [{ externalSubjectRef: "asc" }, { version: "desc" }] });
  }

  async propose(actor: RoomActor, connectorId: string, body: {
    externalSubjectRef?: string; subjectType?: string; institutionId?: string; allowedActions?: unknown;
    scopeType?: string; scopeRef?: string | null; authorityEvidenceRef?: string; expiresAt?: string | null;
    stepUpEvidenceId?: string;
  }) {
    const connector = await this.requireConnectorOwner(actor, connectorId, "OPERATE_CONNECTORS");
    if (connector.status !== "CERTIFIED_SHADOW" || !connector.providerReferenceId || !connector.credentialVaultRef?.startsWith("vault-kv-v2://")) {
      throw new ConflictException("connector must be certified in shadow with a Vault credential before subject mapping");
    }
    const externalSubjectRef = required(body.externalSubjectRef, "externalSubjectRef", 500);
    const subjectType = required(body.subjectType, "subjectType", 80);
    if (!["INSTITUTION_DID", "OTHER_APPROVED"].includes(subjectType)) throw new BadRequestException("subjectType must be INSTITUTION_DID or OTHER_APPROVED");
    const institutionId = required(body.institutionId, "institutionId", 160);
    const institution = await this.db.institution.findUnique({ where: { id: institutionId }, include: { admission: true } });
    if (!institution || institution.status !== "ACTIVE" || institution.admission?.status !== "ADMITTED") throw new BadRequestException("mapped institution must be admitted and active");
    const allowedActions = actions(body.allowedActions);
    const scopeType = required(body.scopeType ?? "INSTITUTION", "scopeType", 80);
    if (!["INSTITUTION", "TRANSACTION_CASE"].includes(scopeType)) throw new BadRequestException("scopeType must be INSTITUTION or TRANSACTION_CASE");
    const scopeRef = scopeType === "TRANSACTION_CASE" ? required(body.scopeRef, "scopeRef", 160) : null;
    if (scopeRef) {
      const transactionCase = await this.db.transactionCase.findUnique({ where: { id: scopeRef }, include: { parties: true } });
      if (!transactionCase || (transactionCase.ownerInstitutionId !== institutionId && !transactionCase.parties.some((item) => item.institutionId === institutionId && item.status === "ACTIVE"))) {
        throw new BadRequestException("mapped institution is not an active party to the scoped case");
      }
    }
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const expiresAt = date(body.expiresAt, "expiresAt");
    const prior = await this.db.connectorSubjectMapping.findFirst({ where: { connectorRegistrationId: connectorId, externalSubjectRef }, orderBy: { version: "desc" } });
    const version = (prior?.version ?? 0) + 1;
    const proposalDigest = sha256Digest({ connectorId, externalSubjectRef, subjectType, institutionId, allowedActions, scopeType, scopeRef, authorityEvidenceRef, expiresAt: expiresAt?.toISOString() ?? null, version });
    const replay = await this.db.connectorSubjectMapping.findUnique({ where: { proposalDigest } });
    if (replay) return replay;
    if (prior?.status === "PROPOSED") throw new ConflictException("a mapping for this external subject is already pending");
    if (prior?.status === "ACTIVE") throw new ConflictException("an active mapping must expire or its connector must be suspended before a replacement is proposed");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "OPERATE_CONNECTORS" });
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "CONNECTOR_SUBJECT_PROPOSE", institutionId: actor.actingInstitutionId }, tx);
      const created = await tx.connectorSubjectMapping.create({ data: {
        id: `csmap_${randomUUID()}`, connectorRegistrationId: connectorId, externalSubjectRef, subjectType,
        institutionId, allowedActions, scopeType, scopeRef, authorityEvidenceRef, proposalDigest,
        version, supersedesMappingId: prior?.id ?? null, proposedByUserId: actor.actorUserId,
        proposalStepUpId: stepUpEvidenceId, expiresAt,
      } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.connector_subject.proposed", detail: { connectorId, mappingId: created.id, externalSubjectRef, institutionId, allowedActions, scopeType, scopeRef, version, authorityMandateId: authority.mandateId } });
      return created;
    });
  }

  async review(actor: RoomActor, connectorId: string, mappingId: string, body: { decision?: string; reviewReason?: string; stepUpEvidenceId?: string }) {
    const mapping = await this.db.connectorSubjectMapping.findUnique({ where: { id: mappingId }, include: { connectorRegistration: true } });
    if (!mapping || mapping.connectorRegistrationId !== connectorId) throw new NotFoundException("connector subject mapping not found");
    if (mapping.institutionId !== actor.actingInstitutionId) throw new NotFoundException("connector subject mapping not found");
    if (mapping.status !== "PROPOSED") return mapping;
    if (mapping.proposedByUserId === actor.actorUserId) throw new ForbiddenException("the mapping proposer cannot review their own mapping");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "OPERATE_CONNECTORS" });
    const decision = required(body.decision, "decision", 20);
    if (!["APPROVE", "REJECT"].includes(decision)) throw new BadRequestException("decision must be APPROVE or REJECT");
    const reviewReason = required(body.reviewReason, "reviewReason", 1_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    if (mapping.expiresAt && mapping.expiresAt <= now) throw new ConflictException("expired mapping proposals cannot be approved");
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "CONNECTOR_SUBJECT_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      const changed = await tx.connectorSubjectMapping.updateMany({ where: { id: mapping.id, status: "PROPOSED" }, data: {
        status: decision === "APPROVE" ? "ACTIVE" : "REJECTED", approvedByUserId: actor.actorUserId,
        approvalStepUpId: stepUpEvidenceId, approvalReason: reviewReason, effectiveAt: decision === "APPROVE" ? now : null,
      } });
      if (changed.count !== 1) throw new ConflictException("connector subject mapping changed concurrently");
      const result = await tx.connectorSubjectMapping.findUniqueOrThrow({ where: { id: mapping.id } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: decision === "APPROVE" ? "rail.connector_subject.approved" : "rail.connector_subject.rejected", detail: { connectorId, mappingId, externalSubjectRef: mapping.externalSubjectRef, institutionId: mapping.institutionId, reviewReason, authorityMandateId: authority.mandateId } });
      return result;
    });
  }

  async resolve(connectorId: string, externalSubjectRef: string, action: LegacyProxyAction, caseId?: string | null) {
    const now = new Date();
    const mappings = await this.db.connectorSubjectMapping.findMany({
      where: { connectorRegistrationId: connectorId, externalSubjectRef, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    const valid = mappings.filter((item) => (!item.effectiveAt || item.effectiveAt <= now) && (!item.expiresAt || item.expiresAt > now)
      && Array.isArray(item.allowedActions) && item.allowedActions.includes(action)
      && (item.scopeType === "INSTITUTION" || (item.scopeType === "TRANSACTION_CASE" && item.scopeRef === caseId)));
    if (valid.length !== 1) throw new ForbiddenException(valid.length ? "connector subject mapping is ambiguous" : "connector subject is not authorised for this action and scope");
    return valid[0];
  }

  async resolveIdentity(connectorId: string, externalSubjectRef: string) {
    const now = new Date();
    const mappings = await this.db.connectorSubjectMapping.findMany({
      where: { connectorRegistrationId: connectorId, externalSubjectRef, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    const valid = mappings.filter((item) => (!item.effectiveAt || item.effectiveAt <= now) && (!item.expiresAt || item.expiresAt > now));
    const institutions = new Set(valid.map((item) => item.institutionId));
    if (valid.length === 0 || institutions.size !== 1) {
      throw new ForbiddenException(valid.length ? "connector subject identity mapping is ambiguous" : "connector subject identity is not authorised");
    }
    return valid[0];
  }

  private async requireConnectorOwner(actor: RoomActor, connectorId: string, action: "VIEW_EVIDENCE" | "OPERATE_CONNECTORS") {
    const connector = await this.db.connectorRegistration.findUnique({ where: { id: connectorId } });
    if (!connector || connector.institutionId !== actor.actingInstitutionId) throw new NotFoundException("connector not found");
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action });
    return connector;
  }

  private actorRef(actor: RoomActor): string { return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`; }
}
