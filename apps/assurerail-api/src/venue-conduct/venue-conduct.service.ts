import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest } from "../contracts/v1";
import { StepUpService } from "../institutions/step-up.service";
import { PrismaService } from "../store/prisma.service";
import {
  assertBoundedControlWindow, capacityState, CONDUCT_ALERT_STATUSES, CONDUCT_CONTROL_SCOPES,
  CONDUCT_CONTROL_TYPES, CONDUCT_SEVERITIES, CONDUCT_SIGNAL_TYPES, evaluateConductSignal,
  type ConductSignalType,
} from "./venue-conduct-policy";

const POLICY_VALIDITY_MS = 366 * 86_400_000;
const SIGNAL_TYPES = new Set<string>(CONDUCT_SIGNAL_TYPES);
const CONTROL_TYPES = new Set<string>(CONDUCT_CONTROL_TYPES);
const CONTROL_SCOPES = new Set<string>(CONDUCT_CONTROL_SCOPES);
const SEVERITIES = new Set<string>(CONDUCT_SEVERITIES);
const ALERT_STATUSES = new Set<string>(CONDUCT_ALERT_STATUSES);

function required(value: unknown, name: string, max = 2_000): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return trimmed;
}
function optional(value: unknown, name: string, max = 500): string | null {
  return value === undefined || value === null || value === "" ? null : required(value, name, max);
}
function digest(value: unknown, name: string): string {
  const parsed = required(value, name, 80);
  if (!/^sha256:[a-f0-9]{64}$/.test(parsed)) throw new BadRequestException(`${name} must be lowercase sha256:<64 hex>`);
  return parsed;
}
function date(value: unknown, name: string): Date {
  const parsed = new Date(required(value, name, 120));
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}
function jsonObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException(`${name} must be an object`);
  return value as Record<string, unknown>;
}
function jsonArray(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new BadRequestException(`${name} must be an array`);
  return value;
}
function evidenceRefs(value: unknown): Prisma.InputJsonValue {
  const refs = jsonArray(value, "evidenceRefs").map((entry) => required(entry, "evidenceRefs[]", 500));
  if (!refs.length) throw new BadRequestException("evidenceRefs must contain at least one evidence reference");
  if (refs.some((ref) => /synthetic|fixture|demo|example/i.test(ref))) throw new BadRequestException("control evidence cannot use synthetic/demo/fixture/example references");
  return refs;
}

@Injectable()
export class VenueConductService {
  constructor(private readonly db: PrismaService, private readonly stepUp: StepUpService) {}

