import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/assurerail-client";
import { sha256Digest } from "../contracts/v1";
import type { InstitutionAccessService } from "../institutions/institution-access.service";
import type { StepUpService } from "../institutions/step-up.service";
import type { RoomActor } from "../rooms/room-authority.service";
import type { PrismaService } from "../store/prisma.service";
import { LifecycleService } from "./lifecycle.service";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the disposable AR-25 rehearsal");
Object.assign(process.env, {
  ASSURERAIL_OPERATING_MODE: "REPLAY", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
  ARAIL_NEUTRAL_INGRESS_V1: "shadow", ARAIL_TRANSACTION_CASE_V1: "shadow",
  ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_INTERNAL_RBAC_V1: "shadow",
  ARAIL_DEVELOPER_PORTAL_V1: "shadow", ARAIL_HOSTED_ALPHA_V1: "shadow",
  ARAIL_INSTITUTIONAL_PRODUCT_V1: "shadow", ARAIL_DA_REPLAY_V1: "allow_list",
  ARAIL_DA_PRODUCT_V1: "shadow", ARAIL_LIFECYCLE_PRODUCT_V1: "shadow",
});

const db = new PrismaClient();
const caseId = "ar25_case"; const institutionId = "ar25_institution";
const maker: RoomActor = { actorUserId: "ar25_maker", actorSessionId: "ar25_session_maker", actingInstitutionId: institutionId };
const checker: RoomActor = { actorUserId: "ar25_checker", actorSessionId: "ar25_session_checker", actingInstitutionId: institutionId };
let routeAllowed = true;
const access = { requireHuman: async () => ({ mandateId: "ar25_mandate" }), evaluateRoute: async () => routeAllowed ? ({ allowed: true, code: "ROUTE_ENTITLED" }) : ({ allowed: false, code: "NO_MATCHING_ROUTE_ENTITLEMENT" }) } as unknown as InstitutionAccessService;
const stepUp = { consume: async () => undefined } as unknown as StepUpService;
const service = new LifecycleService(db as unknown as PrismaService, access, stepUp);
const now = new Date(); const future = new Date(now.getTime() + 30 * 86_400_000);
const expected = { accountReference: "synthetic-account", amount: { currency: "INR", units: "10000", scale: 2 }, status: "RECEIVED" };
const mismatch = { ...expected, amount: { ...expected.amount, units: "9999" } };

async function evidence(id: string, payload: unknown) {
  await db.evidenceObject.create({ data: { id, institutionId, transactionCaseId: caseId, evidenceType: "LIFECYCLE_ACKNOWLEDGEMENT", classification: "CASE_CONFIDENTIAL", purpose: "Synthetic AR-25 software rehearsal", status: "AVAILABLE", currentVersion: 1, retentionUntilAt: future, createdByUserId: maker.actorUserId, versions: { create: { id: `${id}_v1`, version: 1, schemaId: "synthetic.lifecycle", schemaVersion: "1.0.0", payloadDigest: sha256Digest(payload), signatureStatus: "VERIFIED", result: "VERIFIED", sourceAsOfAt: now, expiresAt: future, qualifications: [], validationStatus: "VALID", validationDetail: {}, createdByUserId: maker.actorUserId } } } });
}

