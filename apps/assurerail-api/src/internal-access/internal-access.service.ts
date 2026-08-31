import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest } from "../contracts/v1";
import { StepUpService } from "../institutions/step-up.service";
import { PrismaService } from "../store/prisma.service";
import {
  evaluateIndependentApproval,
  evaluateInternalAssignment,
  isInternalPermission,
  isInternalRole,
  isInternalScopeType,
  type InternalPermission,
  type InternalPolicyDecision,
  type InternalRole,
  type InternalScopeType,
} from "./internal-access-policy";

const ASSIGNMENT_ROLES_REQUIRING_SHORT_TERM = new Set<InternalRole>(["SUPERADMIN", "SYSADMIN", "SECURITY_ADMIN"]);
const ELEVATION_RISK_CLASSES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const MAX_STANDARD_ASSIGNMENT_MS = 366 * 24 * 60 * 60 * 1_000;
const MAX_SENSITIVE_ASSIGNMENT_MS = 91 * 24 * 60 * 60 * 1_000;
const MIN_ELEVATION_MS = 60_000;
const MAX_ELEVATION_MS = 4 * 60 * 60 * 1_000;

function required(value: unknown, name: string, max = 1_000): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return trimmed;
}

function optional(value: unknown, name: string, max = 1_000): string | null {
  return value === undefined || value === null || value === "" ? null : required(value, name, max);
}