  async dashboard() {
    const now = new Date();
    const [alerts, overdueAlerts, complaints, overdueComplaints, investigations, controls, hardLimits] = await Promise.all([
      this.db.venueConductAlert.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.venueConductAlert.count({ where: { status: { in: ["OPEN", "TRIAGED", "INVESTIGATING", "ESCALATED"] }, dueAt: { lt: now } } }),
      this.db.venueComplaint.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.venueComplaint.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "INVESTIGATING"] }, dueAt: { lt: now } } }),
      this.db.venueConductInvestigation.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.venueControlAction.findMany({ where: { status: "APPROVED", effectiveFrom: { lte: now }, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" } }),
      this.db.venueCapacityObservation.findMany({ where: { state: "HARD_LIMIT" }, orderBy: { observedAt: "desc" }, take: 100 }),
    ]);
    return { asOf: now, alerts, overdueAlerts, complaints, overdueComplaints, investigations, activeControls: controls, hardLimits };
  }

  listPolicies() { return this.db.conductPolicyRelease.findMany({ orderBy: [{ policyRef: "asc" }, { version: "desc" }] }); }
  listAlerts() { return this.db.venueConductAlert.findMany({ orderBy: [{ status: "asc" }, { dueAt: "asc" }] }); }
  listComplaints() { return this.db.venueComplaint.findMany({ orderBy: [{ status: "asc" }, { dueAt: "asc" }] }); }

  async proposePolicy(actor: { userId: string; sessionId: string }, body: Record<string, unknown>) {
    const policyRef = required(body.policyRef, "policyRef", 160);
    const version = body.version;
    if (!Number.isSafeInteger(version) || Number(version) < 1) throw new BadRequestException("version must be a positive integer");
    const effectiveFrom = date(body.effectiveFrom, "effectiveFrom");
    const expiresAt = date(body.expiresAt, "expiresAt");
    if (expiresAt <= effectiveFrom || expiresAt.getTime() - effectiveFrom.getTime() > POLICY_VALIDITY_MS) throw new BadRequestException("policy validity must be positive and no longer than 366 days");
    const rules = {
      prohibitedActionRules: jsonObject(body.prohibitedActionRules, "prohibitedActionRules"),
      fairAccessRules: jsonObject(body.fairAccessRules, "fairAccessRules"),
      communicationsRules: jsonObject(body.communicationsRules, "communicationsRules"),
      allocationRules: jsonObject(body.allocationRules, "allocationRules"),
      slaRules: jsonObject(body.slaRules, "slaRules"),
    };
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const policyDigest = sha256Digest({ policyRef, version, effectiveFrom: effectiveFrom.toISOString(), expiresAt: expiresAt.toISOString(), ...rules });
    try {
      const created = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_POLICY_PROPOSE", institutionId: null }, tx);
        return tx.conductPolicyRelease.create({ data: { id: `cpr_${randomUUID()}`, policyRef, version: Number(version), effectiveFrom, expiresAt,
          prohibitedActionRules: rules.prohibitedActionRules as Prisma.InputJsonValue, fairAccessRules: rules.fairAccessRules as Prisma.InputJsonValue,
          communicationsRules: rules.communicationsRules as Prisma.InputJsonValue, allocationRules: rules.allocationRules as Prisma.InputJsonValue,
          slaRules: rules.slaRules as Prisma.InputJsonValue, policyDigest, proposedByUserId: actor.userId, proposalStepUpId: stepUpEvidenceId } });
      });
      audit("venue.conduct.policy.proposed", { actorUserId: actor.userId, policyId: created.id, policyRef, version });
      return created;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("policy version or digest already exists");
      throw error;
    }
  }

  async reviewPolicy(actor: { userId: string; sessionId: string }, policyId: string, body: Record<string, unknown>) {
    const policy = await this.db.conductPolicyRelease.findUnique({ where: { id: policyId } });
    if (!policy || policy.status !== "PROPOSED") throw new ConflictException("policy is not pending review");
    if (policy.proposedByUserId === actor.userId) throw new ForbiddenException("policy proposer cannot review the same policy");
    const approve = body.approve === true;
    const reason = required(body.reason, "reason", 2_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_POLICY_REVIEW", institutionId: null }, tx);
      const claimed = await tx.conductPolicyRelease.updateMany({ where: { id: policyId, status: "PROPOSED" }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedByUserId: actor.userId, reviewStepUpId: stepUpEvidenceId, reviewReason: reason, reviewedAt: new Date() } });
      if (claimed.count !== 1) throw new ConflictException("policy was concurrently reviewed");
      if (approve) await tx.conductPolicyRelease.updateMany({ where: { policyRef: policy.policyRef, status: "APPROVED", id: { not: policyId } }, data: { status: "SUPERSEDED" } });
      return tx.conductPolicyRelease.findUniqueOrThrow({ where: { id: policyId } });
    });
    audit("venue.conduct.policy.reviewed", { actorUserId: actor.userId, policyId, approved: approve });
    return updated;
  }

  async recordSignal(actor: { userId: string; sessionId: string }, body: Record<string, unknown>) {
    const signalType = required(body.signalType, "signalType", 80);
    if (!SIGNAL_TYPES.has(signalType)) throw new BadRequestException("signalType is invalid");
    const sourceEventRef = required(body.sourceEventRef, "sourceEventRef", 500);
    const sourceOccurredAt = date(body.sourceOccurredAt, "sourceOccurredAt");
    if (sourceOccurredAt > new Date()) throw new BadRequestException("sourceOccurredAt cannot be in the future");
    const sourceEvidenceRef = required(body.sourceEvidenceRef, "sourceEvidenceRef", 500);
    const sourceEvidenceDigest = digest(body.sourceEvidenceDigest, "sourceEvidenceDigest");
    const facts = jsonObject(body.facts, "facts");
    const ownerUserId = required(body.ownerUserId, "ownerUserId", 160);
    const dueAt = date(body.dueAt, "dueAt");
    if (dueAt <= new Date()) throw new BadRequestException("dueAt must be in the future");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 160);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    const policy = await this.db.conductPolicyRelease.findFirst({ where: { status: "APPROVED", effectiveFrom: { lte: now }, expiresAt: { gt: now } }, orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }] });
    if (!policy) throw new ConflictException("no current approved conduct policy is available");
    const evaluation = evaluateConductSignal(signalType as ConductSignalType, facts);
    const factsDigest = sha256Digest(facts);
    const evaluationDigest = sha256Digest({ policyDigest: policy.policyDigest, signalType, factsDigest, evaluation });
    try {
      const recorded = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_SIGNAL_RECORD", institutionId: null }, tx);
        const signal = await tx.venueConductSignal.create({ data: {
          id: `vcs_${randomUUID()}`, signalType, transactionCaseId: optional(body.transactionCaseId, "transactionCaseId"),
          commercialOpportunityId: optional(body.commercialOpportunityId, "commercialOpportunityId"), institutionId: optional(body.institutionId, "institutionId"),
          route: optional(body.route, "route", 80), cohortRef: optional(body.cohortRef, "cohortRef", 160), sourceEventRef, sourceOccurredAt,
          sourceEvidenceRef, sourceEvidenceDigest, facts: facts as Prisma.InputJsonValue, factsDigest, policyReleaseId: policy.id,
          evaluation: evaluation as unknown as Prisma.InputJsonValue, evaluationDigest, result: evaluation.result, idempotencyKey,
          recordedByUserId: actor.userId, stepUpEvidenceId,
        } });
        const alert = evaluation.result === "REVIEW_REQUIRED" ? await tx.venueConductAlert.create({ data: {
          id: `vca_${randomUUID()}`, signalId: signal.id, alertCode: evaluation.alertCode!, severity: evaluation.severity,
          ownerUserId, dueAt,
        } }) : null;
        return { signal, alert };
      });
      audit("venue.conduct.signal.recorded", { actorUserId: actor.userId, signalId: recorded.signal.id, result: evaluation.result, alertId: recorded.alert?.id ?? null });
      return recorded;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("signal was already recorded");
      throw error;
    }
  }

  async reviewAlert(actor: { userId: string; sessionId: string }, alertId: string, body: Record<string, unknown>) {
    const status = required(body.status, "status", 80);
    if (!ALERT_STATUSES.has(status) || status === "OPEN") throw new BadRequestException("status is not a review transition");
    const closed = ["CLOSED_NO_FINDING", "REMEDIATED"].includes(status);
    const resolution = closed ? required(body.resolution, "resolution", 4_000) : optional(body.resolution, "resolution", 4_000);
    const resolutionEvidenceRef = closed ? required(body.resolutionEvidenceRef, "resolutionEvidenceRef", 500) : optional(body.resolutionEvidenceRef, "resolutionEvidenceRef", 500);
    const resolutionEvidenceDigest = closed ? digest(body.resolutionEvidenceDigest, "resolutionEvidenceDigest") : null;
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const current = await this.db.venueConductAlert.findUnique({ where: { id: alertId } });
    if (!current) throw new NotFoundException("conduct alert not found");
    if (["CLOSED_NO_FINDING", "REMEDIATED"].includes(current.status)) throw new ConflictException("closed alert cannot be rewritten");
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_ALERT_REVIEW", institutionId: null }, tx);
      const claimed = await tx.venueConductAlert.updateMany({ where: { id: alertId, status: current.status }, data: { status, resolution, resolutionEvidenceRef, resolutionEvidenceDigest, reviewedByUserId: actor.userId, reviewStepUpId: stepUpEvidenceId, closedAt: closed ? new Date() : null } });
      if (claimed.count !== 1) throw new ConflictException("alert was concurrently changed");
      return tx.venueConductAlert.findUniqueOrThrow({ where: { id: alertId } });
    });
    audit("venue.conduct.alert.reviewed", { actorUserId: actor.userId, alertId, fromStatus: current.status, toStatus: status });
    return updated;
  }

  async createInvestigation(actor: { userId: string; sessionId: string }, body: Record<string, unknown>) {
    const alertId = required(body.alertId, "alertId", 160);
    if (!await this.db.venueConductAlert.findUnique({ where: { id: alertId } })) throw new NotFoundException("conduct alert not found");
    const complaintId = optional(body.complaintId, "complaintId", 160);
    if (complaintId && !await this.db.venueComplaint.findUnique({ where: { id: complaintId } })) throw new NotFoundException("complaint not found");
    const scope = jsonObject(body.scope, "scope");
    const refs = evidenceRefs(body.evidenceRefs);
    const assigneeUserId = required(body.assigneeUserId, "assigneeUserId", 160);
    const dueAt = date(body.dueAt, "dueAt");
    if (dueAt <= new Date()) throw new BadRequestException("dueAt must be in the future");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_INVESTIGATION_CHANGE", institutionId: null }, tx);
      await tx.venueConductAlert.update({ where: { id: alertId }, data: { status: "INVESTIGATING" } });
      return tx.venueConductInvestigation.create({ data: { id: `vci_${randomUUID()}`, alertId, complaintId, scope: scope as Prisma.InputJsonValue, evidenceRefs: refs,
        assigneeUserId, dueAt, proposedByUserId: actor.userId, lastChangedByUserId: actor.userId, stepUpEvidenceId } });
    });
    audit("venue.conduct.investigation.opened", { actorUserId: actor.userId, investigationId: created.id, alertId, legalHold: false });
    return created;
  }

  async changeInvestigation(actor: { userId: string; sessionId: string }, investigationId: string, body: Record<string, unknown>) {
    const current = await this.db.venueConductInvestigation.findUnique({ where: { id: investigationId } });
    if (!current || ["CONCLUDED", "CANCELLED"].includes(current.status)) throw new ConflictException("investigation is not changeable");
    const status = required(body.status, "status", 40);
    if (!["OPEN", "ON_HOLD", "CONCLUDED", "CANCELLED"].includes(status)) throw new BadRequestException("investigation status is invalid");
    const legalHold = body.legalHold;
    if (typeof legalHold !== "boolean") throw new BadRequestException("legalHold must be boolean");
    const conclusion = status === "CONCLUDED" ? required(body.conclusion, "conclusion", 4_000) : optional(body.conclusion, "conclusion", 4_000);
    const conclusionClass = status === "CONCLUDED" ? required(body.conclusionClass, "conclusionClass", 80) : null;
    if (conclusionClass && !["NO_FINDING", "CONTROL_FAILURE", "REFERRED"].includes(conclusionClass)) throw new BadRequestException("conclusionClass is invalid");
    const refs = evidenceRefs(body.evidenceRefs);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_INVESTIGATION_CHANGE", institutionId: null }, tx);
      return tx.venueConductInvestigation.update({ where: { id: investigationId }, data: { status, legalHold, evidenceRefs: refs, conclusion, conclusionClass, lastChangedByUserId: actor.userId, stepUpEvidenceId } });
    });
    audit("venue.conduct.investigation.changed", { actorUserId: actor.userId, investigationId, fromStatus: current.status, toStatus: status, legalHold });
    return updated;
  }

  async recordComplaint(actor: { userId: string; sessionId: string }, body: Record<string, unknown>) {
    const complaintRef = required(body.complaintRef, "complaintRef", 160);
    const category = required(body.category, "category", 120);
    const summary = required(body.summary, "summary", 4_000);
    const refs = evidenceRefs(body.evidenceRefs);
    const ownerUserId = required(body.ownerUserId, "ownerUserId", 160);
    const dueAt = date(body.dueAt, "dueAt");
    if (dueAt <= new Date()) throw new BadRequestException("dueAt must be in the future");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 160);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const data = { complaintRef, category, summary, ownerUserId, dueAt: dueAt.toISOString(), idempotencyKey,
      complainantInstitutionId: optional(body.complainantInstitutionId, "complainantInstitutionId"), transactionCaseId: optional(body.transactionCaseId, "transactionCaseId"),
      commercialOpportunityId: optional(body.commercialOpportunityId, "commercialOpportunityId"), evidenceRefs: refs };
    const requestDigest = sha256Digest(data);
    try {
      const created = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_COMPLAINT_CHANGE", institutionId: null }, tx);
        return tx.venueComplaint.create({ data: { id: `vcp_${randomUUID()}`, ...data, dueAt, evidenceRefs: refs, requestDigest, recordedByUserId: actor.userId, stepUpEvidenceId } });
      });
      audit("venue.complaint.recorded", { actorUserId: actor.userId, complaintId: created.id, complaintRef });
      return created;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("complaint reference or idempotency key already exists");
      throw error;
    }
  }

  async resolveComplaint(actor: { userId: string; sessionId: string }, complaintId: string, body: Record<string, unknown>) {
    const current = await this.db.venueComplaint.findUnique({ where: { id: complaintId } });
    if (!current || ["RESOLVED", "REJECTED", "WITHDRAWN"].includes(current.status)) throw new ConflictException("complaint is not resolvable");
    const status = required(body.status, "status", 40);
    if (!["RESOLVED", "REJECTED", "WITHDRAWN"].includes(status)) throw new BadRequestException("complaint terminal status is invalid");
    const resolution = required(body.resolution, "resolution", 4_000);
    const resolutionEvidenceRef = required(body.resolutionEvidenceRef, "resolutionEvidenceRef", 500);
    const resolutionEvidenceDigest = digest(body.resolutionEvidenceDigest, "resolutionEvidenceDigest");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_COMPLAINT_CHANGE", institutionId: null }, tx);
      const claimed = await tx.venueComplaint.updateMany({ where: { id: complaintId, status: current.status }, data: { status, resolution, resolutionEvidenceRef, resolutionEvidenceDigest, resolvedByUserId: actor.userId, resolvedAt: new Date() } });
      if (claimed.count !== 1) throw new ConflictException("complaint was concurrently changed");
      return tx.venueComplaint.findUniqueOrThrow({ where: { id: complaintId } });
    });
    audit("venue.complaint.resolved", { actorUserId: actor.userId, complaintId, status });
    return updated;
  }

  async proposeCorrection(actor: { userId: string; sessionId: string }, body: Record<string, unknown>) {
    const complaintId = optional(body.complaintId, "complaintId", 160);
    if (complaintId && !await this.db.venueComplaint.findUnique({ where: { id: complaintId } })) throw new NotFoundException("complaint not found");
    const targetType = required(body.targetType, "targetType", 100);
    const targetRef = required(body.targetRef, "targetRef", 500);
    const reason = required(body.reason, "reason", 4_000);
    const priorDigest = digest(body.priorDigest, "priorDigest");
    const correctedDigest = digest(body.correctedDigest, "correctedDigest");
    if (priorDigest === correctedDigest) throw new BadRequestException("correction must change the digest");
    const correctionEvidenceRef = required(body.correctionEvidenceRef, "correctionEvidenceRef", 500);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const proposalDigest = sha256Digest({ complaintId, targetType, targetRef, reason, priorDigest, correctedDigest, correctionEvidenceRef });
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_CORRECTION_PROPOSE", institutionId: null }, tx);
      return tx.venueCorrection.create({ data: { id: `vcr_${randomUUID()}`, complaintId, targetType, targetRef, reason, priorDigest, correctedDigest, correctionEvidenceRef, proposalDigest, proposedByUserId: actor.userId, proposalStepUpId: stepUpEvidenceId } });
    });
    audit("venue.correction.proposed", { actorUserId: actor.userId, correctionId: created.id, targetType, targetRef });
    return created;
  }

  async reviewCorrection(actor: { userId: string; sessionId: string }, correctionId: string, body: Record<string, unknown>) {
    const current = await this.db.venueCorrection.findUnique({ where: { id: correctionId } });
    if (!current || current.status !== "PROPOSED") throw new ConflictException("correction is not pending review");
    if (current.proposedByUserId === actor.userId) throw new ForbiddenException("correction proposer cannot review the same correction");
    const approve = body.approve === true;
    const reason = required(body.reason, "reason", 2_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_CORRECTION_REVIEW", institutionId: null }, tx);
      return tx.venueCorrection.update({ where: { id: correctionId }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedByUserId: actor.userId, reviewStepUpId: stepUpEvidenceId, reviewReason: reason, reviewedAt: new Date() } });
    });
    audit("venue.correction.reviewed", { actorUserId: actor.userId, correctionId, approved: approve });
    return updated;
  }

  async proposeControl(actor: { userId: string; sessionId: string }, body: Record<string, unknown>) {
    const actionType = required(body.actionType, "actionType", 80);
    const scopeType = required(body.scopeType, "scopeType", 80);
    if (!CONTROL_TYPES.has(actionType) || !CONTROL_SCOPES.has(scopeType)) throw new BadRequestException("control action type or scope is invalid");
    const scopeRef = required(body.scopeRef, "scopeRef", 500);
    const severity = required(body.severity, "severity", 20);
    if (!SEVERITIES.has(severity)) throw new BadRequestException("severity is invalid");
    const reason = required(body.reason, "reason", 4_000);
    const refs = evidenceRefs(body.evidenceRefs);
    const effectiveFrom = date(body.effectiveFrom, "effectiveFrom");
    const expiresAt = date(body.expiresAt, "expiresAt");
    try { assertBoundedControlWindow(effectiveFrom, expiresAt); } catch (error) { throw new BadRequestException((error as Error).message); }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const proposalDigest = sha256Digest({ actionType, scopeType, scopeRef, severity, reason, evidenceRefs: refs, effectiveFrom: effectiveFrom.toISOString(), expiresAt: expiresAt.toISOString() });
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_CONTROL_PROPOSE", institutionId: null }, tx);
      return tx.venueControlAction.create({ data: { id: `vct_${randomUUID()}`, actionType, scopeType, scopeRef, severity, reason, evidenceRefs: refs, effectiveFrom, expiresAt, proposalDigest, proposedByUserId: actor.userId, proposalStepUpId: stepUpEvidenceId } });
    });
    audit("venue.control.proposed", { actorUserId: actor.userId, controlId: created.id, actionType, scopeType, scopeRef });
    return created;
  }

  async reviewControl(actor: { userId: string; sessionId: string }, controlId: string, body: Record<string, unknown>) {
    const current = await this.db.venueControlAction.findUnique({ where: { id: controlId } });
    if (!current || current.status !== "PROPOSED") throw new ConflictException("control is not pending review");
    if (current.proposedByUserId === actor.userId) throw new ForbiddenException("control proposer cannot review the same action");
    const approve = body.approve === true;
    const reason = required(body.reason, "reason", 2_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CONDUCT_CONTROL_REVIEW", institutionId: null }, tx);
      return tx.venueControlAction.update({ where: { id: controlId }, data: { status: approve ? "APPROVED" : "REJECTED", reviewedByUserId: actor.userId, reviewStepUpId: stepUpEvidenceId, reviewReason: reason, reviewedAt: new Date() } });
    });
    audit("venue.control.reviewed", { actorUserId: actor.userId, controlId, approved: approve });
    return updated;
  }

  async setCapacityBudget(actor: { userId: string; sessionId: string }, body: Record<string, unknown>) {
    const environment = required(body.environment, "environment", 120);
    const route = required(body.route, "route", 80);
    const cohortRef = required(body.cohortRef, "cohortRef", 160);
    const metric = required(body.metric, "metric", 160);
    const unit = required(body.unit, "unit", 80);
    const warningThreshold = required(body.warningThreshold, "warningThreshold", 80);
    const hardThreshold = required(body.hardThreshold, "hardThreshold", 80);
    try { capacityState("0", warningThreshold, hardThreshold); } catch (error) { throw new BadRequestException((error as Error).message); }
    const effectiveFrom = date(body.effectiveFrom, "effectiveFrom");
    const expiresAt = date(body.expiresAt, "expiresAt");
    if (expiresAt <= effectiveFrom) throw new BadRequestException("budget expiry must follow effective time");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const latest = await this.db.venueCapacityBudget.findFirst({ where: { environment, route, cohortRef, metric }, orderBy: { version: "desc" } });
    const version = (latest?.version ?? 0) + 1;
    const budgetDigest = sha256Digest({ environment, route, cohortRef, metric, unit, warningThreshold, hardThreshold, version, effectiveFrom: effectiveFrom.toISOString(), expiresAt: expiresAt.toISOString() });
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CAPACITY_BUDGET_CHANGE", institutionId: null }, tx);
      await tx.venueCapacityBudget.updateMany({ where: { environment, route, cohortRef, metric, status: "ACTIVE" }, data: { status: "SUPERSEDED" } });
      return tx.venueCapacityBudget.create({ data: { id: `vcb_${randomUUID()}`, environment, route, cohortRef, metric, unit, warningThreshold, hardThreshold, version, budgetDigest, changedByUserId: actor.userId, stepUpEvidenceId, effectiveFrom, expiresAt } });
    });
    audit("venue.capacity.budget.changed", { actorUserId: actor.userId, budgetId: created.id, environment, route, cohortRef, metric, version });
    return created;
  }

  async recordCapacity(actor: { userId: string; sessionId: string }, budgetId: string, body: Record<string, unknown>) {
    const budget = await this.db.venueCapacityBudget.findUnique({ where: { id: budgetId } });
    if (!budget || budget.status !== "ACTIVE") throw new ConflictException("active capacity budget required");
    const observedValue = required(body.observedValue, "observedValue", 80);
    let state: "WITHIN" | "WARNING" | "HARD_LIMIT";
    try { state = capacityState(observedValue, budget.warningThreshold, budget.hardThreshold); } catch (error) { throw new BadRequestException((error as Error).message); }
    const observedAt = date(body.observedAt, "observedAt");
    if (observedAt > new Date()) throw new BadRequestException("observedAt cannot be in the future");
    const sourceEvidenceRef = required(body.sourceEvidenceRef, "sourceEvidenceRef", 500);
    const sourceEvidenceDigest = digest(body.sourceEvidenceDigest, "sourceEvidenceDigest");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const observationDigest = sha256Digest({ budgetDigest: budget.budgetDigest, observedValue, observedAt: observedAt.toISOString(), sourceEvidenceRef, sourceEvidenceDigest, state });
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.userId, sessionId: actor.sessionId, purpose: "INTERNAL_CAPACITY_OBSERVATION_RECORD", institutionId: null }, tx);
      return tx.venueCapacityObservation.create({ data: { id: `vco_${randomUUID()}`, capacityBudgetId: budgetId, observedValue, observedAt, state, sourceEvidenceRef, sourceEvidenceDigest, observationDigest, recordedByUserId: actor.userId, stepUpEvidenceId } });
    });
    audit("venue.capacity.observed", { actorUserId: actor.userId, observationId: created.id, budgetId, state });
    return created;
  }
}
