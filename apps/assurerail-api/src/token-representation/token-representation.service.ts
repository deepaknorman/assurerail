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
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import { compareTokenRepresentation, exactNonNegativeInteger } from "./token-reconciliation";

export const TOKEN_ACTION_TYPES = ["MINT", "TRANSFER", "PAYMENT", "ANCHOR", "AMORTISE_BURN", "CLOSE_BURN"] as const;
export type TokenActionType = (typeof TOKEN_ACTION_TYPES)[number];

type LinkBody = {
  noteId?: string;
  authoritativeRecordDeclarationId?: string;
  network?: string;
  unitsScale?: number;
  idempotencyKey?: string;
  reason?: string;
  stepUpEvidenceId?: string;
};

type PrepareActionBody = {
  providerReferenceId?: string;
  actionType?: TokenActionType;
  expected?: unknown;
  idempotencyKey?: string;
  reason?: string;
  stepUpEvidenceId?: string;
};

type ObserveActionBody = {
  externalAcknowledgementId?: string;
  status?: string;
  finalityClass?: string;
  response?: unknown;
  signatureStatus?: string;
  acknowledgedAt?: string;
  evidenceObjectId?: string;
  reason?: string;
  stepUpEvidenceId?: string;
};

type ReconcileBody = {
  tokenSupplyMinor?: string;
  tokenHoldings?: unknown;
  economicInterests?: unknown;
  authoritativeRecord?: unknown;
  evidenceObjectId?: string;
  sourceAsOfAt?: string;
  idempotencyKey?: string;
  reason?: string;
  stepUpEvidenceId?: string;
};

function enabled(): void {
  const flags = inspectPersistenceFlags(process.env);
  const replay = flags.transactionCase === "shadow" && flags.tokenisedDa === "allow_list";
  const live = flags.transactionCase === "on" && flags.tokenisedDa === "live";
  if ((!replay && !live) || flags.externalActionSaga !== "required") {
    throw new ForbiddenException("tokenised-DA representation adapter is disabled");
  }
}

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function json(value: unknown, name: string): Prisma.InputJsonValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException(`${name} must be an object`);
  try {
    return toCanonicalValue(value) as Prisma.InputJsonValue;
  } catch (error) {
    throw new BadRequestException(`${name} is not canonical JSON: ${(error as Error).message}`);
  }
}