function requiredDate(value: unknown, name: string): Date {
  const parsed = new Date(required(value, name, 120));
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function scope(input: { scopeType?: unknown; scopeRef?: unknown }): { scopeType: InternalScopeType; scopeRef: string | null; scopeKey: string } {
  const scopeType = required(input.scopeType, "scopeType", 80);
  if (!isInternalScopeType(scopeType)) throw new BadRequestException("scopeType is invalid");
  const scopeRef = optional(input.scopeRef, "scopeRef", 300);
  if (scopeType === "GLOBAL" && scopeRef !== null) throw new BadRequestException("GLOBAL scope may not carry scopeRef");
  if (scopeType !== "GLOBAL" && scopeRef === null) throw new BadRequestException(`${scopeType} scope requires scopeRef`);
  return { scopeType, scopeRef, scopeKey: `${scopeType}:${scopeRef ?? "*"}` };
}

function assignmentTerm(role: InternalRole, expiresAt: Date, now: Date): void {
  if (expiresAt <= now) throw new BadRequestException("expiresAt must be in the future");
  const cap = ASSIGNMENT_ROLES_REQUIRING_SHORT_TERM.has(role) ? MAX_SENSITIVE_ASSIGNMENT_MS : MAX_STANDARD_ASSIGNMENT_MS;
  if (expiresAt.getTime() - now.getTime() > cap) {
    throw new BadRequestException(`${role} assignment exceeds its maximum recertification term`);
  }
}

function elevationTerm(expiresAt: Date, now: Date): void {
  const duration = expiresAt.getTime() - now.getTime();
  if (duration < MIN_ELEVATION_MS || duration > MAX_ELEVATION_MS) {
    throw new BadRequestException("privileged elevation must expire between one minute and four hours from now");
  }
}

export interface InternalAccessResult extends InternalPolicyDecision {
  source?: "ASSIGNMENT" | "ELEVATION";
  assignmentId?: string;
  elevationId?: string;
}

/**
 * Internal control-plane service. It is intentionally not an InstitutionAccessService: callers
 * must never use staff employment to satisfy participant mandates or external case functions.
 */
@Injectable()
export class InternalAccessService {
  constructor(private readonly db: PrismaService, private readonly stepUp: StepUpService) {}

  async evaluate(input: {
    userId: string;
    permission: InternalPermission;
    scopeType: InternalScopeType;
    scopeRef: string | null;
    now?: Date;
  }): Promise<InternalAccessResult> {
    const now = input.now ?? new Date();
    const assignments = await this.db.internalRoleAssignment.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    });
    let last: InternalPolicyDecision = { allowed: false, code: "INTERNAL_ASSIGNMENT_NOT_FOUND" };
    for (const assignment of assignments) {
      last = evaluateInternalAssignment({
        role: assignment.role,
        status: assignment.status,
        scopeType: assignment.scopeType,
        scopeRef: assignment.scopeRef,
        effectiveAt: assignment.effectiveAt,
        expiresAt: assignment.expiresAt,
        permission: input.permission,
        requestedScopeType: input.scopeType,
        requestedScopeRef: input.scopeRef,
        now,
      });
      if (last.allowed) return { ...last, source: "ASSIGNMENT", assignmentId: assignment.id };
    }

    const elevations = await this.db.privilegedAccessRequest.findMany({
      where: { userId: input.userId, status: "ACTIVE", expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" },
    });
    for (const elevation of elevations) {
      if (elevation.requestedPermission === input.permission
        && (!elevation.startsAt || elevation.startsAt <= now)
        && (elevation.scopeType === "GLOBAL" || (elevation.scopeType === input.scopeType && elevation.scopeRef === input.scopeRef))) {
        return { allowed: true, code: "INTERNAL_ELEVATION_AUTHORISED", source: "ELEVATION", elevationId: elevation.id };
      }
    }
    return last;
  }

  async require(input: {
    userId: string;
    permission: InternalPermission;
    scopeType: InternalScopeType;
    scopeRef: string | null;
  }) {
    const result = await this.evaluate(input);
    if (!result.allowed) throw new ForbiddenException(`internal authority denied: ${result.code}`);
    return result;
  }

  async listForUser(userId: string) {
    const [assignments, elevations] = await Promise.all([
      this.db.internalRoleAssignment.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      this.db.privilegedAccessRequest.findMany({ where: { userId }, orderBy: { requestedAt: "desc" } }),
    ]);
    return { assignments, elevations };
  }

  async listAssignments() {
    return this.db.internalRoleAssignment.findMany({
      include: { user: { select: { id: true, email: true, displayName: true, status: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async proposeAssignment(actorUserId: string, actorSessionId: string, body: {
    userId?: unknown;
    role?: unknown;
    scopeType?: unknown;
    scopeRef?: unknown;
    reason?: unknown;
    evidenceRef?: unknown;
    expiresAt?: unknown;
    stepUpEvidenceId?: unknown;
  }) {
    const userId = required(body.userId, "userId", 160);
    const roleValue = required(body.role, "role", 80);
    if (!isInternalRole(roleValue)) throw new BadRequestException("role is invalid");
    const role = roleValue;
    const scoped = scope(body);
    if (role === "SUPERADMIN" && scoped.scopeType !== "GLOBAL") throw new BadRequestException("SUPERADMIN assignment must be GLOBAL scope");
    const now = new Date();
    const expiresAt = requiredDate(body.expiresAt, "expiresAt");
    assignmentTerm(role, expiresAt, now);
    const reason = required(body.reason, "reason", 2_000);
    const evidenceRef = optional(body.evidenceRef, "evidenceRef", 500);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const target = await this.db.venueUser.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!target || target.status === "SUSPENDED") throw new BadRequestException("target user must be an active or pending Rail account");
    const proposalDigest = sha256Digest({ userId, role, ...scoped, reason, evidenceRef, expiresAt: expiresAt.toISOString() });
    try {
      const assignment = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actorUserId,
          sessionId: actorSessionId,
          purpose: "INTERNAL_ROLE_PROPOSE",
          institutionId: null,
        }, tx);
        const latest = await tx.internalRoleAssignment.findFirst({
          where: { userId, role, scopeKey: scoped.scopeKey },
          orderBy: { version: "desc" },
        });
        const created = await tx.internalRoleAssignment.create({
          data: {
            id: `ira_${randomUUID()}`,
            userId,
            role,
            ...scoped,
            reason,
            evidenceRef,
            proposalDigest,
            proposedByUserId: actorUserId,
            proposalStepUpId: stepUpEvidenceId,
            version: (latest?.version ?? 0) + 1,
            supersedesId: latest?.id ?? null,
            expiresAt,
          },
        });
        await tx.internalAccessEvent.create({
          data: {
            id: `iae_${randomUUID()}`,
            userId,
            internalRoleAssignmentId: created.id,
            eventType: "INTERNAL_ROLE_PROPOSED",
            scopeType: scoped.scopeType,
            scopeRef: scoped.scopeRef,
            reason,
            payloadDigest: sha256Digest({ proposalDigest, actorUserId, eventType: "INTERNAL_ROLE_PROPOSED" }),
          },
        });
        return created;
      });
      audit("internal.role.proposed", { actorUserId, assignmentId: assignment.id, userId, role, scopeKey: scoped.scopeKey });
      return assignment;
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002") throw new ConflictException("an identical assignment proposal already exists");
      throw error;
    }
  }

  async reviewAssignment(actorUserId: string, actorSessionId: string, assignmentId: string, body: {
    approve?: unknown;
    reason?: unknown;
    stepUpEvidenceId?: unknown;
  }) {
    const assignment = await this.db.internalRoleAssignment.findUnique({
      where: { id: assignmentId },
      include: { user: { select: { status: true, identityVerifiedAt: true } } },
    });
    if (!assignment) throw new NotFoundException("internal role assignment not found");
    if (assignment.status !== "PROPOSED") throw new ConflictException("internal role assignment is no longer pending");
    if (assignment.expiresAt && assignment.expiresAt <= new Date()) throw new ConflictException("internal role assignment proposal has expired");
    if (body.approve === true && (assignment.user.status !== "ACTIVE" || !assignment.user.identityVerifiedAt)) {
      throw new ConflictException("an assignment cannot activate until its target account is active and identity-bound");
    }
    const independence = evaluateIndependentApproval({
      actorUserId,
      proposerUserId: assignment.proposedByUserId,
      subjectUserId: assignment.userId,
    });
    if (!independence.allowed) throw new ForbiddenException(independence.code);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const approve = body.approve === true;
    const reason = required(body.reason, "reason", 2_000);
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "INTERNAL_ROLE_REVIEW",
        institutionId: null,
      }, tx);
      const claimed = await tx.internalRoleAssignment.updateMany({
        where: { id: assignment.id, status: "PROPOSED", approvedByUserId: null },
        data: {
          status: approve ? "ACTIVE" : "REJECTED",
          approvedByUserId: actorUserId,
          approvalStepUpId: stepUpEvidenceId,
          approvalReason: reason,
          effectiveAt: approve ? now : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("internal role assignment was concurrently reviewed");
      if (approve && assignment.supersedesId) {
        await tx.internalRoleAssignment.updateMany({
          where: { id: assignment.supersedesId, userId: assignment.userId, status: "ACTIVE" },
          data: { status: "SUPERSEDED" },
        });
      }
      await tx.internalAccessEvent.create({
        data: {
          id: `iae_${randomUUID()}`,
          userId: assignment.userId,
          internalRoleAssignmentId: assignment.id,
          eventType: approve ? "INTERNAL_ROLE_APPROVED" : "INTERNAL_ROLE_REJECTED",
          scopeType: assignment.scopeType,
          scopeRef: assignment.scopeRef,
          reason,
          payloadDigest: sha256Digest({ assignmentId: assignment.id, actorUserId, approve, reason }),
        },
      });
      return tx.internalRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    });
    audit("internal.role.reviewed", { actorUserId, assignmentId, approved: approve });
    return updated;
  }

  async revokeAssignment(actorUserId: string, actorSessionId: string, assignmentId: string, body: { reason?: unknown; stepUpEvidenceId?: unknown }) {
    const assignment = await this.db.internalRoleAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("internal role assignment not found");
    if (!["PROPOSED", "ACTIVE", "SUSPENDED"].includes(assignment.status)) throw new ConflictException("internal role assignment cannot be revoked from its current state");
    const reason = required(body.reason, "reason", 2_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "INTERNAL_ROLE_REVOKE", institutionId: null }, tx);
      const claimed = await tx.internalRoleAssignment.updateMany({
        where: { id: assignment.id, status: { in: ["PROPOSED", "ACTIVE", "SUSPENDED"] } },
        data: { status: "REVOKED", revokedAt: now, approvalReason: reason },
      });
      if (claimed.count !== 1) throw new ConflictException("internal role assignment was concurrently changed");
      await tx.privilegedAccessRequest.updateMany({
        where: { userId: assignment.userId, status: { in: ["REQUESTED", "APPROVED", "ACTIVE"] } },
        data: { status: "REVOKED", revokedAt: now, revokedByUserId: actorUserId },
      });
      await tx.internalAccessEvent.create({
        data: {
          id: `iae_${randomUUID()}`, userId: assignment.userId, internalRoleAssignmentId: assignment.id,
          eventType: "INTERNAL_ROLE_REVOKED", scopeType: assignment.scopeType, scopeRef: assignment.scopeRef,
          reason, payloadDigest: sha256Digest({ assignmentId: assignment.id, actorUserId, reason }),
        },
      });
      return tx.internalRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    });
    audit("internal.role.revoked", { actorUserId, assignmentId });
    return updated;
  }

  async requestElevation(actorUserId: string, actorSessionId: string, body: {
    permission?: unknown;
    scopeType?: unknown;
    scopeRef?: unknown;
    reason?: unknown;
    ticketRef?: unknown;
    riskClass?: unknown;
    expiresAt?: unknown;
    stepUpEvidenceId?: unknown;
  }) {
    const permissionValue = required(body.permission, "permission", 120);
    if (!isInternalPermission(permissionValue)) throw new BadRequestException("permission is invalid");
    const scoped = scope(body);
    await this.require({
      userId: actorUserId,
      permission: "SUPPORT_ELEVATION_REQUEST",
      scopeType: scoped.scopeType,
      scopeRef: scoped.scopeRef,
    });
    const riskClass = required(body.riskClass, "riskClass", 30);
    if (!ELEVATION_RISK_CLASSES.has(riskClass)) throw new BadRequestException("riskClass is invalid");
    const reason = required(body.reason, "reason", 2_000);
    const ticketRef = required(body.ticketRef, "ticketRef", 240);
    const now = new Date();
    const expiresAt = requiredDate(body.expiresAt, "expiresAt");
    elevationTerm(expiresAt, now);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const requested = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "PRIVILEGED_ACCESS_REQUEST", institutionId: null }, tx);
      const created = await tx.privilegedAccessRequest.create({
        data: {
          id: `par_${randomUUID()}`, userId: actorUserId, requestedPermission: permissionValue, ...scoped,
          reason, ticketRef, riskClass, requestedByUserId: actorUserId, requestStepUpId: stepUpEvidenceId, expiresAt,
        },
      });
      await tx.internalAccessEvent.create({
        data: {
          id: `iae_${randomUUID()}`, userId: actorUserId, privilegedAccessRequestId: created.id,
          eventType: "PRIVILEGED_ACCESS_REQUESTED", permission: permissionValue,
          scopeType: scoped.scopeType, scopeRef: scoped.scopeRef, reason,
          payloadDigest: sha256Digest({ elevationId: created.id, actorUserId, permission: permissionValue, ...scoped, ticketRef }),
        },
      });
      return created;
    });
    audit("internal.elevation.requested", { actorUserId, elevationId: requested.id, permission: permissionValue, scopeKey: scoped.scopeKey });
    return requested;
  }

  async reviewElevation(actorUserId: string, actorSessionId: string, elevationId: string, body: { approve?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    const elevation = await this.db.privilegedAccessRequest.findUnique({ where: { id: elevationId } });
    if (!elevation) throw new NotFoundException("privileged access request not found");
    if (elevation.status !== "REQUESTED") throw new ConflictException("privileged access request is no longer pending");
    if (!elevation.expiresAt || elevation.expiresAt <= new Date()) throw new ConflictException("privileged access request has expired");
    const independence = evaluateIndependentApproval({ actorUserId, proposerUserId: elevation.requestedByUserId });
    if (!independence.allowed) throw new ForbiddenException(independence.code);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const approve = body.approve === true;
    const reason = required(body.reason, "reason", 2_000);
    const now = new Date();
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "PRIVILEGED_ACCESS_REVIEW", institutionId: null }, tx);
      const claimed = await tx.privilegedAccessRequest.updateMany({
        where: { id: elevation.id, status: "REQUESTED", approvedByUserId: null },
        data: {
          status: approve ? "ACTIVE" : "DENIED", startsAt: approve ? now : null,
          approvedByUserId: approve ? actorUserId : null, approvalStepUpId: approve ? stepUpEvidenceId : null,
          approvalReason: reason, deniedByUserId: approve ? null : actorUserId, deniedAt: approve ? null : now,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("privileged access request was concurrently reviewed");
      await tx.internalAccessEvent.create({
        data: {
          id: `iae_${randomUUID()}`, userId: elevation.userId, privilegedAccessRequestId: elevation.id,
          eventType: approve ? "PRIVILEGED_ACCESS_APPROVED" : "PRIVILEGED_ACCESS_DENIED",
          permission: elevation.requestedPermission, scopeType: elevation.scopeType, scopeRef: elevation.scopeRef,
          reason, payloadDigest: sha256Digest({ elevationId: elevation.id, actorUserId, approve, reason }),
        },
      });
      return tx.privilegedAccessRequest.findUniqueOrThrow({ where: { id: elevation.id } });
    });
    audit("internal.elevation.reviewed", { actorUserId, elevationId, approved: approve });
    return updated;
  }

  async recordElevationUse(input: { userId: string; elevationId: string; permission: InternalPermission; scopeType: InternalScopeType; scopeRef: string | null; requestId?: string | null; reason?: string | null }) {
    const elevation = await this.db.privilegedAccessRequest.findUnique({ where: { id: input.elevationId } });
    const now = new Date();
    if (!elevation || elevation.userId !== input.userId || elevation.status !== "ACTIVE" || !elevation.startsAt || elevation.startsAt > now || !elevation.expiresAt || elevation.expiresAt <= now) {
      throw new ForbiddenException("privileged elevation is not active");
    }
    if (elevation.requestedPermission !== input.permission
      || !(elevation.scopeType === "GLOBAL" || (elevation.scopeType === input.scopeType && elevation.scopeRef === input.scopeRef))) {
      throw new ForbiddenException("privileged elevation does not cover this action");
    }
    return this.db.internalAccessEvent.create({
      data: {
        id: `iae_${randomUUID()}`, userId: input.userId, privilegedAccessRequestId: elevation.id,
        eventType: "PRIVILEGED_ACCESS_USED", permission: input.permission, scopeType: input.scopeType,
        scopeRef: input.scopeRef, requestId: input.requestId ?? null, reason: input.reason ?? null,
        payloadDigest: sha256Digest({ elevationId: elevation.id, userId: input.userId, permission: input.permission, scopeType: input.scopeType, scopeRef: input.scopeRef, requestId: input.requestId ?? null }),
      },
    });
  }
}
