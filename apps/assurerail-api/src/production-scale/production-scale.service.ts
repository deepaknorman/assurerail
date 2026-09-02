import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { evaluateInternalEnforcementCoverage } from "../internal-access/internal-access-readiness";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import {
  EXTERNAL_GATE_CODES,
  type ActivationManifestV1,
} from "../runtime/activation-manifest";
import { PrismaService } from "../store/prisma.service";
import {
  PRODUCTION_SCALE_BOUNDARY,
  PRODUCTION_SCALE_CONTROL_FAMILIES,
  PRODUCTION_SCALE_TARGETS,
  blockerCount,
  classifyOpenGateCodes,
  deriveProductionScaleState,
  requiredGateCodes,
  type ProductionScaleBlockers,
  type ProductionScaleTarget,
} from "./production-scale-policy";

const BUILD_COMMIT = /^[a-f0-9]{40}$/;
const MAX_ASSESSMENT_REVIEW_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_CONTROL_OBSERVATION_AGE_MS = 24 * 60 * 60 * 1_000;

export interface ProductionScaleActor {
  userId: string;
  sessionId: string;
  authorityRef: string;
}

function enabled(): void {
  if (inspectPersistenceFlags(process.env).productionScale !== "shadow") {
    throw new ForbiddenException("production-scale command centre is disabled");
  }
}

