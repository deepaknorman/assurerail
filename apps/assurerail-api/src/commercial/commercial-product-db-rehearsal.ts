import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/assurerail-client";
import { CasesService } from "../cases/cases.service";
import { sha256Digest } from "../contracts/v1";
import type { InstitutionAccessService } from "../institutions/institution-access.service";
import type { StepUpService } from "../institutions/step-up.service";
import type { PrismaService } from "../store/prisma.service";
import { CommercialService } from "./commercial.service";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the disposable AR-26 rehearsal");
Object.assign(process.env, {
  ASSURERAIL_OPERATING_MODE: "SHADOW", ARAIL_PARTICIPANT_ADMISSION_V1: "shadow",
  ARAIL_NEUTRAL_INGRESS_V1: "shadow", ARAIL_TRANSACTION_CASE_V1: "shadow",
  ARAIL_PRIMARY_COMMERCIAL_V1: "shadow", ARAIL_PRIMARY_VENUE_PRODUCT_V1: "shadow",
});

const db = new PrismaClient();
const caseId = "ar26_case"; const opportunityId = "ar26_opportunity";
const ownerId = "ar26_owner"; const counterpartyId = "ar26_counterparty";
const owner = { actorUserId: "ar26_owner_maker", actorSessionId: "ar26_owner_session", actingInstitutionId: ownerId };
const counterparty = { actorUserId: "ar26_counterparty_user", actorSessionId: "ar26_counterparty_session", actingInstitutionId: counterpartyId };
const access = {
  requireHuman: async () => ({ mandateId: "ar26_mandate" }),
  evaluateRoute: async () => ({ allowed: true, code: "ROUTE_ENTITLED" }),
} as unknown as InstitutionAccessService;
const stepUp = { consume: async () => undefined } as unknown as StepUpService;
const commercial = new CommercialService(db as unknown as PrismaService, access, stepUp);
const cases = new CasesService(db as unknown as PrismaService, access, stepUp);
const now = new Date(); const future = new Date(now.getTime() + 30 * 86_400_000);

