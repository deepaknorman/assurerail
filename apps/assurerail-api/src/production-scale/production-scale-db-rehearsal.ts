import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/assurerail-client";
import type { StepUpService } from "../institutions/step-up.service";
import type { PrismaService } from "../store/prisma.service";
import { ProductionScaleService } from "./production-scale.service";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for the disposable AR-30 rehearsal"
  );
}

process.env.ARAIL_PRODUCTION_SCALE_V1 = "shadow";
process.env.ASSURERAIL_ENVIRONMENT = "ar30-rehearsal";
process.env.ASSURERAIL_BUILD_COMMIT = "a".repeat(40);

const db = new PrismaClient();
const stepUp = { consume: async () => undefined } as unknown as StepUpService;
const service = new ProductionScaleService(
  db as unknown as PrismaService,
  stepUp
);
const maker = {
  userId: "ar30_maker",
  sessionId: "ar30_maker_session",
  authorityRef: "assignment:ar30-maker",
};
const checker = {
  userId: "ar30_checker",
  sessionId: "ar30_checker_session",
  authorityRef: "assignment:ar30-checker",
};

async function run() {
  await db.$connect();
  try {
    const board = await service.board({
      targetOperatingMode: "PRODUCTION",
    });
    assert.equal(board.boardState, "OPEN_EXTERNAL_GATES");
    assert.ok(board.openGates.external.length > 0);
    assert.ok(board.openGates.internal.length > 0);
    assert.equal(board.activation, null);
    assert.equal(board.blockers.opsSweepMissingOrStale, 1);
    assert.equal(board.blockers.activeCapacityBudgetsMissing, 1);
    assert.ok(board.blockers.internalCoverageErrors.length > 0);
    assert.equal(board.boundary.assessmentIsActivation, false);
    assert.equal(board.boundary.syntheticExternalEvidenceAccepted, false);

    const assessment = await service.generate(maker, {
      targetOperatingMode: "PRODUCTION",
      idempotencyKey: "ar30-production-assessment",
      stepUpEvidenceId: "ar30-assess-step-up",
    });
    assert.equal(assessment.status, "GENERATED");
    assert.equal(assessment.boardState, "OPEN_EXTERNAL_GATES");
    assert.equal(assessment.deploymentActivationId, null);

    const replay = await service.generate(maker, {
      targetOperatingMode: "PRODUCTION",
      idempotencyKey: "ar30-production-assessment",
      stepUpEvidenceId: "ar30-assess-retry-step-up",
    });
    assert.equal(replay.id, assessment.id);
    await assert.rejects(
      service.review(maker, assessment.id, {
        decision: "ACKNOWLEDGE",
        reason: "self review is forbidden",
        stepUpEvidenceId: "ar30-self-review-step-up",
      }),
      /cannot review/
    );

    const reviewed = await service.review(checker, assessment.id, {
      decision: "ACKNOWLEDGE",
      reason:
        "Acknowledged only as an open-gate software rehearsal; no gate or activation is approved.",
      stepUpEvidenceId: "ar30-review-step-up",
    });
    assert.equal(reviewed.status, "ACKNOWLEDGED");
    assert.equal(reviewed.reviewedByUserId, checker.userId);

    const packOne = await service.evidencePack(assessment.id);
    const packTwo = await service.evidencePack(assessment.id);
    assert.equal(packOne.manifestDigest, packTwo.manifestDigest);
    assert.match(packOne.manifestDigest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(await db.deploymentActivation.count(), 0);
    assert.equal(await db.operationalReadinessDecision.count(), 0);
    assert.equal(await db.externalInstruction.count(), 0);
    console.log(
      `[AR30-SERVICE-DB] PASS state=${board.boardState} assessment=${assessment.id} independent-review=true deterministic-pack=${packOne.manifestDigest} external-gates-open=${board.openGates.external.length} internal-gates-open=${board.openGates.internal.length} activation=none external-action=none synthetic-fixture-only=true`
    );
  } finally {
    await db.$disconnect();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
