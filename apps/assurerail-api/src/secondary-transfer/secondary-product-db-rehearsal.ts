import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/assurerail-client";
import { sha256Digest } from "../contracts/v1";
import type { InstitutionAccessService } from "../institutions/institution-access.service";
import type { StepUpService } from "../institutions/step-up.service";
import type { PrismaService } from "../store/prisma.service";
import { SecondaryTransferService } from "./secondary-transfer.service";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the disposable AR-27 rehearsal");
Object.assign(process.env, {
  ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_TRANSACTION_CASE_V1: "shadow",
  ARAIL_EXTERNAL_ACTION_SAGA_V1: "required", ARAIL_CONVENTIONAL_SECONDARY_V1: "shadow",
  ARAIL_SECONDARY_PRODUCT_V1: "shadow",
});

const db = new PrismaClient();
const sellerId = "ar27_seller"; const buyerId = "ar27_buyer"; const recordkeeperId = "ar27_recordkeeper";
const caseId = "ar27_case"; const transferId = "ar27_transfer"; const breakId = "ar27_break";
const beforeDigest = sha256Digest({ holder: sellerId }); const oldAfterDigest = beforeDigest;
const replacementDigest = sha256Digest({ holder: buyerId });
const access = {
  requireHuman: async () => ({ mandateId: "ar27_mandate" }),
  evaluateHuman: async () => ({ allowed: true, code: "AUTHORISED", mandateId: "ar27_mandate" }),
  evaluateRoute: async () => ({ allowed: true, code: "ROUTE_ENTITLED" }),
} as unknown as InstitutionAccessService;
const stepUp = { consume: async () => undefined } as unknown as StepUpService;
const service = new SecondaryTransferService(db as unknown as PrismaService, access, stepUp);
const maker = { actorUserId: "ar27_recordkeeper_maker", actorSessionId: "ar27_maker_session", actingInstitutionId: recordkeeperId };
const checker = { actorUserId: "ar27_recordkeeper_checker", actorSessionId: "ar27_checker_session", actingInstitutionId: recordkeeperId };

