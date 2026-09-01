import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/assurerail-client";
import { sha256Digest } from "../contracts/v1";
import type { InstitutionAccessService } from "../institutions/institution-access.service";
import type { StepUpService } from "../institutions/step-up.service";
import type { RoomActor } from "../rooms/room-authority.service";
import type { PrismaService } from "../store/prisma.service";
import { SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1 } from "./fixtures/synthetic-conventional-ptc-replay-v1";
import { buildConventionalPtcFunctionAssignments } from "./ptc-route-pack";
import { PtcReplayService } from "./ptc-replay.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the disposable PR-10 rehearsal");

process.env.ASSURERAIL_OPERATING_MODE = "REPLAY";
process.env.ARAIL_PARTICIPANT_ADMISSION_V1 = "shadow";
process.env.ARAIL_NEUTRAL_INGRESS_V1 = "shadow";
process.env.ARAIL_TRANSACTION_CASE_V1 = "shadow";
process.env.ARAIL_EXTERNAL_ACTION_SAGA_V1 = "required";
process.env.ARAIL_PTC_REPLAY_V1 = "allow_list";

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const now = new Date();
const future = new Date(now.getTime() + 86_400_000);
const caseId = "ptc_service_case_10";
const userId = "ptc_service_user_10";
const mandateId = "ptc_service_mandate_10";
const actor: RoomActor = {
  actorUserId: userId,
  actorSessionId: "ptc_service_session_10",
  actingInstitutionId: SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId,
};

const access = {
  requireHuman: async () => ({ mandateId }),
} as unknown as InstitutionAccessService;
const stepUp = {
  consume: async () => ({ id: "consumed-step-up" }),
} as unknown as StepUpService;
const service = new PtcReplayService(db as unknown as PrismaService, access, stepUp);