export function tokenActionExpected(actionType: TokenActionType, value: unknown): Prisma.InputJsonValue {
  const expected = json(value, "expected") as unknown as Record<string, unknown>;
  const positiveUnits = (field: string) => {
    let amount: string;
    try { amount = exactNonNegativeInteger(expected[field], `expected.${field}`); }
    catch (error) { throw new BadRequestException((error as Error).message); }
    if (amount === "0") throw new BadRequestException(`expected.${field} must be positive`);
    return amount;
  };
  const party = (field: string) => required(expected[field], `expected.${field}`, 300);
  if (actionType === "TRANSFER") {
    const sellerRef = party("sellerRef");
    const buyerRef = party("buyerRef");
    if (sellerRef === buyerRef) throw new BadRequestException("expected sellerRef and buyerRef must differ");
    positiveUnits("unitsMinor");
  } else if (actionType === "PAYMENT") {
    const payerRef = party("payerRef");
    const payeeRef = party("payeeRef");
    if (payerRef === payeeRef) throw new BadRequestException("expected payerRef and payeeRef must differ");
    positiveUnits("amountMinor");
    const currency = required(expected.currency, "expected.currency", 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException("expected.currency must be a three-letter code");
    if (!Number.isSafeInteger(expected.scale) || (expected.scale as number) < 0 || (expected.scale as number) > 18) {
      throw new BadRequestException("expected.scale must be a safe integer from 0 to 18");
    }
  } else if (["MINT", "AMORTISE_BURN", "CLOSE_BURN"].includes(actionType)) {
    positiveUnits("unitsMinor");
  } else if (actionType === "ANCHOR") {
    const payloadDigest = required(expected.payloadDigest, "expected.payloadDigest", 80);
    if (!/^sha256:[0-9a-f]{64}$/.test(payloadDigest)) throw new BadRequestException("expected.payloadDigest must be a sha256 digest");
  }
  return toCanonicalValue(expected) as Prisma.InputJsonValue;
}

function date(value: unknown, name: string): Date {
  const parsed = new Date(required(value, name, 80));
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function commandDigest(scope: string, body: Readonly<Record<string, unknown>>): string {
  const { stepUpEvidenceId: _stepUpEvidenceId, ...request } = body;
  return sha256Digest({ scope, request: toCanonicalValue(request) });
}

function unique(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

@Injectable()
export class TokenRepresentationService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
  ) {}

  async get(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.tokenRepresentation.findUnique({
      where: { transactionCaseId: caseId },
      include: {
        note: true,
        authoritativeRecordDeclaration: true,
        actions: { include: { externalInstruction: { include: { acknowledgements: { orderBy: { acknowledgedAt: "asc" } } } } }, orderBy: { sequence: "asc" } },
        reconciliationSnapshots: { orderBy: { version: "desc" }, take: 20, include: { breaks: true } },
        breaks: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" } },
      },
    });
  }

  async link(actor: RoomActor, caseId: string, body: LinkBody) {
    const { transactionCase, authority } = await this.requireOwner(actor, caseId);
    this.assertTokenisedDaCase(transactionCase);
    await this.requireFunctionAssignment(caseId, actor.actingInstitutionId);
    const noteId = required(body.noteId, "noteId");
    const authoritativeRecordDeclarationId = required(body.authoritativeRecordDeclarationId, "authoritativeRecordDeclarationId");
    const network = required(body.network, "network", 100);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 200);
    const unitsScale = body.unitsScale ?? 0;
    if (!Number.isSafeInteger(unitsScale) || unitsScale < 0 || unitsScale > 18) {
      throw new BadRequestException("unitsScale must be a safe integer from 0 to 18");
    }
    const requestDigest = commandDigest(`token-representation:link:${caseId}`, { noteId, authoritativeRecordDeclarationId, network, unitsScale, idempotencyKey, reason });
    const replay = await this.db.tokenRepresentation.findUnique({ where: { transactionCaseId: caseId } });
    if (replay) {
      if (replay.linkageIdempotencyKey === idempotencyKey && replay.linkageRequestDigest === requestDigest) return replay;
      throw new ConflictException("transaction case already has a different token representation");
    }
    const [note, declaration] = await Promise.all([
      this.db.note.findUnique({ where: { id: noteId } }),
      this.db.authoritativeRecordDeclaration.findUnique({ where: { id: authoritativeRecordDeclarationId } }),
    ]);
    if (!note) throw new NotFoundException("legacy Note not found");
    if (!declaration || declaration.transactionCaseId !== caseId || declaration.status !== "ACTIVE") {
      throw new BadRequestException("an active case-scoped authoritative-record declaration is required");
    }
    try {
      const representation = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "TOKEN_REPRESENTATION_LINK",
          institutionId: actor.actingInstitutionId,
        }, tx);
        const created = await tx.tokenRepresentation.create({ data: {
          id: `trep_${randomUUID()}`,
          transactionCaseId: caseId,
          noteId,
          authoritativeRecordDeclarationId,
          representationType: "TOKENISED",
          authorityMode: "MIRROR",
          network,
          tokenId: note.tokenId,
          unitsScale,
          status: "LINKED",
          linkageIdempotencyKey: idempotencyKey,
          linkageRequestDigest: requestDigest,
          linkedByUserId: actor.actorUserId,
          linkedByMandateId: authority.mandateId!,
          linkageStepUpId: stepUpEvidenceId,
        } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_representation.linked", detail: {
          caseId, representationId: created.id, noteId, authorityMode: "MIRROR", authoritativeRecordDeclarationId,
          requestDigest, reason, authorityMandateId: authority.mandateId,
        } });
        return created;
      });
      audit("rail.token_representation.linked", { caseId, representationId: representation.id, noteId });
      return representation;
    } catch (error) {
      if (unique(error)) throw new ConflictException("Note or transaction case is already linked to a token representation");
      throw error;
    }
  }

  async prepareAction(actor: RoomActor, caseId: string, body: PrepareActionBody) {
    const { authority } = await this.requireOwner(actor, caseId);
    await this.requireFunctionAssignment(caseId, actor.actingInstitutionId);
    const representation = await this.requireRepresentation(caseId);
    const providerReferenceId = required(body.providerReferenceId, "providerReferenceId");
    const actionType = required(body.actionType, "actionType", 40) as TokenActionType;
    if (!(TOKEN_ACTION_TYPES as readonly string[]).includes(actionType)) {
      throw new BadRequestException(`actionType must be one of: ${TOKEN_ACTION_TYPES.join(", ")}`);
    }
    if (inspectPersistenceFlags(process.env).tokenisedDa === "live") {
      throw new ForbiddenException("live token actions must use the certified connector command endpoint");
    }
    const expected = tokenActionExpected(actionType, body.expected);
    const expectedDigest = sha256Digest(expected);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 200);
    const requestDigest = commandDigest(`token-action:prepare:${caseId}:${representation.id}`, { providerReferenceId, actionType, expected, idempotencyKey, reason });
    const replay = await this.db.tokenAction.findUnique({ where: { tokenRepresentationId_idempotencyKey: { tokenRepresentationId: representation.id, idempotencyKey } } });
    if (replay) {
      if (replay.requestDigest === requestDigest) return replay;
      throw new ConflictException("idempotency key was already used with a different token action");
    }
    const provider = await this.db.providerReference.findUnique({ where: { id: providerReferenceId } });
    if (!provider || provider.status !== "ACTIVE" || (provider.transactionCaseId && provider.transactionCaseId !== caseId)) {
      throw new BadRequestException("an active provider reference scoped to this case or platform is required");
    }
    try {
      return await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "TOKEN_ACTION_PREPARE",
          institutionId: actor.actingInstitutionId,
        }, tx);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`token-action:${representation.id}`}))`;
        const last = await tx.tokenAction.findFirst({ where: { tokenRepresentationId: representation.id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
        const instruction = await tx.externalInstruction.create({ data: {
          id: `ext_${randomUUID()}`,
          providerReferenceId,
          instructionType: `TOKEN_${actionType}`,
          idempotencyKey: `token:${representation.id}:${idempotencyKey}`,
          requestDigest,
          request: { representationId: representation.id, actionType, expected, executionMode: "OBSERVE_ONLY", dispatchProhibited: true },
          state: "SHADOW_RECORDED",
          institutionId: actor.actingInstitutionId,
          transactionCaseId: caseId,
        } });
        const action = await tx.tokenAction.create({ data: {
          id: `tact_${randomUUID()}`,
          tokenRepresentationId: representation.id,
          externalInstructionId: instruction.id,
          actionType,
          sequence: (last?.sequence ?? 0) + 1,
          executionMode: "OBSERVE_ONLY",
          state: "PREPARED",
          expected,
          expectedDigest,
          idempotencyKey,
          requestDigest,
          createdByUserId: actor.actorUserId,
          createdByMandateId: authority.mandateId!,
          stepUpEvidenceId,
        } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_action.prepared", detail: {
          caseId, representationId: representation.id, actionId: action.id, externalInstructionId: instruction.id,
          actionType, executionMode: "OBSERVE_ONLY", dispatchProhibited: true, requestDigest, reason,
          authorityMandateId: authority.mandateId,
        } });
        return action;
      });
    } catch (error) {
      if (unique(error)) throw new ConflictException("token action already exists or sequence changed concurrently; retry with the same idempotency key");
      throw error;
    }
  }

  async observeAction(actor: RoomActor, caseId: string, actionId: string, body: ObserveActionBody) {
    const { authority } = await this.requireOwner(actor, caseId);
    await this.requireFunctionAssignment(caseId, actor.actingInstitutionId);
    const action = await this.loadAction(caseId, actionId);
    const externalAcknowledgementId = required(body.externalAcknowledgementId, "externalAcknowledgementId", 300);
    const status = required(body.status, "status", 40).toUpperCase();
    const finalityClass = required(body.finalityClass, "finalityClass", 40).toUpperCase();
    const signatureStatus = required(body.signatureStatus, "signatureStatus", 40).toUpperCase();
    if (signatureStatus !== "VERIFIED") throw new BadRequestException("external acknowledgement signature must be VERIFIED");
    if (!["SUCCEEDED", "FAILED", "PENDING"].includes(status)) throw new BadRequestException("status must be SUCCEEDED, FAILED or PENDING");
    if (!["FINAL", "PROVISIONAL", "AMBIGUOUS"].includes(finalityClass)) throw new BadRequestException("finalityClass must be FINAL, PROVISIONAL or AMBIGUOUS");
    const response = json(body.response, "response");
    const responseBinding = response as unknown as { instructionRequestDigest?: unknown; expectedDigest?: unknown };
    if (responseBinding.instructionRequestDigest !== action.externalInstruction.requestDigest || responseBinding.expectedDigest !== action.expectedDigest) {
      throw new BadRequestException("external acknowledgement must bind the exact instruction request and expected action digests");
    }
    const responseDigest = sha256Digest(response);
    const acknowledgedAt = date(body.acknowledgedAt, "acknowledgedAt");
    if (acknowledgedAt.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException("acknowledgedAt cannot be materially in the future");
    const reason = required(body.reason, "reason", 1000);
    const evidenceObjectId = required(body.evidenceObjectId, "evidenceObjectId");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 200);
    const acknowledgementEvidence = await this.requireEvidence(evidenceObjectId, caseId);
    if (acknowledgementEvidence.payloadDigest !== responseDigest) {
      throw new BadRequestException("acknowledgement evidence digest does not match the authenticated response");
    }
    const existing = await this.db.externalAcknowledgement.findUnique({
      where: { providerReferenceId_externalAcknowledgementId: { providerReferenceId: action.externalInstruction.providerReferenceId, externalAcknowledgementId } },
    });
    if (existing) {
      if (existing.externalInstructionId === action.externalInstructionId && existing.responseDigest === responseDigest) return existing;
      throw new ConflictException("external acknowledgement ID was already used with different content");
    }
    const terminal = status === "SUCCEEDED" && finalityClass === "FINAL";
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actor.actorUserId,
        sessionId: actor.actorSessionId,
        purpose: "TOKEN_ACTION_OBSERVE",
        institutionId: actor.actingInstitutionId,
      }, tx);
      const acknowledgement = await tx.externalAcknowledgement.create({ data: {
        id: `ack_${randomUUID()}`,
        externalInstructionId: action.externalInstructionId,
        providerReferenceId: action.externalInstruction.providerReferenceId,
        externalAcknowledgementId,
        status,
        finalityClass,
        responseDigest,
        response,
        storageRef: `evidence:${evidenceObjectId}`,
        signatureStatus,
        acknowledgedAt,
        institutionId: actor.actingInstitutionId,
        transactionCaseId: caseId,
      } });
      await tx.externalInstruction.update({ where: { id: action.externalInstructionId }, data: {
        state: terminal ? "ACKNOWLEDGED" : "AMBIGUOUS",
        terminalAt: terminal ? new Date() : null,
        lastError: terminal ? null : `observed ${status}/${finalityClass}`,
      } });
      await tx.tokenAction.update({ where: { id: action.id }, data: { state: terminal ? "OBSERVED" : "BREAK_OPEN" } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_action.observed", detail: {
        caseId, representationId: action.tokenRepresentationId, actionId: action.id, externalInstructionId: action.externalInstructionId,
        externalAcknowledgementId, status, finalityClass, signatureStatus, responseDigest, evidenceObjectId, reason,
        authorityMandateId: authority.mandateId,
      } });
      return acknowledgement;
    });
  }

  async reconcile(actor: RoomActor, caseId: string, body: ReconcileBody) {
    const { transactionCase, authority } = await this.requireOwner(actor, caseId);
    await this.requireFunctionAssignment(caseId, actor.actingInstitutionId);
    const representation = await this.requireRepresentation(caseId);
    const evidenceObjectId = required(body.evidenceObjectId, "evidenceObjectId");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 200);
    const sourceAsOfAt = date(body.sourceAsOfAt, "sourceAsOfAt");
    if (sourceAsOfAt.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException("sourceAsOfAt cannot be materially in the future");
    let comparison: ReturnType<typeof compareTokenRepresentation>;
    try {
      comparison = compareTokenRepresentation({
        tokenSupplyMinor: required(body.tokenSupplyMinor, "tokenSupplyMinor", 100),
        tokenHoldings: body.tokenHoldings as never,
        economicInterests: body.economicInterests as never,
        authoritativeRecord: body.authoritativeRecord as never,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const requestDigest = commandDigest(`token-reconciliation:${caseId}:${representation.id}`, {
      tokenSupplyMinor: comparison.tokenSupplyMinor,
      tokenHoldings: comparison.tokenHoldings,
      economicInterests: comparison.economicInterests,
      authoritativeRecord: comparison.authoritativeRecord,
      evidenceObjectId,
      sourceAsOfAt: sourceAsOfAt.toISOString(),
      idempotencyKey,
      reason,
    });
    const replay = await this.db.tokenReconciliationSnapshot.findUnique({ where: {
      tokenRepresentationId_idempotencyKey: { tokenRepresentationId: representation.id, idempotencyKey },
    } });
    if (replay) {
      if (replay.requestDigest === requestDigest) return replay;
      throw new ConflictException("idempotency key was already used with different reconciliation evidence");
    }
    const reconciliationEvidence = await this.requireEvidence(evidenceObjectId, caseId);
    const reconciliationEvidenceDigest = sha256Digest({
      tokenSupplyMinor: comparison.tokenSupplyMinor,
      tokenHoldings: comparison.tokenHoldings,
      economicInterests: comparison.economicInterests,
      authoritativeRecord: comparison.authoritativeRecord,
      sourceAsOfAt: sourceAsOfAt.toISOString(),
    });
    if (reconciliationEvidence.payloadDigest !== reconciliationEvidenceDigest) {
      throw new BadRequestException("reconciliation evidence digest does not bind the submitted supply, positions and source timestamp");
    }
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actor.actorUserId,
        sessionId: actor.actorSessionId,
        purpose: "TOKEN_RECONCILIATION_RECORD",
        institutionId: actor.actingInstitutionId,
      }, tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`token-reconcile:${representation.id}`}))`;
      const last = await tx.tokenReconciliationSnapshot.findFirst({ where: { tokenRepresentationId: representation.id }, orderBy: { version: "desc" }, select: { version: true } });
      const snapshot = await tx.tokenReconciliationSnapshot.create({ data: {
        id: `trs_${randomUUID()}`,
        tokenRepresentationId: representation.id,
        version: (last?.version ?? 0) + 1,
        idempotencyKey,
        requestDigest,
        tokenSupplyMinor: comparison.tokenSupplyMinor,
        tokenHoldings: comparison.tokenHoldings as Prisma.InputJsonValue,
        tokenHoldingsDigest: sha256Digest(comparison.tokenHoldings),
        economicInterests: comparison.economicInterests as Prisma.InputJsonValue,
        economicInterestDigest: sha256Digest(comparison.economicInterests),
        authoritativeRecord: comparison.authoritativeRecord as Prisma.InputJsonValue,
        authoritativeRecordDigest: sha256Digest(comparison.authoritativeRecord),
        evidenceObjectId,
        sourceAsOfAt,
        comparison: comparison.checks as unknown as Prisma.InputJsonValue,
        comparisonDigest: comparison.comparisonDigest,
        reconciliationState: comparison.matched ? "MATCHED" : "BREAK_OPEN",
        recordedByUserId: actor.actorUserId,
        recordedByMandateId: authority.mandateId!,
        stepUpEvidenceId,
      } });
      for (const check of comparison.checks.filter((item) => !item.matched)) {
        await tx.tokenReconciliationBreak.create({ data: {
          id: `trb_${randomUUID()}`,
          tokenRepresentationId: representation.id,
          reconciliationSnapshotId: snapshot.id,
          breakCode: check.code,
          severity: "CRITICAL",
          expected: check.expected as Prisma.InputJsonValue,
          observed: check.observed as Prisma.InputJsonValue,
          expectedDigest: check.expectedDigest,
          observedDigest: check.observedDigest,
          blockedCapabilities: ["TOKEN_TRANSFER", "TOKEN_BURN", "CASE_COMPLETION"],
          ownerInstitutionId: transactionCase.ownerInstitutionId,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
          openedByUserId: actor.actorUserId,
        } });
      }
      const openBreaks = await tx.tokenReconciliationBreak.count({ where: { tokenRepresentationId: representation.id, status: "OPEN" } });
      const representationReconciled = comparison.matched && openBreaks === 0;
      await tx.tokenRepresentation.update({ where: { id: representation.id }, data: { status: representationReconciled ? "RECONCILED" : "BREAK_OPEN" } });
      if (representationReconciled) {
        await tx.tokenAction.updateMany({ where: { tokenRepresentationId: representation.id, state: "OBSERVED" }, data: { state: "RECONCILED" } });
      } else {
        await tx.tokenAction.updateMany({ where: { tokenRepresentationId: representation.id, state: "RECONCILED" }, data: { state: "BREAK_OPEN" } });
      }
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_representation.reconciled", detail: {
        caseId, representationId: representation.id, snapshotId: snapshot.id, version: snapshot.version,
        reconciliationState: snapshot.reconciliationState, representationStatus: representationReconciled ? "RECONCILED" : "BREAK_OPEN", openBreaks,
        comparisonDigest: comparison.comparisonDigest,
        evidenceObjectId, reason, authorityMandateId: authority.mandateId,
      } });
      return snapshot;
    });
  }

  private async requireEvidence(evidenceObjectId: string, caseId: string) {
    const item = await this.db.evidenceObject.findUnique({
      where: { id: evidenceObjectId },
      include: { institution: { include: { admission: true } }, versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const version = item?.versions[0];
    const now = new Date();
    const transactionCase = item ? await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } }) : null;
    const participatingInstitution = Boolean(item && transactionCase && (transactionCase.ownerInstitutionId === item.institutionId ||
      transactionCase.parties.some((party) => party.institutionId === item.institutionId && party.status === "ACTIVE")));
    if (!item || item.transactionCaseId !== caseId || !participatingInstitution || item.status !== "AVAILABLE" ||
      item.institution.status !== "ACTIVE" || item.institution.admission?.status !== "ADMITTED" ||
      (item.institution.admission.effectiveAt && item.institution.admission.effectiveAt > now) ||
      (item.institution.admission.expiresAt && item.institution.admission.expiresAt <= now) ||
      !version || version.validationStatus !== "VALID" || version.signatureStatus !== "VERIFIED" ||
      version.result !== "VERIFIED" || (version.expiresAt && version.expiresAt <= now)) {
      throw new BadRequestException("evidence must be current, signed, valid, verified, available and supplied by an active participant in this case");
    }
    return { payloadDigest: version.payloadDigest };
  }

  private async requireCase(actor: RoomActor, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE" | "OPERATE_ROUTE") {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    if (!transactionCase) throw new NotFoundException("transaction case not found");
    const participant = transactionCase.ownerInstitutionId === actor.actingInstitutionId ||
      transactionCase.parties.some((party) => party.institutionId === actor.actingInstitutionId && party.status === "ACTIVE");
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
    const result = await this.requireCase(actor, caseId, "OPERATE_ROUTE");
    if (result.transactionCase.ownerInstitutionId !== actor.actingInstitutionId) {
      throw new ForbiddenException("only the case-owning institution may govern the token representation");
    }
    this.assertTokenisedDaCase(result.transactionCase);
    const routeEntitlement = await this.access.evaluateRoute(actor.actingInstitutionId, {
      transactionRoute: result.transactionCase.transactionRoute,
      representation: result.transactionCase.representation,
      assetClass: result.transactionCase.assetClass,
      lifecycleLeg: result.transactionCase.lifecycleLeg,
      materialFunction: "TOKEN_REPRESENTATION_MANAGEMENT",
      operatingMode: result.transactionCase.operatingMode,
    });
    if (!routeEntitlement.allowed) {
      throw new ForbiddenException(`token representation route entitlement denied: ${routeEntitlement.code}`);
    }
    return result;
  }

  private assertTokenisedDaCase(transactionCase: { transactionRoute: string; representation: string; operatingMode: string; lifecycleLeg: string }) {
    if (transactionCase.transactionRoute !== "DA" || transactionCase.representation !== "TOKENISED") {
      throw new BadRequestException("token representation adapter requires a DA/TOKENISED transaction case");
    }
    const flags = inspectPersistenceFlags(process.env);
    const validMode = flags.tokenisedDa === "allow_list"
      ? ["REPLAY", "SHADOW"].includes(transactionCase.operatingMode)
      : flags.tokenisedDa === "live" && ["CONTROLLED_LIVE", "PRODUCTION"].includes(transactionCase.operatingMode);
    if (!validMode) {
      throw new BadRequestException("token representation case mode does not match its replay/live feature mode");
    }
    if (transactionCase.lifecycleLeg !== "INITIAL_TRANSFER_OR_ISSUE") {
      throw new BadRequestException("PR-11 supports initial tokenised DA only; secondary activity remains unavailable");
    }
  }

  private async requireFunctionAssignment(caseId: string, institutionId: string) {
    const now = new Date();
    const assignment = await this.db.caseFunctionAssignment.findFirst({ where: {
      transactionCaseId: caseId,
      materialFunction: "TOKEN_REPRESENTATION_MANAGEMENT",
      performerInstitutionId: institutionId,
      status: "ACTIVE",
      performer: { not: "PROHIBITED" },
      AND: [{ OR: [{ effectiveAt: null }, { effectiveAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    } });
    if (!assignment) throw new ConflictException("an active TOKEN_REPRESENTATION_MANAGEMENT function assignment is required");
  }

  private async requireRepresentation(caseId: string) {
    const representation = await this.db.tokenRepresentation.findUnique({ where: { transactionCaseId: caseId } });
    if (!representation) throw new NotFoundException("token representation not linked");
    if (representation.authorityMode !== "MIRROR") throw new ConflictException("unsupported token authority mode");
    return representation;
  }

  private async loadAction(caseId: string, actionId: string) {
    const action = await this.db.tokenAction.findUnique({
      where: { id: actionId },
      include: { tokenRepresentation: true, externalInstruction: true },
    });
    if (!action || action.tokenRepresentation.transactionCaseId !== caseId) throw new NotFoundException("token action not found");
    if (action.executionMode !== "OBSERVE_ONLY") throw new ConflictException("unsupported token action execution mode");
    return action;
  }

  private actorRef(actor: RoomActor) {
    return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`;
  }
}
