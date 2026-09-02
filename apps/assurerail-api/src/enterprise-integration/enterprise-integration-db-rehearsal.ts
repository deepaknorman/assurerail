import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/assurerail-client";
import { sha256Digest } from "../contracts/v1";
import type { InstitutionAccessService } from "../institutions/institution-access.service";
import type { StepUpService } from "../institutions/step-up.service";
import type { PrismaService } from "../store/prisma.service";
import { EnterpriseIntegrationService } from "./enterprise-integration.service";

if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required for the disposable AR-29 rehearsal"
  );
process.env.ARAIL_ENTERPRISE_INTEGRATION_V1 = "shadow";
const db = new PrismaClient();
const institutionId = "ar29_institution";
const connectorId = "ar29_connector";
const caseId = "ar29_case";
const access = {
  requireHuman: async () => ({ mandateId: "ar29_mandate" }),
} as unknown as InstitutionAccessService;
const stepUp = { consume: async () => undefined } as unknown as StepUpService;
const service = new EnterpriseIntegrationService(
  db as unknown as PrismaService,
  access,
  stepUp
);
const maker = {
  actorUserId: "ar29_maker",
  actorSessionId: "ar29_maker_session",
  actingInstitutionId: institutionId,
};
const checker = {
  actorUserId: "ar29_checker",
  actorSessionId: "ar29_checker_session",
  actingInstitutionId: institutionId,
};