const historicOutcomeDigest = sha256Digest({ synthetic: "PTC_REPLAY_V1", value: "historic-outcome" });
const evidenceRequirements = [
  ["PROGRAMME_OR_TRUST", "PROGRAMME_OR_TRUST", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.programmeTrust.programmeOrTrustEvidenceDigest],
  ["TRUSTEE_APPOINTMENT", "TRUSTEE_APPOINTMENT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.programmeTrust.trusteeAppointmentEvidenceDigest],
  ["POOL_TRANSFER", "POOL_TRANSFER", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.poolTransfer.poolTransferEvidenceDigest],
  ["POOL_ELIGIBILITY", "POOL_ELIGIBILITY", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.poolTransfer.poolEligibilityEvidenceDigest],
  ["COUNSEL_OPINION", "COUNSEL_OPINION", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.counsel!.providerInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.counsel!.opinionEvidenceDigest],
  ["RATING", "RATING_OR_EXTERNAL_REVIEW", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.rating!.providerInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.rating!.evidenceDigest],
  ["ASSURANCE_APPOINTMENT", "ASSURANCE_APPOINTMENT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.assurance!.appointmentEvidenceDigest],
  ["ASSURANCE_RESULT", "ASSURANCE_RESULT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.assurance!.providerInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.requiredReviews.assurance!.resultEvidenceDigest],
  ["EXECUTED_DOCUMENTS", "EXECUTED_PTC_DOCUMENTS", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.issue.executedDocumentsEvidenceDigest],
  ["TRANCHE_DEFINITION", "PTC_TRANCHE_DEFINITION", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.issue.trancheDefinitionDigest],
  ["SUBSCRIPTION", "PTC_SUBSCRIPTION", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.issue.subscriptionEvidenceDigest],
  ["TRUSTEE_TRANSACTION_CONTROL", "TRUSTEE_TRANSACTION_CONTROL", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.issue.trusteeControlDecisionDigest],
  ["ISSUE_OR_ALLOTMENT", "PTC_ISSUE_OR_ALLOTMENT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.issue.allotmentEvidenceDigest],
  ["AUTHORITATIVE_RECORD_DECLARATION", "AUTHORITATIVE_RECORD_DECLARATION", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.recordkeeperInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.authoritativeRecord.declarationEvidenceDigest],
  ["AUTHORITATIVE_RECORD_BEFORE", "AUTHORITATIVE_RECORD_SNAPSHOT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.recordkeeperInstitutionId, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.authoritativeRecord.beforeDigest],
  ["SERVICER_APPOINTMENT", "SERVICER_APPOINTMENT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup.servicerInstitutionId!, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup.servicerAppointmentEvidenceDigest!],
  ["COLLECTION_ACCOUNT", "COLLECTION_ACCOUNT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup.servicerInstitutionId!, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup.collectionAccountEvidenceDigest!],
  ["REQUIRED_NOTICE_ACKNOWLEDGEMENT", "REQUIRED_NOTICE_ACKNOWLEDGEMENT", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup.servicerInstitutionId!, SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.lifecycleSetup.requiredNoticeAcknowledgementDigest],
  ["HISTORIC_PTC_OUTCOME", "HISTORIC_PTC_OUTCOME", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId, historicOutcomeDigest],
] as const;

async function run(): Promise<void> {
  await db.$connect();
  try {
    const institutionIds = new Set<string>([
      SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId,
      SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId,
      SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.recordkeeperInstitutionId,
      ...evidenceRequirements.map((item) => item[2]),
    ]);
    await db.venueUser.create({ data: { id: userId, email: "ptc-service@example.invalid", status: "IDENTITY_BOUND" } });
    for (const institutionId of institutionIds) {
      await db.institution.create({ data: {
        id: institutionId,
        legalName: `Synthetic ${institutionId}`,
        institutionKind: "REGULATED_ENTITY",
        jurisdiction: "IN",
        legalIdentifiers: {},
        status: "ACTIVE",
        applicantUserId: userId,
      } });
      await db.participantAdmission.create({ data: {
        id: `admission_${institutionId}`,
        institutionId,
        status: "ADMITTED",
        termsVersion: "synthetic-v1",
        rulebookVersion: "synthetic-v1",
        applicationDigest: sha256Digest({ institutionId }),
        effectiveAt: now,
        expiresAt: future,
      } });
    }
    await db.transactionCase.create({ data: {
      id: caseId,
      caseReference: "PTC-SERVICE-REHEARSAL-10",
      ownerInstitutionId: SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId,
      transactionRoute: "PTC",
      representation: "CONVENTIONAL",
      jurisdiction: "IN",
      marketContext: "DOMESTIC",
      placementOrListing: "PRIVATE_PLACEMENT",
      lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
      assetClass: "MSME_LOAN",
      operatingMode: "REPLAY",
      routePackRef: "assurerail://route-packs/domestic-conventional-ptc-replay",
      routePackVersion: "1.0.0",
      status: "APPROVED_FOR_EXECUTION",
      creationIdempotencyKey: "ptc-service-case-create",
      creationRequestDigest: sha256Digest({ caseId }),
      createdByUserId: userId,
      createdByMandateId: mandateId,
    } });
    for (const [partyRole, institutionId] of [
      ["ORIGINATOR", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.originatorInstitutionId],
      ["TRUSTEE", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.trusteeInstitutionId],
      ["RECORDKEEPER", SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1.recordkeeperInstitutionId],
    ] as const) {
      await db.caseParty.create({ data: {
        id: `party_${partyRole}`,
        transactionCaseId: caseId,
        institutionId,
        partyRole,
        status: "ACTIVE",
        authorityEvidenceRef: `synthetic://${partyRole}`,
        createdByUserId: userId,
      } });
    }
    const assignments = buildConventionalPtcFunctionAssignments(SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1);
    for (const assignment of assignments) {
      await db.caseFunctionAssignment.create({ data: {
        id: `function_${assignment.materialFunction}`,
        transactionCaseId: caseId,
        materialFunction: assignment.materialFunction,
        performer: assignment.performer,
        performerInstitutionId: assignment.performerInstitutionId,
        authorityEvidenceRef: assignment.authorityEvidenceDigest,
        status: "ACTIVE",
        effectiveAt: now,
        expiresAt: future,
        createdByUserId: userId,
      } });
    }
    const evidence = Object.create(null) as Record<string, { evidenceObjectId: string }>;
    for (const [role, evidenceType, institutionId, payloadDigest] of evidenceRequirements) {
      const evidenceObjectId = `evidence_${role}`;
      evidence[role] = { evidenceObjectId };
      await db.evidenceObject.create({ data: {
        id: evidenceObjectId,
        institutionId,
        transactionCaseId: caseId,
        evidenceType,
        classification: "CASE_CONFIDENTIAL",
        purpose: "Synthetic PR-10 service rehearsal",
        status: "AVAILABLE",
        currentVersion: 1,
        retentionUntilAt: future,
        createdByUserId: userId,
        versions: { create: {
          id: `evidence_version_${role}`,
          version: 1,
          schemaId: `synthetic.${role.toLowerCase()}`,
          schemaVersion: "1.0.0",
          payloadDigest,
          signatureStatus: "VERIFIED",
          result: "VERIFIED",
          sourceAsOfAt: now,
          expiresAt: future,
          qualifications: [],
          validationStatus: "VALID",
          validationDetail: {},
          createdByUserId: userId,
        } },
      } });
    }
    await db.ptcReplayAuthorisation.create({ data: {
      id: "ptc_service_authorisation_10",
      transactionCaseId: caseId,
      idempotencyKey: "ptc-service-authorisation",
      requestDigest: sha256Digest({ authorisation: caseId }),
      authorityEvidenceRef: "synthetic://authorisation",
      reason: "Synthetic service rehearsal",
      status: "APPROVED",
      proposedByUserId: "maker",
      proposedByMandateId: mandateId,
      proposalStepUpId: "step-maker",
      reviewedByUserId: "checker",
      reviewedByMandateId: mandateId,
      reviewStepUpId: "step-checker",
      effectiveAt: now,
    } });
    const body: Parameters<PtcReplayService["createSaga"]>[2] = {
      idempotencyKey: "ptc-service-saga",
      expectedCaseAggregateVersion: 1,
      replayInput: SYNTHETIC_CONVENTIONAL_PTC_REPLAY_V1,
      evidence,
      legalMechanism: "SECURITISATION_TRUST_PTC",
      historicOutcomeRef: "synthetic://historic-outcome",
      historicOutcomeDigest,
      authoritativeRecord: {
        declarationEvidenceRef: "synthetic://record-declaration",
        beforeSourceAsOfAt: now.toISOString(),
      },
      reason: "Synthetic service rehearsal",
      stepUpEvidenceId: "step-saga",
    };
    const created = await service.createSaga(actor, caseId, body);
    assert.equal(created.transactionRoute, "PTC");
    assert.equal(created.executionMode, "OBSERVE_ONLY");
    assert.equal(created.evidenceLinks.length, evidenceRequirements.length);
    assert.equal(created.historicOutcomeEvidenceObjectId, null);
    assert.equal(created.transfereeCreditDecisionEvidenceObjectId, null);
    assert.equal(created.executedTransferDocumentEvidenceObjectId, null);
    assert.ok(created.legs.some((leg) => leg.legType === "TRUSTEE_TRANSACTION_CONTROL"));
    assert.ok(created.legs.some((leg) => leg.legType === "AUTHORITATIVE_RECORD_ACKNOWLEDGEMENT"));
    const replayed = await service.createSaga(actor, caseId, body);
    assert.equal(replayed.id, created.id);
    await assert.rejects(
      service.createSaga(actor, caseId, { ...body, reason: "changed command" }),
      /idempotency key conflicts/,
    );
    assert.equal(await db.settlementSaga.count({ where: { transactionCaseId: caseId } }), 1);
    assert.equal(await db.authoritativeRecordDeclaration.count({ where: { transactionCaseId: caseId } }), 1);
    assert.equal(await db.auditLog.count({ where: { event: "rail.ptc_replay.saga_planned" } }), 1);
    await db.transactionCase.update({ where: { id: caseId }, data: { status: "EXECUTION_PENDING" } });
    const firstLeg = created.legs[0]!;
    const observationEvidenceId = "evidence_ptc_exact_observation";
    await db.evidenceObject.create({ data: {
      id: observationEvidenceId,
      institutionId: firstLeg.participantOwnerInstitutionId,
      transactionCaseId: caseId,
      evidenceType: "PTC_REPLAY_OBSERVATION",
      classification: "CASE_CONFIDENTIAL",
      purpose: "Synthetic exact observation",
      status: "AVAILABLE",
      currentVersion: 1,
      retentionUntilAt: future,
      createdByUserId: userId,
      versions: { create: {
        id: "evidence_version_ptc_exact_observation",
        version: 1,
        schemaId: "synthetic.ptc-observation",
        schemaVersion: "1.0.0",
        payloadDigest: firstLeg.expectedDigest,
        signatureStatus: "VERIFIED",
        result: "VERIFIED",
        sourceAsOfAt: now,
        expiresAt: future,
        qualifications: [],
        validationStatus: "VALID",
        validationDetail: {},
        createdByUserId: userId,
      } },
    } });
    const observer: RoomActor = { ...actor, actorUserId: "ptc_observer_10", actingInstitutionId: firstLeg.participantOwnerInstitutionId };
    const observationBody: Parameters<PtcReplayService["recordObservation"]>[4] = {
      idempotencyKey: "ptc-observation-exact-10",
      observed: firstLeg.expected,
      externalReference: "synthetic://exact-observation",
      finalityClass: "FINAL",
      signatureStatus: "VERIFIED",
      evidenceObjectId: observationEvidenceId,
      observedAt: now.toISOString(),
      reason: "Synthetic exact observation",
      stepUpEvidenceId: "step-observation",
    };
    const observedSaga = await service.recordObservation(observer, caseId, created.id, firstLeg.id, observationBody);
    assert.equal(observedSaga.legs[0]!.state, "OBSERVED");
    assert.equal(observedSaga.legs[0]!.observations.length, 1);
    const observationReplay = await service.recordObservation(observer, caseId, created.id, firstLeg.id, observationBody);
    assert.equal(observationReplay.legs[0]!.observations.length, 1);
    const checker: RoomActor = { ...observer, actorUserId: "ptc_checker_10" };
    const reconciledSaga = await service.reconcileLeg(checker, caseId, created.id, firstLeg.id, {
      idempotencyKey: "ptc-reconcile-exact-10",
      reason: "Independent synthetic reconciliation",
      stepUpEvidenceId: "step-reconcile",
    });
    assert.equal(reconciledSaga.legs[0]!.state, "RECONCILED");

    const secondLeg = reconciledSaga.legs[1]!;
    const mismatchObserved = { mismatch: "synthetic" };
    const mismatchEvidenceId = "evidence_ptc_mismatch_observation";
    await db.evidenceObject.create({ data: {
      id: mismatchEvidenceId,
      institutionId: secondLeg.participantOwnerInstitutionId,
      transactionCaseId: caseId,
      evidenceType: "PTC_REPLAY_OBSERVATION",
      classification: "CASE_CONFIDENTIAL",
      purpose: "Synthetic mismatch observation",
      status: "AVAILABLE",
      currentVersion: 1,
      retentionUntilAt: future,
      createdByUserId: userId,
      versions: { create: {
        id: "evidence_version_ptc_mismatch_observation",
        version: 1,
        schemaId: "synthetic.ptc-observation",
        schemaVersion: "1.0.0",
        payloadDigest: sha256Digest(mismatchObserved),
        signatureStatus: "VERIFIED",
        result: "VERIFIED",
        sourceAsOfAt: now,
        expiresAt: future,
        qualifications: [],
        validationStatus: "VALID",
        validationDetail: {},
        createdByUserId: userId,
      } },
    } });
    const mismatchActor: RoomActor = { ...actor, actorUserId: "ptc_mismatch_observer_10", actingInstitutionId: secondLeg.participantOwnerInstitutionId };
    const brokenSaga = await service.recordObservation(mismatchActor, caseId, created.id, secondLeg.id, {
      idempotencyKey: "mismatch-replay",
      observed: mismatchObserved,
      externalReference: "synthetic://mismatch-observation",
      finalityClass: "FINAL",
      signatureStatus: "VERIFIED",
      evidenceObjectId: mismatchEvidenceId,
      observedAt: now.toISOString(),
      reason: "Synthetic mismatch observation",
      stepUpEvidenceId: "step-mismatch-observation",
    });
    assert.equal(brokenSaga.state, "BREAK_OPEN");
    assert.equal((await service.listBreaks(mismatchActor, caseId)).length, 1);
    const report = await service.comparison(mismatchActor, caseId, created.id);
    assert.equal(report.matched, 1);
    assert.equal(report.breaks, 1);
    assert.equal(report.notObserved, created.legs.length - 2);
    const pack = await service.evidencePack(mismatchActor, caseId, created.id);
    assert.match(pack.evidencePackDigest, /^sha256:[0-9a-f]{64}$/);
    process.stdout.write(`[PR10-SERVICE-DB] PASS saga=${created.id} legs=${created.legs.length} evidence=${created.evidenceLinks.length} plan-idempotent=true observation-idempotent=true reconciled=1 breaks=1\n`);
  } finally {
    await db.$disconnect();
  }
}

void run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
