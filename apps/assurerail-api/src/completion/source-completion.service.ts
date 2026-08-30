import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { assertSha256Digest, assertValidNeutralEnvelopeV1, buildNeutralAcknowledgementEnvelope, sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { ConnectorSecretVaultService } from "../integrations/connector-secret-vault.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { WebhookEgressService } from "../platform/webhook-egress.service";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";

function required(value: unknown, name: string, max = 1_000): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim(); if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

function digestValue(value: unknown, name: string): string {
  const result = required(value, name, 80);
  if (!/^sha256:[a-f0-9]{64}$/.test(result)) throw new BadRequestException(`${name} must be a lowercase sha256 digest`);
  return result;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8"); const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SourceCompletionObservation = {
  externalAcknowledgementId?: string;
  status?: string;
  finality?: string;
  occurredAt?: string;
  sourceObjectId?: string;
  sourceVersion?: string;
  manifestDigest?: string;
  sourceState?: string;
  lockReference?: string | null;
  signature?: string;
};

export type SourceCompletionComparison = {
  expectedSourceObjectId: string; expectedSourceVersion: string; expectedManifestDigest: string; expectedLockReference: string | null;
  observedSourceObjectId: string | null; observedSourceState: string | null; observedSourceVersion: string | null;
  observedManifestDigest: string | null; observedLockReference: string | null;
};

export function sourceCompletionMismatch(completion: SourceCompletionComparison): { code: string; expected: unknown; observed: unknown } | null {
  if (completion.observedSourceObjectId !== completion.expectedSourceObjectId) return { code: "SOURCE_OBJECT_MISMATCH", expected: completion.expectedSourceObjectId, observed: completion.observedSourceObjectId };
  if (completion.observedSourceState !== "PERMANENT") return { code: "SOURCE_STATE_NOT_PERMANENT", expected: "PERMANENT", observed: completion.observedSourceState };
  if (completion.observedSourceVersion !== completion.expectedSourceVersion) return { code: "SOURCE_VERSION_MISMATCH", expected: completion.expectedSourceVersion, observed: completion.observedSourceVersion };
  if (completion.observedManifestDigest !== completion.expectedManifestDigest) return { code: "MANIFEST_DIGEST_MISMATCH", expected: completion.expectedManifestDigest, observed: completion.observedManifestDigest };
  if (completion.expectedLockReference && completion.observedLockReference !== completion.expectedLockReference) return { code: "LOCK_REFERENCE_MISMATCH", expected: completion.expectedLockReference, observed: completion.observedLockReference };
  return null;
}

@Injectable()
export class SourceCompletionService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
    private readonly vault: ConnectorSecretVaultService,
    private readonly egress: WebhookEgressService,
  ) {}

  async list(actor: RoomActor, caseId: string) {
    await this.requireCaseOwner(actor, caseId, "VIEW_CASE");
    return this.db.sourceCompletion.findMany({ where: { transactionCaseId: caseId }, orderBy: { createdAt: "asc" }, include: { externalInstruction: true, finalAcknowledgement: true } });
  }

  async initiate(actor: RoomActor, caseId: string, body: {
    sourceReferenceId?: string; connectorRegistrationId?: string; completionKind?: string;
    completionEvidenceRef?: string; completionEvidenceDigest?: string; idempotencyKey?: string;
    authorityEvidenceRef?: string; stepUpEvidenceId?: string;
  }) {
    const mode = inspectPersistenceFlags(process.env).completionAcknowledgement;
    if (mode === "off") throw new ForbiddenException("source completion acknowledgement is disabled");
    const authority = await this.requireCaseOwner(actor, caseId, "OPERATE_CASE");
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId } });
    if (!transactionCase || transactionCase.status !== "COMPLETION_PENDING") throw new ConflictException("case must be in COMPLETION_PENDING before source completion can be initiated");
    if (transactionCase.transactionRoute !== "DA") throw new BadRequestException("AssurePool source completion is DA-only");
    const sourceReferenceId = required(body.sourceReferenceId, "sourceReferenceId", 200);
    const source = await this.db.sourceReference.findUnique({
      where: { id: sourceReferenceId },
      include: { providerReference: true, intakeSubmissions: { where: { validationStatus: "VALID" }, orderBy: { receivedAt: "desc" }, take: 1 } },
    });
    if (!source || source.transactionCaseId !== caseId || source.sourceObjectType !== "FROZEN_ASSET_TAPE") {
      throw new BadRequestException("source completion requires the retained frozen DA tape for this case");
    }
    const connectorRegistrationId = required(body.connectorRegistrationId, "connectorRegistrationId", 200);
    const connector = await this.db.connectorRegistration.findUnique({ where: { id: connectorRegistrationId }, include: { certifications: true } });
    const requiredConnectorMode = mode === "on" ? "CONTROLLED_LIVE" : "SHADOW";
    const requiredConnectorStatus = mode === "on" ? "CERTIFIED_LIVE" : "CERTIFIED_SHADOW";
    const certified = connector?.certifications.some((item) => item.profileRef === "assurepool.completion-ack.v1" && item.status === "APPROVED"
      && item.operatingMode === requiredConnectorMode && (!item.effectiveAt || item.effectiveAt <= new Date()) && (!item.expiresAt || item.expiresAt > new Date()));
    if (!connector || connector.providerReferenceId !== source.providerReferenceId || connector.status !== requiredConnectorStatus || !certified
      || !connector.endpoint || !connector.credentialVaultRef?.startsWith("vault-kv-v2://")) {
      throw new ConflictException(`source provider connector is not certified for completion acknowledgement in ${requiredConnectorMode}`);
    }
    const completionKind = required(body.completionKind ?? "SOURCE_LOCK_PERMANENT", "completionKind", 100);
    if (completionKind !== "SOURCE_LOCK_PERMANENT") throw new BadRequestException("unsupported source completion kind");
    const completionEvidenceRef = required(body.completionEvidenceRef, "completionEvidenceRef", 500);
    const completionEvidenceDigest = digestValue(body.completionEvidenceDigest, "completionEvidenceDigest");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const sourceRecord = object(object(object(source.intakeSubmissions[0]?.payload).extensions).sourceRecord);
    const normalized = object(object(source.intakeSubmissions[0]?.payload).normalized);
    const expectedManifestDigest = digestValue(sourceRecord.manifestHash ?? normalized.sourceManifestDigest ?? object(source.metadata).manifestHash, "expectedManifestDigest");
    const sourceLock = object(sourceRecord.lock);
    if (sourceLock.state !== "CONFIRMED") throw new ConflictException("AssurePool completion requires a retained CONFIRMED source lock");
    const expectedLockReference = required(sourceLock.reference, "sourceLock.reference", 500);
    const request = {
      contractVersion: "1.0.0", completionKind, transactionCaseId: caseId,
      source: { sourceObjectId: source.sourceObjectId, sourceVersion: source.sourceVersion, manifestDigest: expectedManifestDigest, lockReference: expectedLockReference },
      completionEvidence: { ref: completionEvidenceRef, digest: completionEvidenceDigest },
      authorityEvidenceRef,
    };
    const requestDigest = sha256Digest(request);
    const existing = await this.db.sourceCompletion.findUnique({ where: { providerReferenceId_idempotencyKey: { providerReferenceId: source.providerReferenceId, idempotencyKey } } });
    if (existing) {
      if (existing.requestDigest !== requestDigest || existing.transactionCaseId !== caseId || existing.sourceReferenceId !== sourceReferenceId) {
        throw new ConflictException("source-completion idempotency key was reused with different content or scope");
      }
      return existing;
    }
    const duplicateSource = await this.db.sourceCompletion.findUnique({ where: { transactionCaseId_sourceReferenceId: { transactionCaseId: caseId, sourceReferenceId } } });
    if (duplicateSource) throw new ConflictException("this exact case/source version already has a completion lifecycle");
    const instructionId = `exti_${randomUUID()}`;
    const completionId = `scomp_${randomUUID()}`;
    const instructionRequest = { ...request, instructionId, completionId };
    const instructionRequestDigest = sha256Digest(instructionRequest);
    const dispatchMode = mode === "on" ? "ON" : "SHADOW";
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "SOURCE_COMPLETION_INITIATE", institutionId: actor.actingInstitutionId }, tx);
      await tx.externalInstruction.create({ data: {
        id: instructionId, providerReferenceId: source.providerReferenceId, instructionType: "SOURCE_LOCK_PERMANENT",
        idempotencyKey, requestDigest: instructionRequestDigest, request: json(instructionRequest),
        state: dispatchMode === "ON" ? "PENDING" : "CANCELLED", lastError: dispatchMode === "SHADOW" ? "SHADOW_MODE_NO_EXTERNAL_MUTATION" : null,
        terminalAt: dispatchMode === "SHADOW" ? new Date() : null, institutionId: actor.actingInstitutionId, transactionCaseId: caseId,
      } });
      const completion = await tx.sourceCompletion.create({ data: {
        id: completionId, transactionCaseId: caseId, sourceReferenceId, providerReferenceId: source.providerReferenceId,
        connectorRegistrationId, completionKind, idempotencyKey, requestDigest, completionEvidenceRef,
        completionEvidenceDigest, expectedSourceObjectId: source.sourceObjectId, expectedSourceVersion: source.sourceVersion,
        expectedManifestDigest, expectedLockReference, dispatchMode,
        state: dispatchMode === "ON" ? "PENDING" : "SHADOW_RECORDED", externalInstructionId: instructionId,
        initiatedByUserId: actor.actorUserId, initiatedByMandateId: authority.mandateId!,
      } });
      const eventPayload = { completionId, instructionId, caseId, sourceReferenceId, dispatchMode, requestDigest };
      await tx.outboxMessage.create({ data: {
        id: `out_${randomUUID()}`, event: dispatchMode === "ON" ? "rail.source_completion.dispatch_requested" : "rail.source_completion.shadow_recorded",
        schemaId: "assurerail.source-completion.event", schemaVersion: "1.0.0", payloadDigest: sha256Digest(eventPayload), payload: json(eventPayload),
        aggregateId: completionId, aggregateVersion: 1, institutionId: actor.actingInstitutionId, transactionCaseId: caseId,
        idempotencyKey: `source-completion:${completionId}:created`, correlationId: caseId,
        state: "FANOUT_COMPLETE", completedAt: new Date(),
      } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: dispatchMode === "ON" ? "rail.source_completion.initiated" : "rail.source_completion.shadow_recorded", detail: { ...eventPayload, completionEvidenceRef, authorityEvidenceRef, authorityMandateId: authority.mandateId } });
      return completion;
    });
  }

  async reconcile(actor: RoomActor, caseId: string, completionId: string, body: { reason?: string; stepUpEvidenceId?: string }) {
    const authority = await this.requireCaseOwner(actor, caseId, "OPERATE_CASE");
    const completion = await this.db.sourceCompletion.findUnique({ where: { id: completionId }, include: { finalAcknowledgement: true } });
    if (!completion || completion.transactionCaseId !== caseId) throw new NotFoundException("source completion not found");
    if (completion.initiatedByUserId === actor.actorUserId) throw new ForbiddenException("the initiator cannot independently close source completion reconciliation");
    if (completion.reconciliationState === "MATCHED") return completion;
    if (!completion.finalAcknowledgement || completion.state !== "ACKNOWLEDGED" || completion.reconciliationState !== "PENDING") {
      throw new ConflictException("only an exact, final acknowledged completion can be independently reconciled");
    }
    const mismatch = sourceCompletionMismatch(completion);
    if (mismatch) throw new ConflictException(`source completion cannot reconcile: ${mismatch.code}`);
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "SOURCE_COMPLETION_RECONCILE", institutionId: actor.actingInstitutionId }, tx);
      const changed = await tx.sourceCompletion.updateMany({ where: { id: completion.id, state: "ACKNOWLEDGED", reconciliationState: "PENDING" }, data: {
        state: "RECONCILED", reconciliationState: "MATCHED", reconciledByUserId: actor.actorUserId, reconciledAt: new Date(),
      } });
      if (changed.count !== 1) throw new ConflictException("source completion changed concurrently");
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.source_completion.reconciled", detail: { caseId, completionId, acknowledgementId: completion.finalAcknowledgementId, reason, authorityMandateId: authority.mandateId } });
      return tx.sourceCompletion.findUniqueOrThrow({ where: { id: completion.id } });
    });
  }

  async dispatch(completionId: string) {
    if (inspectPersistenceFlags(process.env).completionAcknowledgement !== "on") throw new ForbiddenException("live completion dispatch is disabled");
    const completion = await this.db.sourceCompletion.findUnique({ where: { id: completionId }, include: {
      externalInstruction: true, connectorRegistration: true, providerReference: true, sourceReference: true,
    } });
    if (!completion || completion.dispatchMode !== "ON" || !["DISPATCHING", "PENDING"].includes(completion.state)) throw new ConflictException("source completion is not dispatchable");
    const connector = completion.connectorRegistration;
    if (!connector.endpoint || !connector.credentialVaultRef) throw new ConflictException("completion connector endpoint or credential is unavailable");
    const request = object(completion.externalInstruction.request);
    const body = canonicalJson(request);
    const timestamp = String(Date.now());
    const secret = await this.vault.get(connector.credentialVaultRef);
    const signature = createHmac("sha256", secret).update([completion.externalInstruction.id, timestamp, body].join("\n")).digest("hex");
    const response = await this.egress.post(connector.endpoint, body, {
      "content-type": "application/json", "x-assurerail-instruction-id": completion.externalInstruction.id,
      "x-assurerail-signature-timestamp": timestamp, "x-assurerail-signature": signature,
    });
    if (!response.ok) throw new Error(`completion provider returned HTTP ${response.status}`);
    let observation: SourceCompletionObservation;
    try { observation = JSON.parse(response.body) as SourceCompletionObservation; }
    catch { throw new Error("completion provider returned invalid JSON"); }
    return this.recordObservation(completionId, connector.id, observation, secret);
  }

  async recordSignedObservation(completionId: string, connectorId: string, observation: SourceCompletionObservation) {
    const completion = await this.db.sourceCompletion.findUnique({ where: { id: completionId }, include: { connectorRegistration: true } });
    if (!completion || completion.connectorRegistrationId !== connectorId || !completion.connectorRegistration.credentialVaultRef) throw new NotFoundException("source completion not found");
    return this.recordObservation(completionId, connectorId, observation, await this.vault.get(completion.connectorRegistration.credentialVaultRef));
  }

  async markDispatchFailure(completionId: string, error: unknown) {
    const message = (error as Error)?.message?.slice(0, 1_000) || "completion dispatch failed";
    const completion = await this.db.sourceCompletion.findUnique({ where: { id: completionId }, include: { externalInstruction: true } });
    if (!completion) return;
    const attempts = completion.externalInstruction.attemptCount;
    const terminal = attempts >= 8;
    const delaySeconds = Math.min(15 * (2 ** Math.max(0, attempts - 1)), 3_600);
    await this.db.$transaction([
      this.db.externalInstruction.update({ where: { id: completion.externalInstructionId }, data: {
        state: terminal ? "FAILED" : "AMBIGUOUS", lastError: message, lockedAt: null, lockOwner: null,
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1_000), terminalAt: terminal ? new Date() : null,
      } }),
      this.db.sourceCompletion.update({ where: { id: completion.id }, data: { state: terminal ? "FAILED" : "PENDING" } }),
    ]);
  }

  private async recordObservation(completionId: string, connectorId: string, raw: SourceCompletionObservation, secret: string) {
    const completion = await this.db.sourceCompletion.findUnique({ where: { id: completionId }, include: { providerReference: true, sourceReference: true } });
    if (!completion || completion.connectorRegistrationId !== connectorId) throw new NotFoundException("source completion not found");
    const observation = {
      externalAcknowledgementId: required(raw.externalAcknowledgementId, "externalAcknowledgementId", 300),
      status: required(raw.status, "status", 40), finality: required(raw.finality, "finality", 40),
      occurredAt: required(raw.occurredAt, "occurredAt", 80), sourceObjectId: required(raw.sourceObjectId, "sourceObjectId", 500),
      sourceVersion: required(raw.sourceVersion, "sourceVersion", 200), manifestDigest: digestValue(raw.manifestDigest, "manifestDigest"),
      sourceState: required(raw.sourceState, "sourceState", 80), lockReference: raw.lockReference == null ? null : required(raw.lockReference, "lockReference", 500),
    };
    const occurredAt = new Date(observation.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) throw new BadRequestException("occurredAt must be ISO-8601");
    if (observation.status !== "FINALISED" || observation.finality !== "FINAL") throw new BadRequestException("completion acknowledgement must be FINALISED and FINAL");
    const responseDigest = sha256Digest(observation);
    const signature = required(raw.signature, "signature", 300);
    const expected = createHmac("sha256", secret).update(responseDigest).digest("hex");
    if (!safeEqual(signature, expected)) throw new ForbiddenException("completion acknowledgement signature verification failed");
    const envelope = buildNeutralAcknowledgementEnvelope({
      envelopeId: `ack_${observation.externalAcknowledgementId}`,
      transactionCaseId: completion.transactionCaseId,
      provider: { institutionRef: completion.providerReference.providerKey, kind: "SERVICE_PROVIDER", jurisdiction: "IN", identifiers: [{ scheme: "ASSURERAIL_PROVIDER_KEY", value: completion.providerReference.providerKey }] },
      source: {
        providerInstitutionRef: completion.providerReference.providerKey, sourceSystemRef: completion.sourceReference.sourceSystem,
        sourceObjectType: completion.sourceReference.sourceObjectType, sourceObjectRef: observation.sourceObjectId,
        sourceSchemaId: completion.sourceReference.schemaId, sourceSchemaVersion: observation.sourceVersion,
        sourcePayloadDigest: assertSha256Digest(observation.manifestDigest), authorityClass: "EVIDENTIARY",
      },
      asOfAt: observation.occurredAt, expiresAt: null, qualifications: [], instructionId: completion.externalInstructionId,
      status: "FINALISED", finality: "FINAL", occurredAt: observation.occurredAt,
      externalReference: observation.externalAcknowledgementId, reconciliationState: "PENDING", responseDigest,
      signature: { status: "PRESENT", scope: "ACKNOWLEDGEMENT_RESPONSE", signedDigest: responseDigest, algorithm: "HMAC-SHA256", keyRef: `connector:${connectorId}`, signature, signedAt: observation.occurredAt },
    });
    assertValidNeutralEnvelopeV1(envelope);
    const mismatch = sourceCompletionMismatch({
      ...completion, observedSourceObjectId: observation.sourceObjectId, observedSourceState: observation.sourceState, observedSourceVersion: observation.sourceVersion,
      observedManifestDigest: observation.manifestDigest, observedLockReference: observation.lockReference,
    });
    const existing = await this.db.externalAcknowledgement.findFirst({ where: { providerReferenceId: completion.providerReferenceId, externalAcknowledgementId: observation.externalAcknowledgementId } });
    if (existing) {
      if (existing.responseDigest !== responseDigest || existing.externalInstructionId !== completion.externalInstructionId) throw new ConflictException("external acknowledgement ID was reused with different content");
      return this.db.sourceCompletion.findUniqueOrThrow({ where: { id: completion.id } });
    }
    return this.db.$transaction(async (tx) => {
      const ack = await tx.externalAcknowledgement.create({ data: {
        id: `exta_${randomUUID()}`, externalInstructionId: completion.externalInstructionId, providerReferenceId: completion.providerReferenceId,
        externalAcknowledgementId: observation.externalAcknowledgementId, status: "FINALISED", finalityClass: "FINAL",
        responseDigest, response: json(envelope), signatureStatus: "PRESENT", acknowledgedAt: occurredAt,
        institutionId: completion.sourceReference.institutionId, transactionCaseId: completion.transactionCaseId,
      } });
      await tx.inboxMessage.create({ data: {
        id: `inb_${randomUUID()}`, providerReferenceId: completion.providerReferenceId,
        externalMessageId: observation.externalAcknowledgementId, idempotencyKey: observation.externalAcknowledgementId,
        schemaId: "assurerail.neutral-acknowledgement", schemaVersion: "1.0.0", payloadDigest: responseDigest,
        payload: json(envelope), signatureStatus: "VERIFIED", state: "PROCESSED",
        institutionId: completion.sourceReference.institutionId, transactionCaseId: completion.transactionCaseId, processedAt: new Date(),
      } });
      await tx.externalInstruction.update({ where: { id: completion.externalInstructionId }, data: { state: "ACKNOWLEDGED", lockedAt: null, lockOwner: null, lastError: null, terminalAt: new Date() } });
      await tx.sourceCompletion.update({ where: { id: completion.id }, data: {
        finalAcknowledgementId: ack.id, observedSourceObjectId: observation.sourceObjectId, observedSourceState: observation.sourceState, observedSourceVersion: observation.sourceVersion,
        observedManifestDigest: observation.manifestDigest, observedLockReference: observation.lockReference,
        state: mismatch ? "BREAK_OPEN" : "ACKNOWLEDGED", reconciliationState: mismatch ? "BREAK_OPEN" : "PENDING",
        breakCode: mismatch?.code ?? null, breakDetail: mismatch ? json(mismatch) : Prisma.JsonNull,
      } });
      await appendGovernedAudit(tx, { actor: `connector:${connectorId}`, event: mismatch ? "rail.source_completion.break_opened" : "rail.source_completion.acknowledged", detail: { completionId, acknowledgementId: ack.id, responseDigest, mismatch } });
      return tx.sourceCompletion.findUniqueOrThrow({ where: { id: completion.id } });
    });
  }

  private async requireCaseOwner(actor: RoomActor, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE") {
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId } });
    if (!transactionCase || transactionCase.ownerInstitutionId !== actor.actingInstitutionId) throw new NotFoundException("transaction case not found");
    return this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
  }

  private actorRef(actor: RoomActor): string { return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`; }
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}
