import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { audit } from "../common/audit";
import {
  ASSET_CLASSES,
  FUNCTION_PERFORMERS,
  LIFECYCLE_LEGS,
  MATERIAL_FUNCTIONS,
  OPERATING_MODES,
  REPRESENTATIONS,
  TRANSACTION_ROUTES,
  sha256Digest,
  toCanonicalValue,
} from "../contracts/v1";
import { PrismaService } from "../store/prisma.service";
import { InstitutionAccessService } from "./institution-access.service";
import { InstitutionApplicationService } from "./institution-application.service";
import { INSTITUTION_ACTIONS, type InstitutionAction, type StepUpPurpose } from "./institution-policy";
import { StepUpService } from "./step-up.service";

const MEMBERSHIP_ROLES = ["ADMIN", "MEMBER", "AUDITOR", "INTEGRATION_OPERATOR"] as const;
const CHANGE_TARGETS = ["MEMBER", "MANDATE", "APPOINTMENT", "ROUTE_ENTITLEMENT", "SERVICE_PRINCIPAL", "IDENTITY_CONNECTION"] as const;
const CHANGE_TYPES = ["SUSPEND", "REVOKE", "REINSTATE"] as const;
const PR03_OPERATING_MODES = ["REPLAY", "SHADOW"] as const;

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return trimmed;
}

function optional(value: unknown, name: string, max = 300): string | null {
  return value === undefined || value === null || value === "" ? null : required(value, name, max);
}

function optionalDate(value: unknown, name: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(required(value, name));
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

function oneOf(value: unknown, name: string, allowed: readonly string[]): string {
  const candidate = required(value, name, 120);
  if (!allowed.includes(candidate)) throw new BadRequestException(`${name} must be one of: ${allowed.join(", ")}`);
  return candidate;
}

function arrayOf(value: unknown, name: string, allowed: readonly string[]): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || !allowed.includes(entry))) {
    throw new BadRequestException(`${name} must be a non-empty array containing only: ${allowed.join(", ")}`);
  }
  return [...new Set(value)];
}

