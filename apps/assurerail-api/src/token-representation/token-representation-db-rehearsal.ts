import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/assurerail-client";
import { sha256Digest } from "../contracts/v1";
import type { InstitutionAccessService } from "../institutions/institution-access.service";
import type { StepUpService } from "../institutions/step-up.service";
import type { RoomActor } from "../rooms/room-authority.service";
import type { PrismaService } from "../store/prisma.service";
import { TokenRepresentationService } from "./token-representation.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the disposable PR-11 rehearsal");

process.env.ASSURERAIL_OPERATING_MODE = "REPLAY";
process.env.ARAIL_PARTICIPANT_ADMISSION_V1 = "shadow";
process.env.ARAIL_NEUTRAL_INGRESS_V1 = "shadow";
process.env.ARAIL_TRANSACTION_CASE_V1 = "shadow";
process.env.ARAIL_EXTERNAL_ACTION_SAGA_V1 = "required";
process.env.ARAIL_TOKENISED_DA_V1 = "allow_list";

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const now = new Date();
const future = new Date(now.getTime() + 86_400_000);
const actor: RoomActor = { actorUserId: "pr11_user", actorSessionId: "pr11_session", actingInstitutionId: "pr11_institution" };
const mandateId = "pr11_mandate";
const fixtureIdempotencyKey = (outcome: "matched" | "break") =>
  ["pr11", "reconcile", outcome].join("-");
const access = {
  requireHuman: async () => ({ mandateId }),
  evaluateRoute: async () => ({ allowed: true, code: "AUTHORISED" }),
} as unknown as InstitutionAccessService;
const stepUp = { consume: async () => undefined } as unknown as StepUpService;
const service = new TokenRepresentationService(db as unknown as PrismaService, access, stepUp);

async function evidence(id: string, evidenceType: string, payloadDigest: string) {
  await db.evidenceObject.create({ data: {
    id,
    institutionId: actor.actingInstitutionId,
    transactionCaseId: "pr11_case",
    evidenceType,
    classification: "CASE_CONFIDENTIAL",
    purpose: "Synthetic PR-11 service rehearsal",
    status: "AVAILABLE",
    currentVersion: 1,
    retentionUntilAt: future,
    createdByUserId: actor.actorUserId,
    versions: { create: {
      id: `${id}_v1`,
      version: 1,
      schemaId: `synthetic.${evidenceType.toLowerCase()}`,
      schemaVersion: "1.0.0",
      payloadDigest,
      signatureStatus: "VERIFIED",
      result: "VERIFIED",
      sourceAsOfAt: now,
      expiresAt: future,
      qualifications: [],
      validationStatus: "VALID",
      validationDetail: {},
      createdByUserId: actor.actorUserId,
    } },
  } });
}

