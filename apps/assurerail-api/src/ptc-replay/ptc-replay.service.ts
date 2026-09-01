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
  CONVENTIONAL_PTC_REPLAY_ROUTE_PACK,
  type ConventionalPtcReplayInput,
} from "./ptc-route-pack";

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

@Injectable()
export class PtcReplayService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
  ) {}

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
    if (transactionCase.status !== "APPROVED_FOR_EXECUTION")
      throw new ConflictException("PTC replay saga may be planned only after independent case approval");
    const authorisation = await this.db.ptcReplayAuthorisation.findUnique({ where: { transactionCaseId: caseId } });
    if (!authorisation || authorisation.status !== "APPROVED" || !authorisation.effectiveAt)
      throw new ForbiddenException("case is not allow-listed by an approved PTC replay authorisation");
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

  private async requireEvidence(evidenceObjectId: string, caseId: string, institutionId: string, evidenceType: string) {
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
      item.evidenceType !== evidenceType || item.status !== "AVAILABLE" || !latest ||
      latest.validationStatus !== "VALID" || latest.signatureStatus !== "VERIFIED" ||
      latest.result !== "VERIFIED" || (latest.expiresAt && latest.expiresAt <= new Date())) {
      throw new BadRequestException(`${evidenceType} evidence must be current, signed, valid, verified, available and case-scoped to ${institutionId}`);
    }
    return { id: item.id, payloadDigest: latest.payloadDigest };
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

  private loadSaga(sagaId: string) {
    return this.db.settlementSaga.findUniqueOrThrow({ where: { id: sagaId }, include: this.sagaInclude() });
  }

  private sagaInclude() {
    return {
      evidenceLinks: { orderBy: { sequence: "asc" as const } },
      legs: { orderBy: { sequence: "asc" as const } },
      recordSnapshots: { orderBy: { sourceAsOfAt: "asc" as const } },
      breaks: { orderBy: { createdAt: "asc" as const } },
    };
  }

  private actorRef(actor: RoomActor): string {
    return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`;
  }
}
