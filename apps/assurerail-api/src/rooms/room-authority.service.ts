import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { sha256Digest } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { appendGovernedAudit } from "./governed-audit";

export type RoomActor = {
  actorUserId: string;
  actingInstitutionId: string;
  actorSessionId: string;
  proxyAuthority?: {
    connectorId: string;
    mappingId: string;
    requestId: string;
    externalActorRef: string;
    action: string;
  };
};
type AuthorityCommand = "ALLOCATE_RAIL" | "PAUSE_RAIL" | "RESUME_RAIL" | "RETURN_LEGACY";

function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function optionalDate(value: unknown, name: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(required(value, name, 80));
  if (!Number.isFinite(date.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return date;
}

function command(value: unknown): AuthorityCommand {
  const result = required(value, "command", 40) as AuthorityCommand;
  if (!["ALLOCATE_RAIL", "PAUSE_RAIL", "RESUME_RAIL", "RETURN_LEGACY"].includes(result)) {
    throw new BadRequestException("command must be ALLOCATE_RAIL, PAUSE_RAIL, RESUME_RAIL or RETURN_LEGACY");
  }
  return result;
}

@Injectable()
export class RoomAuthorityService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
  ) {}

  async get(actor: RoomActor, caseId: string) {
    await this.requireCaseOwner(actor, caseId, "VIEW_CASE_ROOM");
    const assignment = await this.db.roomAuthorityAssignment.findUnique({
      where: { transactionCaseId: caseId },
      include: { changes: { orderBy: { proposedAt: "desc" } } },
    });
    return assignment ?? {
      transactionCaseId: caseId,
      writeSource: "LEGACY",
      state: "ACTIVE",
      cohortRef: null,
      version: 0,
      implicit: true,
      changes: await this.db.roomAuthorityChange.findMany({ where: { transactionCaseId: caseId }, orderBy: { proposedAt: "desc" } }),
    };
  }

  async propose(actor: RoomActor, caseId: string, body: {
    command?: string; expectedVersion?: number; cohortRef?: string | null; legacyCompatibilityUntil?: string | null;
    reason?: string; authorityEvidenceRef?: string; stepUpEvidenceId?: string;
  }) {
    const authority = await this.requireCaseOwner(actor, caseId, "OPERATE_CASE_ROOM");
    const requested = command(body.command);
    const current = await this.db.roomAuthorityAssignment.findUnique({ where: { transactionCaseId: caseId } });
    const fromWriteSource = current?.writeSource ?? "LEGACY";
    const fromState = current?.state ?? "ACTIVE";
    const currentVersion = current?.version ?? 0;
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion !== currentVersion) {
      throw new ConflictException(`room authority version is ${currentVersion}; proposal expected ${String(body.expectedVersion)}`);
    }
    const target = this.target(requested, fromWriteSource, fromState);
    if (["ALLOCATE_RAIL", "RESUME_RAIL"].includes(requested) && inspectPersistenceFlags(process.env).roomWriteSource !== "rail") {
      throw new ForbiddenException("Rail write capability is disabled by runtime policy");
    }
    if (requested === "RETURN_LEGACY") {
      const railNativeRooms = await this.db.caseRoom.count({ where: { transactionCaseId: caseId, legacyRoomId: null } });
      if (railNativeRooms > 0) {
        throw new ConflictException("a case with Rail-native room history cannot be losslessly returned to legacy; pause it instead");
      }
    }
    const cohortRef = target.writeSource === "RAIL" ? required(body.cohortRef ?? current?.cohortRef, "cohortRef", 200) : null;
    const legacyCompatibilityUntil = optionalDate(body.legacyCompatibilityUntil ?? current?.legacyCompatibilityUntil?.toISOString(), "legacyCompatibilityUntil");
    const reason = required(body.reason, "reason", 1_000);
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const proposalDigest = sha256Digest({
      caseId, requested, expectedVersion: currentVersion, fromWriteSource, fromState,
      toWriteSource: target.writeSource, toState: target.state, cohortRef,
      legacyCompatibilityUntil: legacyCompatibilityUntil?.toISOString() ?? null, reason, authorityEvidenceRef,
    });
    const existing = await this.db.roomAuthorityChange.findUnique({ where: { transactionCaseId_proposalDigest: { transactionCaseId: caseId, proposalDigest } } });
    if (existing) return existing;
    const pending = await this.db.roomAuthorityChange.findFirst({ where: { transactionCaseId: caseId, status: "PENDING" } });
    if (pending) throw new ConflictException("a room-authority change is already pending review");
    const change = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "ROOM_AUTHORITY_PROPOSE", institutionId: actor.actingInstitutionId }, tx);
      const created = await tx.roomAuthorityChange.create({ data: {
        id: `rauthc_${randomUUID()}`, transactionCaseId: caseId, assignmentId: current?.id ?? null,
        command: requested, expectedVersion: currentVersion, fromWriteSource, fromState,
        toWriteSource: target.writeSource, toState: target.state, cohortRef, legacyCompatibilityUntil,
        reason, authorityEvidenceRef, proposalDigest, proposedByUserId: actor.actorUserId,
        proposedByMandateId: authority.mandateId!, proposalStepUpId: stepUpEvidenceId,
      } });
      await appendGovernedAudit(tx, {
        actor: `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`,
        event: "rail.room_authority.proposed",
        detail: { caseId, changeId: created.id, command: requested, fromWriteSource, fromState, toWriteSource: target.writeSource, toState: target.state, cohortRef, authorityMandateId: authority.mandateId },
      });
      return created;
    });
    return change;
  }

  async review(actor: RoomActor, caseId: string, changeId: string, body: {
    decision?: string; reviewNote?: string; stepUpEvidenceId?: string;
  }) {
    const authority = await this.requireCaseOwner(actor, caseId, "OPERATE_CASE_ROOM");
    const change = await this.db.roomAuthorityChange.findUnique({ where: { id: changeId } });
    if (!change || change.transactionCaseId !== caseId) throw new NotFoundException("room-authority change not found");
    if (change.status !== "PENDING") return change;
    if (change.proposedByUserId === actor.actorUserId) throw new ForbiddenException("the proposer cannot review their own room-authority change");
    const decision = required(body.decision, "decision", 20);
    if (!["APPROVE", "REJECT"].includes(decision)) throw new BadRequestException("decision must be APPROVE or REJECT");
    const reviewNote = required(body.reviewNote, "reviewNote", 1_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "ROOM_AUTHORITY_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      if (decision === "REJECT") {
        const rejected = await tx.roomAuthorityChange.update({ where: { id: change.id }, data: {
          status: "REJECTED", approvedByUserId: actor.actorUserId, approvedByMandateId: authority.mandateId,
          approvalStepUpId: stepUpEvidenceId, reviewNote, reviewedAt: new Date(),
        } });
        await appendGovernedAudit(tx, { actor: `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`, event: "rail.room_authority.rejected", detail: { caseId, changeId, reviewNote, authorityMandateId: authority.mandateId } });
        return rejected;
      }
      const current = await tx.roomAuthorityAssignment.findUnique({ where: { transactionCaseId: caseId } });
      const currentVersion = current?.version ?? 0;
      const currentSource = current?.writeSource ?? "LEGACY";
      const currentState = current?.state ?? "ACTIVE";
      if (currentVersion !== change.expectedVersion || currentSource !== change.fromWriteSource || currentState !== change.fromState) {
        throw new ConflictException("room authority changed after this proposal; review cannot apply stale authority");
      }
      const assignmentId = current?.id ?? `rauth_${randomUUID()}`;
      if (current) {
        await tx.roomAuthorityAssignment.update({ where: { id: current.id }, data: {
          writeSource: change.toWriteSource, state: change.toState, cohortRef: change.cohortRef,
          legacyCompatibilityUntil: change.legacyCompatibilityUntil, version: { increment: 1 },
          lastChangeId: change.id, allocatedByUserId: actor.actorUserId, allocatedByMandateId: authority.mandateId!, allocatedAt: new Date(),
        } });
      } else {
        await tx.roomAuthorityAssignment.create({ data: {
          id: assignmentId, transactionCaseId: caseId, writeSource: change.toWriteSource, state: change.toState,
          cohortRef: change.cohortRef, legacyCompatibilityUntil: change.legacyCompatibilityUntil, version: 1,
          lastChangeId: change.id, allocatedByUserId: actor.actorUserId, allocatedByMandateId: authority.mandateId!,
        } });
      }
      const approved = await tx.roomAuthorityChange.update({ where: { id: change.id }, data: {
        assignmentId, status: "APPROVED", approvedByUserId: actor.actorUserId,
        approvedByMandateId: authority.mandateId, approvalStepUpId: stepUpEvidenceId,
        reviewNote, reviewedAt: new Date(), appliedAt: new Date(),
      } });
      await appendGovernedAudit(tx, {
        actor: `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`,
        event: "rail.room_authority.approved",
        detail: { caseId, changeId, command: change.command, writeSource: change.toWriteSource, state: change.toState, cohortRef: change.cohortRef, authorityMandateId: authority.mandateId },
      });
      return approved;
    });
  }

  async requireRailWrite(caseId: string) {
    if (inspectPersistenceFlags(process.env).roomWriteSource !== "rail") throw new ForbiddenException("Rail room writes are disabled");
    const assignment = await this.db.roomAuthorityAssignment.findUnique({ where: { transactionCaseId: caseId } });
    if (!assignment || assignment.writeSource !== "RAIL" || assignment.state !== "ACTIVE") {
      throw new ForbiddenException("this case is not in an active, approved Rail-write cohort");
    }
    return assignment;
  }

  private target(requested: AuthorityCommand, source: string, state: string) {
    if (requested === "ALLOCATE_RAIL" && source === "LEGACY" && state === "ACTIVE") return { writeSource: "RAIL", state: "ACTIVE" };
    if (requested === "PAUSE_RAIL" && source === "RAIL" && state === "ACTIVE") return { writeSource: "RAIL", state: "PAUSED" };
    if (requested === "RESUME_RAIL" && source === "RAIL" && state === "PAUSED") return { writeSource: "RAIL", state: "ACTIVE" };
    if (requested === "RETURN_LEGACY" && source === "RAIL" && state === "PAUSED") return { writeSource: "LEGACY", state: "ACTIVE" };
    throw new ConflictException(`command ${requested} is invalid from ${source}/${state}`);
  }

  private async requireCaseOwner(actor: RoomActor, caseId: string, action: "VIEW_CASE_ROOM" | "OPERATE_CASE_ROOM") {
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId } });
    if (!transactionCase || transactionCase.ownerInstitutionId !== actor.actingInstitutionId) throw new NotFoundException("transaction case not found");
    return this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
  }
}
