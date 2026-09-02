import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import { compareLifecycleObservation, deriveLifecyclePlanState, normaliseLifecycleObligation, type LifecycleObligationInput } from "./lifecycle-policy";

type PlanBody = { idempotencyKey?: string; expectedCaseAggregateVersion?: number; periodStartAt?: string; periodEndAt?: string; obligations?: LifecycleObligationInput[]; reason?: string; stepUpEvidenceId?: string };
type EventBody = { idempotencyKey?: string; observed?: unknown; externalReference?: string; finalityClass?: string; signatureStatus?: string; evidenceObjectId?: string; observedAt?: string; reason?: string; stepUpEvidenceId?: string };
type ReconcileBody = { idempotencyKey?: string; reason?: string; stepUpEvidenceId?: string };

function enabled() {
  const flags = inspectPersistenceFlags(process.env);
  if (flags.lifecycleProduct !== "shadow" || flags.transactionCase !== "shadow" || flags.externalActionSaga !== "required") throw new ForbiddenException("lifecycle product is disabled");
}
function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  if (value.trim().length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return value.trim();
}
function instant(value: unknown, name: string): Date {
  const result = new Date(required(value, name, 80));
  if (!Number.isFinite(result.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return result;
}
function requestDigest(scope: string, body: Readonly<Record<string, unknown>>) {
  const { stepUpEvidenceId: _stepUpEvidenceId, ...request } = body;
  return sha256Digest({ scope, request: toCanonicalValue(request) });
}
function json(value: unknown): Prisma.InputJsonValue { return value as Prisma.InputJsonValue; }
function unique(error: unknown): boolean { return (error as { code?: string } | null)?.code === "P2002"; }

const safePlanSelect = {
  id: true, transactionCaseId: true, version: true, periodStartAt: true, periodEndAt: true,
  executionMode: true, status: true, routePackRef: true, routePackVersion: true, planDigest: true,
  createdAt: true, reconciledAt: true,
  obligations: { orderBy: { sequence: "asc" as const }, select: {
    id: true, obligationKey: true, eventType: true, sequence: true, materialFunction: true,
    accountableInstitutionId: true, performerClass: true, dueAt: true, required: true,
    expectedDigest: true, amountCurrency: true, amountMinorUnits: true, amountScale: true,
    state: true, currentEventVersion: true, reconciledByUserId: true, reconciledAt: true,
    events: { orderBy: { version: "asc" as const }, select: {
      id: true, version: true, observedDigest: true, externalReference: true, finalityClass: true,
      signatureStatus: true, evidenceObjectId: true, observedAt: true, recordedByUserId: true,
      comparisonResult: true, createdAt: true,
    } },
    breaks: { orderBy: { createdAt: "asc" as const }, select: {
      id: true, lifecycleEventId: true, breakCode: true, severity: true, expectedDigest: true,
      observedDigest: true, blockedCapabilities: true, status: true, ownerInstitutionId: true,
      dueAt: true, resolutionEvidenceRef: true, resolvedByUserId: true, resolvedAt: true, createdAt: true,
    } },
  } },
} satisfies Prisma.RailLifecyclePlanSelect;

@Injectable()
export class LifecycleService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly stepUp: StepUpService) {}

  async overview(actor: RoomActor, caseId: string) {
    const { transactionCase } = await this.requireCase(actor, caseId, "VIEW_CASE");
    const plans = await this.db.railLifecyclePlan.findMany({
      where: { transactionCaseId: caseId }, orderBy: { version: "asc" },
      select: safePlanSelect,
    });
    const [canOperateCase, canOperateRoute] = await Promise.all([
      this.may(actor, caseId, "OPERATE_CASE"), this.may(actor, caseId, "OPERATE_ROUTE"),
    ]);
    return {
      generatedAt: new Date().toISOString(), operatingBoundary: "OBSERVE_ONLY",
      authorityNotice: "AssureRail records expected and observed lifecycle facts. It does not service assets, move funds, deliver legal notices, decide trustee matters or alter an authoritative register in this mode.",
      case: { id: transactionCase.id, caseReference: transactionCase.caseReference, ownerInstitutionId: transactionCase.ownerInstitutionId, transactionRoute: transactionCase.transactionRoute, representation: transactionCase.representation, operatingMode: transactionCase.operatingMode, status: transactionCase.status, routePackRef: transactionCase.routePackRef, routePackVersion: transactionCase.routePackVersion, aggregateVersion: transactionCase.aggregateVersion },
      capabilities: { canOperateCase, canOperateRoute, canCreatePlan: canOperateCase && transactionCase.ownerInstitutionId === actor.actingInstitutionId && transactionCase.status === "COMPLETED" },
      plans,
      externalGates: [
        { code: "ASSIGNED_PERFORMER_ACKNOWLEDGEMENT", state: "OPEN_EXTERNAL" },
        { code: "PAYMENT_OR_ACCOUNT_CONFIRMATION", state: "OPEN_EXTERNAL" },
        { code: "TRUSTEE_OR_RECORDKEEPER_CONFIRMATION_WHERE_REQUIRED", state: "OPEN_EXTERNAL" },
        { code: "CONTROLLED_LIVE_ACCEPTANCE", state: "OPEN_EXTERNAL" },
      ],
    };
  }

  async createPlan(actor: RoomActor, caseId: string, body: PlanBody) {
    const { transactionCase, authority } = await this.requireCase(actor, caseId, "OPERATE_CASE");
    if (transactionCase.ownerInstitutionId !== actor.actingInstitutionId) throw new ForbiddenException("only the case owner may create a lifecycle plan");
    if (!["DA", "PTC"].includes(transactionCase.transactionRoute) || !["REPLAY", "SHADOW"].includes(transactionCase.operatingMode)) throw new BadRequestException("lifecycle supports DA/PTC replay or shadow cases only");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const digest = requestDigest("LIFECYCLE_PLAN_CREATE", { caseId, ...body });
    const existing = await this.db.railLifecyclePlan.findFirst({ where: { transactionCaseId: caseId, idempotencyKey } });
    if (existing) {
      if (existing.requestDigest !== digest) throw new ConflictException("lifecycle plan idempotency key conflicts with retained request");
      return this.loadPlan(existing.id);
    }
    if (transactionCase.status !== "COMPLETED") throw new ConflictException("lifecycle planning requires a completed transaction case");
    if (!Number.isSafeInteger(body.expectedCaseAggregateVersion) || body.expectedCaseAggregateVersion !== transactionCase.aggregateVersion) throw new ConflictException("case aggregate version is stale");
    const settled = await this.db.settlementSaga.findFirst({ where: { transactionCaseId: caseId, transactionRoute: transactionCase.transactionRoute, state: "RECONCILED", executionMode: "OBSERVE_ONLY" }, orderBy: { sagaVersion: "desc" } });
    const openCompletionBreaks = await this.db.reconciliationBreak.count({ where: { transactionCaseId: caseId, status: { not: "RESOLVED" } } });
    if (!settled || openCompletionBreaks > 0) throw new ConflictException("a reconciled observe-only completion with no open completion break is required");
    const periodStartAt = instant(body.periodStartAt, "periodStartAt"); const periodEndAt = instant(body.periodEndAt, "periodEndAt");
    if (periodEndAt <= periodStartAt) throw new BadRequestException("periodEndAt must be after periodStartAt");
    if (!Array.isArray(body.obligations) || body.obligations.length < 1 || body.obligations.length > 200) throw new BadRequestException("obligations must contain 1 through 200 items");
    let obligations;
    try { obligations = body.obligations.map(normaliseLifecycleObligation); } catch (error) { throw new BadRequestException((error as Error).message); }
    if (new Set(obligations.map((item) => item.obligationKey)).size !== obligations.length || new Set(obligations.map((item) => item.sequence)).size !== obligations.length) throw new BadRequestException("obligationKey and sequence must be unique within the plan");
    if (!obligations.some((item) => item.required)) throw new BadRequestException("at least one lifecycle obligation must be required");
    for (const item of obligations) {
      if (!item.accountableInstitutionId || !item.performerClass) throw new BadRequestException("each obligation requires an accountable institution and performerClass");
      if (item.dueAt < periodStartAt || item.dueAt > periodEndAt) throw new BadRequestException(`dueAt for ${item.obligationKey} must fall within the lifecycle period`);
      await this.requireLifecycleFunction(transactionCase, item.materialFunction, item.accountableInstitutionId, item.performerClass);
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const reason = required(body.reason, "reason", 1_000);
    const planDigest = sha256Digest({ caseId, periodStartAt: periodStartAt.toISOString(), periodEndAt: periodEndAt.toISOString(), routePackRef: transactionCase.routePackRef, routePackVersion: transactionCase.routePackVersion, obligations: obligations.map((item) => ({ ...item, dueAt: item.dueAt.toISOString() })) });
    try {
      const created = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "LIFECYCLE_PLAN_CREATE", institutionId: actor.actingInstitutionId }, tx);
        const latest = await tx.railLifecyclePlan.aggregate({ where: { transactionCaseId: caseId }, _max: { version: true } });
        const changed = await tx.transactionCase.updateMany({ where: { id: caseId, aggregateVersion: transactionCase.aggregateVersion }, data: { aggregateVersion: { increment: 1 } } });
        if (changed.count !== 1) throw new ConflictException("case changed while lifecycle plan was being created");
        const plan = await tx.railLifecyclePlan.create({ data: {
          id: `lcp_${randomUUID()}`, transactionCaseId: caseId, version: (latest._max.version ?? 0) + 1,
          periodStartAt, periodEndAt, routePackRef: transactionCase.routePackRef, routePackVersion: transactionCase.routePackVersion,
          idempotencyKey, requestDigest: digest, planDigest, createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId!,
          obligations: { create: obligations.map((item) => ({
            id: `lco_${randomUUID()}`, obligationKey: item.obligationKey, eventType: item.eventType, sequence: item.sequence,
            materialFunction: item.materialFunction, accountableInstitutionId: item.accountableInstitutionId,
            performerClass: item.performerClass, dueAt: item.dueAt, required: item.required,
            expected: json(item.expected), expectedDigest: item.expectedDigest,
            amountCurrency: item.amount?.currency, amountMinorUnits: item.amount?.units, amountScale: item.amount?.scale,
          })) },
        } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.lifecycle.plan_created", detail: { caseId, planId: plan.id, planDigest, requestDigest: digest, reason, obligationCount: obligations.length, executionMode: "OBSERVE_ONLY" } });
        return plan;
      });
      audit("rail.lifecycle.plan_created", { caseId, planId: created.id, actorUserId: actor.actorUserId });
      return this.loadPlan(created.id);
    } catch (error) {
      const replay = await this.db.railLifecyclePlan.findFirst({ where: { transactionCaseId: caseId, idempotencyKey } });
      if (replay?.requestDigest === digest) return this.loadPlan(replay.id);
      if (unique(error)) throw new ConflictException("lifecycle plan conflicts with a retained request");
      throw error;
    }
  }

  async recordEvent(actor: RoomActor, caseId: string, planId: string, obligationId: string, body: EventBody) {
    const { transactionCase } = await this.requireCase(actor, caseId, "OPERATE_ROUTE");
    const obligation = await this.requireObligation(caseId, planId, obligationId);
    if (obligation.accountableInstitutionId !== actor.actingInstitutionId) throw new ForbiddenException("only the assigned accountable institution may record this event");
    await this.requireLifecycleFunction(transactionCase, obligation.materialFunction, obligation.accountableInstitutionId, obligation.performerClass);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200); const digest = requestDigest("LIFECYCLE_EVENT_RECORD", { caseId, planId, obligationId, ...body });
    const existing = await this.db.railLifecycleEvent.findFirst({ where: { lifecycleObligationId: obligationId, idempotencyKey } });
    if (existing) { if (existing.requestDigest !== digest) throw new ConflictException("event idempotency key conflicts with retained request"); return this.loadPlan(planId); }
    if (!["PLANNED", "BREAK_OPEN"].includes(obligation.state)) throw new ConflictException("obligation is not awaiting an observation");
    if (obligation.lifecyclePlan.status === "PAUSED" || obligation.lifecyclePlan.status === "CLOSED") throw new ConflictException("lifecycle plan is not active");
    const prior = await this.db.railLifecycleObligation.findFirst({ where: { lifecyclePlanId: planId, required: true, sequence: { lt: obligation.sequence }, state: { notIn: ["OBSERVED", "RECONCILED"] } }, orderBy: { sequence: "asc" } });
    if (prior) throw new ConflictException(`prior required obligation is not observed: ${prior.obligationKey}`);
    let compared; try { compared = compareLifecycleObservation(obligation.expectedDigest, body.observed); } catch (error) { throw new BadRequestException((error as Error).message); }
    const evidenceObjectId = required(body.evidenceObjectId, "evidenceObjectId", 160);
    await this.assertEvidence(evidenceObjectId, caseId, actor.actingInstitutionId, compared.observedDigest);
    const externalReference = required(body.externalReference, "externalReference"); const finalityClass = required(body.finalityClass, "finalityClass", 80); const signatureStatus = required(body.signatureStatus, "signatureStatus", 80);
    if (finalityClass !== "FINAL") throw new BadRequestException("finalityClass must be FINAL");
    if (signatureStatus !== "VERIFIED") throw new BadRequestException("signatureStatus must be VERIFIED");
    const observedAt = instant(body.observedAt, "observedAt");
    if (observedAt.getTime() > Date.now() + 300_000) throw new BadRequestException("observedAt cannot be materially in the future");
    const reason = required(body.reason, "reason", 1_000); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "OPERATE_ROUTE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    try {
      await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "LIFECYCLE_EVENT_RECORD", institutionId: actor.actingInstitutionId }, tx);
        const changed = await tx.railLifecycleObligation.updateMany({ where: { id: obligationId, currentEventVersion: obligation.currentEventVersion, state: obligation.state }, data: { state: compared.comparisonResult === "MATCHED" ? "OBSERVED" : "BREAK_OPEN", currentEventVersion: { increment: 1 } } });
        if (changed.count !== 1) throw new ConflictException("lifecycle obligation changed concurrently");
        const event = await tx.railLifecycleEvent.create({ data: { id: `lce_${randomUUID()}`, lifecycleObligationId: obligationId, version: obligation.currentEventVersion + 1, idempotencyKey, requestDigest: digest, observed: json(compared.observed), observedDigest: compared.observedDigest, externalReference, finalityClass: "FINAL", signatureStatus: "VERIFIED", evidenceObjectId, observedAt, recordedByUserId: actor.actorUserId, recordedByMandateId: authority.mandateId!, comparisonResult: compared.comparisonResult, comparison: compared.comparison } });
        if (compared.comparisonResult === "BREAK_OPEN") await tx.railLifecycleBreak.create({ data: { id: `lcb_${randomUUID()}`, transactionCaseId: caseId, lifecyclePlanId: planId, lifecycleObligationId: obligationId, lifecycleEventId: event.id, breakCode: "LIFECYCLE_FACT_MISMATCH", severity: "HIGH", expectedDigest: obligation.expectedDigest, observedDigest: compared.observedDigest, blockedCapabilities: ["LIFECYCLE_RECONCILIATION", "LEGAL_EFFECT_CLAIM"], ownerInstitutionId: obligation.accountableInstitutionId, dueAt: new Date(Date.now() + 24 * 60 * 60 * 1_000), openedByUserId: actor.actorUserId } });
        await this.refreshPlan(tx, planId);
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.lifecycle.event_recorded", detail: { caseId, planId, obligationId, eventId: event.id, comparisonResult: compared.comparisonResult, evidenceObjectId, externalReference, reason } });
      });
    } catch (error) {
      const retained = await this.db.railLifecycleEvent.findFirst({ where: { lifecycleObligationId: obligationId, idempotencyKey } });
      if (retained?.requestDigest === digest) return this.loadPlan(planId);
      if (unique(error)) throw new ConflictException("lifecycle event conflicts with a retained event");
      throw error;
    }
    return this.loadPlan(planId);
  }

  async reconcile(actor: RoomActor, caseId: string, planId: string, obligationId: string, body: ReconcileBody) {
    const { transactionCase } = await this.requireCase(actor, caseId, "OPERATE_ROUTE");
    const obligation = await this.requireObligation(caseId, planId, obligationId);
    if (obligation.accountableInstitutionId !== actor.actingInstitutionId) throw new ForbiddenException("only the accountable institution may reconcile this event");
    await this.requireLifecycleFunction(transactionCase, obligation.materialFunction, obligation.accountableInstitutionId, obligation.performerClass);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200); const digest = requestDigest("LIFECYCLE_EVENT_RECONCILE", { caseId, planId, obligationId, ...body });
    if (obligation.reconciliationIdempotencyKey) { if (obligation.reconciliationIdempotencyKey !== idempotencyKey || obligation.reconciliationRequestDigest !== digest) throw new ConflictException("reconciliation command conflicts with retained result"); return this.loadPlan(planId); }
    const current = obligation.events.at(-1);
    if (!current || current.comparisonResult !== "MATCHED" || obligation.state !== "OBSERVED") throw new ConflictException("a current matched observation is required");
    if (current.recordedByUserId === actor.actorUserId) throw new ForbiddenException("event recorder cannot reconcile their own observation");
    await this.assertEvidence(current.evidenceObjectId, caseId, actor.actingInstitutionId, current.observedDigest);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160); const reason = required(body.reason, "reason", 1_000);
    await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "LIFECYCLE_EVENT_RECONCILE", institutionId: actor.actingInstitutionId }, tx);
      const changed = await tx.railLifecycleObligation.updateMany({ where: { id: obligationId, state: "OBSERVED", currentEventVersion: current.version }, data: { state: "RECONCILED", reconciledByUserId: actor.actorUserId, reconciliationStepUpId: stepUpEvidenceId, reconciliationReason: reason, reconciliationIdempotencyKey: idempotencyKey, reconciliationRequestDigest: digest, reconciledAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException("lifecycle obligation changed while it was being reconciled");
      await tx.railLifecycleBreak.updateMany({ where: { lifecycleObligationId: obligationId, status: "OPEN" }, data: { status: "RESOLVED", resolutionEvidenceRef: current.evidenceObjectId, resolvedByUserId: actor.actorUserId, resolvedAt: new Date() } });
      await this.refreshPlan(tx, planId);
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.lifecycle.event_reconciled", detail: { caseId, planId, obligationId, eventId: current.id, evidenceObjectId: current.evidenceObjectId, reason } });
    });
    return this.loadPlan(planId);
  }

  private async requireCase(actor: RoomActor, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE" | "OPERATE_ROUTE") {
    enabled(); const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    if (!transactionCase) throw new NotFoundException("transaction case not found");
    const participant = transactionCase.ownerInstitutionId === actor.actingInstitutionId || transactionCase.parties.some((party) => party.institutionId === actor.actingInstitutionId && party.status === "ACTIVE");
    if (!participant) throw new NotFoundException("transaction case not found");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    return { transactionCase, authority };
  }
  private async may(actor: RoomActor, caseId: string, action: "OPERATE_CASE" | "OPERATE_ROUTE") { try { await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId }); return true; } catch { return false; } }
  private async requireObligation(caseId: string, planId: string, obligationId: string) {
    const obligation = await this.db.railLifecycleObligation.findUnique({ where: { id: obligationId }, include: { lifecyclePlan: true, events: { orderBy: { version: "asc" } }, breaks: { orderBy: { createdAt: "asc" } } } });
    if (!obligation || obligation.lifecyclePlanId !== planId || obligation.lifecyclePlan.transactionCaseId !== caseId) throw new NotFoundException("lifecycle obligation not found");
    return obligation;
  }
  private async assertEvidence(evidenceObjectId: string, caseId: string, institutionId: string, observedDigest: string) {
    const now = new Date(); const evidence = await this.db.evidenceObject.findUnique({ where: { id: evidenceObjectId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } }); const latest = evidence?.versions[0];
    if (!evidence || evidence.transactionCaseId !== caseId || evidence.institutionId !== institutionId || evidence.status !== "AVAILABLE" || !latest || latest.version !== evidence.currentVersion || latest.validationStatus !== "VALID" || latest.result !== "VERIFIED" || latest.signatureStatus !== "VERIFIED" || (latest.expiresAt && latest.expiresAt <= now)) throw new ConflictException("current valid, signed, verified case evidence from the accountable institution is required");
    if (latest.payloadDigest !== observedDigest) throw new ConflictException("evidence payload digest does not match the observed lifecycle fact");
  }
  private async requireLifecycleFunction(
    transactionCase: { id: string; transactionRoute: string; representation: string; assetClass: string; lifecycleLeg: string; operatingMode: string; parties: Array<{ institutionId: string; status: string }> },
    materialFunction: string,
    accountableInstitutionId: string,
    performerClass: string,
  ) {
    const now = new Date();
    if (!transactionCase.parties.some((party) => party.institutionId === accountableInstitutionId && party.status === "ACTIVE")) throw new ConflictException(`accountable institution is not an active case party for ${materialFunction}`);
    const assignment = await this.db.caseFunctionAssignment.findUnique({ where: { transactionCaseId_materialFunction: { transactionCaseId: transactionCase.id, materialFunction } } });
    if (!assignment || assignment.status !== "ACTIVE" || assignment.performer === "PROHIBITED" || assignment.performer !== performerClass || assignment.performerInstitutionId !== accountableInstitutionId || (assignment.effectiveAt && assignment.effectiveAt > now) || (assignment.expiresAt && assignment.expiresAt <= now)) throw new ConflictException(`current function assignment mismatch for ${materialFunction}`);
    const entitlement = await this.access.evaluateRoute(accountableInstitutionId, { transactionRoute: transactionCase.transactionRoute, representation: transactionCase.representation, assetClass: transactionCase.assetClass, lifecycleLeg: transactionCase.lifecycleLeg, materialFunction, operatingMode: transactionCase.operatingMode });
    if (!entitlement.allowed) throw new ForbiddenException(`${materialFunction} route denied for ${accountableInstitutionId}: ${entitlement.code}`);
  }
  private async refreshPlan(tx: Prisma.TransactionClient, planId: string) {
    const [obligations, openBreaks] = await Promise.all([tx.railLifecycleObligation.findMany({ where: { lifecyclePlanId: planId }, select: { required: true, state: true } }), tx.railLifecycleBreak.count({ where: { lifecyclePlanId: planId, status: "OPEN" } })]); const state = deriveLifecyclePlanState(obligations, openBreaks); await tx.railLifecyclePlan.update({ where: { id: planId }, data: { status: state, reconciledAt: state === "RECONCILED" ? new Date() : null } }); return state;
  }
  private loadPlan(id: string) { return this.db.railLifecyclePlan.findUniqueOrThrow({ where: { id }, select: safePlanSelect }); }
  private actorRef(actor: RoomActor) { return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`; }
}
