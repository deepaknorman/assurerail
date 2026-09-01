import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { canonicalSerialize, sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { ConnectorSecretVaultService } from "../integrations/connector-secret-vault.service";
import { OperationalActivationGuardService } from "../operational-readiness/operational-activation-guard.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { WebhookEgressService } from "../platform/webhook-egress.service";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import { tokenActionExpected } from "./token-representation.service";

export const TOKEN_CUSTODY_MODELS = ["EXTERNAL_CUSTODIAN", "INSTITUTION_CONTROLLED", "MPC_PROVIDER"] as const;
export const LIVE_TOKEN_CONNECTOR_ACTION_TYPES = ["MINT", "TRANSFER", "ANCHOR", "AMORTISE_BURN", "CLOSE_BURN"] as const;
export type LiveTokenConnectorActionType = (typeof LIVE_TOKEN_CONNECTOR_ACTION_TYPES)[number];

export const TOKEN_ACTION_CAPABILITIES: Readonly<Record<LiveTokenConnectorActionType, string>> = Object.freeze({
  MINT: "assurerail.da.token.mint.v1",
  TRANSFER: "assurerail.da.token.transfer.v1",
  ANCHOR: "assurerail.da.token.anchor.v1",
  AMORTISE_BURN: "assurerail.da.token.amortise-burn.v1",
  CLOSE_BURN: "assurerail.da.token.close-burn.v1",
});

type Actor = RoomActor;

function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function date(value: unknown, name: string): Date {
  const result = new Date(required(value, name, 80));
  if (!Number.isFinite(result.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return result;
}

function unique(error: unknown): boolean { return (error as { code?: string } | null)?.code === "P2002"; }

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8"); const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function commandDigest(scope: string, body: Readonly<Record<string, unknown>>): string {
  const { stepUpEvidenceId: _stepUpEvidenceId, ...request } = body;
  return sha256Digest({ scope, request: toCanonicalValue(request) });
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

export interface VerifiedTokenAcknowledgement {
  readonly observation: Readonly<Record<string, string>>;
  readonly responseDigest: string;
  readonly acknowledgedAt: Date;
}

export function verifyTokenConnectorAcknowledgement(
  raw: Readonly<Record<string, unknown>>,
  expected: { instructionId: string; instructionRequestDigest: string; expectedDigest: string },
  secret: string,
  now = new Date(),
): VerifiedTokenAcknowledgement {
  const observation = {
    externalAcknowledgementId: required(raw.externalAcknowledgementId, "externalAcknowledgementId", 300),
    instructionId: required(raw.instructionId, "instructionId", 160),
    instructionRequestDigest: required(raw.instructionRequestDigest, "instructionRequestDigest", 80),
    expectedDigest: required(raw.expectedDigest, "expectedDigest", 80),
    status: required(raw.status, "status", 40), finalityClass: required(raw.finalityClass, "finalityClass", 40),
    externalTransactionRef: required(raw.externalTransactionRef, "externalTransactionRef", 300),
    outcomeDigest: required(raw.outcomeDigest, "outcomeDigest", 80), acknowledgedAt: required(raw.acknowledgedAt, "acknowledgedAt", 80),
  };
  if (observation.instructionId !== expected.instructionId
    || observation.instructionRequestDigest !== expected.instructionRequestDigest
    || observation.expectedDigest !== expected.expectedDigest) {
    throw new BadRequestException("token acknowledgement does not bind the exact instruction and expected action");
  }
  if (observation.status !== "SUCCEEDED" || observation.finalityClass !== "FINAL") {
    throw new ConflictException("token acknowledgement is not successful and final");
  }
  const acknowledgedAt = new Date(observation.acknowledgedAt);
  if (!Number.isFinite(acknowledgedAt.getTime()) || acknowledgedAt.getTime() > now.getTime() + 5 * 60_000) {
    throw new BadRequestException("acknowledgedAt is invalid");
  }
  const responseDigest = sha256Digest(observation);
  const signature = required(raw.signature, "signature", 300);
  if (!safeEqual(signature, createHmac("sha256", secret).update(responseDigest).digest("hex"))) {
    throw new ForbiddenException("token acknowledgement signature verification failed");
  }
  return { observation, responseDigest, acknowledgedAt };
}

@Injectable()
export class TokenConnectorService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
    private readonly activation: OperationalActivationGuardService,
    private readonly vault: ConnectorSecretVaultService,
    private readonly egress: WebhookEgressService,
  ) {}

  async listBindings(actor: Actor, caseId: string) {
    const { representation } = await this.requireOwner(actor, caseId);
    return this.db.tokenConnectorBinding.findMany({
      where: { tokenRepresentationId: representation.id },
      orderBy: { version: "desc" },
      select: {
        id: true, version: true, connectorRegistrationId: true, connectorCertificationId: true,
        connectorProfileRef: true, custodyInstitutionId: true, custodyModel: true, signingKeyReference: true,
        signingPolicyDigest: true, supportedActionTypes: true, status: true, proposalDigest: true,
        proposedAt: true, reviewedAt: true, effectiveAt: true, expiresAt: true, suspendedAt: true,
        reviewReason: true, suspensionReason: true,
      },
    });
  }

  async proposeBinding(actor: Actor, caseId: string, body: {
    connectorRegistrationId?: unknown; connectorCertificationId?: unknown; connectorProfileRef?: unknown;
    custodyInstitutionId?: unknown; custodyModel?: unknown; signingKeyReference?: unknown; signingPolicyDigest?: unknown;
    supportedActionTypes?: unknown; custodyEvidenceObjectId?: unknown; legalFinalityEvidenceObjectId?: unknown;
    operatingAcceptanceEvidenceObjectId?: unknown; effectiveAt?: unknown; expiresAt?: unknown;
    reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { transactionCase, authority, representation } = await this.requireOwner(actor, caseId);
    const connectorRegistrationId = required(body.connectorRegistrationId, "connectorRegistrationId", 160);
    const connectorCertificationId = required(body.connectorCertificationId, "connectorCertificationId", 160);
    const connectorProfileRef = required(body.connectorProfileRef, "connectorProfileRef", 240);
    const custodyInstitutionId = required(body.custodyInstitutionId, "custodyInstitutionId", 160);
    const custodyModel = required(body.custodyModel, "custodyModel", 60);
    if (!(TOKEN_CUSTODY_MODELS as readonly string[]).includes(custodyModel)) throw new BadRequestException("unsupported custodyModel");
    const signingKeyReference = required(body.signingKeyReference, "signingKeyReference", 500);
    if (/private|secret|seed|mnemonic/i.test(signingKeyReference) || signingKeyReference.length < 12) {
      throw new BadRequestException("signingKeyReference must be an external non-secret key/custody reference");
    }
    const signingPolicyDigest = this.digest(body.signingPolicyDigest, "signingPolicyDigest");
    if (!Array.isArray(body.supportedActionTypes) || body.supportedActionTypes.length === 0) throw new BadRequestException("supportedActionTypes must be a non-empty array");
    const supportedActionTypes = [...new Set(body.supportedActionTypes.map((value) => required(value, "supportedActionTypes[]", 40) as LiveTokenConnectorActionType))];
    if (supportedActionTypes.some((value) => !(LIVE_TOKEN_CONNECTOR_ACTION_TYPES as readonly string[]).includes(value))) {
      throw new BadRequestException("supportedActionTypes contains an unsupported token-connector action; payment must use a separately governed settlement connector");
    }
    const effectiveAt = date(body.effectiveAt, "effectiveAt");
    const expiresAt = date(body.expiresAt, "expiresAt");
    if (expiresAt <= effectiveAt || expiresAt.getTime() - effectiveAt.getTime() > 366 * 24 * 60 * 60_000) {
      throw new BadRequestException("binding expiry must follow effective time and be within 366 days");
    }
    const connector = await this.requireCertifiedConnector(connectorRegistrationId, connectorCertificationId, connectorProfileRef);
    if (connector.institutionId !== custodyInstitutionId) throw new BadRequestException("custody institution must own the certified connector");
    await this.requireCustodyAuthority(transactionCase, custodyInstitutionId);
    const custodyEvidence = await this.requireEvidence(required(body.custodyEvidenceObjectId, "custodyEvidenceObjectId", 160), caseId, "TOKEN_KEY_CUSTODY_ASSIGNMENT");
    const legalEvidence = await this.requireEvidence(required(body.legalFinalityEvidenceObjectId, "legalFinalityEvidenceObjectId", 160), caseId, "TOKEN_LEGAL_FINALITY");
    const operatingEvidence = await this.requireEvidence(required(body.operatingAcceptanceEvidenceObjectId, "operatingAcceptanceEvidenceObjectId", 160), caseId, "TOKEN_CONNECTOR_OPERATING_ACCEPTANCE");
    const reason = required(body.reason, "reason", 1000);
    const proposalDigest = sha256Digest({ caseId, representationId: representation.id, connectorRegistrationId, connectorCertificationId,
      connectorProfileRef, custodyInstitutionId, custodyModel, signingKeyReference, signingPolicyDigest,
      supportedActionTypes: [...supportedActionTypes].sort(), custodyEvidence, legalEvidence, operatingEvidence,
      effectiveAt: effectiveAt.toISOString(), expiresAt: expiresAt.toISOString(), reason });
    const existing = await this.db.tokenConnectorBinding.findUnique({ where: {
      tokenRepresentationId_proposalDigest: { tokenRepresentationId: representation.id, proposalDigest },
    } });
    if (existing) return existing;
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`token-binding:${representation.id}`}))`;
      const last = await tx.tokenConnectorBinding.findFirst({ where: { tokenRepresentationId: representation.id }, orderBy: { version: "desc" }, select: { version: true } });
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "TOKEN_CONNECTOR_BINDING_PROPOSE", institutionId: actor.actingInstitutionId }, tx);
      const binding = await tx.tokenConnectorBinding.create({ data: {
        id: `tcb_${randomUUID()}`, tokenRepresentationId: representation.id, version: (last?.version ?? 0) + 1,
        connectorRegistrationId, connectorCertificationId, connectorProfileRef, custodyInstitutionId, custodyModel,
        signingKeyReference, signingPolicyDigest, supportedActionTypes, custodyEvidenceObjectId: custodyEvidence.id,
        custodyEvidenceDigest: custodyEvidence.digest, legalFinalityEvidenceObjectId: legalEvidence.id,
        legalFinalityEvidenceDigest: legalEvidence.digest, operatingAcceptanceEvidenceObjectId: operatingEvidence.id,
        operatingAcceptanceEvidenceDigest: operatingEvidence.digest, proposalDigest, proposedByUserId: actor.actorUserId,
        proposedByMandateId: authority.mandateId!, proposalStepUpId: stepUpEvidenceId, effectiveAt, expiresAt,
      } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_connector.binding_proposed", detail: {
        caseId, bindingId: binding.id, connectorRegistrationId, connectorCertificationId, custodyInstitutionId,
        custodyModel, signingKeyReference, proposalDigest, externalEvidenceObjects: [custodyEvidence.id, legalEvidence.id, operatingEvidence.id],
      } });
      return binding;
    });
  }

  async reviewBinding(actor: Actor, caseId: string, bindingId: string, body: { approved?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    const { authority, representation } = await this.requireOwner(actor, caseId);
    const binding = await this.db.tokenConnectorBinding.findUnique({ where: { id: bindingId } });
    if (!binding || binding.tokenRepresentationId !== representation.id) throw new NotFoundException("token connector binding not found");
    if (binding.status !== "PROPOSED") throw new ConflictException("token connector binding is not awaiting review");
    if (binding.proposedByUserId === actor.actorUserId) throw new ForbiddenException("binding proposer cannot review their own proposal");
    if (typeof body.approved !== "boolean") throw new BadRequestException("approved must be boolean");
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    if (body.approved) {
      await this.requireCertifiedConnector(binding.connectorRegistrationId, binding.connectorCertificationId, binding.connectorProfileRef);
      await Promise.all([
        this.requireEvidence(binding.custodyEvidenceObjectId, caseId, "TOKEN_KEY_CUSTODY_ASSIGNMENT", binding.custodyEvidenceDigest),
        this.requireEvidence(binding.legalFinalityEvidenceObjectId, caseId, "TOKEN_LEGAL_FINALITY", binding.legalFinalityEvidenceDigest),
        this.requireEvidence(binding.operatingAcceptanceEvidenceObjectId, caseId, "TOKEN_CONNECTOR_OPERATING_ACCEPTANCE", binding.operatingAcceptanceEvidenceDigest),
      ]);
    }
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "TOKEN_CONNECTOR_BINDING_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`token-binding:${representation.id}`}))`;
      if (body.approved) await tx.tokenConnectorBinding.updateMany({ where: { tokenRepresentationId: representation.id, status: "ACTIVE" }, data: { status: "REVOKED" } });
      const changed = await tx.tokenConnectorBinding.updateMany({ where: { id: binding.id, status: "PROPOSED" }, data: {
        status: body.approved ? "ACTIVE" : "REJECTED", reviewedByUserId: actor.actorUserId, reviewedByMandateId: authority.mandateId!,
        reviewStepUpId: stepUpEvidenceId, reviewReason: reason, reviewedAt: new Date(),
      } });
      if (changed.count !== 1) throw new ConflictException("token connector binding changed concurrently");
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_connector.binding_reviewed", detail: {
        caseId, bindingId, approved: body.approved, reason, externalActivationStillRequired: true,
      } });
      return tx.tokenConnectorBinding.findUniqueOrThrow({ where: { id: binding.id } });
    });
  }

  async prepareLiveAction(actor: Actor, caseId: string, body: {
    actionType?: unknown; expected?: unknown; idempotencyKey?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { transactionCase, authority, representation } = await this.requireOwner(actor, caseId, true);
    const actionType = required(body.actionType, "actionType", 40) as LiveTokenConnectorActionType;
    if (!(LIVE_TOKEN_CONNECTOR_ACTION_TYPES as readonly string[]).includes(actionType)) {
      throw new BadRequestException("unsupported live token-connector actionType; payment requires the settlement saga/provider boundary");
    }
    const capabilityId = TOKEN_ACTION_CAPABILITIES[actionType];
    await this.activation.requireCapability(capabilityId);
    const expected = tokenActionExpected(actionType, body.expected);
    const expectedDigest = sha256Digest(expected);
    const binding = await this.activeBinding(representation.id, actionType);
    if (representation.status !== "RECONCILED") throw new ConflictException("token, economics and authoritative record must reconcile before a live action");
    const openBreaks = await this.db.tokenReconciliationBreak.count({ where: { tokenRepresentationId: representation.id, status: "OPEN" } });
    if (openBreaks !== 0) throw new ConflictException("open token reconciliation breaks block live action");
    const pending = await this.db.tokenAction.count({ where: { tokenRepresentationId: representation.id, state: { in: ["PREPARED", "OBSERVED", "BREAK_OPEN"] } } });
    if (pending !== 0) throw new ConflictException("a prior token action must be reconciled or cancelled before another live action");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const requestDigest = commandDigest(`token-live-action:${caseId}:${representation.id}`, { actionType, expected, idempotencyKey, reason,
      connectorBindingId: binding.id, capabilityId, authorityMode: "MIRROR" });
    const replay = await this.db.tokenAction.findUnique({ where: { tokenRepresentationId_idempotencyKey: { tokenRepresentationId: representation.id, idempotencyKey } } });
    if (replay) { if (replay.requestDigest !== requestDigest) throw new ConflictException("live action idempotency key was reused with different content"); return replay; }
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`token-live:${representation.id}`}))`;
        const current = await tx.tokenRepresentation.findUniqueOrThrow({ where: { id: representation.id } });
        if (current.status !== "RECONCILED") throw new ConflictException("token representation changed before live action preparation");
        const last = await tx.tokenAction.findFirst({ where: { tokenRepresentationId: representation.id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
          purpose: "TOKEN_LIVE_ACTION_PREPARE", institutionId: actor.actingInstitutionId }, tx);
        const instructionId = `ext_${randomUUID()}`;
        const request = { schemaVersion: "assurerail.token-instruction.v1", instructionId, caseId,
          representationId: representation.id, actionType, expected, expectedDigest, capabilityId,
          network: representation.network, tokenId: representation.tokenId, authorityMode: "MIRROR",
          custody: { institutionId: binding.custodyInstitutionId, model: binding.custodyModel,
            signingKeyReference: binding.signingKeyReference, signingPolicyDigest: binding.signingPolicyDigest },
          authoritativeRecordDeclarationId: representation.authoritativeRecordDeclarationId };
        const instructionDigest = sha256Digest(request);
        const instruction = await tx.externalInstruction.create({ data: {
          id: instructionId, providerReferenceId: binding.connectorRegistration.providerReferenceId!,
          instructionType: `TOKEN_${actionType}`, idempotencyKey: `token-live:${representation.id}:${idempotencyKey}`,
          requestDigest: instructionDigest, request: json(request), state: "PENDING", institutionId: actor.actingInstitutionId,
          transactionCaseId: caseId,
        } });
        const action = await tx.tokenAction.create({ data: {
          id: `tact_${randomUUID()}`, tokenRepresentationId: representation.id, externalInstructionId: instruction.id,
          connectorBindingId: binding.id, actionType, sequence: (last?.sequence ?? 0) + 1, executionMode: transactionCase.operatingMode,
          state: "PREPARED", expected, expectedDigest, idempotencyKey, requestDigest,
          createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId!, stepUpEvidenceId,
        } });
        await tx.tokenRepresentation.update({ where: { id: representation.id }, data: { status: "ACTION_PENDING" } });
        const event = { caseId, representationId: representation.id, actionId: action.id, instructionId: instruction.id,
          capabilityId, actionType, connectorBindingId: binding.id, instructionDigest };
        await tx.outboxMessage.create({ data: { id: `out_${randomUUID()}`, event: "rail.token_action.dispatch_requested",
          schemaId: "assurerail.token-action.event", schemaVersion: "1.0.0", payloadDigest: sha256Digest(event), payload: json(event),
          aggregateId: action.id, aggregateVersion: 1, institutionId: actor.actingInstitutionId, transactionCaseId: caseId,
          idempotencyKey: `token-action:${action.id}:dispatch-requested`, correlationId: caseId, state: "FANOUT_COMPLETE", completedAt: new Date(),
        } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_action.live_prepared", detail: { ...event,
          authorityMode: "MIRROR", reason, authorityMandateId: authority.mandateId } });
        return action;
      });
    } catch (error) { if (unique(error)) throw new ConflictException("live token action already exists or changed concurrently"); throw error; }
  }

  async pauseBinding(actor: Actor, caseId: string, bindingId: string, body: { reason?: unknown; stepUpEvidenceId?: unknown }) {
    const { representation } = await this.requireOwner(actor, caseId);
    const binding = await this.db.tokenConnectorBinding.findUnique({ where: { id: bindingId } });
    if (!binding || binding.tokenRepresentationId !== representation.id) throw new NotFoundException("token connector binding not found");
    if (binding.status !== "ACTIVE") throw new ConflictException("only an active binding can be safe-paused");
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "TOKEN_CONNECTOR_SAFE_PAUSE", institutionId: actor.actingInstitutionId }, tx);
      await tx.tokenConnectorBinding.update({ where: { id: binding.id }, data: { status: "SUSPENDED", suspendedByUserId: actor.actorUserId, suspensionReason: reason, suspendedAt: new Date() } });
      const instructions = await tx.externalInstruction.findMany({ where: { tokenAction: { connectorBindingId: binding.id, state: "PREPARED" }, state: "PENDING" }, select: { id: true } });
      if (instructions.length) {
        await tx.externalInstruction.updateMany({ where: { id: { in: instructions.map((item) => item.id) }, state: "PENDING" }, data: { state: "CANCELLED", terminalAt: new Date(), lastError: "SAFE_PAUSED_BEFORE_DISPATCH" } });
        await tx.tokenAction.updateMany({ where: { connectorBindingId: binding.id, state: "PREPARED", externalInstructionId: { in: instructions.map((item) => item.id) } }, data: { state: "CANCELLED" } });
      }
      const ambiguous = await tx.externalInstruction.count({ where: { tokenAction: { connectorBindingId: binding.id }, state: { in: ["AMBIGUOUS", "DISPATCHING"] } } });
      await tx.tokenRepresentation.update({ where: { id: representation.id }, data: { status: ambiguous ? "BREAK_OPEN" : "SUSPENDED" } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.token_connector.safe_paused", detail: { caseId, bindingId, reason, cancelledBeforeDispatch: instructions.length, ambiguousOutstanding: ambiguous } });
      return tx.tokenConnectorBinding.findUniqueOrThrow({ where: { id: binding.id } });
    });
  }

  async dispatch(actionId: string) {
    const action = await this.loadDispatchAction(actionId);
    if (action.externalInstruction.state !== "DISPATCHING") throw new ConflictException("token instruction is not claimed for dispatch");
    const actionType = action.actionType as LiveTokenConnectorActionType;
    if (!(LIVE_TOKEN_CONNECTOR_ACTION_TYPES as readonly string[]).includes(actionType)) throw new ConflictException("instruction is not a token-connector action");
    const capabilityId = TOKEN_ACTION_CAPABILITIES[actionType];
    await this.activation.requireCapability(capabilityId);
    this.assertBindingCurrent(action.connectorBinding!);
    const connector = action.connectorBinding!.connectorRegistration;
    const request = action.externalInstruction.request as unknown;
    const body = canonicalSerialize(toCanonicalValue(request));
    const timestamp = String(Date.now());
    const secret = await this.vault.get(connector.credentialVaultRef!);
    const signature = createHmac("sha256", secret).update([action.externalInstruction.id, timestamp, body].join("\n")).digest("hex");
    const response = await this.egress.post(connector.endpoint!, body, { "content-type": "application/json",
      "x-assurerail-instruction-id": action.externalInstruction.id, "x-assurerail-idempotency-key": action.externalInstruction.idempotencyKey,
      "x-assurerail-signature-timestamp": timestamp, "x-assurerail-signature": signature });
    if (!response.ok) throw new Error(`token connector returned HTTP ${response.status}`);
    let observation: Record<string, unknown>;
    try { observation = JSON.parse(response.body) as Record<string, unknown>; }
    catch { throw new Error("token connector returned invalid JSON"); }
    return this.recordSignedAcknowledgement(action.id, observation, secret);
  }

  async markDispatchFailure(actionId: string, error: unknown) {
    const action = await this.db.tokenAction.findUnique({ where: { id: actionId }, include: { externalInstruction: true } });
    if (!action) return;
    const message = (error as Error)?.message?.slice(0, 1000) || "token connector dispatch failed";
    const terminal = action.externalInstruction.attemptCount >= 8;
    const delaySeconds = Math.min(15 * 2 ** Math.max(0, action.externalInstruction.attemptCount - 1), 3600);
    await this.db.$transaction([
      this.db.externalInstruction.update({ where: { id: action.externalInstructionId }, data: { state: terminal ? "FAILED" : "AMBIGUOUS",
        lastError: message, lockedAt: null, lockOwner: null, nextAttemptAt: new Date(Date.now() + delaySeconds * 1000), terminalAt: terminal ? new Date() : null } }),
      this.db.tokenAction.update({ where: { id: action.id }, data: { state: "BREAK_OPEN" } }),
      this.db.tokenRepresentation.update({ where: { id: action.tokenRepresentationId }, data: { status: "BREAK_OPEN" } }),
    ]);
  }

  private async recordSignedAcknowledgement(actionId: string, raw: Record<string, unknown>, secret: string) {
    const action = await this.loadDispatchAction(actionId);
    if (action.externalInstruction.state !== "DISPATCHING") throw new ConflictException("token instruction is not awaiting a connector acknowledgement");
    const { observation, responseDigest, acknowledgedAt } = verifyTokenConnectorAcknowledgement(raw, {
      instructionId: action.externalInstruction.id,
      instructionRequestDigest: action.externalInstruction.requestDigest,
      expectedDigest: action.expectedDigest,
    }, secret);
    const existing = await this.db.externalAcknowledgement.findUnique({ where: { providerReferenceId_externalAcknowledgementId: {
      providerReferenceId: action.externalInstruction.providerReferenceId, externalAcknowledgementId: observation.externalAcknowledgementId,
    } } });
    if (existing) { if (existing.externalInstructionId === action.externalInstructionId && existing.responseDigest === responseDigest) return existing; throw new ConflictException("token acknowledgement ID was reused"); }
    return this.db.$transaction(async (tx) => {
      const acknowledgement = await tx.externalAcknowledgement.create({ data: { id: `ack_${randomUUID()}`,
        externalInstructionId: action.externalInstructionId, providerReferenceId: action.externalInstruction.providerReferenceId,
        externalAcknowledgementId: observation.externalAcknowledgementId, status: observation.status, finalityClass: observation.finalityClass,
        responseDigest, response: json(observation), signatureStatus: "VERIFIED", acknowledgedAt,
        institutionId: action.tokenRepresentation.transactionCase.ownerInstitutionId,
        transactionCaseId: action.tokenRepresentation.transactionCaseId,
      } });
      await tx.externalInstruction.update({ where: { id: action.externalInstructionId }, data: { state: "ACKNOWLEDGED", terminalAt: new Date(), lockedAt: null, lockOwner: null, lastError: null } });
      await tx.tokenAction.update({ where: { id: action.id }, data: { state: "OBSERVED" } });
      await tx.tokenRepresentation.update({ where: { id: action.tokenRepresentationId }, data: { status: "BREAK_OPEN" } });
      await appendGovernedAudit(tx, { actor: `system:token-connector:${action.connectorBindingId}`, event: "rail.token_action.live_acknowledged", detail: {
        caseId: action.tokenRepresentation.transactionCaseId, actionId: action.id, externalInstructionId: action.externalInstructionId,
        externalAcknowledgementId: observation.externalAcknowledgementId, externalTransactionRef: observation.externalTransactionRef,
        outcomeDigest: observation.outcomeDigest, responseDigest, postActionReconciliationRequired: true,
      } });
      return acknowledgement;
    });
  }

  private async requireOwner(actor: Actor, caseId: string, liveOnly = false) {
    const flags = inspectPersistenceFlags(process.env);
    if (liveOnly && flags.tokenisedDa !== "live") throw new ForbiddenException("live token connector is disabled");
    if (!liveOnly && !["allow_list", "live"].includes(flags.tokenisedDa)) throw new ForbiddenException("token connector governance is disabled");
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId } });
    if (!transactionCase || transactionCase.ownerInstitutionId !== actor.actingInstitutionId) throw new NotFoundException("transaction case not found");
    if (transactionCase.transactionRoute !== "DA" || transactionCase.representation !== "TOKENISED" || transactionCase.lifecycleLeg !== "INITIAL_TRANSFER_OR_ISSUE") {
      throw new BadRequestException("token connector requires an initial DA/TOKENISED case");
    }
    if (liveOnly && !["CONTROLLED_LIVE", "PRODUCTION"].includes(transactionCase.operatingMode)) throw new BadRequestException("case is not in a live operating mode");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action: "OPERATE_ROUTE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const route = await this.access.evaluateRoute(actor.actingInstitutionId, { transactionRoute: "DA", representation: "TOKENISED",
      assetClass: transactionCase.assetClass, lifecycleLeg: transactionCase.lifecycleLeg,
      materialFunction: "TOKEN_REPRESENTATION_MANAGEMENT", operatingMode: transactionCase.operatingMode });
    if (!route.allowed) throw new ForbiddenException(`token representation route denied: ${route.code}`);
    const representation = await this.db.tokenRepresentation.findUnique({ where: { transactionCaseId: caseId } });
    if (!representation || representation.authorityMode !== "MIRROR") throw new ConflictException("a MIRROR token representation is required");
    return { transactionCase, authority, representation };
  }

  private async requireCustodyAuthority(transactionCase: { id: string; assetClass: string; lifecycleLeg: string; operatingMode: string }, custodyInstitutionId: string) {
    const assignment = await this.db.caseFunctionAssignment.findUnique({ where: { transactionCaseId_materialFunction: {
      transactionCaseId: transactionCase.id, materialFunction: "CUSTODY",
    } } });
    if (!assignment || assignment.status !== "ACTIVE" || assignment.performer === "PROHIBITED" || assignment.performerInstitutionId !== custodyInstitutionId) {
      throw new ConflictException("active case custody assignment must name the connector-owning custody institution");
    }
    const route = await this.access.evaluateRoute(custodyInstitutionId, { transactionRoute: "DA", representation: "TOKENISED",
      assetClass: transactionCase.assetClass, lifecycleLeg: transactionCase.lifecycleLeg, materialFunction: "CUSTODY", operatingMode: transactionCase.operatingMode });
    if (!route.allowed) throw new ForbiddenException(`custody route denied: ${route.code}`);
  }

  private async requireCertifiedConnector(registrationId: string, certificationId: string, profileRef: string) {
    const connector = await this.db.connectorRegistration.findUnique({ where: { id: registrationId }, include: {
      providerReference: true, certifications: { where: { id: certificationId } },
    } });
    const certification = connector?.certifications[0];
    const now = new Date();
    if (!connector || !certification || connector.status !== "CERTIFIED_LIVE" || connector.transport !== "API"
      || !connector.endpoint?.startsWith("https://") || !connector.credentialVaultRef?.startsWith("vault-kv-v2://")
      || !connector.providerReferenceId || connector.providerReference?.status !== "ACTIVE"
      || certification.connectorRegistrationId !== connector.id || certification.profileRef !== profileRef
      || certification.status !== "APPROVED" || !["CONTROLLED_LIVE", "PRODUCTION"].includes(certification.operatingMode)
      || (certification.effectiveAt && certification.effectiveAt > now) || (certification.expiresAt && certification.expiresAt <= now)) {
      throw new ConflictException("token connector lacks a current approved live certification, HTTPS endpoint or Vault credential");
    }
    return { ...connector, certification };
  }

  private async requireEvidence(id: string, caseId: string, evidenceType: string, expectedDigest?: string) {
    const evidence = await this.db.evidenceObject.findUnique({ where: { id }, include: { institution: { include: { admission: true } }, versions: { orderBy: { version: "desc" }, take: 1 } } });
    const version = evidence?.versions[0]; const now = new Date();
    if (!evidence || evidence.transactionCaseId !== caseId || evidence.evidenceType !== evidenceType || evidence.status !== "AVAILABLE"
      || evidence.currentVersion !== version?.version || evidence.institution.status !== "ACTIVE" || evidence.institution.admission?.status !== "ADMITTED"
      || !version || version.validationStatus !== "VALID" || version.signatureStatus !== "VERIFIED" || version.result !== "VERIFIED"
      || (version.expiresAt && version.expiresAt <= now) || (expectedDigest && version.payloadDigest !== expectedDigest)) {
      throw new ConflictException(`${evidenceType} external evidence is missing, stale, invalid or unverified`);
    }
    return { id: evidence.id, digest: version.payloadDigest };
  }

  private async activeBinding(representationId: string, actionType: LiveTokenConnectorActionType) {
    const binding = await this.db.tokenConnectorBinding.findFirst({ where: { tokenRepresentationId: representationId, status: "ACTIVE" },
      orderBy: { version: "desc" }, include: { connectorRegistration: { include: { providerReference: true } }, connectorCertification: true } });
    if (!binding) throw new ConflictException("an active token connector/custody binding is required");
    this.assertBindingCurrent(binding);
    const supported = Array.isArray(binding.supportedActionTypes) ? binding.supportedActionTypes : [];
    if (!supported.includes(actionType)) throw new ForbiddenException(`active connector binding does not support ${actionType}`);
    const representation = await this.db.tokenRepresentation.findUniqueOrThrow({ where: { id: representationId }, select: { transactionCaseId: true } });
    await Promise.all([
      this.requireEvidence(binding.custodyEvidenceObjectId, representation.transactionCaseId, "TOKEN_KEY_CUSTODY_ASSIGNMENT", binding.custodyEvidenceDigest),
      this.requireEvidence(binding.legalFinalityEvidenceObjectId, representation.transactionCaseId, "TOKEN_LEGAL_FINALITY", binding.legalFinalityEvidenceDigest),
      this.requireEvidence(binding.operatingAcceptanceEvidenceObjectId, representation.transactionCaseId, "TOKEN_CONNECTOR_OPERATING_ACCEPTANCE", binding.operatingAcceptanceEvidenceDigest),
    ]);
    return binding;
  }

  private assertBindingCurrent(binding: { status: string; effectiveAt: Date | null; expiresAt: Date | null; connectorRegistration: { status: string; endpoint: string | null; credentialVaultRef: string | null; providerReferenceId: string | null }; connectorCertification: { status: string; operatingMode: string; effectiveAt: Date | null; expiresAt: Date | null } }) {
    const now = new Date(); const runtime = (process.env.ASSURERAIL_OPERATING_MODE ?? "").toUpperCase();
    if (binding.status !== "ACTIVE" || !binding.effectiveAt || binding.effectiveAt > now || !binding.expiresAt || binding.expiresAt <= now
      || binding.connectorRegistration.status !== "CERTIFIED_LIVE" || !binding.connectorRegistration.endpoint?.startsWith("https://")
      || !binding.connectorRegistration.credentialVaultRef?.startsWith("vault-kv-v2://") || !binding.connectorRegistration.providerReferenceId
      || binding.connectorCertification.status !== "APPROVED" || binding.connectorCertification.operatingMode !== runtime
      || (binding.connectorCertification.effectiveAt && binding.connectorCertification.effectiveAt > now)
      || (binding.connectorCertification.expiresAt && binding.connectorCertification.expiresAt <= now)) {
      throw new ConflictException("token connector/custody binding is inactive, expired or not certified for this exact runtime mode");
    }
  }

  private async loadDispatchAction(actionId: string) {
    const action = await this.db.tokenAction.findUnique({ where: { id: actionId }, include: {
      externalInstruction: true, connectorBinding: { include: { connectorRegistration: true, connectorCertification: true } },
      tokenRepresentation: { include: { transactionCase: true } },
    } });
    if (!action || !action.connectorBinding || !["CONTROLLED_LIVE", "PRODUCTION"].includes(action.executionMode)) throw new NotFoundException("live token action not found");
    return action;
  }

  private digest(value: unknown, name: string): string {
    const result = required(value, name, 80);
    if (!/^sha256:[a-f0-9]{64}$/.test(result)) throw new BadRequestException(`${name} must be a lowercase sha256 digest`);
    return result;
  }

  private actorRef(actor: Actor) { return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`; }
}