async function run() {
  await db.$connect();
  try {
    for (const [id, name] of [[ownerId, "AR26 synthetic owner"], [counterpartyId, "AR26 synthetic counterparty"]] as const) {
      await db.institution.create({ data: { id, legalName: name, institutionKind: "NBFC", jurisdiction: "IN", legalIdentifiers: {}, status: "ACTIVE", applicantUserId: `${id}_applicant`, admission: { create: { id: `${id}_admission`, status: "ADMITTED", termsVersion: "synthetic-1", rulebookVersion: "synthetic-1", applicationDigest: sha256Digest({ id }), effectiveAt: now, expiresAt: future } } } });
    }
    await db.transactionCase.create({ data: { id: caseId, caseReference: "AR26-SYNTHETIC", ownerInstitutionId: ownerId, transactionRoute: "DA", representation: "CONVENTIONAL", jurisdiction: "IN", marketContext: "DOMESTIC", placementOrListing: "BILATERAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", assetClass: "RECEIVABLES", operatingMode: "SHADOW", routePackRef: "synthetic://da-route", routePackVersion: "1", status: "DRAFT", creationIdempotencyKey: "ar26-case", creationRequestDigest: sha256Digest({ caseId }), createdByUserId: owner.actorUserId, createdByMandateId: "ar26_mandate" } });
    await db.caseFunctionAssignment.create({ data: { id: "ar26_allocation_function", transactionCaseId: caseId, materialFunction: "ALLOCATION", performer: "PARTICIPANT_OWNED", performerInstitutionId: ownerId, authorityEvidenceRef: "synthetic://authority", status: "ACTIVE", effectiveAt: now, expiresAt: future, createdByUserId: owner.actorUserId } });
    await db.commercialOpportunity.create({ data: { id: opportunityId, transactionCaseId: caseId, ownerInstitutionId: ownerId, opportunityReference: "AR26-OPPORTUNITY", status: "PUBLISHED", currentTermVersion: 1, opensAt: now, closesAt: future, creationIdempotencyKey: "ar26-opportunity", creationRequestDigest: sha256Digest({ opportunityId }), createdByUserId: owner.actorUserId, createdByMandateId: "ar26_mandate" } });
    const term = await db.commercialTermVersion.create({ data: { id: "ar26_term", commercialOpportunityId: opportunityId, version: 1, currency: "INR", amountUnits: "10000000", amountScale: 2, minimumParticipationUnits: "100000", pricingType: "YIELD_BPS", pricingValue: "875.25", commercialTerms: { recourse: "synthetic" }, validFrom: now, expiresAt: future, termDigest: sha256Digest({ term: 1 }), reason: "Synthetic governed term", createdByUserId: owner.actorUserId, createdByMandateId: "ar26_mandate", stepUpEvidenceId: "ar26_step_term" } });
    await db.commercialAudienceGrant.create({ data: { id: "ar26_grant", commercialOpportunityId: opportunityId, institutionId: counterpartyId, status: "ACTIVE", purpose: "TERM_DISPLAY_AND_RFQ", conflictDisclosure: { reviewed: true }, effectiveAt: now, expiresAt: future, invitationDigest: sha256Digest({ counterpartyId }), invitedByUserId: owner.actorUserId, invitedByMandateId: "ar26_mandate", stepUpEvidenceId: "ar26_step_grant" } });
    await db.commercialAllocation.create({ data: { id: "ar26_allocation", commercialOpportunityId: opportunityId, allocationReference: "AR26-ALLOC-1", offereeInstitutionId: counterpartyId, termVersionId: term.id, basisType: "RFQ", basisId: "synthetic-rfq", currency: "INR", amountUnits: "1000000", amountScale: 2, status: "OFFERED", idempotencyKey: "ar26-allocation", proposalDigest: sha256Digest({ allocation: 1 }), proposedByUserId: owner.actorUserId, proposedByMandateId: "ar26_mandate", proposalStepUpId: "ar26_step_allocation", reviewedByUserId: "ar26_owner_checker", reviewedAt: now, expiresAt: future } });

    const body = { idempotencyKey: "ar26-handoff", reason: "Synthetic accepted-allocation handoff", stepUpEvidenceId: "ar26_step_handoff" };
    await assert.rejects(commercial.prepareCaseHandoff(owner, caseId, opportunityId, "ar26_allocation", body), /counterparty acceptance/);
    await db.commercialAllocation.update({ where: { id: "ar26_allocation" }, data: { status: "ACCEPTED", respondedByUserId: counterparty.actorUserId, respondedAt: now } });
    await db.commercialOpportunity.update({ where: { id: opportunityId }, data: { status: "PAUSED" } });
    await assert.rejects(commercial.prepareCaseHandoff(owner, caseId, opportunityId, "ar26_allocation", body), /must remain open and current/);
    await db.commercialOpportunity.update({ where: { id: opportunityId }, data: { status: "PUBLISHED" } });
    const handoff = await commercial.prepareCaseHandoff(owner, caseId, opportunityId, "ar26_allocation", body);
    assert.equal(handoff.status, "HANDOFF_RECORDED"); assert.equal(handoff.caseParty.status, "PROPOSED");
    assert.equal(handoff.audienceGrantId, "ar26_grant"); assert.equal(handoff.eligibilityDecisionCode, "ROUTE_ENTITLED");
    assert.equal((handoff as unknown as Record<string, unknown>).stepUpEvidenceId, undefined);
    assert.equal((handoff as unknown as Record<string, unknown>).requestDigest, undefined);
    assert.equal((await commercial.prepareCaseHandoff(owner, caseId, opportunityId, "ar26_allocation", body)).id, handoff.id);
    assert.equal(await db.commercialCaseHandoff.count(), 1); assert.equal(await db.caseParty.count(), 1);

    await db.commercialAudienceGrant.update({ where: { id: "ar26_grant" }, data: { status: "REVOKED", revokedAt: new Date() } });
    await db.commercialTermVersion.create({ data: { id: "ar26_term_later", commercialOpportunityId: opportunityId, version: 2, currency: "INR", amountUnits: "20000000", amountScale: 2, minimumParticipationUnits: "200000", pricingType: "YIELD_BPS", pricingValue: "925.25", commercialTerms: { recourse: "later-owner-only" }, validFrom: now, expiresAt: future, termDigest: sha256Digest({ term: 2 }), reason: "Synthetic later term", createdByUserId: owner.actorUserId, createdByMandateId: "ar26_mandate", stepUpEvidenceId: "ar26_step_term_later" } });
    await db.commercialOpportunity.update({ where: { id: opportunityId }, data: { currentTermVersion: 2 } });
    const retained = await commercial.get(counterparty, caseId, opportunityId);
    assert.equal(retained.caseHandoffs.length, 1); assert.equal(retained.allocations.length, 1);
    assert.deepEqual(retained.terms.map((entry) => entry.id), ["ar26_term"]);
    assert.equal(retained.interests.length, 0); assert.equal(retained.rfqs.length, 0); assert.equal(retained.threads.length, 0);
    const retainedList = await commercial.list(counterparty);
    assert.equal(retainedList.length, 1); assert.deepEqual(retainedList[0]!.terms.map((entry) => entry.id), ["ar26_term"]);
    await db.commercialAudienceGrant.update({ where: { id: "ar26_grant" }, data: { status: "ACTIVE", revokedAt: null } });
    await db.commercialOpportunity.update({ where: { id: opportunityId }, data: { status: "WITHDRAWN" } });
    const terminal = await commercial.get(counterparty, caseId, opportunityId);
    assert.deepEqual(terminal.terms.map((entry) => entry.id), ["ar26_term"]); assert.equal(terminal.changes.length, 0);
    const terminalList = await commercial.list(counterparty);
    assert.deepEqual(terminalList[0]!.terms.map((entry) => entry.id), ["ar26_term"]);
    const safe = retained as unknown as Record<string, unknown>;
    assert.equal(safe.creationIdempotencyKey, undefined); assert.equal(safe.creationRequestDigest, undefined);
    await cases.acceptParty(counterparty.actorUserId, counterpartyId, counterparty.actorSessionId, caseId, handoff.casePartyId, { stepUpEvidenceId: "ar26_step_accept" });
    const accepted = await commercial.get(counterparty, caseId, opportunityId);
    assert.equal(accepted.caseHandoffs[0]!.status, "HANDOFF_RECORDED");
    assert.equal(accepted.caseHandoffs[0]!.caseParty.status, "ACTIVE");
    assert.equal(await db.auditLog.count({ where: { event: "rail.commercial.case_handoff_prepared" } }), 1);
    console.log(`[AR26-SERVICE-DB] PASS handoff=${handoff.id} accepted-allocation=true case-party=separately-accepted retained-access=handoff-snapshot-only idempotent=true projection=minimised external-action=none`);
  } finally { await db.$disconnect(); }
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
