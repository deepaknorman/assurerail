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
import {
  assertSha256Digest,
  sha256Digest,
  toCanonicalValue,
} from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import {
  buildConventionalDaSagaPlan,
  compareDaLegObservation,
  CONVENTIONAL_DA_ROUTE_PACK,
  deriveDaSagaState,
  type DaReplayNoticePlan,
} from "./da-route-pack";
import { daReplayCsvCell } from "./da-replay-export";

const FINALITY_CLASSES = ["FINAL"] as const;
const SIGNATURE_STATUSES = ["VERIFIED"] as const;

function enabled(): void {
  const flags = inspectPersistenceFlags(process.env);
  if (
    flags.transactionCase !== "shadow" ||
    flags.externalActionSaga !== "required" ||
    flags.daReplay !== "allow_list"
  ) {
    throw new ForbiddenException("conventional DA replay is disabled");
  }
}

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max)
    throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function optional(value: unknown, name: string, max = 300): string | null {
  return value === null || value === undefined || value === ""
    ? null
    : required(value, name, max);
}

function oneOf(
  value: unknown,
  name: string,
  values: readonly string[]
): string {
  const result = required(value, name, 100);
  if (!values.includes(result))
    throw new BadRequestException(
      `${name} must be one of: ${values.join(", ")}`
    );
  return result;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${name} must be a positive safe integer`);
  }
  return value;
}

function date(value: unknown, name: string): Date {
  const parsed = new Date(required(value, name, 80));
  if (!Number.isFinite(parsed.getTime()))
    throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

function digest(value: unknown, name: string): string {
  try {
    return assertSha256Digest(value, name);
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}

function unique(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

function commandDigest(
  scope: string,
  body: Readonly<Record<string, unknown>>
): string {
  const { stepUpEvidenceId: _stepUpEvidenceId, ...request } = body;
  return sha256Digest({ scope, request: toCanonicalValue(request) });
}

type SagaCreateBody = {
  idempotencyKey?: string;
  expectedCaseAggregateVersion?: number;
  legalMechanism?: string;
  consideration?: { currency?: unknown; units?: unknown; scale?: unknown };
  transfereeCreditDecisionEvidenceObjectId?: string;
  executedTransferDocumentEvidenceObjectId?: string;
  historicOutcomeEvidenceObjectId?: string;
  historicOutcomeRef?: string;
  historicOutcomeDigest?: string;
  expectedOutcome?: {
    transferredAssetDigest?: string;
    considerationReference?: string;
    transferorSourceAfterDigest?: string;
    transfereeSourceAfterDigest?: string;
    authoritativeRecordAfterDigest?: string;
  };
  authoritativeRecord?: {
    recordType?: string;
    recordkeeperInstitutionId?: string;
    sourceReferenceId?: string | null;
    declarationEvidenceRef?: string;
    declarationEvidenceDigest?: string;
    declarationEvidenceObjectId?: string;
    beforeSnapshot?: {
      recordReference?: string;
      payloadDigest?: string;
      sourceAsOfAt?: string;
      evidenceObjectId?: string;
    };
  };
  notices?: Array<{
    noticeType?: string;
    recipientInstitutionId?: string;
    expectedAcknowledgementDigest?: string;
  }>;
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

@Injectable()
export class DaReplayService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService
  ) {}

  async getAuthorisation(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.daReplayAuthorisation.findUnique({
      where: { transactionCaseId: caseId },
    });
  }

  async proposeAuthorisation(
    actor: RoomActor,
    caseId: string,
    body: {
      idempotencyKey?: string;
      authorityEvidenceRef?: string;
      reason?: string;
      stepUpEvidenceId?: string;
    }
  ) {
    const { transactionCase, authority } = await this.requireOwner(
      actor,
      caseId
    );
    this.assertDaRoute(transactionCase);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const authorityEvidenceRef = required(
      body.authorityEvidenceRef,
      "authorityEvidenceRef",
      500
    );
    const reason = required(body.reason, "reason", 1_000);
    const requestDigest = commandDigest("DA_REPLAY_AUTHORISATION_PROPOSE", {
      caseId,
      ...body,
    });
    const existing = await this.db.daReplayAuthorisation.findUnique({
      where: { transactionCaseId: caseId },
    });
    if (existing) {
      if (
        existing.idempotencyKey !== idempotencyKey ||
        existing.requestDigest !== requestDigest
      ) {
        throw new ConflictException(
          "this case already has a different DA replay authorisation proposal"
        );
      }
      return existing;
    }
    await this.assertRouteFoundation(caseId);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    let authorisation;
    try {
      authorisation = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume(
          {
            evidenceId: stepUpEvidenceId,
            userId: actor.actorUserId,
            sessionId: actor.actorSessionId,
            purpose: "DA_REPLAY_AUTHORISATION_PROPOSE",
            institutionId: actor.actingInstitutionId,
          },
          tx
        );
        const created = await tx.daReplayAuthorisation.create({
          data: {
            id: `dara_${randomUUID()}`,
            transactionCaseId: caseId,
            idempotencyKey,
            requestDigest,
            authorityEvidenceRef,
            reason,
            proposedByUserId: actor.actorUserId,
            proposedByMandateId: authority.mandateId!,
            proposalStepUpId: stepUpEvidenceId,
          },
        });
        await tx.transactionCase.update({
          where: { id: caseId },
          data: { aggregateVersion: { increment: 1 } },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.da_replay.authorisation_proposed",
          detail: {
            caseId,
            authorisationId: created.id,
            requestDigest,
            authorityEvidenceRef,
            authorityMandateId: authority.mandateId,
          },
        });
        return created;
      });
    } catch (error) {
      const replay = await this.db.daReplayAuthorisation.findUnique({
        where: { transactionCaseId: caseId },
      });
      if (
        replay?.idempotencyKey === idempotencyKey &&
        replay.requestDigest === requestDigest
      )
        return replay;
      if (unique(error))
        throw new ConflictException(
          "this case already has a different DA replay authorisation proposal"
        );
      throw error;
    }
    audit("rail.da_replay.authorisation_proposed", {
      caseId,
      actorUserId: actor.actorUserId,
      requestDigest,
    });
    return authorisation;
  }

  async reviewAuthorisation(
    actor: RoomActor,
    caseId: string,
    authorisationId: string,
    body: {
      idempotencyKey?: string;
      approve?: boolean;
      reason?: string;
      stepUpEvidenceId?: string;
    }
  ) {
    const { authority } = await this.requireOwner(actor, caseId);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("DA_REPLAY_AUTHORISATION_REVIEW", {
      caseId,
      authorisationId,
      ...body,
    });
    const current = await this.db.daReplayAuthorisation.findUnique({
      where: { id: authorisationId },
    });
    if (!current || current.transactionCaseId !== caseId)
      throw new NotFoundException("DA replay authorisation not found");
    if (current.reviewIdempotencyKey) {
      if (current.reviewIdempotencyKey !== idempotencyKey)
        throw new ConflictException(
          "authorisation was already reviewed by a different command"
        );
      if (current.reviewRequestDigest !== requestDigest)
        throw new ConflictException(
          "authorisation review idempotency key was reused with different content"
        );
      return current;
    }
    if (current.status !== "PROPOSED")
      throw new ConflictException(
        "DA replay authorisation is already terminal"
      );
    if (current.proposedByUserId === actor.actorUserId)
      throw new ForbiddenException(
        "authorisation maker cannot review their own proposal"
      );
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const reviewReason = required(body.reason, "reason", 1_000);
    const approved = body.approve === true;
    if (approved) await this.assertRouteFoundation(caseId);
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume(
          {
            evidenceId: stepUpEvidenceId,
            userId: actor.actorUserId,
            sessionId: actor.actorSessionId,
            purpose: "DA_REPLAY_AUTHORISATION_REVIEW",
            institutionId: actor.actingInstitutionId,
          },
          tx
        );
        const changed = await tx.daReplayAuthorisation.updateMany({
          where: { id: current.id, status: "PROPOSED", reviewedByUserId: null },
          data: {
            status: approved ? "APPROVED" : "REJECTED",
            reviewedByUserId: actor.actorUserId,
            reviewedByMandateId: authority.mandateId!,
            reviewStepUpId: stepUpEvidenceId,
            reviewReason,
            reviewIdempotencyKey: idempotencyKey,
            reviewRequestDigest: requestDigest,
            effectiveAt: approved ? new Date() : null,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            "DA replay authorisation changed concurrently"
          );
        await tx.transactionCase.update({
          where: { id: caseId },
          data: { aggregateVersion: { increment: 1 } },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.da_replay.authorisation_reviewed",
          detail: {
            caseId,
            authorisationId,
            approved,
            reviewReason,
            authorityMandateId: authority.mandateId,
          },
        });
        return tx.daReplayAuthorisation.findUniqueOrThrow({
          where: { id: current.id },
        });
      });
    } catch (error) {
      const replay = await this.db.daReplayAuthorisation.findUnique({
        where: { id: authorisationId },
      });
      if (
        replay?.reviewIdempotencyKey === idempotencyKey &&
        replay.reviewRequestDigest === requestDigest
      )
        return replay;
      throw error;
    }
  }

  async listSagas(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.settlementSaga.findMany({
      where: { transactionCaseId: caseId },
      orderBy: { sagaVersion: "asc" },
      include: this.sagaInclude(),
    });
  }

  async createSaga(actor: RoomActor, caseId: string, body: SagaCreateBody) {
    const { transactionCase, authority } = await this.requireOwner(
      actor,
      caseId
    );
    this.assertDaRoute(transactionCase);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("DA_REPLAY_SAGA_CREATE", {
      caseId,
      ...body,
    });
    const existing = await this.db.settlementSaga.findUnique({
      where: {
        transactionCaseId_idempotencyKey: {
          transactionCaseId: caseId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest)
        throw new ConflictException(
          "saga idempotency key was reused with different content"
        );
      return this.loadSaga(existing.id);
    }
    if (transactionCase.status !== "APPROVED_FOR_EXECUTION") {
      throw new ConflictException(
        "DA replay saga may be planned only after independent case approval"
      );
    }
    const authorisation = await this.db.daReplayAuthorisation.findUnique({
      where: { transactionCaseId: caseId },
    });
    if (
      !authorisation ||
      authorisation.status !== "APPROVED" ||
      !authorisation.effectiveAt
    ) {
      throw new ForbiddenException(
        "case is not allow-listed by an approved DA replay authorisation"
      );
    }
    const expectedCaseAggregateVersion = positiveInteger(
      body.expectedCaseAggregateVersion,
      "expectedCaseAggregateVersion"
    );
    if (transactionCase.aggregateVersion !== expectedCaseAggregateVersion)
      throw new ConflictException("stale case aggregate version");
    const parties = await this.daParties(caseId);
    const transferor = parties.get("TRANSFEROR")!;
    const transferee = parties.get("TRANSFEREE")!;
    const creditEvidence = await this.requireEvidence(
      required(
        body.transfereeCreditDecisionEvidenceObjectId,
        "transfereeCreditDecisionEvidenceObjectId",
        160
      ),
      caseId,
      transferee,
      "TRANSFEREE_CREDIT_DECISION"
    );
    const documentEvidence = await this.requireEvidence(
      required(
        body.executedTransferDocumentEvidenceObjectId,
        "executedTransferDocumentEvidenceObjectId",
        160
      ),
      caseId,
      transferor,
      "EXECUTED_TRANSFER_DOCUMENT"
    );
    const record = body.authoritativeRecord ?? {};
    const recordkeeperInstitutionId = required(
      record.recordkeeperInstitutionId,
      "authoritativeRecord.recordkeeperInstitutionId",
      160
    );
    await this.assertRecordkeeper(caseId, recordkeeperInstitutionId);
    const before = record.beforeSnapshot ?? {};
    const beforeEvidence = await this.requireEvidence(
      required(
        before.evidenceObjectId,
        "authoritativeRecord.beforeSnapshot.evidenceObjectId",
        160
      ),
      caseId,
      recordkeeperInstitutionId,
      "AUTHORITATIVE_RECORD_SNAPSHOT"
    );
    const beforePayloadDigest = digest(
      before.payloadDigest,
      "authoritativeRecord.beforeSnapshot.payloadDigest"
    );
    if (beforePayloadDigest !== beforeEvidence.payloadDigest)
      throw new ConflictException(
        "before snapshot digest does not match its retained evidence version"
      );
    const beforeSourceAsOfAt = date(
      before.sourceAsOfAt,
      "authoritativeRecord.beforeSnapshot.sourceAsOfAt"
    );
    if (beforeSourceAsOfAt.getTime() > Date.now() + 5 * 60 * 1_000) {
      throw new BadRequestException(
        "authoritative record before-snapshot cannot be materially in the future"
      );
    }
    const sourceReferenceId = optional(
      record.sourceReferenceId,
      "authoritativeRecord.sourceReferenceId",
      160
    );
    if (sourceReferenceId) {
      const source = await this.db.sourceReference.findUnique({
        where: { id: sourceReferenceId },
      });
      if (!source || source.transactionCaseId !== caseId)
        throw new BadRequestException(
          "authoritative source reference must be scoped to this case"
        );
    }
    const expectedOutcome = body.expectedOutcome ?? {};
    if (body.notices !== undefined && !Array.isArray(body.notices)) {
      throw new BadRequestException("notices must be an array");
    }
    if ((body.notices?.length ?? 0) > 50) {
      throw new BadRequestException("notices cannot exceed 50 entries");
    }
    const notices: DaReplayNoticePlan[] = (body.notices ?? []).map(
      (notice, index) => {
        if (!notice || typeof notice !== "object" || Array.isArray(notice)) {
          throw new BadRequestException(`notices[${index}] must be an object`);
        }
        return {
          noticeType: required(
            notice.noticeType,
            `notices[${index}].noticeType`,
            120
          ),
          recipientInstitutionId: required(
            notice.recipientInstitutionId,
            `notices[${index}].recipientInstitutionId`,
            160
          ),
          expectedAcknowledgementDigest: digest(
            notice.expectedAcknowledgementDigest,
            `notices[${index}].expectedAcknowledgementDigest`
          ),
        };
      }
    );
    const normalisedExpectedOutcome = {
      transferredAssetDigest: digest(
        expectedOutcome.transferredAssetDigest,
        "expectedOutcome.transferredAssetDigest"
      ),
      considerationReference: required(
        expectedOutcome.considerationReference,
        "expectedOutcome.considerationReference",
        300
      ),
      transferorSourceAfterDigest: digest(
        expectedOutcome.transferorSourceAfterDigest,
        "expectedOutcome.transferorSourceAfterDigest"
      ),
      transfereeSourceAfterDigest: digest(
        expectedOutcome.transfereeSourceAfterDigest,
        "expectedOutcome.transfereeSourceAfterDigest"
      ),
      authoritativeRecordAfterDigest: digest(
        expectedOutcome.authoritativeRecordAfterDigest,
        "expectedOutcome.authoritativeRecordAfterDigest"
      ),
    };
    const plan = buildConventionalDaSagaPlan({
      transferorInstitutionId: transferor,
      transfereeInstitutionId: transferee,
      recordkeeperInstitutionId,
      legalMechanism: required(body.legalMechanism, "legalMechanism", 160),
      consideration: {
        currency: body.consideration?.currency,
        units: body.consideration?.units,
        scale: body.consideration?.scale,
      },
      transfereeCreditDecisionDigest: creditEvidence.payloadDigest,
      executedTransferDocumentDigest: documentEvidence.payloadDigest,
      expectedOutcome: normalisedExpectedOutcome,
      authoritativeRecord: {
        recordType: required(
          record.recordType,
          "authoritativeRecord.recordType",
          120
        ),
        recordReference: required(
          before.recordReference,
          "authoritativeRecord.beforeSnapshot.recordReference",
          300
        ),
        beforeDigest: beforePayloadDigest,
      },
      notices,
    });
    const consideration = plan.find(
      (leg) => leg.legType === "CASH_CONSIDERATION"
    )!.expected as Readonly<Record<string, unknown>>;
    const exactConsideration = consideration.consideration as Readonly<
      Record<string, unknown>
    >;
    const historicOutcomeEvidence = await this.requireEvidence(
      required(
        body.historicOutcomeEvidenceObjectId,
        "historicOutcomeEvidenceObjectId",
        160
      ),
      caseId,
      transferor,
      "HISTORIC_DA_OUTCOME"
    );
    const historicOutcomeRef = required(
      body.historicOutcomeRef,
      "historicOutcomeRef",
      500
    );
    const historicOutcomeDigest = digest(
      body.historicOutcomeDigest,
      "historicOutcomeDigest"
    );
    if (historicOutcomeDigest !== historicOutcomeEvidence.payloadDigest) {
      throw new ConflictException(
        "historic outcome digest does not match its retained evidence version"
      );
    }
    const declarationEvidence = await this.requireEvidence(
      required(
        record.declarationEvidenceObjectId,
        "authoritativeRecord.declarationEvidenceObjectId",
        160
      ),
      caseId,
      recordkeeperInstitutionId,
      "AUTHORITATIVE_RECORD_DECLARATION"
    );
    const declarationEvidenceRef = required(
      record.declarationEvidenceRef,
      "authoritativeRecord.declarationEvidenceRef",
      500
    );
    const declarationEvidenceDigest = digest(
      record.declarationEvidenceDigest,
      "authoritativeRecord.declarationEvidenceDigest"
    );
    if (declarationEvidenceDigest !== declarationEvidence.payloadDigest) {
      throw new ConflictException(
        "authoritative-record declaration digest does not match its retained evidence version"
      );
    }
    const expectedOutcomeValue = json({
      ...normalisedExpectedOutcome,
      notices,
    });
    const expectedOutcomeDigest = sha256Digest(expectedOutcomeValue);
    const planDigest = sha256Digest(plan);
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const sagaId = `saga_${randomUUID()}`;
    try {
      await this.db.$transaction(async (tx) => {
        await this.stepUp.consume(
          {
            evidenceId: stepUpEvidenceId,
            userId: actor.actorUserId,
            sessionId: actor.actorSessionId,
            purpose: "DA_REPLAY_SAGA_CREATE",
            institutionId: actor.actingInstitutionId,
          },
          tx
        );
        const changed = await tx.transactionCase.updateMany({
          where: {
            id: caseId,
            status: "APPROVED_FOR_EXECUTION",
            aggregateVersion: expectedCaseAggregateVersion,
          },
          data: {
            aggregateVersion: { increment: 1 },
            routeState: "DA_REPLAY_SAGA_READY",
          },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            "case changed while the saga was being planned"
          );
        const declaration = await tx.authoritativeRecordDeclaration.create({
          data: {
            id: `ard_${randomUUID()}`,
            transactionCaseId: caseId,
            recordType: required(
              record.recordType,
              "authoritativeRecord.recordType",
              120
            ),
            authorityClass: "LEGAL_OPERATIVE_EXTERNAL_RECORD",
            recordkeeperInstitutionId,
            sourceReferenceId,
            declarationEvidenceRef,
            declarationEvidenceDigest,
            declarationEvidenceObjectId: declarationEvidence.id,
            routePackRef: CONVENTIONAL_DA_ROUTE_PACK.ref,
            routePackVersion: CONVENTIONAL_DA_ROUTE_PACK.version,
            createdByUserId: actor.actorUserId,
            createdByMandateId: authority.mandateId!,
          },
        });
        await tx.settlementSaga.create({
          data: {
            id: sagaId,
            transactionCaseId: caseId,
            routePackRef: CONVENTIONAL_DA_ROUTE_PACK.ref,
            routePackVersion: CONVENTIONAL_DA_ROUTE_PACK.version,
            transactionRoute: "DA",
            executionMode: "OBSERVE_ONLY",
            state: "READY",
            idempotencyKey,
            requestDigest,
            planDigest,
            routeEvidenceBundleDigest: planDigest,
            legalMechanism: required(
              body.legalMechanism,
              "legalMechanism",
              160
            ),
            considerationCurrency: String(exactConsideration.currency),
            considerationMinorUnits: String(exactConsideration.units),
            considerationScale: Number(exactConsideration.scale),
            historicOutcomeRef,
            historicOutcomeDigest,
            historicOutcomeEvidenceObjectId: historicOutcomeEvidence.id,
            transfereeCreditDecisionEvidenceObjectId: creditEvidence.id,
            executedTransferDocumentEvidenceObjectId: documentEvidence.id,
            expectedOutcome: expectedOutcomeValue,
            expectedOutcomeDigest,
            createdByUserId: actor.actorUserId,
            createdByMandateId: authority.mandateId!,
          },
        });
        await tx.settlementLeg.createMany({
          data: plan.map((leg) => ({
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
          })),
        });
        await tx.authoritativeRecordSnapshot.create({
          data: {
            id: `ars_${randomUUID()}`,
            authoritativeRecordDeclarationId: declaration.id,
            settlementSagaId: sagaId,
            snapshotKind: "BEFORE",
            recordReference: required(
              before.recordReference,
              "authoritativeRecord.beforeSnapshot.recordReference",
              300
            ),
            payloadDigest: beforePayloadDigest,
            evidenceObjectId: beforeEvidence.id,
            sourceAsOfAt: beforeSourceAsOfAt,
            recordedByUserId: actor.actorUserId,
          },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.da_replay.saga_planned",
          detail: {
            caseId,
            sagaId,
            executionMode: "OBSERVE_ONLY",
            planDigest,
            historicOutcomeRef,
            historicOutcomeDigest,
            routePackRef: CONVENTIONAL_DA_ROUTE_PACK.ref,
            routePackVersion: CONVENTIONAL_DA_ROUTE_PACK.version,
            reason,
            authorityMandateId: authority.mandateId,
          },
        });
      });
    } catch (error) {
      const replay = await this.db.settlementSaga.findUnique({
        where: {
          transactionCaseId_idempotencyKey: {
            transactionCaseId: caseId,
            idempotencyKey,
          },
        },
      });
      if (replay?.requestDigest === requestDigest)
        return this.loadSaga(replay.id);
      if (unique(error))
        throw new ConflictException(
          "case already has a DA replay saga or authoritative-record declaration"
        );
      throw error;
    }
    return this.loadSaga(sagaId);
  }

  async recordObservation(
    actor: RoomActor,
    caseId: string,
    sagaId: string,
    legId: string,
    body: ObservationBody
  ) {
    const { transactionCase } = await this.requireCase(
      actor,
      caseId,
      "OPERATE_CASE"
    );
    const leg = await this.requireLeg(caseId, sagaId, legId);
    if (leg.settlementSaga.executionMode !== "OBSERVE_ONLY")
      throw new ForbiddenException(
        "PR-09 cannot dispatch or record live-mutating actions"
      );
    if (leg.participantOwnerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException(
        "only the declared participant owner may record this leg"
      );
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("DA_REPLAY_OBSERVATION_RECORD", {
      caseId,
      sagaId,
      legId,
      ...body,
    });
    const existing = await this.db.sagaLegObservation.findUnique({
      where: {
        settlementLegId_idempotencyKey: {
          settlementLegId: legId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest)
        throw new ConflictException(
          "observation idempotency key was reused with different content"
        );
      return this.loadSaga(sagaId);
    }
    if (transactionCase.status !== "EXECUTION_PENDING")
      throw new ConflictException(
        "observations may be recorded only while case execution is pending"
      );
    const authority = await this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action: "OPERATE_ROUTE",
      scopeType: "TRANSACTION_CASE",
      scopeRef: caseId,
    });
    await this.assertPriorLegsObserved(sagaId, leg.sequence);
    const validated = await this.validateObservation(
      caseId,
      leg,
      body,
      actor.actingInstitutionId,
      authority.mandateId!
    );
    return this.persistObservation(actor, authority.mandateId!, leg, validated);
  }

  async reconcileLeg(
    actor: RoomActor,
    caseId: string,
    sagaId: string,
    legId: string,
    body: {
      idempotencyKey?: string;
      reason?: string;
      stepUpEvidenceId?: string;
    }
  ) {
    const { transactionCase } = await this.requireCase(
      actor,
      caseId,
      "OPERATE_CASE"
    );
    const leg = await this.requireLeg(caseId, sagaId, legId);
    if (leg.participantOwnerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException(
        "only the declared participant owner may reconcile this leg"
      );
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("DA_REPLAY_LEG_RECONCILE", {
      caseId,
      sagaId,
      legId,
      ...body,
    });
    if (leg.reconciliationIdempotencyKey) {
      if (leg.reconciliationIdempotencyKey !== idempotencyKey)
        throw new ConflictException(
          "leg was already reconciled by a different command"
        );
      if (leg.reconciliationRequestDigest !== requestDigest)
        throw new ConflictException(
          "leg reconciliation idempotency key was reused with different content"
        );
      return this.loadSaga(sagaId);
    }
    if (
      !["EXECUTION_PENDING", "COMPLETION_PENDING"].includes(
        transactionCase.status
      )
    ) {
      throw new ConflictException(
        "legs may be reconciled only while execution or completion is pending"
      );
    }
    if (leg.state !== "OBSERVED")
      throw new ConflictException(
        "only an exact observed leg can be reconciled"
      );
    const observation = leg.observations.at(-1);
    if (!observation || observation.comparisonResult !== "MATCHED")
      throw new ConflictException("leg has no exact current observation");
    if (observation.recordedByUserId === actor.actorUserId)
      throw new ForbiddenException(
        "observation recorder cannot independently reconcile the same leg"
      );
    const appliedRepair = observation.appliedRepairs[0];
    if (appliedRepair?.reviewedByUserId === actor.actorUserId)
      throw new ForbiddenException(
        "repair checker cannot also reconcile the repaired leg"
      );
    await this.requireEvidence(
      observation.evidenceObjectId,
      caseId,
      actor.actingInstitutionId,
      null
    );
    const authority = await this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action: "OPERATE_ROUTE",
      scopeType: "TRANSACTION_CASE",
      scopeRef: caseId,
    });
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume(
          {
            evidenceId: stepUpEvidenceId,
            userId: actor.actorUserId,
            sessionId: actor.actorSessionId,
            purpose: "DA_REPLAY_LEG_RECONCILE",
            institutionId: actor.actingInstitutionId,
          },
          tx
        );
        const changed = await tx.settlementLeg.updateMany({
          where: {
            id: leg.id,
            state: "OBSERVED",
            currentObservationVersion: observation.version,
          },
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
        if (changed.count !== 1)
          throw new ConflictException("saga leg changed concurrently");
        const state = await this.refreshSagaState(tx, sagaId);
        await tx.transactionCase.update({
          where: { id: caseId },
          data: {
            aggregateVersion: { increment: 1 },
            routeState: `DA_REPLAY_SAGA_${state}`,
          },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.da_replay.leg_reconciled",
          detail: {
            caseId,
            sagaId,
            legId,
            observationId: observation.id,
            reason,
            authorityMandateId: authority.mandateId,
          },
        });
        return tx.settlementSaga.findUniqueOrThrow({
          where: { id: sagaId },
          include: this.sagaInclude(),
        });
      });
    } catch (error) {
      const replay = await this.db.settlementLeg.findUnique({
        where: { id: legId },
      });
      if (
        replay?.reconciliationIdempotencyKey === idempotencyKey &&
        replay.reconciliationRequestDigest === requestDigest
      ) {
        return this.loadSaga(sagaId);
      }
      throw error;
    }
  }

  async listBreaks(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.reconciliationBreak.findMany({
      where: { transactionCaseId: caseId },
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
    }
  ) {
    const { transactionCase } = await this.requireCase(
      actor,
      caseId,
      "OPERATE_CASE"
    );
    const item = await this.db.reconciliationBreak.findUnique({
      where: { id: breakId },
      include: { settlementLeg: true },
    });
    if (!item || item.transactionCaseId !== caseId || !item.settlementLeg)
      throw new NotFoundException("reconciliation break not found");
    if (item.ownerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException(
        "only the accountable break owner may propose repair"
      );
    const replacementObservation = json(body.replacementObservation);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1_000);
    const authorityEvidenceRef = required(
      body.authorityEvidenceRef,
      "authorityEvidenceRef",
      500
    );
    const requestDigest = sha256Digest({
      breakId,
      idempotencyKey,
      replacementObservation,
      reason,
      authorityEvidenceRef,
    });
    const existing = await this.db.sagaRepairAction.findUnique({
      where: {
        reconciliationBreakId_idempotencyKey: {
          reconciliationBreakId: breakId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest)
        throw new ConflictException(
          "repair idempotency key was reused with different content"
        );
      return existing;
    }
    if (
      !["EXECUTION_PENDING", "COMPLETION_PENDING", "BLOCKED"].includes(
        transactionCase.status
      )
    ) {
      throw new ConflictException(
        "repairs may be proposed only for an active or blocked DA replay case"
      );
    }
    if (item.status !== "OPEN")
      throw new ConflictException("break is not open for a repair proposal");
    const authority = await this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action: "OPERATE_ROUTE",
      scopeType: "TRANSACTION_CASE",
      scopeRef: caseId,
    });
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume(
          {
            evidenceId: stepUpEvidenceId,
            userId: actor.actorUserId,
            sessionId: actor.actorSessionId,
            purpose: "DA_REPLAY_REPAIR_PROPOSE",
            institutionId: actor.actingInstitutionId,
          },
          tx
        );
        const claimed = await tx.reconciliationBreak.updateMany({
          where: { id: breakId, status: "OPEN" },
          data: { status: "REPAIR_PROPOSED" },
        });
        if (claimed.count !== 1)
          throw new ConflictException(
            "break changed while the repair was being proposed"
          );
        const repair = await tx.sagaRepairAction.create({
          data: {
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
          },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.da_replay.repair_proposed",
          detail: {
            caseId,
            breakId,
            repairId: repair.id,
            requestDigest,
            authorityMandateId: authority.mandateId,
          },
        });
        return repair;
      });
    } catch (error) {
      const replay = await this.db.sagaRepairAction.findUnique({
        where: {
          reconciliationBreakId_idempotencyKey: {
            reconciliationBreakId: breakId,
            idempotencyKey,
          },
        },
      });
      if (replay?.requestDigest === requestDigest) return replay;
      throw error;
    }
  }

  async reviewRepair(
    actor: RoomActor,
    caseId: string,
    breakId: string,
    repairId: string,
    body: {
      idempotencyKey?: string;
      approve?: boolean;
      reason?: string;
      stepUpEvidenceId?: string;
    }
  ) {
    const { transactionCase } = await this.requireCase(
      actor,
      caseId,
      "OPERATE_CASE"
    );
    const repair = await this.db.sagaRepairAction.findUnique({
      where: { id: repairId },
      include: {
        reconciliationBreak: {
          include: {
            settlementLeg: {
              include: {
                settlementSaga: { include: { legs: true } },
                observations: {
                  include: { appliedRepairs: true },
                  orderBy: { version: "asc" },
                },
              },
            },
          },
        },
      },
    });
    if (
      !repair ||
      repair.reconciliationBreakId !== breakId ||
      repair.reconciliationBreak.transactionCaseId !== caseId ||
      !repair.reconciliationBreak.settlementLeg
    ) {
      throw new NotFoundException("saga repair proposal not found");
    }
    if (
      repair.reconciliationBreak.ownerInstitutionId !==
      actor.actingInstitutionId
    )
      throw new ForbiddenException(
        "only the accountable break owner may review repair"
      );
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("DA_REPLAY_REPAIR_REVIEW", {
      caseId,
      breakId,
      repairId,
      ...body,
    });
    if (repair.reviewIdempotencyKey) {
      if (repair.reviewIdempotencyKey !== idempotencyKey)
        throw new ConflictException(
          "repair was already reviewed by a different command"
        );
      if (repair.reviewRequestDigest !== requestDigest)
        throw new ConflictException(
          "repair review idempotency key was reused with different content"
        );
      return repair.status === "APPLIED"
        ? this.loadSaga(repair.reconciliationBreak.settlementSagaId)
        : repair;
    }
    if (
      !["EXECUTION_PENDING", "COMPLETION_PENDING", "BLOCKED"].includes(
        transactionCase.status
      )
    ) {
      throw new ConflictException(
        "repairs may be reviewed only for an active or blocked DA replay case"
      );
    }
    if (repair.status !== "PROPOSED")
      throw new ConflictException("repair proposal is already terminal");
    if (repair.proposedByUserId === actor.actorUserId)
      throw new ForbiddenException(
        "repair maker cannot review their own proposal"
      );
    const authority = await this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action: "OPERATE_ROUTE",
      scopeType: "TRANSACTION_CASE",
      scopeRef: caseId,
    });
    const reviewReason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    if (body.approve !== true) {
      try {
        return await this.db.$transaction(async (tx) => {
          await this.stepUp.consume(
            {
              evidenceId: stepUpEvidenceId,
              userId: actor.actorUserId,
              sessionId: actor.actorSessionId,
              purpose: "DA_REPLAY_REPAIR_REVIEW",
              institutionId: actor.actingInstitutionId,
            },
            tx
          );
          const changed = await tx.sagaRepairAction.updateMany({
            where: {
              id: repair.id,
              status: "PROPOSED",
              reviewIdempotencyKey: null,
            },
            data: {
              status: "REJECTED",
              reviewedByUserId: actor.actorUserId,
              reviewedByMandateId: authority.mandateId!,
              reviewStepUpId: stepUpEvidenceId,
              reviewReason,
              reviewIdempotencyKey: idempotencyKey,
              reviewRequestDigest: requestDigest,
              reviewedAt: new Date(),
            },
          });
          if (changed.count !== 1)
            throw new ConflictException("repair proposal changed concurrently");
          const reopened = await tx.reconciliationBreak.updateMany({
            where: { id: breakId, status: "REPAIR_PROPOSED" },
            data: { status: "OPEN" },
          });
          if (reopened.count !== 1)
            throw new ConflictException(
              "reconciliation break changed concurrently"
            );
          await appendGovernedAudit(tx, {
            actor: this.actorRef(actor),
            event: "rail.da_replay.repair_rejected",
            detail: { caseId, breakId, repairId, reviewReason },
          });
          return tx.sagaRepairAction.findUniqueOrThrow({
            where: { id: repair.id },
          });
        });
      } catch (error) {
        const replay = await this.db.sagaRepairAction.findUnique({
          where: { id: repairId },
        });
        if (
          replay?.reviewIdempotencyKey === idempotencyKey &&
          replay.reviewRequestDigest === requestDigest
        )
          return replay;
        throw error;
      }
    }
    const replacement =
      repair.replacementObservation as unknown as ObservationBody;
    const validated = await this.validateObservation(
      caseId,
      repair.reconciliationBreak.settlementLeg,
      replacement,
      actor.actingInstitutionId,
      repair.proposedByMandateId,
      false
    );
    if (validated.comparison.result !== "MATCHED")
      throw new ConflictException(
        "a repair cannot be approved while replacement evidence still differs from the retained expectation"
      );
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume(
          {
            evidenceId: stepUpEvidenceId,
            userId: actor.actorUserId,
            sessionId: actor.actorSessionId,
            purpose: "DA_REPLAY_REPAIR_REVIEW",
            institutionId: actor.actingInstitutionId,
          },
          tx
        );
        const claimed = await tx.sagaRepairAction.updateMany({
          where: {
            id: repair.id,
            status: "PROPOSED",
            reviewIdempotencyKey: null,
          },
          data: {
            status: "APPROVED",
            reviewedByUserId: actor.actorUserId,
            reviewedByMandateId: authority.mandateId!,
            reviewStepUpId: stepUpEvidenceId,
            reviewReason,
            reviewIdempotencyKey: idempotencyKey,
            reviewRequestDigest: requestDigest,
            reviewedAt: new Date(),
          },
        });
        if (claimed.count !== 1)
          throw new ConflictException("repair proposal changed concurrently");
        const observation = await this.insertObservation(
          tx,
          repair.reconciliationBreak.settlementLeg!,
          validated,
          repair.proposedByUserId
        );
        if (
          repair.reconciliationBreak.settlementLeg!.legType ===
          "AUTHORITATIVE_REGISTER_UPDATE"
        ) {
          const declaration =
            await tx.authoritativeRecordDeclaration.findUniqueOrThrow({
              where: { transactionCaseId: caseId },
            });
          const observed = validated.observation as Readonly<
            Record<string, unknown>
          >;
          await tx.authoritativeRecordSnapshot.upsert({
            where: {
              settlementSagaId_snapshotKind: {
                settlementSagaId: repair.reconciliationBreak.settlementSagaId,
                snapshotKind: "AFTER",
              },
            },
            create: {
              id: `ars_${randomUUID()}`,
              authoritativeRecordDeclarationId: declaration.id,
              settlementSagaId: repair.reconciliationBreak.settlementSagaId,
              snapshotKind: "AFTER",
              recordReference: validated.externalReference,
              payloadDigest: String(observed.afterDigest),
              evidenceObjectId: validated.evidenceObjectId,
              sourceAsOfAt: validated.observedAt,
              recordedByUserId: repair.proposedByUserId,
            },
            update: {},
          });
        }
        await tx.sagaRepairAction.update({
          where: { id: repair.id },
          data: {
            status: "APPLIED",
            appliedAt: new Date(),
            appliedObservationId: observation.id,
          },
        });
        const resolved = await tx.reconciliationBreak.updateMany({
          where: { id: breakId, status: "REPAIR_PROPOSED" },
          data: {
            status: "RESOLVED",
            resolutionEvidenceRef: validated.externalReference,
            resolutionEvidenceDigest: validated.observationDigest,
            resolutionReason: repair.reason,
            resolvedByUserId: repair.proposedByUserId,
            independentlyClosedByUserId: actor.actorUserId,
            resolvedAt: new Date(),
          },
        });
        if (resolved.count !== 1)
          throw new ConflictException(
            "reconciliation break changed concurrently"
          );
        const changedLeg = await tx.settlementLeg.updateMany({
          where: {
            id: repair.reconciliationBreak.settlementLegId!,
            state: "BREAK_OPEN",
            currentObservationVersion:
              repair.reconciliationBreak.settlementLeg!
                .currentObservationVersion,
          },
          data: {
            state: "OBSERVED",
            currentObservationVersion: observation.version,
          },
        });
        if (changedLeg.count !== 1)
          throw new ConflictException("saga leg changed concurrently");
        const state = await this.refreshSagaState(
          tx,
          repair.reconciliationBreak.settlementSagaId
        );
        await tx.transactionCase.update({
          where: { id: caseId },
          data: {
            aggregateVersion: { increment: 1 },
            routeState: `DA_REPLAY_SAGA_${state}`,
          },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event: "rail.da_replay.repair_applied",
          detail: {
            caseId,
            breakId,
            repairId,
            observationId: observation.id,
            reviewReason,
            authorityMandateId: authority.mandateId,
          },
        });
        return tx.settlementSaga.findUniqueOrThrow({
          where: { id: repair.reconciliationBreak.settlementSagaId },
          include: this.sagaInclude(),
        });
      });
    } catch (error) {
      const replay = await this.db.sagaRepairAction.findUnique({
        where: { id: repairId },
      });
      if (
        replay?.reviewIdempotencyKey === idempotencyKey &&
        replay.reviewRequestDigest === requestDigest &&
        replay.status === "APPLIED"
      ) {
        return this.loadSaga(repair.reconciliationBreak.settlementSagaId);
      }
      throw error;
    }
  }

  async comparison(actor: RoomActor, caseId: string, sagaId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    const saga = await this.loadSaga(sagaId);
    if (saga.transactionCaseId !== caseId)
      throw new NotFoundException("DA replay saga not found");
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
        differences: current
          ? (current.comparison as Record<string, unknown>).differences ?? []
          : [],
      };
    });
    const summary = {
      sagaId,
      caseId,
      executionMode: saga.executionMode,
      sagaState: saga.state,
      routePackRef: saga.routePackRef,
      routePackVersion: saga.routePackVersion,
      historicOutcomeRef: saga.historicOutcomeRef,
      matched: rows.filter((row) => row.comparisonResult === "MATCHED").length,
      breaks: rows.filter((row) => row.comparisonResult === "BREAK_OPEN")
        .length,
      notObserved: rows.filter((row) => row.comparisonResult === "NOT_OBSERVED")
        .length,
      rows,
    };
    return { ...summary, reportDigest: sha256Digest(summary) };
  }

  async comparisonCsv(
    actor: RoomActor,
    caseId: string,
    sagaId: string
  ): Promise<string> {
    const report = await this.comparison(actor, caseId, sagaId);
    const header = [
      "sequence",
      "legKey",
      "legType",
      "ownerInstitutionId",
      "state",
      "comparisonResult",
      "expectedDigest",
      "observedDigest",
      "externalReference",
      "differences",
    ];
    const lines = [
      header,
      ...report.rows.map((row) => [
        row.sequence,
        row.legKey,
        row.legType,
        row.ownerInstitutionId,
        row.state,
        row.comparisonResult,
        row.expectedDigest,
        row.observedDigest ?? "",
        row.externalReference ?? "",
        JSON.stringify(row.differences),
      ]),
    ];
    return `${lines
      .map((line) => line.map((cell) => daReplayCsvCell(cell)).join(","))
      .join("\n")}\n`;
  }

  async evidencePack(actor: RoomActor, caseId: string, sagaId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    const [saga, transactionCase, declaration, breaks, comparison] =
      await Promise.all([
        this.loadSaga(sagaId),
        this.db.transactionCase.findUnique({
          where: { id: caseId },
          include: {
            parties: true,
            functionAssignments: true,
            decisions: { include: { approvals: true } },
            transitions: true,
          },
        }),
        this.db.authoritativeRecordDeclaration.findUnique({
          where: { transactionCaseId: caseId },
          include: { snapshots: { orderBy: { sourceAsOfAt: "asc" } } },
        }),
        this.db.reconciliationBreak.findMany({
          where: { transactionCaseId: caseId },
          include: { repairActions: true },
          orderBy: { createdAt: "asc" },
        }),
        this.comparison(actor, caseId, sagaId),
      ]);
    if (!transactionCase || saga.transactionCaseId !== caseId)
      throw new NotFoundException("DA replay saga not found");
    const pack = toCanonicalValue(
      JSON.parse(
        JSON.stringify({
          schemaId: "assurerail.conventional-da-replay-evidence-pack",
          schemaVersion: "1.0.0",
          executionMode: "OBSERVE_ONLY",
          mutationStatement:
            "NO_MONEY_TITLE_REGISTER_OR_NOTICE_ACTION_DISPATCHED",
          transactionCase,
          saga,
          authoritativeRecord: declaration,
          reconciliationBreaks: breaks,
          comparison,
        })
      )
    );
    return {
      generatedAt: new Date().toISOString(),
      evidencePack: pack,
      evidencePackDigest: sha256Digest(pack),
    };
  }

  private async persistObservation(
    actor: RoomActor,
    mandateId: string,
    leg: LoadedLeg,
    validated: Awaited<ReturnType<DaReplayService["validateObservation"]>>
  ) {
    const existing = await this.db.sagaLegObservation.findUnique({
      where: {
        settlementLegId_idempotencyKey: {
          settlementLegId: leg.id,
          idempotencyKey: validated.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestDigest !== validated.requestDigest)
        throw new ConflictException(
          "observation idempotency key was reused with different content"
        );
      return this.loadSaga(leg.settlementSagaId);
    }
    if (leg.currentObservationVersion > 0 || leg.state !== "PLANNED") {
      throw new ConflictException(
        "a recorded leg can be changed only through a maker-checker repair; history is never overwritten"
      );
    }
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume(
          {
            evidenceId: validated.stepUpEvidenceId,
            userId: actor.actorUserId,
            sessionId: actor.actorSessionId,
            purpose: "DA_REPLAY_OBSERVATION_RECORD",
            institutionId: actor.actingInstitutionId,
          },
          tx
        );
        const observation = await this.insertObservation(
          tx,
          leg,
          validated,
          actor.actorUserId
        );
        const nextLegState =
          validated.comparison.result === "MATCHED" ? "OBSERVED" : "BREAK_OPEN";
        const changed = await tx.settlementLeg.updateMany({
          where: {
            id: leg.id,
            currentObservationVersion: leg.currentObservationVersion,
          },
          data: {
            state: nextLegState,
            currentObservationVersion: observation.version,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException("saga leg changed concurrently");
        if (validated.comparison.result === "BREAK_OPEN") {
          await tx.reconciliationBreak.create({
            data: {
              id: `rbreak_${randomUUID()}`,
              transactionCaseId: leg.settlementSaga.transactionCaseId,
              settlementSagaId: leg.settlementSagaId,
              settlementLegId: leg.id,
              breakCode: "DA_LEG_OBSERVATION_MISMATCH",
              severity: "CRITICAL",
              expected: validated.comparison
                .expected as unknown as Prisma.InputJsonValue,
              observed: validated.comparison
                .observed as unknown as Prisma.InputJsonValue,
              expectedDigest: validated.comparison.expectedDigest,
              observedDigest: validated.comparison.observedDigest,
              blockedCapabilities: json([
                "CASE_COMPLETION",
                "SAGA_RECONCILIATION",
              ]),
              ownerInstitutionId: leg.participantOwnerInstitutionId,
              dueAt: new Date(Date.now() + 4 * 60 * 60 * 1_000),
              openedByUserId: actor.actorUserId,
            },
          });
        }
        if (
          leg.legType === "AUTHORITATIVE_REGISTER_UPDATE" &&
          validated.comparison.result === "MATCHED"
        ) {
          const declaration =
            await tx.authoritativeRecordDeclaration.findUniqueOrThrow({
              where: {
                transactionCaseId: leg.settlementSaga.transactionCaseId,
              },
            });
          const observed = validated.observation as Readonly<
            Record<string, unknown>
          >;
          await tx.authoritativeRecordSnapshot.upsert({
            where: {
              settlementSagaId_snapshotKind: {
                settlementSagaId: leg.settlementSagaId,
                snapshotKind: "AFTER",
              },
            },
            create: {
              id: `ars_${randomUUID()}`,
              authoritativeRecordDeclarationId: declaration.id,
              settlementSagaId: leg.settlementSagaId,
              snapshotKind: "AFTER",
              recordReference: validated.externalReference,
              payloadDigest: String(observed.afterDigest),
              evidenceObjectId: validated.evidenceObjectId,
              sourceAsOfAt: validated.observedAt,
              recordedByUserId: actor.actorUserId,
            },
            update: {},
          });
        }
        const state = await this.refreshSagaState(tx, leg.settlementSagaId);
        await tx.transactionCase.update({
          where: { id: leg.settlementSaga.transactionCaseId },
          data: {
            aggregateVersion: { increment: 1 },
            routeState: `DA_REPLAY_SAGA_${state}`,
          },
        });
        await appendGovernedAudit(tx, {
          actor: this.actorRef(actor),
          event:
            validated.comparison.result === "MATCHED"
              ? "rail.da_replay.observation_matched"
              : "rail.da_replay.break_opened",
          detail: {
            caseId: leg.settlementSaga.transactionCaseId,
            sagaId: leg.settlementSagaId,
            legId: leg.id,
            observationId: observation.id,
            observationDigest: validated.observationDigest,
            comparisonResult: validated.comparison.result,
            differenceCount: validated.comparison.differences.length,
            authorityMandateId: mandateId,
          },
        });
        return tx.settlementSaga.findUniqueOrThrow({
          where: { id: leg.settlementSagaId },
          include: this.sagaInclude(),
        });
      });
    } catch (error) {
      const replay = await this.db.sagaLegObservation.findUnique({
        where: {
          settlementLegId_idempotencyKey: {
            settlementLegId: leg.id,
            idempotencyKey: validated.idempotencyKey,
          },
        },
      });
      if (replay?.requestDigest === validated.requestDigest)
        return this.loadSaga(leg.settlementSagaId);
      throw error;
    }
  }

  private async insertObservation(
    tx: Prisma.TransactionClient,
    leg: LoadedLeg,
    validated: Awaited<ReturnType<DaReplayService["validateObservation"]>>,
    recordedByUserId: string
  ) {
    const version = leg.currentObservationVersion + 1;
    return tx.sagaLegObservation.create({
      data: {
        id: `sobs_${randomUUID()}`,
        settlementLegId: leg.id,
        version,
        idempotencyKey: validated.idempotencyKey,
        requestDigest: validated.requestDigest,
        observation: validated.observation as unknown as Prisma.InputJsonValue,
        observationDigest: validated.observationDigest,
        externalReference: validated.externalReference,
        finalityClass: validated.finalityClass,
        signatureStatus: validated.signatureStatus,
        evidenceObjectId: validated.evidenceObjectId,
        observedAt: validated.observedAt,
        recordedByUserId,
        recordedByMandateId: validated.mandateId,
        comparisonResult: validated.comparison.result,
        comparison: json(validated.comparison),
      },
    });
  }

  private async validateObservation(
    caseId: string,
    leg: LoadedLeg | LoadedLeg["settlementSaga"]["legs"][number],
    body: ObservationBody,
    institutionId: string,
    mandateId: string,
    consumeObservationStepUp = true
  ) {
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const externalReference = required(
      body.externalReference,
      "externalReference",
      500
    );
    const finalityClass = oneOf(
      body.finalityClass,
      "finalityClass",
      FINALITY_CLASSES
    );
    const signatureStatus = oneOf(
      body.signatureStatus,
      "signatureStatus",
      SIGNATURE_STATUSES
    );
    const observedAt = date(body.observedAt, "observedAt");
    if (observedAt.getTime() > Date.now() + 5 * 60 * 1_000)
      throw new BadRequestException(
        "observedAt cannot be materially in the future"
      );
    const evidence = await this.requireEvidence(
      required(body.evidenceObjectId, "evidenceObjectId", 160),
      caseId,
      institutionId,
      null
    );
    const observation = toCanonicalValue(body.observed ?? {});
    const comparison = compareDaLegObservation(leg.expected, observation);
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = consumeObservationStepUp
      ? required(body.stepUpEvidenceId, "stepUpEvidenceId", 160)
      : optional(body.stepUpEvidenceId, "stepUpEvidenceId", 160) ??
        "REPAIR_REVIEW_STEP_UP";
    const requestDigest = commandDigest("DA_REPLAY_OBSERVATION_RECORD", {
      caseId,
      sagaId: leg.settlementSagaId,
      legId: leg.id,
      ...body,
    });
    return {
      idempotencyKey,
      externalReference,
      finalityClass,
      signatureStatus,
      observedAt,
      evidenceObjectId: evidence.id,
      observation,
      observationDigest: sha256Digest(observation),
      comparison,
      reason,
      stepUpEvidenceId,
      requestDigest,
      mandateId,
    };
  }

  private async requireEvidence(
    evidenceObjectId: string,
    caseId: string,
    institutionId: string,
    evidenceType: string | null
  ) {
    const item = await this.db.evidenceObject.findUnique({
      where: { id: evidenceObjectId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const latest = item?.versions[0];
    if (
      !item ||
      item.transactionCaseId !== caseId ||
      item.institutionId !== institutionId ||
      item.status !== "AVAILABLE" ||
      (evidenceType && item.evidenceType !== evidenceType) ||
      !latest ||
      latest.validationStatus !== "VALID" ||
      latest.signatureStatus !== "VERIFIED" ||
      latest.result !== "VERIFIED" ||
      (latest.expiresAt && latest.expiresAt <= new Date())
    ) {
      throw new BadRequestException(
        `evidence must be current, signed, valid, available, case-scoped and owned by ${institutionId}${
          evidenceType ? ` with type ${evidenceType}` : ""
        }`
      );
    }
    return { id: item.id, payloadDigest: latest.payloadDigest };
  }

  private async assertPriorLegsObserved(
    sagaId: string,
    sequence: number
  ): Promise<void> {
    const pending = await this.db.settlementLeg.findFirst({
      where: {
        settlementSagaId: sagaId,
        required: true,
        sequence: { lt: sequence },
        state: { notIn: ["OBSERVED", "RECONCILED"] },
      },
      orderBy: { sequence: "asc" },
    });
    if (pending)
      throw new ConflictException(
        `prior required leg is not observed: ${pending.legKey}`
      );
  }

  private async refreshSagaState(tx: Prisma.TransactionClient, sagaId: string) {
    const [legs, openBreaks] = await Promise.all([
      tx.settlementLeg.findMany({
        where: { settlementSagaId: sagaId },
        select: { required: true, state: true },
      }),
      tx.reconciliationBreak.count({
        where: { settlementSagaId: sagaId, status: { not: "RESOLVED" } },
      }),
    ]);
    const state = deriveDaSagaState(legs, openBreaks);
    await tx.settlementSaga.update({
      where: { id: sagaId },
      data: { state, reconciledAt: state === "RECONCILED" ? new Date() : null },
    });
    return state;
  }

  private async requireLeg(caseId: string, sagaId: string, legId: string) {
    const leg = await this.db.settlementLeg.findUnique({
      where: { id: legId },
      include: {
        settlementSaga: { include: { legs: true } },
        observations: {
          include: { appliedRepairs: true },
          orderBy: { version: "asc" },
        },
      },
    });
    if (
      !leg ||
      leg.settlementSagaId !== sagaId ||
      leg.settlementSaga.transactionCaseId !== caseId
    )
      throw new NotFoundException("DA replay saga leg not found");
    return leg;
  }

  private async requireCase(
    actor: RoomActor,
    caseId: string,
    action: "VIEW_CASE" | "OPERATE_CASE"
  ) {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({
      where: { id: caseId },
      include: { parties: true },
    });
    if (!transactionCase)
      throw new NotFoundException("transaction case not found");
    const participant =
      transactionCase.ownerInstitutionId === actor.actingInstitutionId ||
      transactionCase.parties.some(
        (party) =>
          party.institutionId === actor.actingInstitutionId &&
          party.status === "ACTIVE"
      );
    if (!participant) throw new NotFoundException("transaction case not found");
    const authority = await this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action,
      scopeType: "TRANSACTION_CASE",
      scopeRef: caseId,
    });
    return { transactionCase, authority };
  }

  private async requireOwner(actor: RoomActor, caseId: string) {
    const result = await this.requireCase(actor, caseId, "OPERATE_CASE");
    if (result.transactionCase.ownerInstitutionId !== actor.actingInstitutionId)
      throw new ForbiddenException("only the case owner may govern DA replay");
    return result;
  }

  private assertDaRoute(transactionCase: {
    transactionRoute: string;
    representation: string;
    jurisdiction: string;
    marketContext: string;
    placementOrListing: string;
    lifecycleLeg: string;
    operatingMode: string;
    routePackRef: string;
    routePackVersion: string;
  }): void {
    const checks = [
      [
        transactionCase.transactionRoute,
        CONVENTIONAL_DA_ROUTE_PACK.transactionRoute,
        "transactionRoute",
      ],
      [
        transactionCase.representation,
        CONVENTIONAL_DA_ROUTE_PACK.representation,
        "representation",
      ],
      [
        transactionCase.jurisdiction,
        CONVENTIONAL_DA_ROUTE_PACK.jurisdiction,
        "jurisdiction",
      ],
      [
        transactionCase.marketContext,
        CONVENTIONAL_DA_ROUTE_PACK.marketContext,
        "marketContext",
      ],
      [
        transactionCase.placementOrListing,
        CONVENTIONAL_DA_ROUTE_PACK.placementOrListing,
        "placementOrListing",
      ],
      [
        transactionCase.lifecycleLeg,
        CONVENTIONAL_DA_ROUTE_PACK.lifecycleLeg,
        "lifecycleLeg",
      ],
      [
        transactionCase.routePackRef,
        CONVENTIONAL_DA_ROUTE_PACK.ref,
        "routePackRef",
      ],
      [
        transactionCase.routePackVersion,
        CONVENTIONAL_DA_ROUTE_PACK.version,
        "routePackVersion",
      ],
    ];
    const mismatch = checks.find(
      ([observed, expected]) => observed !== expected
    );
    if (mismatch)
      throw new BadRequestException(
        `case ${mismatch[2]} is outside the conventional DA replay route pack`
      );
    if (
      !CONVENTIONAL_DA_ROUTE_PACK.operatingModes.includes(
        transactionCase.operatingMode as "REPLAY" | "SHADOW"
      )
    ) {
      throw new BadRequestException(
        "DA replay is available only in REPLAY or SHADOW case mode"
      );
    }
  }

  private async daParties(caseId: string): Promise<Map<string, string>> {
    const parties = await this.db.caseParty.findMany({
      where: { transactionCaseId: caseId, status: "ACTIVE" },
    });
    const map = new Map(
      parties.map((party) => [party.partyRole, party.institutionId])
    );
    for (const role of CONVENTIONAL_DA_ROUTE_PACK.requiredPartyRoles) {
      if (!map.has(role))
        throw new ConflictException(
          `DA route requires an active ${role} party`
        );
    }
    if (map.get("TRANSFEROR") === map.get("TRANSFEREE"))
      throw new ConflictException(
        "transferor and transferee must be distinct institutions"
      );
    return map;
  }

  private async assertRouteFoundation(caseId: string): Promise<void> {
    await this.daParties(caseId);
    const now = new Date();
    const assignments = await this.db.caseFunctionAssignment.findMany({
      where: {
        transactionCaseId: caseId,
        status: "ACTIVE",
        AND: [
          { OR: [{ effectiveAt: null }, { effectiveAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
    });
    for (const materialFunction of [
      "EXECUTION",
      "CASH_SETTLEMENT",
      "AUTHORITATIVE_REGISTER_UPDATE",
    ]) {
      const assignment = assignments.find(
        (item) => item.materialFunction === materialFunction
      );
      if (!assignment || assignment.performer === "PROHIBITED")
        throw new ConflictException(
          `DA route requires a permitted ${materialFunction} function assignment`
        );
    }
  }

  private async assertRecordkeeper(
    caseId: string,
    institutionId: string
  ): Promise<void> {
    const now = new Date();
    const [institution, assignment] = await Promise.all([
      this.db.institution.findUnique({
        where: { id: institutionId },
        include: { admission: true },
      }),
      this.db.caseFunctionAssignment.findUnique({
        where: {
          transactionCaseId_materialFunction: {
            transactionCaseId: caseId,
            materialFunction: "AUTHORITATIVE_REGISTER_UPDATE",
          },
        },
      }),
    ]);
    if (
      !institution ||
      institution.status !== "ACTIVE" ||
      institution.admission?.status !== "ADMITTED"
    ) {
      throw new BadRequestException(
        "authoritative recordkeeper must be an admitted active institution"
      );
    }
    if (
      !assignment ||
      assignment.status !== "ACTIVE" ||
      (assignment.effectiveAt && assignment.effectiveAt > now) ||
      (assignment.expiresAt && assignment.expiresAt <= now) ||
      assignment.performerInstitutionId !== institutionId ||
      !["PARTICIPANT_OWNED", "EXTERNAL_AUTHORITY"].includes(
        assignment.performer
      )
    ) {
      throw new BadRequestException(
        "authoritative recordkeeper must match the active route function assignment"
      );
    }
  }

  private loadSaga(sagaId: string) {
    return this.db.settlementSaga.findUniqueOrThrow({
      where: { id: sagaId },
      include: this.sagaInclude(),
    });
  }

  private sagaInclude() {
    return {
      legs: {
        orderBy: { sequence: "asc" as const },
        include: {
          observations: {
            orderBy: { version: "asc" as const },
            include: { appliedRepairs: true },
          },
        },
      },
      recordSnapshots: { orderBy: { sourceAsOfAt: "asc" as const } },
      breaks: {
        orderBy: { createdAt: "asc" as const },
        include: { repairActions: { orderBy: { proposedAt: "asc" as const } } },
      },
    };
  }

  private actorRef(actor: RoomActor): string {
    return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`;
  }
}