async function run() {
  await db.$connect();
  try {
    const now = new Date();
    const future = new Date(now.getTime() + 365 * 86_400_000);
    await db.institution.create({
      data: {
        id: institutionId,
        legalName: "AR29 synthetic lender",
        institutionKind: "SYNTHETIC_TEST_FIXTURE",
        jurisdiction: "IN",
        legalIdentifiers: {},
        status: "ACTIVE",
        applicantUserId: "ar29_applicant",
        admission: {
          create: {
            id: "ar29_admission",
            status: "ADMITTED",
            termsVersion: "synthetic",
            rulebookVersion: "synthetic",
            applicationDigest: sha256Digest("ar29"),
            effectiveAt: now,
            expiresAt: future,
          },
        },
      },
    });
    await db.connectorRegistration.create({
      data: {
        id: connectorId,
        institutionId,
        connectorKey: "lender-registry",
        connectorType: "REGISTRY",
        displayName: "Synthetic lender registry",
        transport: "API",
        schemaProfiles: ["assurerail.enterprise.lender-registry.v1"],
        status: "CERTIFIED_SHADOW",
        createdByUserId: maker.actorUserId,
      },
    });
    await db.developerConformanceRun.create({
      data: {
        id: "ar29_conformance",
        institutionId,
        connectorRegistrationId: connectorId,
        fixtureSetVersion: "synthetic-v1",
        schemaProfileRef: "assurerail.enterprise.lender-registry.v1",
        result: "PASSED_SOFTWARE",
        assertions: { synthetic: true },
        inputDigest: sha256Digest("input"),
        resultDigest: sha256Digest("result"),
        sandboxNonEvidence: true,
        createdByUserId: maker.actorUserId,
        createdByMandateId: "ar29_mandate",
        stepUpEvidenceId: "ar29_conformance_step",
      },
    });
    const profile = await service.proposeProfile(maker, {
      connectorRegistrationId: connectorId,
      connectorClass: "LENDER_REGISTRY",
      direction: "INBOUND",
      materialFunctions: ["SOURCE_DATA_PROVISION"],
      routeScope: ["DA", "CONVENTIONAL"],
      dataClassification: "CONFIDENTIAL",
      serviceLevel: { healthMaxAgeHours: 24 },
      reconciliationPolicy: { failClosed: true },
      authorityPolicy: { sourceRemainsAuthoritative: true },
      idempotencyKey: "ar29-profile",
      stepUpEvidenceId: "ar29_profile_step",
    });
    await service.attachConformance(maker, profile.id, {
      developerConformanceRunId: "ar29_conformance",
      stepUpEvidenceId: "ar29_software_step",
    });
    const gates = await db.enterpriseIntegrationGate.findMany({
      where: {
        enterpriseIntegrationProfileId: profile.id,
        gateKind: "EXTERNAL_EVIDENCE",
      },
      orderBy: { gateCode: "asc" },
    });
    for (const gate of gates) {
      const evidenceId = `ar29_ev_${gate.gateCode.toLowerCase()}`;
      const evidenceDigest = sha256Digest({ gateCode: gate.gateCode });
      await db.evidenceObject.create({
        data: {
          id: evidenceId,
          institutionId,
          evidenceType: `ENTERPRISE_INTEGRATION_${gate.gateCode}`,
          classification: "CONFIDENTIAL",
          purpose: `ENTERPRISE_INTEGRATION_GATE:${profile.id}:${gate.gateCode}`,
          status: "AVAILABLE",
          currentVersion: 1,
          retentionUntilAt: future,
          createdByUserId: checker.actorUserId,
          versions: {
            create: {
              id: `${evidenceId}_v1`,
              version: 1,
              schemaId: "assurerail.synthetic.ar29",
              schemaVersion: "1",
              payloadDigest: evidenceDigest,
              signatureStatus: "VERIFIED",
              result: "VERIFIED",
              sourceAsOfAt: now,
              expiresAt: future,
              qualifications: { synthetic: true },
              validationStatus: "VALID",
              validationDetail: { synthetic: true },
              createdByUserId: checker.actorUserId,
            },
          },
        },
      });
      await service.attachExternalEvidence(maker, profile.id, gate.gateCode, {
        evidenceObjectId: evidenceId,
        evidenceDigest,
        expiresAt: future.toISOString(),
        qualifications: ["SYNTHETIC_REHEARSAL_ONLY"],
        stepUpEvidenceId: `ar29_gate_${gate.gateCode}`,
      });
    }
    const healthDigest = sha256Digest({
      status: "HEALTHY",
      at: now.toISOString(),
    });
    await service.recordHealth(maker, profile.id, {
      observedStatus: "HEALTHY",
      source: "SYNTHETIC_MONITOR",
      sourceAsOfAt: now.toISOString(),
      evidenceDigest: healthDigest,
      detail: { synthetic: true },
      stepUpEvidenceId: "ar29_health_step",
    });
    assert.equal(
      (
        await service.recordHealth(maker, profile.id, {
          observedStatus: "HEALTHY",
          source: "SYNTHETIC_MONITOR",
          sourceAsOfAt: now.toISOString(),
          evidenceDigest: healthDigest,
          detail: { synthetic: true },
          stepUpEvidenceId: "ar29_health_retry",
        })
      ).sequence,
      1
    );
    await assert.rejects(
      service.reviewProfile(maker, profile.id, {
        decision: "APPROVE",
        reason: "self review",
        stepUpEvidenceId: "self",
      }),
      /cannot review/
    );
    await service.reviewProfile(checker, profile.id, {
      decision: "APPROVE",
      reason: "Independent synthetic shadow review",
      stepUpEvidenceId: "ar29_profile_review",
    });
    await db.transactionCase.create({
      data: {
        id: caseId,
        caseReference: "AR29-SYNTHETIC",
        ownerInstitutionId: institutionId,
        transactionRoute: "DA",
        representation: "CONVENTIONAL",
        jurisdiction: "IN",
        marketContext: "DOMESTIC",
        placementOrListing: "BILATERAL",
        lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
        assetClass: "RECEIVABLES",
        operatingMode: "SHADOW",
        routePackRef: "assurerail://route-packs/synthetic-da",
        routePackVersion: "1",
        status: "APPROVED_FOR_EXECUTION",
        creationIdempotencyKey: "ar29-case",
        creationRequestDigest: sha256Digest("case"),
        createdByUserId: maker.actorUserId,
        createdByMandateId: "ar29_mandate",
        functionAssignments: {
          create: {
            id: "ar29_assignment",
            materialFunction: "SOURCE_DATA_PROVISION",
            performer: "PARTICIPANT_OWNED",
            performerInstitutionId: institutionId,
            authorityEvidenceRef: "synthetic://authority",
            status: "ACTIVE",
            effectiveAt: now,
            expiresAt: future,
            createdByUserId: maker.actorUserId,
          },
        },
      },
    });
    const binding = await service.proposeCaseBinding(maker, caseId, {
      enterpriseIntegrationProfileId: profile.id,
      materialFunction: "SOURCE_DATA_PROVISION",
      idempotencyKey: "ar29-binding",
      stepUpEvidenceId: "ar29_binding_step",
    });
    await assert.rejects(
      service.reviewCaseBinding(maker, caseId, binding.id, {
        decision: "APPROVE",
        reason: "self review",
        stepUpEvidenceId: "self",
      }),
      /cannot review/
    );
    await service.reviewCaseBinding(checker, caseId, binding.id, {
      decision: "APPROVE",
      reason: "Independent binding review",
      stepUpEvidenceId: "ar29_binding_review",
    });
    const pack = await service.evidencePack(checker, profile.id);
    assert.match(pack.manifestDigest, /^sha256:/);
    await db.evidenceObject.update({
      where: { id: `ar29_ev_${gates[0].gateCode.toLowerCase()}` },
      data: { status: "QUARANTINED" },
    });
    const current = await service.listProfiles(checker);
    assert.equal(current[0].readiness.shadowReady, false);
    assert.equal(
      current[0].readiness.openGates[0].currentStatus,
      "REVIEW_REQUIRED"
    );
    const effectiveBinding = await service.listCaseBindings(checker, caseId);
    assert.equal(effectiveBinding[0].effectiveStatus, "SAFE_PAUSED");
    assert.equal(await db.externalInstruction.count(), 0);
    console.log(
      `[AR29-SERVICE-DB] PASS profile=${profile.id} gates=${
        gates.length + 1
      } maker-checker=true currentness-safe-pause=true binding=${
        binding.id
      } pack=${
        pack.manifestDigest
      } external-action=none synthetic-fixture-only=true`
    );
  } finally {
    await db.$disconnect();
  }
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