async function run(): Promise<void> {
  await db.$connect();
  try {
    await db.venueUser.create({ data: { id: actor.actorUserId, email: "pr11@example.invalid", status: "IDENTITY_BOUND" } });
    await db.institution.create({ data: {
      id: actor.actingInstitutionId,
      legalName: "Synthetic PR-11 Originator",
      institutionKind: "REGULATED_ENTITY",
      jurisdiction: "IN",
      legalIdentifiers: {},
      status: "ACTIVE",
      applicantUserId: actor.actorUserId,
    } });
    await db.participantAdmission.create({ data: {
      id: "pr11_admission",
      institutionId: actor.actingInstitutionId,
      status: "ADMITTED",
      termsVersion: "synthetic-v1",
      rulebookVersion: "synthetic-v1",
      applicationDigest: sha256Digest({ admission: "pr11" }),
      effectiveAt: now,
      expiresAt: future,
    } });
    await db.transactionCase.create({ data: {
      id: "pr11_case",
      caseReference: "TOKENISED-DA-PR11-REHEARSAL",
      ownerInstitutionId: actor.actingInstitutionId,
      transactionRoute: "DA",
      representation: "TOKENISED",
      jurisdiction: "IN",
      marketContext: "DOMESTIC",
      placementOrListing: "BILATERAL",
      lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
      assetClass: "TRADE_RECEIVABLE",
      operatingMode: "REPLAY",
      routePackRef: "assurerail://route-packs/domestic-tokenised-da-replay",
      routePackVersion: "1.0.0",
      status: "EXECUTION_PENDING",
      creationIdempotencyKey: "pr11-case-create",
      creationRequestDigest: sha256Digest({ case: "pr11" }),
      createdByUserId: actor.actorUserId,
      createdByMandateId: mandateId,
    } });
    await db.caseFunctionAssignment.create({ data: {
      id: "pr11_function",
      transactionCaseId: "pr11_case",
      materialFunction: "TOKEN_REPRESENTATION_MANAGEMENT",
      performer: "PARTICIPANT_OWNED",
      performerInstitutionId: actor.actingInstitutionId,
      authorityEvidenceRef: "synthetic://token-authority",
      status: "ACTIVE",
      effectiveAt: now,
      expiresAt: future,
      createdByUserId: actor.actorUserId,
    } });
    await db.note.create({ data: {
      id: "pr11_note",
      poolId: "pr11_pool",
      tapeHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      manifestHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      tokenId: "0.0.111",
      serials: [1],
      t1Aggregates: { mintableMinor: "100" },
      state: "ISSUED",
    } });
    await db.noteHolding.create({ data: { id: "pr11_holding", noteId: "pr11_note", holderDid: "did:holder:a", units: "100" } });
    const declarationDigest = sha256Digest({ authority: "external-register", caseId: "pr11_case" });
    await evidence("pr11_declaration_evidence", "AUTHORITATIVE_RECORD_DECLARATION", declarationDigest);
    await db.authoritativeRecordDeclaration.create({ data: {
      id: "pr11_declaration",
      transactionCaseId: "pr11_case",
      recordType: "LENDER_BOOK_AND_TRANSFER_REGISTER",
      authorityClass: "LEGAL_AUTHORITY",
      recordkeeperInstitutionId: actor.actingInstitutionId,
      declarationEvidenceRef: "synthetic://record-declaration",
      declarationEvidenceDigest: declarationDigest,
      declarationEvidenceObjectId: "pr11_declaration_evidence",
      routePackRef: "assurerail://route-packs/domestic-tokenised-da-replay",
      routePackVersion: "1.0.0",
      status: "ACTIVE",
      createdByUserId: actor.actorUserId,
      createdByMandateId: mandateId,
    } });
    await db.providerReference.create({ data: {
      id: "pr11_provider",
      providerKey: "synthetic-token-network",
      providerType: "TOKEN_NETWORK",
      displayName: "Synthetic Token Network",
      status: "ACTIVE",
      transactionCaseId: "pr11_case",
    } });

    const linkBody: Parameters<TokenRepresentationService["link"]>[2] = {
      noteId: "pr11_note",
      authoritativeRecordDeclarationId: "pr11_declaration",
      network: "HEDERA_TEST_FIXTURE",
      unitsScale: 0,
      idempotencyKey: "pr11-link",
      reason: "Synthetic linkage rehearsal",
      stepUpEvidenceId: "pr11_step_link",
    };
    const linked = await service.link(actor, "pr11_case", linkBody);
    assert.equal(linked.authorityMode, "MIRROR");
    assert.equal((await service.link(actor, "pr11_case", linkBody)).id, linked.id);

    const actionBody: Parameters<TokenRepresentationService["prepareAction"]>[2] = {
      providerReferenceId: "pr11_provider",
      actionType: "TRANSFER",
      expected: { sellerRef: "did:holder:a", buyerRef: "did:holder:b", unitsMinor: "40" },
      idempotencyKey: "pr11-transfer",
      reason: "Synthetic observe-only action",
      stepUpEvidenceId: "pr11_step_action",
    };
    const action = await service.prepareAction(actor, "pr11_case", actionBody);
    assert.equal(action.executionMode, "OBSERVE_ONLY");
    assert.equal((await service.prepareAction(actor, "pr11_case", actionBody)).id, action.id);
    const instruction = await db.externalInstruction.findUniqueOrThrow({ where: { id: action.externalInstructionId } });
    assert.equal((instruction.request as { dispatchProhibited?: boolean }).dispatchProhibited, true);
    assert.equal(instruction.state, "SHADOW_RECORDED");

    const observedResponse = {
      transactionRef: "synthetic://token-transfer/1",
      instructionRequestDigest: instruction.requestDigest,
      expectedDigest: action.expectedDigest,
    };
    await evidence("pr11_ack_evidence", "TOKEN_ACTION_ACKNOWLEDGEMENT", sha256Digest(observedResponse));
    await assert.rejects(service.observeAction(actor, "pr11_case", action.id, {
      externalAcknowledgementId: "pr11-ack-wrong-binding",
      status: "SUCCEEDED",
      finalityClass: "FINAL",
      signatureStatus: "VERIFIED",
      response: { ...observedResponse, expectedDigest: sha256Digest({ wrong: true }) },
      evidenceObjectId: "pr11_ack_evidence",
      acknowledgedAt: now.toISOString(),
      reason: "Synthetic wrong-binding rejection",
      stepUpEvidenceId: "pr11_step_observe_wrong",
    }), /bind the exact instruction/);

    const acknowledgement = await service.observeAction(actor, "pr11_case", action.id, {
      externalAcknowledgementId: "pr11-ack-1",
      status: "SUCCEEDED",
      finalityClass: "FINAL",
      signatureStatus: "VERIFIED",
      response: observedResponse,
      evidenceObjectId: "pr11_ack_evidence",
      acknowledgedAt: now.toISOString(),
      reason: "Synthetic authenticated observation",
      stepUpEvidenceId: "pr11_step_observe",
    });
    assert.equal(acknowledgement.finalityClass, "FINAL");

    const matchedBody: Parameters<TokenRepresentationService["reconcile"]>[2] = {
      tokenSupplyMinor: "100",
      tokenHoldings: [{ holderRef: "did:holder:a", unitsMinor: "100" }],
      economicInterests: [{ holderRef: "did:holder:a", unitsMinor: "100" }],
      authoritativeRecord: [{ holderRef: "did:holder:a", unitsMinor: "100" }],
      evidenceObjectId: "pr11_reconciliation_evidence",
      sourceAsOfAt: now.toISOString(),
      idempotencyKey: fixtureIdempotencyKey("matched"),
      reason: "Synthetic exact reconciliation",
      stepUpEvidenceId: "pr11_step_reconcile",
    };
    await evidence("pr11_reconciliation_evidence", "TOKEN_RECONCILIATION", sha256Digest({
      tokenSupplyMinor: matchedBody.tokenSupplyMinor,
      tokenHoldings: matchedBody.tokenHoldings,
      economicInterests: matchedBody.economicInterests,
      authoritativeRecord: matchedBody.authoritativeRecord,
      sourceAsOfAt: matchedBody.sourceAsOfAt,
    }));
    const matched = await service.reconcile(actor, "pr11_case", matchedBody);
    assert.equal(matched.reconciliationState, "MATCHED");
    assert.equal((await service.reconcile(actor, "pr11_case", matchedBody)).id, matched.id);
    assert.equal((await db.tokenAction.findUniqueOrThrow({ where: { id: action.id } })).state, "RECONCILED");

    const brokenBody: Parameters<TokenRepresentationService["reconcile"]>[2] = {
      ...matchedBody,
      authoritativeRecord: [{ holderRef: "did:holder:b", unitsMinor: "100" }],
      idempotencyKey: fixtureIdempotencyKey("break"),
      reason: "Synthetic divergence rehearsal",
      stepUpEvidenceId: "pr11_step_reconcile_break",
      evidenceObjectId: "pr11_break_evidence",
    };
    await evidence("pr11_break_evidence", "TOKEN_RECONCILIATION", sha256Digest({
      tokenSupplyMinor: brokenBody.tokenSupplyMinor,
      tokenHoldings: brokenBody.tokenHoldings,
      economicInterests: brokenBody.economicInterests,
      authoritativeRecord: brokenBody.authoritativeRecord,
      sourceAsOfAt: brokenBody.sourceAsOfAt,
    }));
    const broken = await service.reconcile(actor, "pr11_case", brokenBody);
    assert.equal(broken.reconciliationState, "BREAK_OPEN");
    assert.equal(await db.tokenReconciliationBreak.count({ where: { tokenRepresentationId: linked.id, status: "OPEN" } }), 1);
    assert.equal((await db.tokenRepresentation.findUniqueOrThrow({ where: { id: linked.id } })).status, "BREAK_OPEN");
    assert.equal((await db.tokenAction.findUniqueOrThrow({ where: { id: action.id } })).state, "BREAK_OPEN");

    await evidence("pr11_post_break_match_evidence", "TOKEN_RECONCILIATION", sha256Digest({
      tokenSupplyMinor: matchedBody.tokenSupplyMinor,
      tokenHoldings: matchedBody.tokenHoldings,
      economicInterests: matchedBody.economicInterests,
      authoritativeRecord: matchedBody.authoritativeRecord,
      sourceAsOfAt: matchedBody.sourceAsOfAt,
    }));
    const postBreakMatch = await service.reconcile(actor, "pr11_case", {
      ...matchedBody,
      evidenceObjectId: "pr11_post_break_match_evidence",
      idempotencyKey: "pr11-reconcile-post-break-match",
      reason: "A later match must not hide an unresolved historic break",
      stepUpEvidenceId: "pr11_step_post_break_match",
    });
    assert.equal(postBreakMatch.reconciliationState, "MATCHED");
    assert.equal((await db.tokenRepresentation.findUniqueOrThrow({ where: { id: linked.id } })).status, "BREAK_OPEN");
    assert.equal(await db.auditLog.count({ where: { event: { startsWith: "rail.token_" } } }), 6);
  } finally {
    await db.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
