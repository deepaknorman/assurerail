import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { assertSha256Digest, sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import {
  buildConventionalPtcFunctionAssignments,
  buildConventionalPtcReplayPlan,
  comparePtcReplayObservation,
  CONVENTIONAL_PTC_REPLAY_ROUTE_PACK,
  derivePtcSagaState,
  type ConventionalPtcReplayInput,
} from "./ptc-route-pack";
import { derivePtcProductJourney } from "./ptc-product";

type EvidenceBinding = { evidenceObjectId?: string };
type EvidenceBindings = Partial<Record<
  | "PROGRAMME_OR_TRUST"
  | "TRUSTEE_APPOINTMENT"
  | "POOL_TRANSFER"
  | "POOL_ELIGIBILITY"
  | "COUNSEL_OPINION"
  | "RATING"
  | "ASSURANCE_APPOINTMENT"
  | "ASSURANCE_RESULT"
  | "EXECUTED_DOCUMENTS"
  | "TRANCHE_DEFINITION"
  | "SUBSCRIPTION"
  | "TRUSTEE_TRANSACTION_CONTROL"
  | "ISSUE_OR_ALLOTMENT"
  | "AUTHORITATIVE_RECORD_DECLARATION"
  | "AUTHORITATIVE_RECORD_BEFORE"
  | "SERVICER_APPOINTMENT"
  | "COLLECTION_ACCOUNT"
  | "REQUIRED_NOTICE_ACKNOWLEDGEMENT"
  | "HISTORIC_PTC_OUTCOME",
  EvidenceBinding
>>;

type SagaCreateBody = {
  idempotencyKey?: string;
  expectedCaseAggregateVersion?: number;
  replayInput?: ConventionalPtcReplayInput;
  evidence?: EvidenceBindings;
  legalMechanism?: string;
  historicOutcomeRef?: string;
  historicOutcomeDigest?: string;
  authoritativeRecord?: {
    declarationEvidenceRef?: string;
    sourceReferenceId?: string | null;
    beforeSourceAsOfAt?: string;
  };
  reason?: string;
  stepUpEvidenceId?: string;
};

type ObservationBody = {
  idempotencyKey?: string;
  observed?: unknown;
  externalReference?: string;
  finalityClass?: string;
  signatureStatus?: string;
  evidenceObjectId?: string;
  observedAt?: string;
  reason?: string;
  stepUpEvidenceId?: string;
};

type LoadedLeg = Prisma.SettlementLegGetPayload<{
  include: {
    settlementSaga: { include: { legs: true } };
    observations: { include: { appliedRepairs: true } };
  };
}>;

type EvidenceRequirement = {
  role: keyof EvidenceBindings;
  institutionId: string;
  evidenceType: string;
  digest: string;
};

function enabled(): void {
  const flags = inspectPersistenceFlags(process.env);
  if (
    flags.transactionCase !== "shadow" ||
    flags.externalActionSaga !== "required" ||
    flags.ptcReplay !== "allow_list"
  ) throw new ForbiddenException("conventional PTC replay is disabled");
}

function productEnabled(): void {
  enabled();
  if (inspectPersistenceFlags(process.env).ptcProduct !== "shadow")
    throw new ForbiddenException("conventional PTC product journey is disabled");
}

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max)
    throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function digest(value: unknown, name: string): string {
  try {
    return assertSha256Digest(value, name);
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new BadRequestException(`${name} must be a positive safe integer`);
  return value;
}

function commandDigest(scope: string, body: Readonly<Record<string, unknown>>): string {
  const { stepUpEvidenceId: _stepUpEvidenceId, ...request } = body;
  return sha256Digest({ scope, request: toCanonicalValue(request) });
}

function unique(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

function date(value: unknown, name: string): Date {
  const parsed = new Date(required(value, name, 80));
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

@Injectable()
export class PtcReplayService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
  ) {}

  async productOverview(actor: RoomActor, caseId: string) {
    productEnabled();
    const { transactionCase } = await this.requireCase(actor, caseId, "VIEW_CASE");
    this.assertPtcRoute(transactionCase);
    const now = new Date();
    const canOperateCase = await this.may(actor, caseId, "OPERATE_CASE");
    const canOperateRoute = await this.may(actor, caseId, "OPERATE_ROUTE");
    const canViewEvidence = await this.may(actor, caseId, "VIEW_EVIDENCE", "INSTITUTION");
    const canViewRooms = await this.may(actor, caseId, "VIEW_CASE_ROOM");
    const owner = transactionCase.ownerInstitutionId === actor.actingInstitutionId;
    const [detail, authorisation, evidence, rooms, sources, sagas, breaks, authoritativeRecord] = await Promise.all([
      this.db.transactionCase.findUniqueOrThrow({
        where: { id: caseId },
        select: {
          id: true, caseReference: true, ownerInstitutionId: true, transactionRoute: true,
          representation: true, operatingMode: true, status: true, routeState: true,
          routePackRef: true, routePackVersion: true, aggregateVersion: true, evidenceLockedAt: true,
          parties: { orderBy: { partyRole: "asc" }, select: { id: true, institutionId: true, partyRole: true, status: true } },
          functionAssignments: { orderBy: { materialFunction: "asc" }, select: { id: true, materialFunction: true, performer: true, performerInstitutionId: true, status: true } },
          conditions: { orderBy: { code: "asc" }, select: { id: true, code: true, conditionKind: true, status: true, ownerInstitutionId: true, dueAt: true } },
          decisions: { orderBy: { createdAt: "asc" }, select: { id: true, decisionType: true, status: true } },
        },
      }),
      this.db.ptcReplayAuthorisation.findUnique({ where: { transactionCaseId: caseId }, select: { id: true, status: true, authorityEvidenceRef: true, reason: true, proposedByUserId: true, reviewedByUserId: true, reviewReason: true, effectiveAt: true, createdAt: true } }),
      canViewEvidence ? this.db.evidenceObject.findMany({
        where: {
          transactionCaseId: caseId,
          OR: [
            { institutionId: actor.actingInstitutionId },
            { grants: { some: { granteeInstitutionId: actor.actingInstitutionId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, institutionId: true, evidenceType: true, purpose: true, status: true, currentVersion: true, retentionUntilAt: true, legalHold: true, versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, version: true, payloadDigest: true, signatureStatus: true, result: true, validationStatus: true, sourceAsOfAt: true, expiresAt: true, qualifications: true } } },
      }) : Promise.resolve(null),
      canViewRooms ? this.db.caseRoom.findMany({
        where: owner
          ? { transactionCaseId: caseId }
          : { transactionCaseId: caseId, grants: { some: { granteeInstitutionId: actor.actingInstitutionId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
        orderBy: { createdAt: "asc" },
        select: { id: true, purpose: true, status: true, policyVersion: true, sourceManifestDigest: true, openedAt: true, closedAt: true },
      }) : Promise.resolve(null),
      canViewEvidence ? this.db.sourceReference.findMany({ where: { transactionCaseId: caseId, institutionId: actor.actingInstitutionId }, orderBy: { createdAt: "asc" }, select: { id: true, sourceSystem: true, sourceObjectType: true, sourceObjectId: true, sourceVersion: true, payloadDigest: true, authoritativeStatus: true } }) : Promise.resolve(null),
      this.db.settlementSaga.findMany({ where: { transactionCaseId: caseId, transactionRoute: "PTC" }, orderBy: { sagaVersion: "asc" }, select: {
        id: true, sagaVersion: true, state: true, executionMode: true, routePackRef: true, routePackVersion: true,
        planDigest: true, routeEvidenceBundleDigest: true, legalMechanism: true, considerationCurrency: true,
        considerationMinorUnits: true, considerationScale: true, historicOutcomeRef: true, historicOutcomeDigest: true,
        createdAt: true, reconciledAt: true,
        legs: { orderBy: { sequence: "asc" }, select: { id: true, legKey: true, legType: true, sequence: true, required: true, participantOwnerInstitutionId: true, performerClass: true, expectedDigest: true, state: true, currentObservationVersion: true, reconciledAt: true, observations: { orderBy: { version: "asc" }, select: { id: true, version: true, observationDigest: true, externalReference: true, finalityClass: true, signatureStatus: true, observedAt: true, comparisonResult: true, createdAt: true } } } },
      } }),
      this.db.reconciliationBreak.findMany({ where: { transactionCaseId: caseId, settlementSaga: { transactionRoute: "PTC" } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], select: { id: true, settlementSagaId: true, settlementLegId: true, breakCode: true, severity: true, status: true, ownerInstitutionId: true, dueAt: true, expectedDigest: true, observedDigest: true, createdAt: true, resolvedAt: true, repairActions: { orderBy: { proposedAt: "asc" }, select: { id: true, status: true, actionType: true, reason: true, proposedByUserId: true, reviewedByUserId: true, reviewReason: true, proposedAt: true, reviewedAt: true, appliedAt: true } } } }),
      this.db.authoritativeRecordDeclaration.findUnique({ where: { transactionCaseId: caseId }, select: { id: true, recordType: true, authorityClass: true, recordkeeperInstitutionId: true, declarationEvidenceDigest: true, routePackRef: true, routePackVersion: true, createdAt: true, snapshots: { orderBy: { sourceAsOfAt: "asc" }, select: { id: true, snapshotKind: true, recordReference: true, payloadDigest: true, sourceAsOfAt: true, createdAt: true } } } }),
    ]);
    const validEvidenceTypes = evidence?.flatMap((item) => {
      const latest = item.versions[0];
      return item.status === "AVAILABLE" && latest?.validationStatus === "VALID"
        && latest.result === "VERIFIED" && latest.signatureStatus === "VERIFIED"
        && (!latest.expiresAt || latest.expiresAt > now) ? [item.evidenceType] : [];
    }) ?? [];
    const activeParties = new Set(detail.parties.filter((item) => item.status === "ACTIVE").map((item) => item.partyRole));
    const currentSaga = sagas.at(-1) ?? null;
    const openBreakCount = breaks.filter((item) => item.status !== "RESOLVED").length;
    const journey = derivePtcProductJourney({
      canViewEvidence, canViewRooms, visibleEvidenceTypes: validEvidenceTypes,
      roomCount: rooms?.length ?? 0, hasOpenRoom: rooms?.some((item) => item.status === "OPEN") ?? false,
      hasCompletedRoom: rooms?.some((item) => item.status === "CLOSED") ?? false,
      caseStatus: detail.status,
      requiredPartiesActive: activeParties.has("ORIGINATOR") && activeParties.has("TRUSTEE") && activeParties.has("RECORDKEEPER"),
      authorisationStatus: authorisation?.status ?? null, sagaPresent: Boolean(currentSaga),
      legs: currentSaga?.legs.map((leg) => ({ legType: leg.legType, required: leg.required, state: leg.state })) ?? [],
      openBreakCount,
    });
    return {
      generatedAt: now.toISOString(), operatingBoundary: "OBSERVE_ONLY", case: detail,
      authorityNotice: "AssureRail coordinates and records this conventional PTC journey. The trustee controls the Rail workflow and the route-defined RTA, depository or register remains legally operative; Rail performs no funds, issue, allotment, notice or register act in this mode.",
      capabilities: { canOperateCase, canOperateRoute, canViewEvidence, canViewRooms, canGovernReplay: owner && canOperateCase },
      ...journey, authorisation,
      evidence: evidence === null ? { availability: "UNAVAILABLE", items: [] } : { availability: "AVAILABLE", items: evidence },
      rooms: rooms === null ? { availability: "UNAVAILABLE", items: [] } : { availability: "AVAILABLE", items: rooms },
      sources: sources === null ? { availability: "UNAVAILABLE", items: [] } : { availability: "AVAILABLE", items: sources },
      sagas, breaks, authoritativeRecord,
    };
  }

  async getAuthorisation(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.ptcReplayAuthorisation.findUnique({ where: { transactionCaseId: caseId } });
  }

  async proposeAuthorisation(
    actor: RoomActor,
    caseId: string,
    body: { idempotencyKey?: string; authorityEvidenceRef?: string; reason?: string; stepUpEvidenceId?: string },
  ) {
    const { transactionCase, authority } = await this.requireOwner(actor, caseId);
    this.assertPtcRoute(transactionCase);
    await this.assertRouteFoundation(caseId);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const reason = required(body.reason, "reason", 1_000);
    const requestDigest = commandDigest("PTC_REPLAY_AUTHORISATION_PROPOSE", { caseId, ...body });
    const existing = await this.db.ptcReplayAuthorisation.findUnique({ where: { transactionCaseId: caseId } });
    if (existing) {
      if (existing.idempotencyKey !== idempotencyKey || existing.requestDigest !== requestDigest)
        throw new ConflictException("this case already has a different PTC replay authorisation proposal");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const created = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "PTC_REPLAY_AUTHORISATION_PROPOSE",
          institutionId: actor.actingInstitutionId,
        }, tx);
        const result = await tx.ptcReplayAuthorisation.create({ data: {
          id: `ptcra_${randomUUID()}`,
          transactionCaseId: caseId,
          idempotencyKey,
          requestDigest,
          authorityEvidenceRef,
          reason,
          proposedByUserId: actor.actorUserId,
          proposedByMandateId: authority.mandateId!,
          proposalStepUpId: stepUpEvidenceId,
        } });
        await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.ptc_replay.authorisation_proposed",
          detail: { caseId, authorisationId: result.id, requestDigest, authorityEvidenceRef, authorityMandateId: authority.mandateId },
        });
        return result;
      });
      audit("rail.ptc_replay.authorisation_proposed", { caseId, actorUserId: actor.actorUserId, requestDigest });
      return created;
    } catch (error) {
      const replay = await this.db.ptcReplayAuthorisation.findUnique({ where: { transactionCaseId: caseId } });
      if (replay?.idempotencyKey === idempotencyKey && replay.requestDigest === requestDigest) return replay;
      if (unique(error)) throw new ConflictException("this case already has a different PTC replay authorisation proposal");
      throw error;
    }
  }

  async reviewAuthorisation(
    actor: RoomActor,
    caseId: string,
    authorisationId: string,
    body: { idempotencyKey?: string; approve?: boolean; reason?: string; stepUpEvidenceId?: string },
  ) {
    const { authority } = await this.requireOwner(actor, caseId);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("PTC_REPLAY_AUTHORISATION_REVIEW", { caseId, authorisationId, ...body });
    const current = await this.db.ptcReplayAuthorisation.findUnique({ where: { id: authorisationId } });
    if (!current || current.transactionCaseId !== caseId)
      throw new NotFoundException("PTC replay authorisation not found");
    if (current.reviewIdempotencyKey) {
      if (current.reviewIdempotencyKey !== idempotencyKey || current.reviewRequestDigest !== requestDigest)
        throw new ConflictException("authorisation review command conflicts with the retained result");
      return current;
    }
    if (current.status !== "PROPOSED") throw new ConflictException("PTC replay authorisation is already terminal");
    if (current.proposedByUserId === actor.actorUserId)
      throw new ForbiddenException("authorisation maker cannot review their own proposal");
    if (body.approve === true) await this.assertRouteFoundation(caseId);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const reviewReason = required(body.reason, "reason", 1_000);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actor.actorUserId,
        sessionId: actor.actorSessionId,
        purpose: "PTC_REPLAY_AUTHORISATION_REVIEW",
        institutionId: actor.actingInstitutionId,
      }, tx);
      const changed = await tx.ptcReplayAuthorisation.updateMany({
        where: { id: current.id, status: "PROPOSED", reviewedByUserId: null },
        data: {
          status: body.approve === true ? "APPROVED" : "REJECTED",
          reviewedByUserId: actor.actorUserId,
          reviewedByMandateId: authority.mandateId!,
          reviewStepUpId: stepUpEvidenceId,
          reviewReason,
          reviewIdempotencyKey: idempotencyKey,
          reviewRequestDigest: requestDigest,
          effectiveAt: body.approve === true ? new Date() : null,
        },
      });
      if (changed.count !== 1) throw new ConflictException("PTC replay authorisation changed concurrently");
      await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
      await appendGovernedAudit(tx, {
        actor: this.actorRef(actor),
        event: "rail.ptc_replay.authorisation_reviewed",
        detail: { caseId, authorisationId, approved: body.approve === true, reviewReason, authorityMandateId: authority.mandateId },
      });
      return tx.ptcReplayAuthorisation.findUniqueOrThrow({ where: { id: current.id } });
    });
  }

  async listSagas(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.settlementSaga.findMany({
      where: { transactionCaseId: caseId, transactionRoute: "PTC" },
      orderBy: { sagaVersion: "asc" },
      include: this.sagaInclude(),
    });
  }

  async createSaga(actor: RoomActor, caseId: string, body: SagaCreateBody) {
    const { transactionCase, authority } = await this.requireOwner(actor, caseId);
    this.assertPtcRoute(transactionCase);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("PTC_REPLAY_SAGA_CREATE", { caseId, ...body });
    const existing = await this.db.settlementSaga.findUnique({
      where: { transactionCaseId_idempotencyKey: { transactionCaseId: caseId, idempotencyKey } },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest || existing.transactionRoute !== "PTC")
        throw new ConflictException("saga idempotency key conflicts with a retained saga");
      return this.loadSaga(existing.id);
    }
    if (transactionCase.status !== "APPROVED_FOR_EXECUTION")
      throw new ConflictException("PTC replay saga may be planned only after independent case approval");
    const authorisation = await this.db.ptcReplayAuthorisation.findUnique({ where: { transactionCaseId: caseId } });
    if (!authorisation || authorisation.status !== "APPROVED" || !authorisation.effectiveAt)
      throw new ForbiddenException("case is not allow-listed by an approved PTC replay authorisation");
    const expectedCaseAggregateVersion = positiveInteger(body.expectedCaseAggregateVersion, "expectedCaseAggregateVersion");
    if (transactionCase.aggregateVersion !== expectedCaseAggregateVersion)
      throw new ConflictException("stale case aggregate version");
    const replayInput = body.replayInput;
    if (!replayInput || typeof replayInput !== "object") throw new BadRequestException("replayInput is required");
    let plan;
    let assignments;
    try {
      plan = buildConventionalPtcReplayPlan(replayInput);
      assignments = buildConventionalPtcFunctionAssignments(replayInput);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const parties = await this.ptcParties(caseId);
    this.assertInputParties(replayInput, parties);
    await this.assertAssignments(caseId, assignments);
    const evidenceRequirements = this.evidenceRequirements(replayInput, body);
    const expectedEvidenceRoles = new Set(evidenceRequirements.map((item) => item.role));
    const suppliedEvidenceRoles = Object.keys(body.evidence ?? {});
    const unexpectedEvidenceRole = suppliedEvidenceRoles.find((role) => !expectedEvidenceRoles.has(role as keyof EvidenceBindings));
    if (unexpectedEvidenceRole)
      throw new BadRequestException(`evidence.${unexpectedEvidenceRole} is not required by this PTC route input`);
    const retainedEvidence = await Promise.all(evidenceRequirements.map(async (requirement) => ({
      ...requirement,
      evidence: await this.requireEvidence(
        required(body.evidence?.[requirement.role]?.evidenceObjectId, `evidence.${requirement.role}.evidenceObjectId`, 160),
        caseId,
        requirement.institutionId,
        requirement.evidenceType,
      ),
    })));
    for (const item of retainedEvidence) {
      if (item.digest !== item.evidence.payloadDigest)
        throw new ConflictException(`${item.role} digest does not match its retained evidence version`);
    }
    const record = body.authoritativeRecord ?? {};
    const beforeSourceAsOfAt = new Date(required(record.beforeSourceAsOfAt, "authoritativeRecord.beforeSourceAsOfAt", 80));
    if (!Number.isFinite(beforeSourceAsOfAt.getTime()) || beforeSourceAsOfAt.getTime() > Date.now() + 300_000)
      throw new BadRequestException("authoritative record before-snapshot time is invalid or in the future");
    const sourceReferenceId = record.sourceReferenceId
      ? required(record.sourceReferenceId, "authoritativeRecord.sourceReferenceId", 160)
      : null;
    if (sourceReferenceId) {
      const source = await this.db.sourceReference.findUnique({ where: { id: sourceReferenceId } });
      if (!source || source.transactionCaseId !== caseId)
        throw new BadRequestException("authoritative source reference must be scoped to this case");
    }
    const historicOutcomeRef = required(body.historicOutcomeRef, "historicOutcomeRef", 500);
    const historicOutcomeDigest = digest(body.historicOutcomeDigest, "historicOutcomeDigest");
    const legalMechanism = required(body.legalMechanism, "legalMechanism", 160);
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const planDigest = sha256Digest(plan);
    const routeEvidenceBundleDigest = sha256Digest(retainedEvidence.map((item) => ({
      role: item.role,
      evidenceObjectId: item.evidence.id,
      digest: item.digest,
    })));
    const expectedOutcome = toCanonicalValue({
      trusteeControlDecisionDigest: replayInput.issue.trusteeControlDecisionDigest,
      allotmentEvidenceDigest: replayInput.issue.allotmentEvidenceDigest,
      authoritativeRecordAfterDigest: replayInput.authoritativeRecord.afterDigest,
      requiredNoticeAcknowledgementDigest: replayInput.lifecycleSetup.requiredNoticeAcknowledgementDigest,
    }) as unknown as Prisma.InputJsonValue;
    const considerationLeg = plan.find((leg) => leg.legType === "SUBSCRIPTION_AND_CONSIDERATION")!;
    const exactConsideration = (considerationLeg.expected as Record<string, unknown>).consideration as Record<string, unknown>;
    const declarationEvidence = retainedEvidence.find((item) => item.role === "AUTHORITATIVE_RECORD_DECLARATION")!;
    const beforeEvidence = retainedEvidence.find((item) => item.role === "AUTHORITATIVE_RECORD_BEFORE")!;
    const sagaId = `saga_${randomUUID()}`;
    try {
      await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "PTC_REPLAY_SAGA_CREATE",
          institutionId: actor.actingInstitutionId,
        }, tx);
        const changed = await tx.transactionCase.updateMany({
          where: { id: caseId, status: "APPROVED_FOR_EXECUTION", aggregateVersion: expectedCaseAggregateVersion },
          data: { aggregateVersion: { increment: 1 }, routeState: "PTC_REPLAY_SAGA_READY" },
        });
        if (changed.count !== 1) throw new ConflictException("case changed while the PTC saga was being planned");
        const declaration = await tx.authoritativeRecordDeclaration.create({ data: {
          id: `ard_${randomUUID()}`,
          transactionCaseId: caseId,
          recordType: replayInput.authoritativeRecord.recordType,
          authorityClass: "LEGAL_OPERATIVE_EXTERNAL_RECORD",
          recordkeeperInstitutionId: replayInput.recordkeeperInstitutionId,
          sourceReferenceId,
          declarationEvidenceRef: required(record.declarationEvidenceRef, "authoritativeRecord.declarationEvidenceRef", 500),
          declarationEvidenceDigest: replayInput.authoritativeRecord.declarationEvidenceDigest,
          declarationEvidenceObjectId: declarationEvidence.evidence.id,
          routePackRef: CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.ref,
          routePackVersion: CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.version,
          createdByUserId: actor.actorUserId,
          createdByMandateId: authority.mandateId!,
        } });
        await tx.settlementSaga.create({ data: {
          id: sagaId,
          transactionCaseId: caseId,
          routePackRef: CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.ref,
          routePackVersion: CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.version,
          transactionRoute: "PTC",
          executionMode: "OBSERVE_ONLY",
          state: "READY",
          idempotencyKey,
          requestDigest,
          planDigest,
          routeEvidenceBundleDigest,
          legalMechanism,
          considerationCurrency: String(exactConsideration.currency),
          considerationMinorUnits: String(exactConsideration.units),
          considerationScale: Number(exactConsideration.scale),
          historicOutcomeRef,
          historicOutcomeDigest,
          expectedOutcome,
          expectedOutcomeDigest: sha256Digest(expectedOutcome),
          createdByUserId: actor.actorUserId,
          createdByMandateId: authority.mandateId!,
        } });
        await tx.sagaEvidenceLink.createMany({ data: retainedEvidence.map((item, index) => ({
          id: `sel_${randomUUID()}`,
          settlementSagaId: sagaId,
          evidenceObjectId: item.evidence.id,
          evidenceRole: item.role,
          evidenceDigest: item.digest,
          sequence: (index + 1) * 10,
        })) });
        await tx.settlementLeg.createMany({ data: plan.map((leg) => ({
          id: `sleg_${randomUUID()}`,
          settlementSagaId: sagaId,
          legKey: leg.legKey,
          legType: leg.legType,
          sequence: leg.sequence,
          required: leg.required,
          participantOwnerInstitutionId: leg.participantOwnerInstitutionId,
          performerClass: leg.performerClass,
          expected: leg.expected as unknown as Prisma.InputJsonValue,
          expectedDigest: leg.expectedDigest,
        })) });
        await tx.authoritativeRecordSnapshot.create({ data: {
          id: `ars_${randomUUID()}`,
          authoritativeRecordDeclarationId: declaration.id,
          settlementSagaId: sagaId,
          snapshotKind: "BEFORE",
          recordReference: replayInput.authoritativeRecord.recordReference,
          payloadDigest: replayInput.authoritativeRecord.beforeDigest,
          evidenceObjectId: beforeEvidence.evidence.id,
          sourceAsOfAt: beforeSourceAsOfAt,
          recordedByUserId: actor.actorUserId,
        } });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.ptc_replay.saga_planned",
          detail: { caseId, sagaId, executionMode: "OBSERVE_ONLY", planDigest, routeEvidenceBundleDigest, historicOutcomeRef, historicOutcomeDigest, reason, authorityMandateId: authority.mandateId },
        });
      });
    } catch (error) {
      const replay = await this.db.settlementSaga.findUnique({ where: { transactionCaseId_idempotencyKey: { transactionCaseId: caseId, idempotencyKey } } });
      if (replay?.requestDigest === requestDigest && replay.transactionRoute === "PTC") return this.loadSaga(replay.id);
      if (unique(error)) throw new ConflictException("case already has a PTC replay saga or authoritative-record declaration");
      throw error;
    }
    return this.loadSaga(sagaId);
  }

  async recordObservation(
    actor: RoomActor,
    caseId: string,
    sagaId: string,
    legId: string,
    body: ObservationBody,
  ) {
    const { transactionCase } = await this.requireCase(actor, caseId, "OPERATE_CASE");
    const leg = await this.requireLeg(caseId, sagaId, legId);
    if (leg.settlementSaga.transactionRoute !== "PTC" || leg.settlementSaga.executionMode !== "OBSERVE_ONLY")
      throw new ForbiddenException("PTC replay observations cannot dispatch live actions");
    if (leg.participantOwnerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException("only the declared participant owner may record this leg");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("PTC_REPLAY_OBSERVATION_RECORD", { caseId, sagaId, legId, ...body });
    const replay = await this.db.sagaLegObservation.findUnique({
      where: { settlementLegId_idempotencyKey: { settlementLegId: legId, idempotencyKey } },
    });
    if (replay) {
      if (replay.requestDigest !== requestDigest)
        throw new ConflictException("observation idempotency key was reused with different content");
      return this.loadSaga(sagaId);
    }
    if (transactionCase.status !== "EXECUTION_PENDING")
      throw new ConflictException("observations may be recorded only while case execution is pending");
    if (leg.currentObservationVersion !== 0 || leg.observations.length !== 0)
      throw new ConflictException("an initial observation already exists; correction requires governed repair");
    await this.assertPriorLegsObserved(sagaId, leg.sequence);
    const authority = await this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action: "OPERATE_ROUTE",
      scopeType: "TRANSACTION_CASE",
      scopeRef: caseId,
    });
    const evidenceObjectId = required(body.evidenceObjectId, "evidenceObjectId", 160);
    const evidence = await this.requireEvidence(evidenceObjectId, caseId, actor.actingInstitutionId, null);
    const observedAt = date(body.observedAt, "observedAt");
    if (observedAt.getTime() > Date.now() + 300_000)
      throw new BadRequestException("observedAt cannot be materially in the future");
    const externalReference = required(body.externalReference, "externalReference", 500);
    if (required(body.finalityClass, "finalityClass", 40) !== "FINAL")
      throw new BadRequestException("finalityClass must be FINAL for replay evidence");
    if (required(body.signatureStatus, "signatureStatus", 40) !== "VERIFIED")
      throw new BadRequestException("signatureStatus must be VERIFIED for replay evidence");
    const observed = toCanonicalValue(body.observed ?? {});
    const comparison = comparePtcReplayObservation(leg.expected, observed);
    if (comparison.observedDigest !== evidence.payloadDigest)
      throw new ConflictException("observation digest does not match its retained evidence version");
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "PTC_REPLAY_OBSERVATION_RECORD",
          institutionId: actor.actingInstitutionId,
        }, tx);
        const changed = await tx.settlementLeg.updateMany({
          where: { id: leg.id, currentObservationVersion: 0, state: "PLANNED" },
          data: { state: comparison.result === "MATCHED" ? "OBSERVED" : "BREAK_OPEN", currentObservationVersion: 1 },
        });
        if (changed.count !== 1) throw new ConflictException("saga leg changed concurrently");
        const observation = await tx.sagaLegObservation.create({ data: {
          id: `sobs_${randomUUID()}`,
          settlementLegId: leg.id,
          version: 1,
          idempotencyKey,
          requestDigest,
          observation: observed as unknown as Prisma.InputJsonValue,
          observationDigest: comparison.observedDigest,
          externalReference,
          finalityClass: "FINAL",
          signatureStatus: "VERIFIED",
          evidenceObjectId: evidence.id,
          observedAt,
          recordedByUserId: actor.actorUserId,
          recordedByMandateId: authority.mandateId!,
          comparisonResult: comparison.result,
          comparison: toCanonicalValue({ differences: comparison.differences }) as unknown as Prisma.InputJsonValue,
        } });
        if (comparison.result === "BREAK_OPEN") {
          await tx.reconciliationBreak.create({ data: {
            id: `rbreak_${randomUUID()}`,
            transactionCaseId: caseId,
            settlementSagaId: sagaId,
            settlementLegId: leg.id,
            breakCode: "PTC_LEG_OBSERVATION_MISMATCH",
            severity: "CRITICAL",
            expected: comparison.expected as unknown as Prisma.InputJsonValue,
            observed: comparison.observed as unknown as Prisma.InputJsonValue,
            expectedDigest: comparison.expectedDigest,
            observedDigest: comparison.observedDigest,
            blockedCapabilities: ["CASE_COMPLETION"],
            ownerInstitutionId: actor.actingInstitutionId,
            dueAt: new Date(Date.now() + 4 * 60 * 60 * 1_000),
            openedByUserId: actor.actorUserId,
          } });
        }
        if (leg.legType === "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT" && comparison.result === "MATCHED") {
          const declaration = await tx.authoritativeRecordDeclaration.findUniqueOrThrow({ where: { transactionCaseId: caseId } });
          const afterDigest = (observed as Readonly<Record<string, unknown>>).afterDigest;
          await tx.authoritativeRecordSnapshot.create({ data: {
            id: `ars_${randomUUID()}`,
            authoritativeRecordDeclarationId: declaration.id,
            settlementSagaId: sagaId,
            snapshotKind: "AFTER",
            recordReference: externalReference,
            payloadDigest: digest(afterDigest, "observed.afterDigest"),
            evidenceObjectId: evidence.id,
            sourceAsOfAt: observedAt,
            recordedByUserId: actor.actorUserId,
          } });
        }
        const state = await this.refreshSagaState(tx, sagaId);
        await tx.transactionCase.update({
          where: { id: caseId },
          data: { aggregateVersion: { increment: 1 }, routeState: `PTC_REPLAY_SAGA_${state}` },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.ptc_replay.observation_recorded",
          detail: { caseId, sagaId, legId, observationId: observation.id, comparisonResult: comparison.result, reason, authorityMandateId: authority.mandateId },
        });
      });
    } catch (error) {
      const retained = await this.db.sagaLegObservation.findUnique({ where: { settlementLegId_idempotencyKey: { settlementLegId: legId, idempotencyKey } } });
      if (retained?.requestDigest === requestDigest) return this.loadSaga(sagaId);
      throw error;
    }
    return this.loadSaga(sagaId);
  }

  async reconcileLeg(
    actor: RoomActor,
    caseId: string,
    sagaId: string,
    legId: string,
    body: { idempotencyKey?: string; reason?: string; stepUpEvidenceId?: string },
  ) {
    const { transactionCase } = await this.requireCase(actor, caseId, "OPERATE_CASE");
    const leg = await this.requireLeg(caseId, sagaId, legId);
    if (leg.participantOwnerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException("only the declared participant owner may reconcile this leg");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("PTC_REPLAY_LEG_RECONCILE", { caseId, sagaId, legId, ...body });
    if (leg.reconciliationIdempotencyKey) {
      if (leg.reconciliationIdempotencyKey !== idempotencyKey || leg.reconciliationRequestDigest !== requestDigest)
        throw new ConflictException("leg reconciliation command conflicts with the retained result");
      return this.loadSaga(sagaId);
    }
    if (!["EXECUTION_PENDING", "COMPLETION_PENDING"].includes(transactionCase.status))
      throw new ConflictException("leg reconciliation requires an active PTC replay case");
    const observation = leg.observations.at(-1);
    if (leg.state !== "OBSERVED" || !observation || observation.comparisonResult !== "MATCHED")
      throw new ConflictException("only an exact observed leg can be reconciled");
    if (observation.recordedByUserId === actor.actorUserId)
      throw new ForbiddenException("observation recorder cannot independently reconcile the same leg");
    const appliedRepair = observation.appliedRepairs[0];
    if (appliedRepair?.reviewedByUserId === actor.actorUserId)
      throw new ForbiddenException("repair checker cannot also reconcile the repaired leg");
    await this.requireEvidence(observation.evidenceObjectId, caseId, actor.actingInstitutionId, null);
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "OPERATE_ROUTE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "PTC_REPLAY_LEG_RECONCILE", institutionId: actor.actingInstitutionId }, tx);
        const changed = await tx.settlementLeg.updateMany({
          where: { id: leg.id, state: "OBSERVED", currentObservationVersion: observation.version },
          data: {
            state: "RECONCILED",
            reconciledByUserId: actor.actorUserId,
            reconciliationStepUpId: stepUpEvidenceId,
            reconciliationReason: reason,
            reconciliationIdempotencyKey: idempotencyKey,
            reconciliationRequestDigest: requestDigest,
            reconciledAt: new Date(),
          },
        });
        if (changed.count !== 1) throw new ConflictException("saga leg changed concurrently");
        const state = await this.refreshSagaState(tx, sagaId);
        await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 }, routeState: `PTC_REPLAY_SAGA_${state}` } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.ptc_replay.leg_reconciled", detail: { caseId, sagaId, legId, observationId: observation.id, reason, authorityMandateId: authority.mandateId } });
      });
    } catch (error) {
      const replay = await this.db.settlementLeg.findUnique({ where: { id: legId } });
      if (replay?.reconciliationIdempotencyKey === idempotencyKey && replay.reconciliationRequestDigest === requestDigest)
        return this.loadSaga(sagaId);
      throw error;
    }
    return this.loadSaga(sagaId);
  }

  async listBreaks(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.reconciliationBreak.findMany({
      where: { transactionCaseId: caseId, settlementSaga: { transactionRoute: "PTC", executionMode: "OBSERVE_ONLY" } },
      orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "asc" }],
      include: { repairActions: { orderBy: { proposedAt: "asc" } } },
    });
  }

  async proposeRepair(
    actor: RoomActor,
    caseId: string,
    breakId: string,
    body: {
      idempotencyKey?: string;
      replacementObservation?: ObservationBody;
      reason?: string;
      authorityEvidenceRef?: string;
      stepUpEvidenceId?: string;
    },
  ) {
    const { transactionCase } = await this.requireCase(actor, caseId, "OPERATE_CASE");
    const item = await this.db.reconciliationBreak.findUnique({ where: { id: breakId }, include: { settlementLeg: { include: { settlementSaga: true } } } });
    if (!item || item.transactionCaseId !== caseId || !item.settlementLeg ||
      item.settlementLeg.settlementSaga.transactionRoute !== "PTC" || item.settlementLeg.settlementSaga.executionMode !== "OBSERVE_ONLY")
      throw new NotFoundException("PTC reconciliation break not found");
    if (item.ownerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException("only the accountable break owner may propose repair");
    const replacementObservation = this.canonicalObservationBody(body.replacementObservation);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1_000);
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const requestDigest = commandDigest("PTC_REPLAY_REPAIR_PROPOSE", { caseId, breakId, idempotencyKey, replacementObservation, reason, authorityEvidenceRef });
    const existing = await this.db.sagaRepairAction.findUnique({
      where: { reconciliationBreakId_idempotencyKey: { reconciliationBreakId: breakId, idempotencyKey } },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest)
        throw new ConflictException("repair idempotency key was reused with different content");
      return existing;
    }
    if (!["EXECUTION_PENDING", "COMPLETION_PENDING", "BLOCKED"].includes(transactionCase.status))
      throw new ConflictException("repairs may be proposed only for an active or blocked PTC replay case");
    if (item.status !== "OPEN") throw new ConflictException("break is not open for a repair proposal");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "OPERATE_ROUTE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "PTC_REPLAY_REPAIR_PROPOSE", institutionId: actor.actingInstitutionId }, tx);
        const claimed = await tx.reconciliationBreak.updateMany({ where: { id: breakId, status: "OPEN" }, data: { status: "REPAIR_PROPOSED" } });
        if (claimed.count !== 1) throw new ConflictException("break changed while repair was being proposed");
        const repair = await tx.sagaRepairAction.create({ data: {
          id: `srepair_${randomUUID()}`,
          reconciliationBreakId: breakId,
          idempotencyKey,
          requestDigest,
          actionType: "APPEND_CORRECTED_OBSERVATION",
          replacementObservation,
          reason,
          authorityEvidenceRef,
          proposedByUserId: actor.actorUserId,
          proposedByMandateId: authority.mandateId!,
          proposalStepUpId: stepUpEvidenceId,
        } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.ptc_replay.repair_proposed", detail: { caseId, breakId, repairId: repair.id, requestDigest, authorityMandateId: authority.mandateId } });
        return repair;
      });
    } catch (error) {
      const replay = await this.db.sagaRepairAction.findUnique({ where: { reconciliationBreakId_idempotencyKey: { reconciliationBreakId: breakId, idempotencyKey } } });
      if (replay?.requestDigest === requestDigest) return replay;
      throw error;
    }
  }

  async reviewRepair(
    actor: RoomActor,
    caseId: string,
    breakId: string,
    repairId: string,
    body: { idempotencyKey?: string; approve?: boolean; reason?: string; stepUpEvidenceId?: string },
  ) {
    const { transactionCase } = await this.requireCase(actor, caseId, "OPERATE_CASE");
    const repair = await this.db.sagaRepairAction.findUnique({
      where: { id: repairId },
      include: { reconciliationBreak: { include: { settlementLeg: { include: { settlementSaga: true, observations: { include: { appliedRepairs: true }, orderBy: { version: "asc" } } } } } } },
    });
    if (!repair || repair.reconciliationBreakId !== breakId || repair.reconciliationBreak.transactionCaseId !== caseId ||
      !repair.reconciliationBreak.settlementLeg || repair.reconciliationBreak.settlementLeg.settlementSaga.transactionRoute !== "PTC" ||
      repair.reconciliationBreak.settlementLeg.settlementSaga.executionMode !== "OBSERVE_ONLY")
      throw new NotFoundException("PTC repair proposal not found");
    if (repair.reconciliationBreak.ownerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException("only the accountable break owner may review repair");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("PTC_REPLAY_REPAIR_REVIEW", { caseId, breakId, repairId, ...body });
    if (repair.reviewIdempotencyKey) {
      if (repair.reviewIdempotencyKey !== idempotencyKey || repair.reviewRequestDigest !== requestDigest)
        throw new ConflictException("repair review command conflicts with the retained result");
      return repair.status === "APPLIED" ? this.loadSaga(repair.reconciliationBreak.settlementSagaId) : repair;
    }
    if (!["EXECUTION_PENDING", "COMPLETION_PENDING", "BLOCKED"].includes(transactionCase.status))
      throw new ConflictException("repairs may be reviewed only for an active or blocked PTC replay case");
    if (repair.status !== "PROPOSED" || repair.reconciliationBreak.status !== "REPAIR_PROPOSED")
      throw new ConflictException("repair proposal is not reviewable");
    if (repair.proposedByUserId === actor.actorUserId)
      throw new ForbiddenException("repair maker cannot review their own proposal");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "OPERATE_ROUTE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const reviewReason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    if (body.approve !== true) {
      try {
        return await this.db.$transaction(async (tx) => {
          await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "PTC_REPLAY_REPAIR_REVIEW", institutionId: actor.actingInstitutionId }, tx);
          const changed = await tx.sagaRepairAction.updateMany({ where: { id: repair.id, status: "PROPOSED", reviewIdempotencyKey: null }, data: {
            status: "REJECTED", reviewedByUserId: actor.actorUserId, reviewedByMandateId: authority.mandateId!, reviewStepUpId: stepUpEvidenceId,
            reviewReason, reviewIdempotencyKey: idempotencyKey, reviewRequestDigest: requestDigest, reviewedAt: new Date(),
          } });
          if (changed.count !== 1) throw new ConflictException("repair proposal changed concurrently");
          const reopened = await tx.reconciliationBreak.updateMany({ where: { id: breakId, status: "REPAIR_PROPOSED" }, data: { status: "OPEN" } });
          if (reopened.count !== 1) throw new ConflictException("reconciliation break changed concurrently");
          await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.ptc_replay.repair_rejected", detail: { caseId, breakId, repairId, reviewReason } });
          return tx.sagaRepairAction.findUniqueOrThrow({ where: { id: repair.id } });
        });
      } catch (error) {
        const replay = await this.db.sagaRepairAction.findUnique({ where: { id: repairId } });
        if (replay?.reviewIdempotencyKey === idempotencyKey && replay.reviewRequestDigest === requestDigest) return replay;
        throw error;
      }
    }
    const leg = repair.reconciliationBreak.settlementLeg;
    const replacement = repair.replacementObservation as unknown as ObservationBody;
    const validated = await this.validateObservation(caseId, leg, replacement, actor.actingInstitutionId);
    if (validated.comparison.result !== "MATCHED")
      throw new ConflictException("repair replacement evidence still differs from the retained expectation");
    const observationIdempotencyKey = required(replacement.idempotencyKey, "replacementObservation.idempotencyKey", 200);
    const observationRequestDigest = commandDigest("PTC_REPLAY_REPAIR_OBSERVATION", { caseId, breakId, repairId, ...replacement });
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "PTC_REPLAY_REPAIR_REVIEW", institutionId: actor.actingInstitutionId }, tx);
        const claimed = await tx.sagaRepairAction.updateMany({ where: { id: repair.id, status: "PROPOSED", reviewIdempotencyKey: null }, data: {
          status: "APPROVED", reviewedByUserId: actor.actorUserId, reviewedByMandateId: authority.mandateId!, reviewStepUpId: stepUpEvidenceId,
          reviewReason, reviewIdempotencyKey: idempotencyKey, reviewRequestDigest: requestDigest, reviewedAt: new Date(),
        } });
        if (claimed.count !== 1) throw new ConflictException("repair proposal changed concurrently");
        const nextVersion = leg.currentObservationVersion + 1;
        const observation = await tx.sagaLegObservation.create({ data: {
          id: `sobs_${randomUUID()}`, settlementLegId: leg.id, version: nextVersion, idempotencyKey: observationIdempotencyKey,
          requestDigest: observationRequestDigest, observation: validated.observed as unknown as Prisma.InputJsonValue,
          observationDigest: validated.comparison.observedDigest, externalReference: validated.externalReference,
          finalityClass: "FINAL", signatureStatus: "VERIFIED", evidenceObjectId: validated.evidence.id, observedAt: validated.observedAt,
          recordedByUserId: repair.proposedByUserId, recordedByMandateId: repair.proposedByMandateId,
          comparisonResult: "MATCHED", comparison: toCanonicalValue({ differences: [] }) as unknown as Prisma.InputJsonValue,
        } });
        if (leg.legType === "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT") {
          const declaration = await tx.authoritativeRecordDeclaration.findUniqueOrThrow({ where: { transactionCaseId: caseId } });
          const afterDigest = (validated.observed as Readonly<Record<string, unknown>>).afterDigest;
          await tx.authoritativeRecordSnapshot.create({ data: {
            id: `ars_${randomUUID()}`, authoritativeRecordDeclarationId: declaration.id, settlementSagaId: repair.reconciliationBreak.settlementSagaId,
            snapshotKind: "AFTER", recordReference: validated.externalReference, payloadDigest: digest(afterDigest, "replacementObservation.observed.afterDigest"),
            evidenceObjectId: validated.evidence.id, sourceAsOfAt: validated.observedAt, recordedByUserId: repair.proposedByUserId,
          } });
        }
        await tx.sagaRepairAction.update({ where: { id: repair.id }, data: { status: "APPLIED", appliedAt: new Date(), appliedObservationId: observation.id } });
        const resolved = await tx.reconciliationBreak.updateMany({ where: { id: breakId, status: "REPAIR_PROPOSED" }, data: {
          status: "RESOLVED", resolutionEvidenceRef: validated.externalReference, resolutionEvidenceDigest: validated.comparison.observedDigest,
          resolutionReason: repair.reason, resolvedByUserId: repair.proposedByUserId, independentlyClosedByUserId: actor.actorUserId, resolvedAt: new Date(),
        } });
        if (resolved.count !== 1) throw new ConflictException("reconciliation break changed concurrently");
        const changedLeg = await tx.settlementLeg.updateMany({ where: { id: leg.id, state: "BREAK_OPEN", currentObservationVersion: leg.currentObservationVersion }, data: { state: "OBSERVED", currentObservationVersion: nextVersion } });
        if (changedLeg.count !== 1) throw new ConflictException("saga leg changed concurrently");
        const state = await this.refreshSagaState(tx, repair.reconciliationBreak.settlementSagaId);
        await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 }, routeState: `PTC_REPLAY_SAGA_${state}` } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.ptc_replay.repair_applied", detail: { caseId, breakId, repairId, observationId: observation.id, reviewReason, authorityMandateId: authority.mandateId } });
        return tx.settlementSaga.findUniqueOrThrow({ where: { id: repair.reconciliationBreak.settlementSagaId }, include: this.sagaInclude() });
      });
    } catch (error) {
      const replay = await this.db.sagaRepairAction.findUnique({ where: { id: repairId } });
      if (replay?.reviewIdempotencyKey === idempotencyKey && replay.reviewRequestDigest === requestDigest && replay.status === "APPLIED")
        return this.loadSaga(repair.reconciliationBreak.settlementSagaId);
      throw error;
    }
  }

  async comparison(actor: RoomActor, caseId: string, sagaId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    const saga = await this.loadSaga(sagaId);
    if (saga.transactionCaseId !== caseId || saga.transactionRoute !== "PTC")
      throw new NotFoundException("PTC replay saga not found");
    const rows = saga.legs.map((leg) => {
      const current = leg.observations.at(-1);
      return {
        sequence: leg.sequence,
        legKey: leg.legKey,
        legType: leg.legType,
        ownerInstitutionId: leg.participantOwnerInstitutionId,
        state: leg.state,
        expectedDigest: leg.expectedDigest,
        observedDigest: current?.observationDigest ?? null,
        comparisonResult: current?.comparisonResult ?? "NOT_OBSERVED",
        externalReference: current?.externalReference ?? null,
        differences: current ? (current.comparison as Record<string, unknown>).differences ?? [] : [],
      };
    });
    const report = {
      sagaId,
      caseId,
      executionMode: saga.executionMode,
      sagaState: saga.state,
      routePackRef: saga.routePackRef,
      routePackVersion: saga.routePackVersion,
      historicOutcomeRef: saga.historicOutcomeRef,
      matched: rows.filter((row) => row.comparisonResult === "MATCHED").length,
      breaks: rows.filter((row) => row.comparisonResult === "BREAK_OPEN").length,
      notObserved: rows.filter((row) => row.comparisonResult === "NOT_OBSERVED").length,
      rows,
    };
    return { ...report, reportDigest: sha256Digest(report) };
  }

  async evidencePack(actor: RoomActor, caseId: string, sagaId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    const [saga, transactionCase, declaration, breaks, comparison] = await Promise.all([
      this.loadSaga(sagaId),
      this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true, functionAssignments: true, decisions: { include: { approvals: true } }, transitions: true } }),
      this.db.authoritativeRecordDeclaration.findUnique({ where: { transactionCaseId: caseId }, include: { snapshots: { orderBy: { sourceAsOfAt: "asc" } } } }),
      this.db.reconciliationBreak.findMany({
        where: { transactionCaseId: caseId, settlementSaga: { transactionRoute: "PTC", executionMode: "OBSERVE_ONLY" } },
        orderBy: { createdAt: "asc" },
        include: { repairActions: { orderBy: { proposedAt: "asc" } } },
      }),
      this.comparison(actor, caseId, sagaId),
    ]);
    if (!transactionCase || saga.transactionCaseId !== caseId || saga.transactionRoute !== "PTC")
      throw new NotFoundException("PTC replay saga not found");
    const pack = toCanonicalValue(JSON.parse(JSON.stringify({
      schemaId: "assurerail.conventional-ptc-replay-evidence-pack",
      schemaVersion: "1.0.0",
      executionMode: "OBSERVE_ONLY",
      mutationStatement: "NO_MONEY_ISSUE_ALLOTMENT_REGISTER_OR_NOTICE_ACTION_DISPATCHED",
      transactionCase,
      saga,
      authoritativeRecord: declaration,
      reconciliationBreaks: breaks,
      comparison,
    })));
    return { generatedAt: new Date().toISOString(), evidencePack: pack, evidencePackDigest: sha256Digest(pack) };
  }

  private canonicalObservationBody(value: unknown): Prisma.InputJsonValue {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new BadRequestException("replacementObservation must be an object");
    if ("stepUpEvidenceId" in value)
      throw new BadRequestException("replacementObservation must not carry step-up evidence; the repair proposal has its own ceremony");
    try {
      return toCanonicalValue(value) as unknown as Prisma.InputJsonValue;
    } catch (error) {
      throw new BadRequestException(`replacementObservation is not canonical JSON: ${(error as Error).message}`);
    }
  }

  private async validateObservation(caseId: string, leg: Pick<LoadedLeg, "expected">, body: ObservationBody, institutionId: string) {
    const evidenceObjectId = required(body.evidenceObjectId, "replacementObservation.evidenceObjectId", 160);
    const evidence = await this.requireEvidence(evidenceObjectId, caseId, institutionId, null);
    const observedAt = date(body.observedAt, "replacementObservation.observedAt");
    if (observedAt.getTime() > Date.now() + 300_000)
      throw new BadRequestException("replacement observation cannot be materially in the future");
    const externalReference = required(body.externalReference, "replacementObservation.externalReference", 500);
    if (required(body.finalityClass, "replacementObservation.finalityClass", 40) !== "FINAL")
      throw new BadRequestException("replacementObservation.finalityClass must be FINAL");
    if (required(body.signatureStatus, "replacementObservation.signatureStatus", 40) !== "VERIFIED")
      throw new BadRequestException("replacementObservation.signatureStatus must be VERIFIED");
    required(body.reason, "replacementObservation.reason", 1_000);
    let observed;
    try {
      observed = toCanonicalValue(body.observed ?? {});
    } catch (error) {
      throw new BadRequestException(`replacementObservation.observed is not canonical JSON: ${(error as Error).message}`);
    }
    const comparison = comparePtcReplayObservation(leg.expected, observed);
    if (comparison.observedDigest !== evidence.payloadDigest)
      throw new ConflictException("replacement observation digest does not match its retained evidence version");
    return { evidence, observedAt, externalReference, observed, comparison };
  }

  private evidenceRequirements(input: ConventionalPtcReplayInput, body: SagaCreateBody): EvidenceRequirement[] {
    const requirements: EvidenceRequirement[] = [
      { role: "PROGRAMME_OR_TRUST", institutionId: input.trusteeInstitutionId, evidenceType: "PROGRAMME_OR_TRUST", digest: input.programmeTrust.programmeOrTrustEvidenceDigest },
      { role: "TRUSTEE_APPOINTMENT", institutionId: input.trusteeInstitutionId, evidenceType: "TRUSTEE_APPOINTMENT", digest: input.programmeTrust.trusteeAppointmentEvidenceDigest },
      { role: "POOL_TRANSFER", institutionId: input.originatorInstitutionId, evidenceType: "POOL_TRANSFER", digest: input.poolTransfer.poolTransferEvidenceDigest },
      { role: "POOL_ELIGIBILITY", institutionId: input.originatorInstitutionId, evidenceType: "POOL_ELIGIBILITY", digest: input.poolTransfer.poolEligibilityEvidenceDigest },
      { role: "EXECUTED_DOCUMENTS", institutionId: input.trusteeInstitutionId, evidenceType: "EXECUTED_PTC_DOCUMENTS", digest: input.issue.executedDocumentsEvidenceDigest },
      { role: "TRANCHE_DEFINITION", institutionId: input.trusteeInstitutionId, evidenceType: "PTC_TRANCHE_DEFINITION", digest: input.issue.trancheDefinitionDigest },
      { role: "SUBSCRIPTION", institutionId: input.originatorInstitutionId, evidenceType: "PTC_SUBSCRIPTION", digest: input.issue.subscriptionEvidenceDigest },
      { role: "TRUSTEE_TRANSACTION_CONTROL", institutionId: input.trusteeInstitutionId, evidenceType: "TRUSTEE_TRANSACTION_CONTROL", digest: input.issue.trusteeControlDecisionDigest },
      { role: "ISSUE_OR_ALLOTMENT", institutionId: input.trusteeInstitutionId, evidenceType: "PTC_ISSUE_OR_ALLOTMENT", digest: input.issue.allotmentEvidenceDigest },
      { role: "AUTHORITATIVE_RECORD_DECLARATION", institutionId: input.recordkeeperInstitutionId, evidenceType: "AUTHORITATIVE_RECORD_DECLARATION", digest: input.authoritativeRecord.declarationEvidenceDigest },
      { role: "AUTHORITATIVE_RECORD_BEFORE", institutionId: input.recordkeeperInstitutionId, evidenceType: "AUTHORITATIVE_RECORD_SNAPSHOT", digest: input.authoritativeRecord.beforeDigest },
      { role: "REQUIRED_NOTICE_ACKNOWLEDGEMENT", institutionId: input.lifecycleSetup.servicerInstitutionId ?? input.trusteeInstitutionId, evidenceType: "REQUIRED_NOTICE_ACKNOWLEDGEMENT", digest: input.lifecycleSetup.requiredNoticeAcknowledgementDigest },
      { role: "HISTORIC_PTC_OUTCOME", institutionId: input.originatorInstitutionId, evidenceType: "HISTORIC_PTC_OUTCOME", digest: digest(body.historicOutcomeDigest, "historicOutcomeDigest") },
    ];
    if (input.requiredReviews.counsel) requirements.push({ role: "COUNSEL_OPINION", institutionId: input.requiredReviews.counsel.providerInstitutionId, evidenceType: "COUNSEL_OPINION", digest: input.requiredReviews.counsel.opinionEvidenceDigest });
    if (input.requiredReviews.rating) requirements.push({ role: "RATING", institutionId: input.requiredReviews.rating.providerInstitutionId, evidenceType: "RATING_OR_EXTERNAL_REVIEW", digest: input.requiredReviews.rating.evidenceDigest });
    if (input.requiredReviews.assurance) requirements.push(
      { role: "ASSURANCE_APPOINTMENT", institutionId: input.trusteeInstitutionId, evidenceType: "ASSURANCE_APPOINTMENT", digest: input.requiredReviews.assurance.appointmentEvidenceDigest },
      { role: "ASSURANCE_RESULT", institutionId: input.requiredReviews.assurance.providerInstitutionId, evidenceType: "ASSURANCE_RESULT", digest: input.requiredReviews.assurance.resultEvidenceDigest },
    );
    if (input.lifecycleSetup.servicerInstitutionId) requirements.push(
      { role: "SERVICER_APPOINTMENT", institutionId: input.lifecycleSetup.servicerInstitutionId, evidenceType: "SERVICER_APPOINTMENT", digest: input.lifecycleSetup.servicerAppointmentEvidenceDigest! },
      { role: "COLLECTION_ACCOUNT", institutionId: input.lifecycleSetup.servicerInstitutionId, evidenceType: "COLLECTION_ACCOUNT", digest: input.lifecycleSetup.collectionAccountEvidenceDigest! },
    );
    return requirements;
  }

  private async requireEvidence(evidenceObjectId: string, caseId: string, institutionId: string, evidenceType: string | null) {
    const item = await this.db.evidenceObject.findUnique({
      where: { id: evidenceObjectId },
      include: {
        institution: { include: { admission: true } },
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    const latest = item?.versions[0];
    if (!item || item.transactionCaseId !== caseId || item.institutionId !== institutionId ||
      item.institution.status !== "ACTIVE" || item.institution.admission?.status !== "ADMITTED" ||
      (evidenceType && item.evidenceType !== evidenceType) || item.status !== "AVAILABLE" || !latest ||
      latest.validationStatus !== "VALID" || latest.signatureStatus !== "VERIFIED" ||
      latest.result !== "VERIFIED" || (latest.expiresAt && latest.expiresAt <= new Date())) {
      const label = evidenceType ?? "observation";
      throw new BadRequestException(`${label} evidence must be current, signed, valid, verified, available and case-scoped to ${institutionId}`);
    }
    return { id: item.id, payloadDigest: latest.payloadDigest };
  }

  private async may(
    actor: RoomActor,
    caseId: string,
    action: "OPERATE_CASE" | "OPERATE_ROUTE" | "VIEW_EVIDENCE" | "VIEW_CASE_ROOM",
    scopeType = "TRANSACTION_CASE",
  ): Promise<boolean> {
    try {
      await this.access.requireHuman({
        userId: actor.actorUserId,
        institutionId: actor.actingInstitutionId,
        action,
        scopeType,
        scopeRef: scopeType === "TRANSACTION_CASE" ? caseId : undefined,
      });
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) return false;
      throw error;
    }
  }

  private async requireCase(actor: RoomActor, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE") {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    if (!transactionCase) throw new NotFoundException("transaction case not found");
    const participant = transactionCase.ownerInstitutionId === actor.actingInstitutionId || transactionCase.parties.some((party) => party.institutionId === actor.actingInstitutionId && party.status === "ACTIVE");
    if (!participant) throw new NotFoundException("transaction case not found");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    return { transactionCase, authority };
  }

  private async requireOwner(actor: RoomActor, caseId: string) {
    const result = await this.requireCase(actor, caseId, "OPERATE_CASE");
    if (result.transactionCase.ownerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException("only the case owner may govern PTC replay");
    return result;
  }

  private assertPtcRoute(transactionCase: Record<string, unknown>): void {
    const checks: Array<[unknown, unknown, string]> = [
      [transactionCase.transactionRoute, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.transactionRoute, "transactionRoute"],
      [transactionCase.representation, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.representation, "representation"],
      [transactionCase.jurisdiction, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.jurisdiction, "jurisdiction"],
      [transactionCase.marketContext, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.marketContext, "marketContext"],
      [transactionCase.placementOrListing, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.placementOrListing, "placementOrListing"],
      [transactionCase.lifecycleLeg, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.lifecycleLeg, "lifecycleLeg"],
      [transactionCase.routePackRef, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.ref, "routePackRef"],
      [transactionCase.routePackVersion, CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.version, "routePackVersion"],
    ];
    const mismatch = checks.find(([observed, expected]) => observed !== expected);
    if (mismatch) throw new BadRequestException(`case ${mismatch[2]} is outside the conventional PTC replay route pack`);
    if (!CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.operatingModes.includes(transactionCase.operatingMode as "REPLAY" | "SHADOW"))
      throw new BadRequestException("PTC replay is available only in REPLAY or SHADOW case mode");
  }

  private async ptcParties(caseId: string): Promise<Map<string, string>> {
    const parties = await this.db.caseParty.findMany({ where: { transactionCaseId: caseId, status: "ACTIVE" } });
    const map = new Map<string, string>();
    for (const role of ["ORIGINATOR", "TRUSTEE", "RECORDKEEPER"]) {
      const matches = parties.filter((party) => party.partyRole === role);
      if (matches.length !== 1)
        throw new ConflictException(`PTC route requires exactly one active ${role} party`);
      map.set(role, matches[0]!.institutionId);
    }
    return map;
  }

  private assertInputParties(input: ConventionalPtcReplayInput, parties: Map<string, string>): void {
    if (parties.get("ORIGINATOR") !== input.originatorInstitutionId || parties.get("TRUSTEE") !== input.trusteeInstitutionId || parties.get("RECORDKEEPER") !== input.recordkeeperInstitutionId)
      throw new ConflictException("PTC replay input parties must match the active case parties");
  }

  private async assertRouteFoundation(caseId: string): Promise<void> {
    await this.ptcParties(caseId);
    const now = new Date();
    const assignments = await this.db.caseFunctionAssignment.findMany({ where: {
      transactionCaseId: caseId,
      status: "ACTIVE",
      AND: [{ OR: [{ effectiveAt: null }, { effectiveAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    } });
    for (const materialFunction of CONVENTIONAL_PTC_REPLAY_ROUTE_PACK.requiredMaterialFunctions) {
      const assignment = assignments.find((item) => item.materialFunction === materialFunction);
      if (!assignment || assignment.performer === "PROHIBITED")
        throw new ConflictException(`PTC route requires a permitted ${materialFunction} function assignment`);
    }
  }

  private async assertAssignments(caseId: string, expected: readonly { materialFunction: string; performer: string; performerInstitutionId: string }[]): Promise<void> {
    const now = new Date();
    const active = await this.db.caseFunctionAssignment.findMany({ where: {
      transactionCaseId: caseId,
      status: "ACTIVE",
      AND: [{ OR: [{ effectiveAt: null }, { effectiveAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    } });
    for (const item of expected) {
      const assignment = active.find((candidate) => candidate.materialFunction === item.materialFunction);
      if (!assignment || assignment.performer !== item.performer || assignment.performerInstitutionId !== item.performerInstitutionId)
        throw new ConflictException(`PTC function assignment mismatch: ${item.materialFunction}`);
    }
  }

  private async assertPriorLegsObserved(sagaId: string, sequence: number): Promise<void> {
    const pending = await this.db.settlementLeg.findFirst({
      where: { settlementSagaId: sagaId, required: true, sequence: { lt: sequence }, state: { notIn: ["OBSERVED", "RECONCILED"] } },
      orderBy: { sequence: "asc" },
    });
    if (pending) throw new ConflictException(`prior required leg is not observed: ${pending.legKey}`);
  }

  private async requireLeg(caseId: string, sagaId: string, legId: string): Promise<LoadedLeg> {
    const leg = await this.db.settlementLeg.findUnique({
      where: { id: legId },
      include: {
        settlementSaga: { include: { legs: true } },
        observations: { include: { appliedRepairs: true }, orderBy: { version: "asc" } },
      },
    });
    if (!leg || leg.settlementSagaId !== sagaId || leg.settlementSaga.transactionCaseId !== caseId || leg.settlementSaga.transactionRoute !== "PTC")
      throw new NotFoundException("PTC replay saga leg not found");
    return leg;
  }

  private async refreshSagaState(tx: Prisma.TransactionClient, sagaId: string) {
    const [legs, openBreaks] = await Promise.all([
      tx.settlementLeg.findMany({ where: { settlementSagaId: sagaId }, select: { required: true, state: true } }),
      tx.reconciliationBreak.count({ where: { settlementSagaId: sagaId, status: { not: "RESOLVED" } } }),
    ]);
    const state = derivePtcSagaState(legs, openBreaks);
    await tx.settlementSaga.update({ where: { id: sagaId }, data: { state, reconciledAt: state === "RECONCILED" ? new Date() : null } });
    return state;
  }

  private loadSaga(sagaId: string) {
    return this.db.settlementSaga.findUniqueOrThrow({ where: { id: sagaId }, include: this.sagaInclude() });
  }

  private sagaInclude() {
    return {
      evidenceLinks: { orderBy: { sequence: "asc" as const } },
      legs: {
        orderBy: { sequence: "asc" as const },
        include: { observations: { include: { appliedRepairs: true }, orderBy: { version: "asc" as const } } },
      },
      recordSnapshots: { orderBy: { sourceAsOfAt: "asc" as const } },
      breaks: { orderBy: { createdAt: "asc" as const } },
    };
  }

  private actorRef(actor: RoomActor): string {
    return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`;
  }
}