async function run() {
  await db.$connect();
  try {
    await db.institution.create({ data: { id: institutionId, legalName: "AR25 synthetic institution", institutionKind: "NBFC", jurisdiction: "IN", legalIdentifiers: {}, status: "ACTIVE", applicantUserId: maker.actorUserId } });
    await db.transactionCase.create({ data: { id: caseId, caseReference: "AR25-SYNTHETIC", ownerInstitutionId: institutionId, transactionRoute: "DA", representation: "CONVENTIONAL", jurisdiction: "IN", marketContext: "DOMESTIC", placementOrListing: "BILATERAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "MSME_LOAN", operatingMode: "REPLAY", routePackRef: "synthetic://da-route", routePackVersion: "1.0.0", status: "COMPLETED", creationIdempotencyKey: "ar25-case", creationRequestDigest: sha256Digest({ caseId }), createdByUserId: maker.actorUserId, createdByMandateId: "ar25_mandate" } });
    await db.caseParty.create({ data: { id: "ar25_party", transactionCaseId: caseId, institutionId, partyRole: "ORIGINATOR", status: "ACTIVE", authorityEvidenceRef: "synthetic://party", createdByUserId: maker.actorUserId } });
    await db.caseFunctionAssignment.create({ data: { id: "ar25_function", transactionCaseId: caseId, materialFunction: "SERVICING_AND_COLLECTION_ACCOUNT", performer: "PARTICIPANT_OWNED", performerInstitutionId: institutionId, authorityEvidenceRef: "synthetic://authority", status: "ACTIVE", effectiveAt: now, expiresAt: future, createdByUserId: maker.actorUserId } });
    await db.settlementSaga.create({ data: { id: "ar25_completion", transactionCaseId: caseId, transactionRoute: "DA", executionMode: "OBSERVE_ONLY", state: "RECONCILED", routePackRef: "synthetic://da-route", routePackVersion: "1.0.0", idempotencyKey: "ar25-completion", requestDigest: sha256Digest({ completion: true }), planDigest: sha256Digest({ plan: true }), routeEvidenceBundleDigest: sha256Digest({ evidence: true }), legalMechanism: "ASSIGNMENT", considerationCurrency: "INR", considerationMinorUnits: "10000", considerationScale: 2, historicOutcomeRef: "synthetic://outcome", historicOutcomeDigest: sha256Digest({ outcome: true }), expectedOutcome: {}, expectedOutcomeDigest: sha256Digest({}), createdByUserId: maker.actorUserId, createdByMandateId: "ar25_mandate", reconciledAt: now } }); // gitleaks:allow -- deterministic synthetic test value
    const planBody: Parameters<LifecycleService["createPlan"]>[2] = { idempotencyKey: "ar25-plan", expectedCaseAggregateVersion: 1, periodStartAt: now.toISOString(), periodEndAt: future.toISOString(), reason: "Synthetic AR-25 lifecycle plan", stepUpEvidenceId: "step-plan", obligations: [{ obligationKey: "collection-1", eventType: "COLLECTION_RECEIPT", sequence: 1, accountableInstitutionId: institutionId, performerClass: "PARTICIPANT_OWNED", dueAt: new Date(now.getTime() + 86_400_000).toISOString(), required: true, expected, amount: { currency: "INR", units: "10000", scale: 2 } }] };
    await db.transactionCase.update({ where: { id: caseId }, data: { status: "FAILED" } });
    await assert.rejects(service.createPlan(maker, caseId, planBody), /completed transaction case/);
    await db.transactionCase.update({ where: { id: caseId }, data: { status: "COMPLETED" } });
    routeAllowed = false; await assert.rejects(service.createPlan(maker, caseId, planBody), /route denied/); routeAllowed = true;
    const created = await service.createPlan(maker, caseId, planBody); assert.equal(created.obligations.length, 1); assert.equal((created as Record<string, unknown>).requestDigest, undefined);
    assert.equal((created.obligations[0] as unknown as Record<string, unknown>).expected, undefined);
    const replay = await service.createPlan(maker, caseId, planBody); assert.equal(replay.id, created.id); assert.equal(await db.railLifecyclePlan.count(), 1);
    const obligation = created.obligations[0]!;
    await evidence("ar25_mismatch_evidence", mismatch); await evidence("ar25_match_evidence", expected);
    const mismatchBody: Parameters<LifecycleService["recordEvent"]>[4] = { idempotencyKey: "ar25-mismatch", observed: mismatch, externalReference: "synthetic://mismatch", finalityClass: "FINAL", signatureStatus: "VERIFIED", evidenceObjectId: "ar25_mismatch_evidence", observedAt: now.toISOString(), reason: "Synthetic mismatch", stepUpEvidenceId: "step-mismatch" };
    await db.caseFunctionAssignment.update({ where: { id: "ar25_function" }, data: { expiresAt: new Date(now.getTime() - 1) } });
    await assert.rejects(service.recordEvent(maker, caseId, created.id, obligation.id, mismatchBody), /current function assignment mismatch/);
    await db.caseFunctionAssignment.update({ where: { id: "ar25_function" }, data: { expiresAt: future } });
    await db.caseParty.update({ where: { id: "ar25_party" }, data: { status: "WITHDRAWN" } });
    await assert.rejects(service.recordEvent(maker, caseId, created.id, obligation.id, mismatchBody), /not an active case party/);
    await db.caseParty.update({ where: { id: "ar25_party" }, data: { status: "ACTIVE" } });
    routeAllowed = false; await assert.rejects(service.recordEvent(maker, caseId, created.id, obligation.id, mismatchBody), /route denied/); routeAllowed = true;
    await assert.rejects(service.recordEvent(maker, caseId, created.id, obligation.id, { ...mismatchBody, finalityClass: "PENDING" }), /finalityClass must be FINAL/);
    await assert.rejects(service.recordEvent(maker, caseId, created.id, obligation.id, { ...mismatchBody, observedAt: new Date(Date.now() + 600_000).toISOString() }), /observedAt cannot be materially in the future/);
    const broken = await service.recordEvent(maker, caseId, created.id, obligation.id, mismatchBody); assert.equal(broken.status, "BREAK_OPEN"); assert.equal(broken.obligations[0]!.events.length, 1); assert.equal(broken.obligations[0]!.breaks[0]!.lifecycleEventId, broken.obligations[0]!.events[0]!.id);
    const replayedMismatch = await service.recordEvent(maker, caseId, created.id, obligation.id, mismatchBody); assert.equal(replayedMismatch.obligations[0]!.events.length, 1);
    const correctionBody: Parameters<LifecycleService["recordEvent"]>[4] = { ...mismatchBody, idempotencyKey: "ar25-correction", observed: expected, externalReference: "synthetic://corrected", evidenceObjectId: "ar25_match_evidence", stepUpEvidenceId: "step-correction" };
    const matched = await service.recordEvent(maker, caseId, created.id, obligation.id, correctionBody); assert.equal(matched.obligations[0]!.events.length, 2); assert.equal(matched.status, "BREAK_OPEN");
    assert.equal((await service.recordEvent(maker, caseId, created.id, obligation.id, correctionBody)).obligations[0]!.events.length, 2);
    await db.evidenceObject.update({ where: { id: "ar25_match_evidence" }, data: { status: "QUARANTINED" } });
    await assert.rejects(service.reconcile(checker, caseId, created.id, obligation.id, { idempotencyKey: "ar25-reconcile", reason: "Independent reconciliation", stepUpEvidenceId: "step-reconcile" }), /current valid, signed, verified/);
    await db.evidenceObject.update({ where: { id: "ar25_match_evidence" }, data: { status: "AVAILABLE" } });
    const reconcileBody = { idempotencyKey: "ar25-reconcile", reason: "Independent reconciliation", stepUpEvidenceId: "step-reconcile" };
    const reconciled = await service.reconcile(checker, caseId, created.id, obligation.id, reconcileBody); assert.equal(reconciled.status, "RECONCILED"); assert.equal(reconciled.obligations[0]!.breaks[0]!.status, "RESOLVED");
    assert.equal((await service.reconcile(checker, caseId, created.id, obligation.id, reconcileBody)).status, "RECONCILED");
    assert.equal(await db.railLifecycleEvent.count(), 2); assert.equal(await db.railLifecycleBreak.count(), 1); assert.equal(await db.auditLog.count({ where: { event: { startsWith: "rail.lifecycle." } } }), 4);
    console.log(`[AR25-SERVICE-DB] PASS plan=${created.id} events=2 break=resolved idempotent=true evidence-rechecked=true projection=minimised`);
  } finally { await db.$disconnect(); }
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