function email(value: unknown): string {
  const normalized = required(value, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new BadRequestException("email is invalid");
  return normalized;
}

function safeDigestEqual(stored: string, supplied: string): boolean {
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function uniqueConstraint(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

@Injectable()
export class InstitutionGovernanceService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
    private readonly applications: InstitutionApplicationService,
  ) {}

  async inviteMember(actorUserId: string, institutionId: string, body: {
    email?: string;
    membershipRole?: string;
    expiresAt?: string | null;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "ADMINISTER_MEMBERS" });
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const invitedEmail = email(body.email);
    const membershipRole = oneOf(body.membershipRole, "membershipRole", MEMBERSHIP_ROLES);
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException("expiresAt must be in the future");
    const invitationToken = randomBytes(32).toString("base64url");
    const invitationDigest = sha256Digest({ invitationToken });
    const member = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "MEMBER_INVITE",
        institutionId,
      }, tx);
      const user = await tx.venueUser.findUnique({ where: { email: invitedEmail } }) ?? await tx.venueUser.create({
        data: { id: `vu_${randomUUID()}`, email: invitedEmail, role: "INVESTOR", status: "PENDING", allowlisted: false },
      });
      const existing = await tx.institutionMember.findUnique({
        where: { institutionId_userId: { institutionId, userId: user.id } },
      });
      if (existing && !["REVOKED", "EXPIRED"].includes(existing.status)) throw new ConflictException("user already has a non-terminal membership");
      if (existing) {
        return tx.institutionMember.update({
          where: { id: existing.id },
          data: {
            membershipRole,
            status: "INVITED",
            invitationDigest,
            invitedByUserId: actorUserId,
            invitedAt: new Date(),
            acceptedAt: null,
            effectiveAt: null,
            expiresAt,
            suspendedAt: null,
            revokedAt: null,
            revocationReason: null,
            bootstrapApprovedDecisionId: null,
          },
        });
      }
      return tx.institutionMember.create({
        data: {
          id: `imem_${randomUUID()}`,
          institutionId,
          userId: user.id,
          invitedEmail,
          membershipRole,
          status: "INVITED",
          invitedByUserId: actorUserId,
          invitationDigest,
          expiresAt,
        },
      });
    });
    audit("institution.member.invited", { actorUserId, institutionId, memberId: member.id, membershipRole });
    return { memberId: member.id, institutionId, invitationToken, expiresAt: member.expiresAt };
  }

  async acceptMembership(
    actorUserId: string,
    memberId: string,
    body: { invitationToken?: string; stepUpEvidenceId?: string },
    actorSessionId: string,
  ) {
    const member = await this.db.institutionMember.findUnique({
      where: { id: memberId },
      include: { user: true, institution: { include: { admission: true } } },
    });
    if (!member || member.userId !== actorUserId) throw new NotFoundException("membership invitation not found");
    if (!["INVITED", "PENDING_ADMISSION"].includes(member.status)) throw new ConflictException("membership is not awaiting acceptance");
    if (!member.user.identityVerifiedAt || !member.user.did) throw new ForbiddenException("identity binding must be completed before membership acceptance");
    if (member.expiresAt && member.expiresAt <= new Date()) throw new ForbiddenException("membership invitation has expired");
    if (member.institution.status !== "ACTIVE" || member.institution.admission?.status !== "ADMITTED") {
      throw new ForbiddenException("institution is not admitted");
    }
    if (!member.bootstrapApprovedDecisionId) {
      const supplied = required(body.invitationToken, "invitationToken", 1_000);
      if (!member.invitationDigest || !safeDigestEqual(member.invitationDigest, sha256Digest({ invitationToken: supplied }))) {
        throw new ForbiddenException("invitation token is invalid");
      }
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const accepted = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "MEMBERSHIP_ACCEPT",
        institutionId: member.institutionId,
      }, tx);
      const claimed = await tx.institutionMember.updateMany({
        where: { id: member.id, status: { in: ["INVITED", "PENDING_ADMISSION"] } },
        data: { status: "ACTIVE", acceptedAt: now, effectiveAt: now, invitationDigest: null },
      });
      if (claimed.count !== 1) throw new ConflictException("membership was concurrently changed");
      if (member.bootstrapApprovedDecisionId) {
        const decision = await tx.participantAdmissionDecision.findUnique({ where: { id: member.bootstrapApprovedDecisionId } });
        if (!decision || decision.status !== "APPROVED") throw new ConflictException("bootstrap approval evidence is unavailable");
        await this.applications.createBootstrapMandates(tx, member.id, member.institutionId, decision, now);
      }
      return tx.institutionMember.findUniqueOrThrow({ where: { id: member.id } });
    });
    audit("institution.member.accepted", { actorUserId, institutionId: member.institutionId, memberId });
    return accepted;
  }

  async proposeMandate(actorUserId: string, institutionId: string, body: {
    memberId?: string;
    action?: string;
    scopeType?: string;
    scopeRef?: string | null;
    limits?: unknown;
    conditions?: unknown;
    delegationBasis?: string;
    authorityEvidenceRef?: string;
    expiresAt?: string | null;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "PROPOSE_AUTHORITY" });
    const memberId = required(body.memberId, "memberId", 160);
    const member = await this.db.institutionMember.findUnique({ where: { id: memberId } });
    if (!member || member.institutionId !== institutionId || member.status !== "ACTIVE") throw new BadRequestException("target member must be active in this institution");
    const action = oneOf(body.action, "action", INSTITUTION_ACTIONS);
    const scopeType = required(body.scopeType, "scopeType", 80);
    const scopeRef = optional(body.scopeRef, "scopeRef", 200);
    const scopeKey = scopeRef ?? "";
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException("expiresAt must be in the future");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    let mandate;
    try {
      mandate = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actorUserId,
          sessionId: actorSessionId,
          purpose: "MANDATE_PROPOSE",
          institutionId,
        }, tx);
        const latest = await tx.authorityMandate.findFirst({
          where: { memberId, action, scopeType, scopeKey },
          orderBy: { version: "desc" },
        });
        return tx.authorityMandate.create({
          data: {
            id: `amnd_${randomUUID()}`,
            institutionId,
            memberId,
            action,
            scopeType,
            scopeRef,
            scopeKey,
            limits: json(body.limits ?? {}),
            conditions: json(body.conditions ?? {}),
            delegationBasis: required(body.delegationBasis, "delegationBasis", 500),
            authorityEvidenceRef: required(body.authorityEvidenceRef, "authorityEvidenceRef", 300),
            version: (latest?.version ?? 0) + 1,
            supersedesMandateId: latest?.id ?? null,
            proposedByUserId: actorUserId,
            proposalStepUpId: stepUpEvidenceId,
            expiresAt,
          },
        });
      });
    } catch (error) {
      if (uniqueConstraint(error)) {
        throw new ConflictException("a mandate proposal already exists for this member, action and scope");
      }
      throw error;
    }
    audit("institution.mandate.proposed", { actorUserId, institutionId, mandateId: mandate.id, memberId, action });
    return mandate;
  }

  async reviewMandate(
    actorUserId: string,
    mandateId: string,
    body: { approve?: boolean; reason?: string; stepUpEvidenceId?: string },
    actingInstitutionId: string,
    actorSessionId: string,
  ) {
    const mandate = await this.db.authorityMandate.findUnique({ where: { id: mandateId }, include: { member: true } });
    if (!mandate) throw new NotFoundException("mandate not found");
    if (actingInstitutionId !== mandate.institutionId) throw new ForbiddenException("mandate does not belong to the active session context");
    if (mandate.status !== "PROPOSED") throw new ConflictException("mandate is already terminal");
    if (mandate.member.status !== "ACTIVE") throw new ConflictException("target member is no longer active");
    if (mandate.expiresAt && mandate.expiresAt <= new Date()) throw new ConflictException("proposed mandate has expired");
    if (mandate.proposedByUserId === actorUserId) throw new ForbiddenException("maker cannot approve their own mandate proposal");
    await this.access.requireHuman({ userId: actorUserId, institutionId: mandate.institutionId, action: "APPROVE_AUTHORITY" });
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "MANDATE_REVIEW",
        institutionId: mandate.institutionId,
      }, tx);
      const claimed = await tx.authorityMandate.updateMany({
        where: { id: mandateId, status: "PROPOSED", approvedByUserId: null },
        data: {
          status: body.approve === true ? "ACTIVE" : "REJECTED",
          approvedByUserId: actorUserId,
          approvalStepUpId: stepUpEvidenceId,
          approvalReason: required(body.reason, "reason", 1_000),
          effectiveAt: body.approve === true ? now : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("mandate was concurrently reviewed");
      if (body.approve === true && mandate.supersedesMandateId) {
        await tx.authorityMandate.updateMany({
          where: { id: mandate.supersedesMandateId, memberId: mandate.memberId, status: "ACTIVE" },
          data: { status: "SUPERSEDED" },
        });
      }
      return tx.authorityMandate.findUniqueOrThrow({ where: { id: mandateId } });
    });
    audit("institution.mandate.reviewed", { actorUserId, institutionId: mandate.institutionId, mandateId, approved: body.approve === true });
    return updated;
  }

  async proposeAppointment(actorUserId: string, institutionId: string, body: {
    transactionCaseId?: string | null;
    appointmentRole?: string;
    appointeeInstitutionId?: string | null;
    appointeeProviderRef?: string | null;
    scope?: unknown;
    conflictDisclosure?: unknown;
    expiresAt?: string | null;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "MANAGE_APPOINTMENTS" });
    const appointeeInstitutionId = optional(body.appointeeInstitutionId, "appointeeInstitutionId", 160);
    const appointeeProviderRef = optional(body.appointeeProviderRef, "appointeeProviderRef", 300);
    if ((appointeeInstitutionId ? 1 : 0) + (appointeeProviderRef ? 1 : 0) !== 1) {
      throw new BadRequestException("exactly one appointeeInstitutionId or appointeeProviderRef is required");
    }
    if (appointeeInstitutionId) {
      const appointee = await this.db.institution.findUnique({ where: { id: appointeeInstitutionId }, include: { admission: true } });
      if (!appointee || appointee.status !== "ACTIVE" || appointee.admission?.status !== "ADMITTED") {
        throw new BadRequestException("appointeeInstitutionId must identify an admitted institution");
      }
    }
    if (appointeeProviderRef) {
      const provider = await this.db.providerReference.findUnique({ where: { id: appointeeProviderRef } });
      if (!provider || provider.status !== "ACTIVE") {
        throw new BadRequestException("appointeeProviderRef must identify an active registered provider");
      }
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException("expiresAt must be in the future");
    const appointment = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "APPOINTMENT_PROPOSE",
        institutionId,
      }, tx);
      return tx.appointment.create({
        data: {
          id: `appt_${randomUUID()}`,
          institutionId,
          transactionCaseId: optional(body.transactionCaseId, "transactionCaseId", 160),
          appointmentRole: required(body.appointmentRole, "appointmentRole", 120),
          appointeeInstitutionId,
          appointeeProviderRef,
          scope: json(body.scope ?? {}),
          conflictDisclosure: json(body.conflictDisclosure ?? {}),
          proposedByUserId: actorUserId,
          proposalStepUpId: stepUpEvidenceId,
          expiresAt,
        },
      });
    });
    audit("institution.appointment.proposed", { actorUserId, institutionId, appointmentId: appointment.id });
    return appointment;
  }

  async acceptAppointment(
    actorUserId: string,
    appointmentId: string,
    body: { stepUpEvidenceId?: string },
    actingInstitutionId: string,
    actorSessionId: string,
  ) {
    const appointment = await this.db.appointment.findUnique({
      where: { id: appointmentId },
      include: { institution: { include: { admission: true } } },
    });
    if (!appointment) throw new NotFoundException("appointment not found");
    if (appointment.status !== "PROPOSED") throw new ConflictException("appointment is not awaiting acceptance");
    if (appointment.expiresAt && appointment.expiresAt <= new Date()) throw new ConflictException("appointment has expired");
    if (appointment.institution.status !== "ACTIVE" || appointment.institution.admission?.status !== "ADMITTED") {
      throw new ConflictException("appointing institution is no longer admitted");
    }
    if (!appointment.appointeeInstitutionId) throw new BadRequestException("provider appointment acceptance requires a certified provider adapter");
    if (actingInstitutionId !== appointment.appointeeInstitutionId) throw new ForbiddenException("appointee does not match the active session context");
    if (appointment.proposedByUserId === actorUserId) throw new ForbiddenException("appointing maker cannot accept their own appointment");
    await this.access.requireHuman({ userId: actorUserId, institutionId: appointment.appointeeInstitutionId, action: "MANAGE_APPOINTMENTS" });
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const accepted = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "APPOINTMENT_ACCEPT",
        institutionId: appointment.appointeeInstitutionId,
      }, tx);
      const claimed = await tx.appointment.updateMany({
        where: { id: appointmentId, status: "PROPOSED", acceptedByUserId: null },
        data: { status: "ACTIVE", acceptedByUserId: actorUserId, acceptanceStepUpId: stepUpEvidenceId, effectiveAt: now },
      });
      if (claimed.count !== 1) throw new ConflictException("appointment was concurrently accepted");
      return tx.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    });
    audit("institution.appointment.accepted", { actorUserId, institutionId: appointment.institutionId, appointmentId });
    return accepted;
  }

  async proposeRouteEntitlement(actorUserId: string, institutionId: string, body: {
    transactionRoute?: string;
    representation?: string;
    assetClass?: string;
    lifecycleLeg?: string;
    materialFunction?: string;
    functionPerformer?: string;
    routePackRef?: string;
    permissionEvidenceRef?: string;
    operatingModes?: unknown;
    limits?: unknown;
    conditions?: unknown;
    expiresAt?: string | null;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: "PROPOSE_AUTHORITY" });
    const transactionRoute = oneOf(body.transactionRoute, "transactionRoute", TRANSACTION_ROUTES);
    const representation = oneOf(body.representation, "representation", REPRESENTATIONS);
    const assetClass = oneOf(body.assetClass, "assetClass", ASSET_CLASSES);
    const lifecycleLeg = oneOf(body.lifecycleLeg, "lifecycleLeg", LIFECYCLE_LEGS);
    const materialFunction = oneOf(body.materialFunction, "materialFunction", MATERIAL_FUNCTIONS);
    const functionPerformer = oneOf(body.functionPerformer, "functionPerformer", FUNCTION_PERFORMERS);
    const operatingModes = arrayOf(body.operatingModes, "operatingModes", OPERATING_MODES);
    const unavailable = operatingModes.filter((mode) => !(PR03_OPERATING_MODES as readonly string[]).includes(mode));
    if (unavailable.length) throw new BadRequestException(`PR-03 may record only REPLAY/SHADOW entitlements; unavailable: ${unavailable.join(", ")}`);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const expiresAt = optionalDate(body.expiresAt, "expiresAt");
    if (expiresAt && expiresAt <= new Date()) throw new BadRequestException("expiresAt must be in the future");
    const entitlement = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "ROUTE_ENTITLEMENT_PROPOSE",
        institutionId,
      }, tx);
      return tx.routeEntitlement.create({
        data: {
          id: `rent_${randomUUID()}`,
          institutionId,
          transactionRoute,
          representation,
          assetClass,
          lifecycleLeg,
          materialFunction,
          functionPerformer,
          routePackRef: required(body.routePackRef, "routePackRef", 300),
          permissionEvidenceRef: required(body.permissionEvidenceRef, "permissionEvidenceRef", 300),
          operatingModes: json(operatingModes),
          limits: json(body.limits ?? {}),
          conditions: json(body.conditions ?? {}),
          proposedByUserId: actorUserId,
          proposalStepUpId: stepUpEvidenceId,
          expiresAt,
        },
      });
    });
    audit("institution.route_entitlement.proposed", { actorUserId, institutionId, entitlementId: entitlement.id });
    return entitlement;
  }

  async reviewRouteEntitlement(
    actorUserId: string,
    entitlementId: string,
    body: { approve?: boolean; reason?: string; stepUpEvidenceId?: string },
    actorSessionId: string,
  ) {
    const entitlement = await this.db.routeEntitlement.findUnique({
      where: { id: entitlementId },
      include: { institution: { include: { admission: true } } },
    });
    if (!entitlement) throw new NotFoundException("route entitlement not found");
    if (entitlement.status !== "PROPOSED") throw new ConflictException("route entitlement is already terminal");
    if (entitlement.expiresAt && entitlement.expiresAt <= new Date()) throw new ConflictException("route entitlement has expired");
    if (entitlement.institution.status !== "ACTIVE" || entitlement.institution.admission?.status !== "ADMITTED") {
      throw new ConflictException("institution is no longer admitted");
    }
    if (entitlement.proposedByUserId === actorUserId) throw new ForbiddenException("maker cannot approve their own route entitlement");
    await this.requirePlatformAdmin(actorUserId);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const reviewed = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "ROUTE_ENTITLEMENT_REVIEW",
        institutionId: entitlement.institutionId,
      }, tx);
      const claimed = await tx.routeEntitlement.updateMany({
        where: { id: entitlementId, status: "PROPOSED", approvedByUserId: null },
        data: {
          status: body.approve === true ? "ACTIVE" : "REJECTED",
          approvedByUserId: actorUserId,
          approvalStepUpId: stepUpEvidenceId,
          approvalReason: required(body.reason, "reason", 1_000),
          effectiveAt: body.approve === true ? now : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("route entitlement was concurrently reviewed");
      return tx.routeEntitlement.findUniqueOrThrow({ where: { id: entitlementId } });
    });
    audit("institution.route_entitlement.reviewed", { actorUserId, institutionId: entitlement.institutionId, entitlementId, approved: body.approve === true });
    return reviewed;
  }

  async proposeStatusChange(actorUserId: string, institutionId: string, body: {
    targetType?: string;
    targetId?: string;
    changeType?: string;
    reason?: string;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    const targetType = oneOf(body.targetType, "targetType", CHANGE_TARGETS);
    const changeType = oneOf(body.changeType, "changeType", CHANGE_TYPES);
    const targetId = required(body.targetId, "targetId", 160);
    const requiredAction: InstitutionAction = targetType === "MEMBER" ? "ADMINISTER_MEMBERS"
      : targetType === "APPOINTMENT" ? "MANAGE_APPOINTMENTS"
        : targetType === "SERVICE_PRINCIPAL" ? "MANAGE_SERVICE_IDENTITIES"
          : targetType === "IDENTITY_CONNECTION" ? "MANAGE_IDENTITY_CONNECTIONS" : "PROPOSE_AUTHORITY";
    await this.access.requireHuman({ userId: actorUserId, institutionId, action: requiredAction });
    const targetStatus = await this.assertTargetInstitution(targetType, targetId, institutionId);
    const shadowAccessTarget = ["SERVICE_PRINCIPAL", "IDENTITY_CONNECTION"].includes(targetType);
    const validStatus = shadowAccessTarget && changeType === "REINSTATE" ? false
      : changeType === "SUSPEND" ? ["ACTIVE", "SHADOW_APPROVED"].includes(targetStatus)
        : changeType === "REVOKE" ? ["ACTIVE", "SHADOW_APPROVED", "SUSPENDED", "PROPOSED", "PENDING"].includes(targetStatus)
          : targetStatus === "SUSPENDED";
    if (!validStatus) throw new ConflictException(`${changeType} is not allowed from target status ${targetStatus}`);
    const purpose = this.changePurpose(targetType);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const payload = {
      institutionId,
      targetType,
      targetId,
      changeType,
      fromStatus: targetStatus,
      reason: required(body.reason, "reason", 1_000),
    };
    let proposal;
    try {
      proposal = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actorUserId,
          sessionId: actorSessionId,
          purpose,
          institutionId,
        }, tx);
        return tx.institutionChangeProposal.create({
          data: {
            id: `ichg_${randomUUID()}`,
            ...payload,
            proposalPayload: json(payload),
            proposalDigest: sha256Digest(payload),
            proposedByUserId: actorUserId,
            proposalStepUpId: stepUpEvidenceId,
          },
        });
      });
    } catch (error) {
      if (uniqueConstraint(error)) throw new ConflictException("a status change is already pending for this target");
      throw error;
    }
    audit("institution.status_change.proposed", { actorUserId, institutionId, proposalId: proposal.id, targetType, targetId, changeType });
    return proposal;
  }

  async reviewStatusChange(
    actorUserId: string,
    proposalId: string,
    body: { approve?: boolean; reviewNote?: string; stepUpEvidenceId?: string },
    actingInstitutionId: string,
    actorSessionId: string,
  ) {
    const proposal = await this.db.institutionChangeProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException("status-change proposal not found");
    if (actingInstitutionId !== proposal.institutionId) throw new ForbiddenException("status change does not belong to the active session context");
    if (proposal.status !== "PENDING") throw new ConflictException("status-change proposal is already terminal");
    if (proposal.proposedByUserId === actorUserId) throw new ForbiddenException("maker cannot review their own status change");
    const requiredAction: InstitutionAction = proposal.targetType === "MEMBER" ? "ADMINISTER_MEMBERS"
      : proposal.targetType === "APPOINTMENT" ? "MANAGE_APPOINTMENTS"
        : proposal.targetType === "SERVICE_PRINCIPAL" ? "MANAGE_SERVICE_IDENTITIES"
          : proposal.targetType === "IDENTITY_CONNECTION" ? "MANAGE_IDENTITY_CONNECTIONS" : "APPROVE_AUTHORITY";
    await this.access.requireHuman({ userId: actorUserId, institutionId: proposal.institutionId, action: requiredAction });
    const purpose = this.changePurpose(proposal.targetType);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const reviewed = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose,
        institutionId: proposal.institutionId,
      }, tx);
      const claimed = await tx.institutionChangeProposal.updateMany({
        where: { id: proposal.id, status: "PENDING", reviewedByUserId: null },
        data: {
          status: body.approve === true ? "APPROVED" : "REJECTED",
          reviewedByUserId: actorUserId,
          reviewStepUpId: stepUpEvidenceId,
          reviewNote: required(body.reviewNote, "reviewNote", 1_000),
          reviewedAt: now,
          appliedAt: body.approve === true ? now : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("status-change proposal was concurrently reviewed");
      if (body.approve === true) await this.applyStatusChange(tx, proposal, now);
      return tx.institutionChangeProposal.findUniqueOrThrow({ where: { id: proposal.id } });
    });
    audit("institution.status_change.reviewed", { actorUserId, institutionId: proposal.institutionId, proposalId, approved: body.approve === true });
    return reviewed;
  }

  private changePurpose(targetType: string): StepUpPurpose {
    if (targetType === "MEMBER") return "MEMBERSHIP_STATUS_CHANGE";
    if (targetType === "MANDATE") return "MANDATE_STATUS_CHANGE";
    if (targetType === "APPOINTMENT") return "APPOINTMENT_STATUS_CHANGE";
    if (targetType === "SERVICE_PRINCIPAL") return "SERVICE_PRINCIPAL_STATUS_CHANGE";
    if (targetType === "IDENTITY_CONNECTION") return "IDENTITY_CONNECTION_STATUS_CHANGE";
    return "ROUTE_ENTITLEMENT_STATUS_CHANGE";
  }

  private async requirePlatformAdmin(userId: string): Promise<void> {
    const user = await this.db.venueUser.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE" || !["ADMIN", "SUPERADMIN"].includes(user.platformRole ?? "")) {
      throw new ForbiddenException("active platform administrator required");
    }
  }

  private async assertTargetInstitution(targetType: string, targetId: string, institutionId: string): Promise<string> {
    const target = targetType === "MEMBER" ? await this.db.institutionMember.findUnique({ where: { id: targetId } })
      : targetType === "MANDATE" ? await this.db.authorityMandate.findUnique({ where: { id: targetId } })
        : targetType === "APPOINTMENT" ? await this.db.appointment.findUnique({ where: { id: targetId } })
          : targetType === "ROUTE_ENTITLEMENT" ? await this.db.routeEntitlement.findUnique({ where: { id: targetId } })
            : targetType === "SERVICE_PRINCIPAL" ? await this.db.institutionServicePrincipal.findUnique({ where: { id: targetId } })
              : await this.db.institutionIdentityConnection.findUnique({ where: { id: targetId } });
    if (!target || target.institutionId !== institutionId) throw new NotFoundException("governance target not found in institution");
    return target.status;
  }

  private async applyStatusChange(tx: Prisma.TransactionClient, proposal: {
    targetType: string;
    targetId: string;
    changeType: string;
    fromStatus: string;
    reason: string;
  }, now: Date): Promise<void> {
    const status = proposal.changeType === "REINSTATE" ? "ACTIVE" : proposal.changeType === "SUSPEND" ? "SUSPENDED" : "REVOKED";
    const timeFields = {
      suspendedAt: proposal.changeType === "SUSPEND" ? now : proposal.changeType === "REINSTATE" ? null : undefined,
      revokedAt: proposal.changeType === "REVOKE" ? now : proposal.changeType === "REINSTATE" ? null : undefined,
    };
    if (proposal.targetType === "MEMBER") {
      const changed = await tx.institutionMember.updateMany({
        where: { id: proposal.targetId, status: proposal.fromStatus },
        data: { status, ...timeFields, revocationReason: proposal.reason },
      });
      if (changed.count !== 1) throw new ConflictException("membership status changed after the proposal was made");
      if (status !== "ACTIVE") await tx.authorityMandate.updateMany({
        where: { memberId: proposal.targetId, status: "ACTIVE" },
        data: { status: "SUSPENDED", suspendedAt: now },
      });
    } else if (proposal.targetType === "MANDATE") {
      const changed = await tx.authorityMandate.updateMany({ where: { id: proposal.targetId, status: proposal.fromStatus }, data: { status, ...timeFields } });
      if (changed.count !== 1) throw new ConflictException("mandate status changed after the proposal was made");
    } else if (proposal.targetType === "APPOINTMENT") {
      const changed = await tx.appointment.updateMany({
        where: { id: proposal.targetId, status: proposal.fromStatus },
        data: { status, ...timeFields },
      });
      if (changed.count !== 1) throw new ConflictException("appointment status changed after the proposal was made");
    } else if (proposal.targetType === "ROUTE_ENTITLEMENT") {
      const changed = await tx.routeEntitlement.updateMany({ where: { id: proposal.targetId, status: proposal.fromStatus }, data: { status, ...timeFields } });
      if (changed.count !== 1) throw new ConflictException("route entitlement status changed after the proposal was made");
    } else if (proposal.targetType === "SERVICE_PRINCIPAL") {
      const changed = await tx.institutionServicePrincipal.updateMany({ where: { id: proposal.targetId, status: proposal.fromStatus }, data: { status, ...timeFields } });
      if (changed.count !== 1) throw new ConflictException("service-principal status changed after the proposal was made");
    } else {
      const changed = await tx.institutionIdentityConnection.updateMany({ where: { id: proposal.targetId, status: proposal.fromStatus }, data: { status, ...timeFields } });
      if (changed.count !== 1) throw new ConflictException("identity-connection status changed after the proposal was made");
    }
  }
}