function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${name} is required`);
  }
  const text = value.trim();
  if (text.length > max)
    throw new BadRequestException(`${name} exceeds ${max} characters`);
  return text;
}

function target(value: unknown): ProductionScaleTarget {
  const parsed = required(value, "targetOperatingMode", 40).toUpperCase();
  if (!(PRODUCTION_SCALE_TARGETS as readonly string[]).includes(parsed)) {
    throw new BadRequestException(
      "targetOperatingMode must be CONTROLLED_LIVE or PRODUCTION"
    );
  }
  return parsed as ProductionScaleTarget;
}

function buildCommit(value: unknown): string {
  const parsed = required(value, "buildCommit", 40).toLowerCase();
  if (!BUILD_COMMIT.test(parsed)) {
    throw new BadRequestException(
      "buildCommit must be an exact lowercase 40-character Git commit"
    );
  }
  return parsed;
}

function authorityRef(actor: ProductionScaleActor): string {
  return required(actor.authorityRef, "authorityRef", 200);
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value) as unknown as Prisma.InputJsonValue;
}

function currentGate(gate: any, now: Date): boolean {
  return (
    gate.status === "ACCEPTED" &&
    gate.currentDecision &&
    gate.currentDecisionId === gate.currentDecision.id &&
    gate.currentDecision.decision === "ACCEPT" &&
    gate.currentDecision.evidenceClass === gate.evidenceClassRequired &&
    (!EXTERNAL_GATE_CODES.has(gate.gateCode) ||
      gate.currentDecision.evidenceClass === "EXTERNAL") &&
    gate.currentDecision.validFrom <= now &&
    gate.currentDecision.expiresAt > now &&
    gate.expiresAt &&
    gate.expiresAt > now &&
    gate.currentEvidenceDigest === gate.currentDecision.evidenceDigest &&
    gate.currentEvidenceRef === gate.currentDecision.evidenceRef
  );
}

function currentActivation(
  activation: any,
  expectedBuild: string,
  now: Date
): boolean {
  if (
    !activation ||
    activation.status !== "APPROVED" ||
    !activation.approvedAt ||
    activation.buildCommit !== expectedBuild ||
    activation.expiresAt <= now
  ) {
    return false;
  }
  if (sha256Digest(activation.manifest) !== activation.manifestDigest)
    return false;
  const manifest = activation.manifest as ActivationManifestV1;
  if (
    manifest.manifestId !== activation.manifestId ||
    manifest.environment !== activation.environment ||
    manifest.operatingMode !== activation.operatingMode ||
    manifest.buildCommit !== activation.buildCommit ||
    !Array.isArray(manifest.gates) ||
    manifest.gates.length !== activation.gateBindings.length
  )
    return false;
  const expectedCodes = requiredGateCodes(manifest.operatingMode);
  if (
    expectedCodes.length !== manifest.gates.length ||
    expectedCodes.some(
      (code) => !manifest.gates.some((gate) => gate.code === code)
    )
  ) {
    return false;
  }
  return activation.gateBindings.every((binding: any) => {
    const manifestGate = manifest.gates.find(
      (gate) => gate.code === binding.gateCode
    );
    return (
      currentGate(
        {
          ...binding.readinessGate,
          currentDecision: binding.readinessDecision,
          currentDecisionId: binding.readinessDecisionId,
        },
        now
      ) &&
      binding.evidenceDigest === binding.readinessDecision.evidenceDigest &&
      manifestGate?.scopeKey === binding.scopeKey &&
      manifestGate?.decisionRef === binding.readinessDecisionId &&
      manifestGate?.evidenceDigest === binding.evidenceDigest
    );
  });
}

@Injectable()
export class ProductionScaleService {
  constructor(
    private readonly db: PrismaService,
    private readonly stepUp: StepUpService
  ) {}

  catalogue() {
    enabled();
    return {
      version: "1.0.0",
      targets: PRODUCTION_SCALE_TARGETS,
      controlFamilies: PRODUCTION_SCALE_CONTROL_FAMILIES,
      requiredGates: {
        CONTROLLED_LIVE: requiredGateCodes("CONTROLLED_LIVE"),
        PRODUCTION: requiredGateCodes("PRODUCTION"),
      },
      boundary: PRODUCTION_SCALE_BOUNDARY,
    };
  }

  async board(input: {
    environment?: unknown;
    targetOperatingMode?: unknown;
    buildCommit?: unknown;
  }) {
    enabled();
    const environment = required(
      input.environment ?? process.env.ASSURERAIL_ENVIRONMENT,
      "environment",
      120
    );
    const targetOperatingMode = target(
      input.targetOperatingMode ?? "CONTROLLED_LIVE"
    );
    const exactBuildCommit = buildCommit(
      input.buildCommit ?? process.env.ASSURERAIL_BUILD_COMMIT
    );
    const now = new Date();
    const requiredCodes = requiredGateCodes(targetOperatingMode);

    const [
      gates,
      activation,
      criticalOpsFindings,
      opsControl,
      openSettlementBreaks,
      openTokenBreaks,
      openLifecycleBreaks,
      openSecondaryBreaks,
      openRoomParityBreaks,
      deadLetterMessages,
      capacityBudgets,
      overdueCriticalSupport,
      assignments,
    ] = await Promise.all([
      this.db.operationalReadinessGate.findMany({
        where: { environment, gateCode: { in: [...requiredCodes] } },
        include: { currentDecision: true },
        orderBy: [{ gateCode: "asc" }, { requirementVersion: "desc" }],
      }),
      this.db.deploymentActivation.findFirst({
        where: {
          environment,
          operatingMode: targetOperatingMode,
          status: "APPROVED",
        },
        include: {
          gateBindings: {
            include: { readinessGate: true, readinessDecision: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.db.opsFinding.count({
        where: { status: "OPEN", severity: "CRITICAL" },
      }),
      this.db.opsControl.findUnique({ where: { id: "singleton" } }),
      this.db.reconciliationBreak.count({
        where: { status: { not: "RESOLVED" } },
      }),
      this.db.tokenReconciliationBreak.count({ where: { status: "OPEN" } }),
      this.db.railLifecycleBreak.count({ where: { status: "OPEN" } }),
      this.db.secondaryTransferBreak.count({ where: { status: "OPEN" } }),
      this.db.roomParityBreak.count({ where: { status: { not: "RESOLVED" } } }),
      this.db.outboxMessage.count({ where: { state: "DEAD_LETTER" } }),
      this.db.venueCapacityBudget.findMany({
        where: {
          environment,
          status: "ACTIVE",
          effectiveFrom: { lte: now },
          expiresAt: { gt: now },
        },
        include: { observations: { orderBy: { observedAt: "desc" }, take: 1 } },
      }),
      this.db.customerServiceRequest.count({
        where: {
          priority: "CRITICAL",
          status: {
            in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_CUSTOMER"],
          },
          slaDueAt: { lt: now },
        },
      }),
      this.db.internalRoleAssignment.findMany({
        where: { status: "ACTIVE", scopeType: "GLOBAL" },
        include: {
          user: { select: { status: true, identityVerifiedAt: true } },
        },
      }),
    ]);

    const latestByScopeAndCode = new Map<string, any>();
    for (const gate of gates) {
      const key = `${gate.scopeKey}|${gate.gateCode}`;
      if (!latestByScopeAndCode.has(key)) latestByScopeAndCode.set(key, gate);
    }
    const latestGates = [...latestByScopeAndCode.values()];
    const gateRows = requiredCodes.map((code) => {
      const candidates = latestGates.filter((gate) => gate.gateCode === code);
      const accepted = candidates.filter((gate) => currentGate(gate, now));
      return {
        code,
        evidenceClass: candidates[0]?.evidenceClassRequired ?? null,
        currentAcceptedScopeCount: accepted.length,
        recordedScopeCount: candidates.length,
        current: accepted.length > 0,
      };
    });
    const openGateCodes = gateRows
      .filter((gate) => !gate.current)
      .map((gate) => gate.code);
    const blockers: ProductionScaleBlockers = {
      criticalOpsFindings,
      opsKillSwitchEngaged: opsControl?.killSwitch ? 1 : 0,
      opsSweepMissingOrStale:
        !opsControl?.lastSweepAt ||
        now.getTime() - opsControl.lastSweepAt.getTime() >
          MAX_CONTROL_OBSERVATION_AGE_MS
          ? 1
          : 0,
      openSettlementBreaks,
      openTokenBreaks,
      openLifecycleBreaks,
      openSecondaryBreaks,
      openRoomParityBreaks,
      deadLetterMessages,
      hardCapacityObservations: capacityBudgets.filter(
        (budget) => budget.observations[0]?.state === "HARD_LIMIT"
      ).length,
      activeCapacityBudgetsMissing: capacityBudgets.length === 0 ? 1 : 0,
      capacityObservationMissingOrStale: capacityBudgets.filter(
        (budget) =>
          !budget.observations[0]?.observedAt ||
          now.getTime() - budget.observations[0].observedAt.getTime() >
            MAX_CONTROL_OBSERVATION_AGE_MS
      ).length,
      overdueCriticalSupport,
      internalCoverageErrors: evaluateInternalEnforcementCoverage(
        assignments,
        now
      ),
    };
    const activationPresent = Boolean(activation?.status === "APPROVED");
    const activationIsCurrent = currentActivation(
      activation,
      exactBuildCommit,
      now
    );
    const boardState = deriveProductionScaleState({
      openGateCodes,
      blockers,
      activationPresent,
      activationCurrent: activationIsCurrent,
    });
    const classifiedOpenGates = classifyOpenGateCodes(openGateCodes);
    const controlFacts = {
      environment,
      targetOperatingMode,
      buildCommit: exactBuildCommit,
      gateRows,
      openGates: classifiedOpenGates,
      blockers,
      blockerCount: blockerCount(blockers),
      activation: activation
        ? {
            id: activation.id,
            manifestId: activation.manifestId,
            status: activation.status,
            buildCommit: activation.buildCommit,
            expiresAt: activation.expiresAt.toISOString(),
            current: activationIsCurrent,
          }
        : null,
      boardState,
    };
    const controlDigest = sha256Digest(controlFacts);
    return {
      version: "1.0.0",
      asOf: now.toISOString(),
      ...controlFacts,
      controlDigest,
      boundary: PRODUCTION_SCALE_BOUNDARY,
      note: "This internal assessment does not accept evidence, close a gate, approve a release or create authority.",
    };
  }

  list(environment?: string) {
    enabled();
    return this.db.productionScaleAssessment.findMany({
      where: environment ? { environment } : undefined,
      orderBy: { assessedAt: "desc" },
      take: 100,
      select: {
        id: true,
        environment: true,
        targetOperatingMode: true,
        buildCommit: true,
        deploymentActivationId: true,
        boardState: true,
        controlDigest: true,
        assessmentDigest: true,
        status: true,
        generatedByUserId: true,
        assessedAt: true,
        reviewedByUserId: true,
        reviewReason: true,
        reviewedAt: true,
      },
    });
  }

  async generate(actor: ProductionScaleActor, body: Record<string, unknown>) {
    enabled();
    const environment = required(
      body.environment ?? process.env.ASSURERAIL_ENVIRONMENT,
      "environment",
      120
    );
    const targetOperatingMode = target(body.targetOperatingMode);
    const exactBuildCommit = buildCommit(
      body.buildCommit ?? process.env.ASSURERAIL_BUILD_COMMIT
    );
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 160);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const requestDigest = sha256Digest({
      environment,
      targetOperatingMode,
      buildCommit: exactBuildCommit,
    });
    const existing = await this.db.productionScaleAssessment.findUnique({
      where: { environment_idempotencyKey: { environment, idempotencyKey } },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest) {
        throw new ConflictException(
          "idempotency key was used for a different production-scale assessment"
        );
      }
      return this.result(existing);
    }
    const board = await this.board({
      environment,
      targetOperatingMode,
      buildCommit: exactBuildCommit,
    });
    const assessment = toCanonicalValue(JSON.parse(JSON.stringify(board)));
    const assessmentDigest = sha256Digest(assessment);
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.userId,
          sessionId: actor.sessionId,
          purpose: "PRODUCTION_SCALE_ASSESS",
          institutionId: null,
        },
        tx
      );
      return tx.productionScaleAssessment.create({
        data: {
          id: `psa_${randomUUID()}`,
          environment,
          targetOperatingMode,
          buildCommit: exactBuildCommit,
          deploymentActivationId: board.activation?.id ?? null,
          boardState: board.boardState,
          assessment: json(assessment),
          controlDigest: board.controlDigest,
          assessmentDigest,
          idempotencyKey,
          requestDigest,
          generatedByUserId: actor.userId,
          generatorAuthorityRef: authorityRef(actor),
          generationStepUpId: stepUpEvidenceId,
        },
      });
    });
    audit("production.scale.assessed", {
      actorUserId: actor.userId,
      assessmentId: created.id,
      environment,
      targetOperatingMode,
      boardState: created.boardState,
    });
    return this.result(created);
  }

  async review(
    actor: ProductionScaleActor,
    assessmentId: string,
    body: Record<string, unknown>
  ) {
    enabled();
    const assessment = await this.db.productionScaleAssessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment)
      throw new NotFoundException("production-scale assessment not found");
    if (assessment.status !== "GENERATED")
      throw new ConflictException("assessment is no longer pending review");
    if (assessment.generatedByUserId === actor.userId) {
      throw new ForbiddenException(
        "assessment generator cannot review the same snapshot"
      );
    }
    if (
      Date.now() - assessment.assessedAt.getTime() >
      MAX_ASSESSMENT_REVIEW_AGE_MS
    ) {
      throw new ConflictException(
        "assessment is older than 24 hours; generate a fresh snapshot"
      );
    }
    const decision = required(body.decision, "decision", 20).toUpperCase();
    if (!["ACKNOWLEDGE", "REJECT"].includes(decision)) {
      throw new BadRequestException("decision must be ACKNOWLEDGE or REJECT");
    }
    const reason = required(body.reason, "reason", 2_000);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const current = await this.board({
      environment: assessment.environment,
      targetOperatingMode: assessment.targetOperatingMode,
      buildCommit: assessment.buildCommit,
    });
    if (
      decision === "ACKNOWLEDGE" &&
      current.controlDigest !== assessment.controlDigest
    ) {
      throw new ConflictException(
        "control state changed after assessment; generate a fresh snapshot"
      );
    }
    const reviewedAt = new Date();
    const reviewDigest = sha256Digest({
      assessmentId,
      assessmentDigest: assessment.assessmentDigest,
      decision,
      reason,
      reviewedByUserId: actor.userId,
      reviewedAt: reviewedAt.toISOString(),
    });
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.userId,
          sessionId: actor.sessionId,
          purpose: "PRODUCTION_SCALE_REVIEW",
          institutionId: null,
        },
        tx
      );
      const claimed = await tx.productionScaleAssessment.updateMany({
        where: {
          id: assessmentId,
          status: "GENERATED",
          reviewedByUserId: null,
        },
        data: {
          status: decision === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : "REJECTED",
          reviewedByUserId: actor.userId,
          reviewerAuthorityRef: authorityRef(actor),
          reviewStepUpId: stepUpEvidenceId,
          reviewReason: reason,
          reviewDigest,
          reviewedAt,
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException("assessment changed during review");
      return tx.productionScaleAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
      });
    });
    audit("production.scale.reviewed", {
      actorUserId: actor.userId,
      assessmentId,
      decision,
      boardState: updated.boardState,
    });
    return this.result(updated);
  }

  async evidencePack(assessmentId: string) {
    enabled();
    const item = await this.db.productionScaleAssessment.findUnique({
      where: { id: assessmentId },
    });
    if (!item)
      throw new NotFoundException("production-scale assessment not found");
    const payload = toCanonicalValue(
      JSON.parse(
        JSON.stringify({
          packVersion: "1.0.0",
          generatedAt: item.assessedAt.toISOString(),
          assessment: this.result(item),
          boundary: PRODUCTION_SCALE_BOUNDARY,
        })
      )
    );
    return { payload, manifestDigest: sha256Digest(payload) };
  }

  private result(item: any) {
    return {
      id: item.id,
      environment: item.environment,
      targetOperatingMode: item.targetOperatingMode,
      buildCommit: item.buildCommit,
      deploymentActivationId: item.deploymentActivationId,
      boardState: item.boardState,
      assessment: item.assessment,
      controlDigest: item.controlDigest,
      assessmentDigest: item.assessmentDigest,
      status: item.status,
      generatedByUserId: item.generatedByUserId,
      generatorAuthorityRef: item.generatorAuthorityRef,
      assessedAt: item.assessedAt,
      reviewedByUserId: item.reviewedByUserId,
      reviewerAuthorityRef: item.reviewerAuthorityRef,
      reviewReason: item.reviewReason,
      reviewDigest: item.reviewDigest,
      reviewedAt: item.reviewedAt,
      boundary: PRODUCTION_SCALE_BOUNDARY,
    };
  }
}