async function run() {
  await db.$connect();
  try {
    const now = new Date(); const future = new Date(now.getTime() + 365 * 86_400_000);
    for (const [id, name] of [[sellerId, "AR27 synthetic seller"], [buyerId, "AR27 synthetic buyer"], [recordkeeperId, "AR27 synthetic recordkeeper"]] as const) {
      await db.institution.create({ data: { id, legalName: name, institutionKind: "SYNTHETIC_TEST_FIXTURE", jurisdiction: "IN", legalIdentifiers: {}, status: "ACTIVE", applicantUserId: `${id}_applicant`, admission: { create: { id: `${id}_admission`, status: "ADMITTED", termsVersion: "synthetic", rulebookVersion: "synthetic", applicationDigest: sha256Digest({ id }), effectiveAt: now, expiresAt: future } } } });
    }
    await db.transactionCase.create({ data: { id: caseId, caseReference: "AR27-SYNTHETIC", ownerInstitutionId: sellerId,
      transactionRoute: "DA", representation: "CONVENTIONAL", jurisdiction: "IN", marketContext: "DOMESTIC",
      placementOrListing: "BILATERAL", lifecycleLeg: "SECONDARY_TRANSFER_OR_TRADE", assetClass: "RECEIVABLES",
      operatingMode: "SHADOW", routePackRef: "assurerail://route-packs/domestic-conventional-da-secondary-replay",
      routePackVersion: "1.0.0", status: "APPROVED_FOR_EXECUTION", creationIdempotencyKey: "ar27-case",
      creationRequestDigest: sha256Digest({ caseId }), createdByUserId: maker.actorUserId, createdByMandateId: "ar27_mandate",
      parties: { create: [
        { id: "ar27_seller_party", institutionId: sellerId, partyRole: "SECONDARY_SELLER", status: "ACTIVE", authorityEvidenceRef: "synthetic://seller-authority", createdByUserId: maker.actorUserId, acceptedByUserId: maker.actorUserId, acceptedAt: now },
        { id: "ar27_buyer_party", institutionId: buyerId, partyRole: "SECONDARY_BUYER", status: "ACTIVE", authorityEvidenceRef: "synthetic://buyer-authority", createdByUserId: maker.actorUserId, acceptedByUserId: maker.actorUserId, acceptedAt: now },
        { id: "ar27_recordkeeper_party", institutionId: recordkeeperId, partyRole: "RECORDKEEPER", status: "ACTIVE", authorityEvidenceRef: "synthetic://recordkeeper-authority", createdByUserId: maker.actorUserId, acceptedByUserId: maker.actorUserId, acceptedAt: now },
      ] } } });
    await db.secondaryTransfer.create({ data: { id: transferId, transactionCaseId: caseId, transactionRoute: "DA",
      routePackRef: "assurerail://route-packs/domestic-conventional-da-secondary-replay", routePackVersion: "1.0.0",
      transferReference: "AR27-TRANSFER", instrumentReference: "AR27-INSTRUMENT", instrumentDigest: sha256Digest({ instrument: 1 }),
      sellerInstitutionId: sellerId, buyerInstitutionId: buyerId, recordkeeperInstitutionId: recordkeeperId,
      quantityUnits: "100", quantityScale: 0, considerationCurrency: "INR", considerationMinorUnits: "500000", considerationScale: 2,
      status: "BREAK_OPEN", aggregateVersion: 3, creationIdempotencyKey: "ar27-transfer", creationRequestDigest: sha256Digest({ transferId }),
      createdByUserId: maker.actorUserId, createdByMandateId: "ar27_mandate" } });
    for (const [id, type, digest] of [["ar27_before", "AUTHORITATIVE_RECORD_BEFORE", beforeDigest], ["ar27_old_after", "AUTHORITATIVE_RECORD_AFTER", oldAfterDigest], ["ar27_replacement", "AUTHORITATIVE_RECORD_AFTER", replacementDigest]] as const) {
      await db.evidenceObject.create({ data: { id, institutionId: recordkeeperId, transactionCaseId: caseId, evidenceType: type,
        classification: "CONFIDENTIAL", purpose: "AR27_SYNTHETIC_REHEARSAL", status: "AVAILABLE", currentVersion: 1,
        retentionUntilAt: future, createdByUserId: maker.actorUserId, versions: { create: { id: `${id}_v1`, version: 1,
          schemaId: "assurerail.synthetic.ar27", schemaVersion: "1", payloadDigest: digest, signatureStatus: "VERIFIED",
          result: "VERIFIED", sourceAsOfAt: now, expiresAt: future, qualifications: { synthetic: true }, validationStatus: "VALID",
          validationDetail: { synthetic: true }, createdByUserId: maker.actorUserId } } } });
    }
    await db.secondaryTransferEvidence.createMany({ data: [
      { id: "ar27_before_record", secondaryTransferId: transferId, evidenceType: "AUTHORITATIVE_RECORD_BEFORE", version: 1,
        providerInstitutionId: recordkeeperId, evidenceObjectId: "ar27_before", evidenceResult: "VERIFIED", assertionDigest: beforeDigest,
        sourceAsOfAt: now, idempotencyKey: "ar27-before", requestDigest: sha256Digest("before"), recordedByUserId: maker.actorUserId,
        recordedByMandateId: "ar27_mandate", stepUpEvidenceId: "ar27_before_step" },
      { id: "ar27_after_record", secondaryTransferId: transferId, evidenceType: "AUTHORITATIVE_RECORD_AFTER", version: 1,
        providerInstitutionId: recordkeeperId, evidenceObjectId: "ar27_old_after", evidenceResult: "VERIFIED", assertionDigest: oldAfterDigest,
        sourceAsOfAt: now, idempotencyKey: "ar27-after", requestDigest: sha256Digest("after"), recordedByUserId: maker.actorUserId,
        recordedByMandateId: "ar27_mandate", stepUpEvidenceId: "ar27_after_step" },
    ] });
    await db.secondaryTransferLeg.create({ data: { id: "ar27_leg", secondaryTransferId: transferId, legKey: "record-after",
      legType: "AUTHORITATIVE_RECORD_AFTER", sequence: 100, performerInstitutionId: recordkeeperId, performerClass: "EXTERNAL_AUTHORITY",
      expectedEvidenceType: "AUTHORITATIVE_RECORD_AFTER", expectedAssertionDigest: oldAfterDigest, evidenceRecordId: "ar27_after_record", state: "BREAK_OPEN" } });
    await db.secondaryTransferBreak.create({ data: { id: breakId, secondaryTransferId: transferId,
      breakCode: "AUTHORITATIVE_RECORD_UNCHANGED", severity: "CRITICAL", expectedDigest: beforeDigest, observedDigest: oldAfterDigest,
      blockedCapabilities: ["EXECUTION", "CASH_SETTLEMENT", "AUTHORITATIVE_REGISTER_UPDATE"], ownerInstitutionId: recordkeeperId,
      status: "OPEN", detail: { syntheticEvidenceAccepted: false }, openedByUserId: maker.actorUserId } });

    const proposalBody = { replacementEvidenceType: "AUTHORITATIVE_RECORD_AFTER", providerInstitutionId: recordkeeperId,
      evidenceObjectId: "ar27_replacement", assertionDigest: replacementDigest, authorityEvidenceRef: "synthetic://recordkeeper-correction",
      idempotencyKey: "ar27-repair", stepUpEvidenceId: "ar27_repair_propose_step" };
    const proposal = await service.proposeRepair(maker, caseId, breakId, proposalBody);
    assert.equal((await service.proposeRepair(maker, caseId, breakId, proposalBody)).id, proposal.id);
    await assert.rejects(service.reviewRepair(maker, caseId, breakId, proposal.id, { approved: true, reason: "self review", stepUpEvidenceId: "self" }), /cannot review/);
    const approved = await service.reviewRepair(checker, caseId, breakId, proposal.id, { approved: true, reason: "Independent synthetic service rehearsal", stepUpEvidenceId: "ar27_repair_review_step" });
    assert.equal(approved.status, "APPROVED");
    assert.equal((await db.secondaryTransfer.findUniqueOrThrow({ where: { id: transferId } })).status, "RECONCILED");
    assert.equal((await db.secondaryTransferBreak.findUniqueOrThrow({ where: { id: breakId } })).status, "RESOLVED");
    assert.equal(await db.secondaryTransferEvidence.count({ where: { secondaryTransferId: transferId, evidenceType: "AUTHORITATIVE_RECORD_AFTER" } }), 2);
    const pack = await service.evidencePack(checker, caseId);
    assert.match(pack.packDigest, /^sha256:/); assert.equal(pack.legalEffect, "NONE_ASSERTED");
    assert.equal(await db.auditLog.count({ where: { event: { in: ["rail.secondary_transfer.repair_proposed", "rail.secondary_transfer.repair_reviewed", "rail.secondary_transfer.evidence_snapshot_accessed"] } } }), 3);
    console.log(`[AR27-SERVICE-DB] PASS repair=${proposal.id} maker-checker=true append-only=true reconciled=true pack=${pack.packDigest} external-action=none synthetic-fixture-only=true`);
  } finally { await db.$disconnect(); }
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
