import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { INSTITUTION_ACTIONS, type InstitutionAction, type StepUpPurpose } from "../institutions/institution-policy";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import { PrismaService } from "../store/prisma.service";

export type InstitutionalActor = { actorUserId: string; actorSessionId: string; actingInstitutionId: string };

const SERVICE_ACTIONS = new Set<InstitutionAction>([
  "OPERATE_CONNECTORS", "VIEW_EVIDENCE", "MANAGE_EVIDENCE", "VIEW_CASE", "VIEW_CASE_ROOM",
  "VIEW_DELIVERY_HEALTH", "MANAGE_DEVELOPER_INTEGRATION",
]);

function enabled(): void {
  if (inspectPersistenceFlags(process.env).institutionalProduct !== "shadow") {
    throw new ForbiddenException("institutional productisation is disabled");
  }
}
function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}
function oneOf(value: unknown, name: string, values: readonly string[]): string {
  const result = required(value, name, 100);
  if (!values.includes(result)) throw new BadRequestException(`${name} must be one of: ${values.join(", ")}`);
  return result;
}
function futureDate(value: unknown, name: string): Date {
  const result = new Date(required(value, name));
  if (!Number.isFinite(result.getTime()) || result <= new Date()) throw new BadRequestException(`${name} must be a future ISO-8601 timestamp`);
  return result;
}
function digest(value: unknown, name: string): string {
  const result = required(value, name, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(result)) throw new BadRequestException(`${name} must be a lowercase SHA-256 digest`);
  return result;
}
function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}
function strings(value: unknown, name: string, max = 50): string[] {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new BadRequestException(`${name} must be an array of non-empty strings with at most ${max} entries`);
  }
  return [...new Set(value.map((item) => item.trim()))];
}
function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException(`${name} must be an object`);
  return value as Record<string, unknown>;
}
function actorRef(actor: InstitutionalActor): string {
  return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`;
}
function publicGovernanceRecord(record: object, extra: readonly string[] = []): Record<string, unknown> {
  const safe = { ...record } as Record<string, unknown>;
  for (const key of ["proposalStepUpId", "reviewStepUpId", "approvalStepUpId", "credentialVaultRef", ...extra]) delete safe[key];
  return safe;
}

async function uniqueGovernedCreate<T>(message: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException(message);
    }
    throw error;
  }
}

@Injectable()
export class InstitutionalProductService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly stepUp: StepUpService) {}

  private async authority(actor: InstitutionalActor, action: InstitutionAction) {
    enabled();
    return this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action });
  }

  private async consume(tx: Prisma.TransactionClient, actor: InstitutionalActor, purpose: StepUpPurpose, evidenceId: unknown) {
    const stepUpEvidenceId = required(evidenceId, "stepUpEvidenceId", 160);
    await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose, institutionId: actor.actingInstitutionId }, tx);
    return stepUpEvidenceId;
  }

  async overview(actor: InstitutionalActor) {
    await this.authority(actor, "VIEW_INSTITUTION");
    const now = new Date();
    const institution = await this.db.institution.findUnique({
      where: { id: actor.actingInstitutionId },
      include: {
        admission: true,
        evidenceSnapshots: { orderBy: { sourceAsOfAt: "desc" } },
        members: { include: { mandates: true }, orderBy: { createdAt: "asc" } },
        appointments: { orderBy: { createdAt: "desc" } },
        routeEntitlements: { orderBy: { createdAt: "desc" } },
        connectorRegistrations: { include: { certifications: true }, orderBy: { createdAt: "desc" } },
        identityConnections: { orderBy: { createdAt: "desc" } },
        servicePrincipals: { orderBy: { createdAt: "desc" } },
        accessReviews: { orderBy: { createdAt: "desc" } },
        exitPlans: { orderBy: { createdAt: "desc" } },
        changeProposals: { where: { status: "PENDING", targetType: { in: ["IDENTITY_CONNECTION", "SERVICE_PRINCIPAL"] } }, orderBy: { proposedAt: "asc" } },
      },
    });
    if (!institution) throw new NotFoundException("institution not found");
    const currentMember = institution.members.find((item) => item.userId === actor.actorUserId);
    const activeMembers = institution.members.filter((item) => item.status === "ACTIVE" && (!item.expiresAt || item.expiresAt > now));
    const activeMandates = activeMembers.flatMap((item) => item.mandates).filter((item) => item.status === "ACTIVE" && (!item.expiresAt || item.expiresAt > now));
    const verifiedEvidence = institution.evidenceSnapshots.filter((item) => item.result === "VERIFIED" && item.signatureStatus === "VERIFIED" && item.expiresAt > now);
    const certifiedConnectors = institution.connectorRegistrations.filter((item) => item.status === "CERTIFIED_SHADOW" && item.certifications.some((certification) => certification.status === "APPROVED" && certification.operatingMode === "SHADOW" && (!certification.expiresAt || certification.expiresAt > now)));
    const identityConnections = institution.identityConnections.map((item) => ({
      id: item.id, connectionKey: item.connectionKey, protocol: item.protocol, displayName: item.displayName,
      issuer: item.issuer, audience: item.audience, metadataDigest: item.metadataDigest, emailDomains: item.emailDomains,
      status: item.status, proposedByUserId: item.proposedByUserId, reviewedByUserId: item.reviewedByUserId,
      reviewReason: item.reviewReason, effectiveAt: item.effectiveAt, expiresAt: item.expiresAt, createdAt: item.createdAt,
      activationStatus: "NOT_ACTIVE" as const,
    }));
    const servicePrincipals = institution.servicePrincipals.map((item) => ({
      id: item.id, clientId: item.clientId, displayName: item.displayName, credentialFingerprint: item.credentialFingerprint,
      status: item.status, allowedActions: item.allowedActions, proposedByUserId: item.proposedByUserId,
      approvedByUserId: item.approvedByUserId, approvalReason: item.approvalReason, effectiveAt: item.effectiveAt,
      expiresAt: item.expiresAt, createdAt: item.createdAt, secretMaterialExcluded: true, authenticationEnabled: false,
    }));
    const accessReviews = institution.accessReviews.map((item) => ({
      id: item.id, reviewRef: item.reviewRef, scope: item.scope, evidenceRefs: item.evidenceRefs, dueAt: item.dueAt,
      status: item.status, conclusion: item.conclusion, proposedByUserId: item.proposedByUserId,
      reviewedByUserId: item.reviewedByUserId, reviewReason: item.reviewReason, reviewedAt: item.reviewedAt, createdAt: item.createdAt,
    }));
    const exitPlans = institution.exitPlans.map((item) => ({
      id: item.id, exitRef: item.exitRef, reason: item.reason, requestedEffectiveAt: item.requestedEffectiveAt,
      scope: item.scope, evidenceRefs: item.evidenceRefs, status: item.status, proposedByUserId: item.proposedByUserId,
      reviewedByUserId: item.reviewedByUserId, reviewReason: item.reviewReason, reviewedAt: item.reviewedAt,
      createdAt: item.createdAt, executionStatus: "NOT_EXECUTED" as const,
    }));
    const accessStatusChanges = institution.changeProposals.map((item) => ({
      id: item.id, targetType: item.targetType, targetId: item.targetId, changeType: item.changeType,
      fromStatus: item.fromStatus, reason: item.reason, status: item.status, proposedByUserId: item.proposedByUserId,
      proposedAt: item.proposedAt,
    }));
    const admissionActive = institution.status === "ACTIVE" && institution.admission?.status === "ADMITTED"
      && (!institution.admission.expiresAt || institution.admission.expiresAt > now);
    const stages = [
      { code: "APPLICATION", state: "COMPLETE", summary: "Application and legal identity are recorded." },
      { code: "EVIDENCE", state: verifiedEvidence.length ? "COMPLETE" : "ACTION_REQUIRED", summary: `${verifiedEvidence.length} current signed verified snapshot(s).` },
      { code: "ADMISSION", state: admissionActive ? "COMPLETE" : "WAITING_REVIEW", summary: institution.admission?.status ?? "NOT_RECORDED" },
      { code: "MEMBERSHIP", state: activeMembers.length >= 2 ? "COMPLETE" : "ACTION_REQUIRED", summary: `${activeMembers.length} active member(s); two-person governance requires at least two.` },
      { code: "AUTHORITY", state: activeMandates.length ? "COMPLETE" : "ACTION_REQUIRED", summary: `${activeMandates.length} active effective mandate(s).` },
      { code: "APPOINTMENTS", state: institution.appointments.some((item) => ["ACCEPTED", "ACTIVE"].includes(item.status)) ? "COMPLETE" : "CONDITIONAL", summary: "Appointments are route- and case-dependent; absence does not block every route." },
      { code: "CONNECTORS", state: certifiedConnectors.length ? "COMPLETE" : "CONDITIONAL", summary: `${certifiedConnectors.length} currently approved shadow connector(s).` },
      { code: "IDENTITY_ACCESS", state: identityConnections.some((item) => item.status === "SHADOW_APPROVED") || servicePrincipals.some((item) => item.status === "SHADOW_APPROVED") ? "SHADOW_READY" : "OPTIONAL", summary: "Federation and service identities remain shadow metadata until independently activated." },
      { code: "RECERTIFICATION", state: institution.admission?.reviewDueAt && institution.admission.reviewDueAt <= now ? "ACTION_REQUIRED" : "MONITORED", summary: institution.admission?.reviewDueAt?.toISOString() ?? "No admission review date recorded." },
      { code: "EXIT", state: institution.exitPlans.some((item) => item.status === "APPROVED") ? "PLANNED" : "AVAILABLE", summary: "Exit planning never silently revokes current authority or deletes evidence." },
    ];
    return {
      generatedAt: now.toISOString(), institutionId: institution.id, operatingBoundary: "SHADOW",
      authorityNotice: "Readiness labels do not grant route authority, activate SSO, enable a service credential or satisfy external evidence gates.",
      currentMember: currentMember ? { id: currentMember.id, role: currentMember.membershipRole, status: currentMember.status } : null,
      summary: { admissionActive, activeMembers: activeMembers.length, activeMandates: activeMandates.length, verifiedEvidence: verifiedEvidence.length, certifiedConnectors: certifiedConnectors.length },
      stages, identityConnections, servicePrincipals, accessReviews, exitPlans, accessStatusChanges,
    };
  }

  async proposeIdentityConnection(actor: InstitutionalActor, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_IDENTITY_CONNECTIONS");
    const connectionKey = required(body.connectionKey, "connectionKey", 100);
    const expiresAt = futureDate(body.expiresAt, "expiresAt");
    const emailDomains = strings(body.emailDomains, "emailDomains", 20).map((value) => value.toLowerCase());
    if (!emailDomains.length) throw new BadRequestException("at least one email domain is required");
    if (emailDomains.some((value) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value))) throw new BadRequestException("emailDomains contains an invalid domain");
    return uniqueGovernedCreate("connectionKey already exists for this institution", () => this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "IDENTITY_CONNECTION_PROPOSE", body.stepUpEvidenceId);
      const created = await tx.institutionIdentityConnection.create({ data: {
        id: `iic_${randomUUID()}`, institutionId: actor.actingInstitutionId, connectionKey,
        protocol: oneOf(body.protocol, "protocol", ["SAML", "OIDC"]), displayName: required(body.displayName, "displayName"),
        issuer: required(body.issuer, "issuer", 1_000), audience: required(body.audience, "audience", 1_000),
        metadataDigest: digest(body.metadataDigest, "metadataDigest"), emailDomains: json(emailDomains),
        proposedByUserId: actor.actorUserId, proposalStepUpId: stepUpEvidenceId, expiresAt,
      } });
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_identity_connection.proposed", detail: { institutionId: actor.actingInstitutionId, connectionId: created.id, protocol: created.protocol, metadataDigest: created.metadataDigest, authorityMandateId: authority.mandateId } });
      return { ...publicGovernanceRecord(created), activationStatus: "NOT_ACTIVE" as const };
    }));
  }

  async reviewIdentityConnection(actor: InstitutionalActor, connectionId: string, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_IDENTITY_CONNECTIONS");
    const connection = await this.db.institutionIdentityConnection.findUnique({ where: { id: connectionId } });
    if (!connection || connection.institutionId !== actor.actingInstitutionId) throw new NotFoundException("identity connection not found");
    if (connection.status !== "PROPOSED") throw new ConflictException("identity connection is already terminal");
    if (connection.proposedByUserId === actor.actorUserId) throw new ForbiddenException("maker cannot review their own identity connection");
    return this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "IDENTITY_CONNECTION_REVIEW", body.stepUpEvidenceId);
      const approve = body.approve === true;
      const claimed = await tx.institutionIdentityConnection.updateMany({ where: { id: connectionId, status: "PROPOSED" }, data: { status: approve ? "SHADOW_APPROVED" : "REJECTED", reviewedByUserId: actor.actorUserId, reviewStepUpId: stepUpEvidenceId, reviewReason: required(body.reason, "reason", 1_000), effectiveAt: approve ? new Date() : null } });
      if (claimed.count !== 1) throw new ConflictException("identity connection was concurrently reviewed");
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_identity_connection.reviewed", detail: { institutionId: actor.actingInstitutionId, connectionId, approved: approve, liveAuthenticationEnabled: false, authorityMandateId: authority.mandateId } });
      return { ...publicGovernanceRecord(await tx.institutionIdentityConnection.findUniqueOrThrow({ where: { id: connectionId } })), activationStatus: "NOT_ACTIVE" as const };
    });
  }

  async proposeServiceIdentity(actor: InstitutionalActor, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_SERVICE_IDENTITIES");
    const allowedActions = strings(body.allowedActions, "allowedActions").map((item) => oneOf(item, "allowedActions[]", INSTITUTION_ACTIONS) as InstitutionAction);
    if (!allowedActions.length || allowedActions.some((item) => !SERVICE_ACTIONS.has(item))) throw new BadRequestException("service identity contains an action reserved for a human authority ceremony");
    const id = `isp_${randomUUID()}`;
    return uniqueGovernedCreate("clientId already exists", () => this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "SERVICE_IDENTITY_PROPOSE", body.stepUpEvidenceId);
      const created = await tx.institutionServicePrincipal.create({ data: {
        id, institutionId: actor.actingInstitutionId, clientId: required(body.clientId, "clientId", 160), displayName: required(body.displayName, "displayName"),
        credentialVaultRef: `vault-kv-v2://pending/${id}`, credentialFingerprint: digest(body.credentialFingerprint, "credentialFingerprint"),
        status: "PENDING", allowedActions: json(allowedActions), proposedByUserId: actor.actorUserId, proposalStepUpId: stepUpEvidenceId,
        expiresAt: futureDate(body.expiresAt, "expiresAt"),
      } });
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_service_identity.proposed", detail: { institutionId: actor.actingInstitutionId, servicePrincipalId: id, clientId: created.clientId, allowedActions, authorityMandateId: authority.mandateId, credentialMaterialAccepted: false } });
      return { ...publicGovernanceRecord(created), secretMaterialExcluded: true, authenticationEnabled: false };
    }));
  }

  async reviewServiceIdentity(actor: InstitutionalActor, principalId: string, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_SERVICE_IDENTITIES");
    const principal = await this.db.institutionServicePrincipal.findUnique({ where: { id: principalId } });
    if (!principal || principal.institutionId !== actor.actingInstitutionId) throw new NotFoundException("service identity not found");
    if (principal.status !== "PENDING") throw new ConflictException("service identity is already terminal");
    if (principal.proposedByUserId === actor.actorUserId) throw new ForbiddenException("maker cannot review their own service identity");
    return this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "SERVICE_IDENTITY_REVIEW", body.stepUpEvidenceId);
      const approve = body.approve === true;
      const claimed = await tx.institutionServicePrincipal.updateMany({ where: { id: principalId, status: "PENDING" }, data: { status: approve ? "SHADOW_APPROVED" : "REVOKED", approvedByUserId: actor.actorUserId, approvalStepUpId: stepUpEvidenceId, approvalReason: required(body.reason, "reason", 1_000), effectiveAt: approve ? new Date() : null } });
      if (claimed.count !== 1) throw new ConflictException("service identity was concurrently reviewed");
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_service_identity.reviewed", detail: { institutionId: actor.actingInstitutionId, servicePrincipalId: principalId, approved: approve, authenticationEnabled: false, authorityMandateId: authority.mandateId } });
      const updated = await tx.institutionServicePrincipal.findUniqueOrThrow({ where: { id: principalId } });
      return { ...publicGovernanceRecord(updated), secretMaterialExcluded: true, authenticationEnabled: false };
    });
  }

  async proposeAccessReview(actor: InstitutionalActor, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_ACCESS_REVIEWS");
    const evidenceRefs = strings(body.evidenceRefs, "evidenceRefs");
    if (!evidenceRefs.length) throw new BadRequestException("at least one evidence reference is required");
    return uniqueGovernedCreate("reviewRef already exists for this institution", () => this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "INSTITUTION_ACCESS_REVIEW_PROPOSE", body.stepUpEvidenceId);
      const created = await tx.institutionAccessReview.create({ data: { id: `iar_${randomUUID()}`, institutionId: actor.actingInstitutionId, reviewRef: required(body.reviewRef, "reviewRef", 160), scope: json(objectValue(body.scope, "scope")), evidenceRefs: json(evidenceRefs), dueAt: futureDate(body.dueAt, "dueAt"), proposedByUserId: actor.actorUserId, proposalStepUpId: stepUpEvidenceId } });
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_access_review.proposed", detail: { institutionId: actor.actingInstitutionId, reviewId: created.id, reviewRef: created.reviewRef, dueAt: created.dueAt.toISOString(), authorityMandateId: authority.mandateId } });
      return publicGovernanceRecord(created);
    }));
  }

  async reviewAccessReview(actor: InstitutionalActor, reviewId: string, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_ACCESS_REVIEWS");
    const review = await this.db.institutionAccessReview.findUnique({ where: { id: reviewId } });
    if (!review || review.institutionId !== actor.actingInstitutionId) throw new NotFoundException("access review not found");
    if (review.status !== "PROPOSED") throw new ConflictException("access review is already terminal");
    if (review.proposedByUserId === actor.actorUserId) throw new ForbiddenException("maker cannot review their own access review");
    return this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "INSTITUTION_ACCESS_REVIEW_REVIEW", body.stepUpEvidenceId);
      const approve = body.approve === true;
      const claimed = await tx.institutionAccessReview.updateMany({ where: { id: reviewId, status: "PROPOSED" }, data: { status: approve ? "APPROVED" : "REJECTED", conclusion: required(body.conclusion, "conclusion", 2_000), reviewedByUserId: actor.actorUserId, reviewStepUpId: stepUpEvidenceId, reviewReason: required(body.reason, "reason", 1_000), reviewedAt: new Date() } });
      if (claimed.count !== 1) throw new ConflictException("access review was concurrently reviewed");
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_access_review.reviewed", detail: { institutionId: actor.actingInstitutionId, reviewId, approved: approve, authorityChanged: false, authorityMandateId: authority.mandateId } });
      return publicGovernanceRecord(await tx.institutionAccessReview.findUniqueOrThrow({ where: { id: reviewId } }));
    });
  }

  async proposeExit(actor: InstitutionalActor, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_PARTICIPANT_EXIT");
    const evidenceRefs = strings(body.evidenceRefs, "evidenceRefs");
    if (!evidenceRefs.length) throw new BadRequestException("at least one evidence reference is required");
    return uniqueGovernedCreate("exitRef already exists for this institution", () => this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "PARTICIPANT_EXIT_PROPOSE", body.stepUpEvidenceId);
      const created = await tx.institutionExitPlan.create({ data: { id: `ixp_${randomUUID()}`, institutionId: actor.actingInstitutionId, exitRef: required(body.exitRef, "exitRef", 160), reason: required(body.reason, "reason", 2_000), requestedEffectiveAt: futureDate(body.requestedEffectiveAt, "requestedEffectiveAt"), scope: json(objectValue(body.scope, "scope")), evidenceRefs: json(evidenceRefs), proposedByUserId: actor.actorUserId, proposalStepUpId: stepUpEvidenceId } });
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_exit.proposed", detail: { institutionId: actor.actingInstitutionId, exitPlanId: created.id, exitRef: created.exitRef, authorityChanged: false, deletionPerformed: false, authorityMandateId: authority.mandateId } });
      return { ...publicGovernanceRecord(created), executionStatus: "NOT_EXECUTED" as const };
    }));
  }

  async reviewExit(actor: InstitutionalActor, exitPlanId: string, body: Record<string, unknown>) {
    const authority = await this.authority(actor, "MANAGE_PARTICIPANT_EXIT");
    const plan = await this.db.institutionExitPlan.findUnique({ where: { id: exitPlanId } });
    if (!plan || plan.institutionId !== actor.actingInstitutionId) throw new NotFoundException("exit plan not found");
    if (plan.status !== "PROPOSED") throw new ConflictException("exit plan is already terminal");
    if (plan.proposedByUserId === actor.actorUserId) throw new ForbiddenException("maker cannot review their own exit plan");
    return this.db.$transaction(async (tx) => {
      const stepUpEvidenceId = await this.consume(tx, actor, "PARTICIPANT_EXIT_REVIEW", body.stepUpEvidenceId);
      const approve = body.approve === true;
      const claimed = await tx.institutionExitPlan.updateMany({ where: { id: exitPlanId, status: "PROPOSED" }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedByUserId: actor.actorUserId, reviewStepUpId: stepUpEvidenceId, reviewReason: required(body.reason, "reason", 1_000), reviewedAt: new Date() } });
      if (claimed.count !== 1) throw new ConflictException("exit plan was concurrently reviewed");
      await appendGovernedAudit(tx, { actor: actorRef(actor), event: "rail.institution_exit.reviewed", detail: { institutionId: actor.actingInstitutionId, exitPlanId, approved: approve, authorityChanged: false, deletionPerformed: false, executionRequiresSeparateGovernedActions: true, authorityMandateId: authority.mandateId } });
      return { ...publicGovernanceRecord(await tx.institutionExitPlan.findUniqueOrThrow({ where: { id: exitPlanId } })), executionStatus: "NOT_EXECUTED" as const };
    });
  }
}
