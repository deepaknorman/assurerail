import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import { PTC_TOKEN_ACTIONS, PTC_TOKEN_GATE_SPECS, TOKENISED_PTC_ROUTE_PACK, ptcTokenPlanDigest } from "./ptc-token-policy";

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim(); if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`); return result;
}
function digest(value: unknown, name: string): string {
  const result = required(value, name, 80); if (!/^sha256:[a-f0-9]{64}$/.test(result)) throw new BadRequestException(`${name} must be a lowercase sha256 digest`); return result;
}
function json(value: unknown): Prisma.InputJsonValue { return toCanonicalValue(value) as unknown as Prisma.InputJsonValue; }
function enabled() {
  const flags = inspectPersistenceFlags(process.env);
  if (flags.tokenisedPtc !== "shadow" || flags.ptcReplay !== "allow_list" || flags.transactionCase !== "shadow" || flags.externalActionSaga !== "required") {
    throw new ForbiddenException("tokenised PTC shadow route is disabled");
  }
}

@Injectable()
export class PtcTokenService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly stepUp: StepUpService) {}

  async get(actor: RoomActor, caseId: string) {
    await this.requireCase(actor, caseId, "VIEW_CASE");
    return this.db.ptcTokenRepresentation.findUnique({ where: { transactionCaseId: caseId }, include: { evidenceGates: { orderBy: { gateCode: "asc" } }, actionPlans: { orderBy: { sequence: "asc" } } } });
  }

  async propose(actor: RoomActor, caseId: string, body: {
    programmeReference?: unknown; trustReference?: unknown; classReference?: unknown; trancheDefinitionDigest?: unknown;
    trusteeInstitutionId?: unknown; recordkeeperInstitutionId?: unknown; assuranceProviderInstitutionId?: unknown;
    authoritativeRecordDeclarationId?: unknown; network?: unknown; tokenId?: unknown; evidenceByGate?: unknown;
    idempotencyKey?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { transactionCase, authority, parties } = await this.requireOwner(actor, caseId);
    const trusteeInstitutionId = required(body.trusteeInstitutionId, "trusteeInstitutionId", 160);
    const recordkeeperInstitutionId = required(body.recordkeeperInstitutionId, "recordkeeperInstitutionId", 160);
    const assuranceProviderInstitutionId = required(body.assuranceProviderInstitutionId, "assuranceProviderInstitutionId", 160);
    if (parties.get("TRUSTEE") !== trusteeInstitutionId || parties.get("RECORDKEEPER") !== recordkeeperInstitutionId) throw new ConflictException("trustee and recordkeeper must match active case parties");
    await this.assertFunction(caseId, "TRUSTEE_TRANSACTION_CONTROL", trusteeInstitutionId);
    await this.assertFunction(caseId, "AUTHORITATIVE_REGISTER_UPDATE", recordkeeperInstitutionId);
    await this.assertFunction(caseId, "ASSURANCE_OR_REVIEW", assuranceProviderInstitutionId);
    const declarationId = required(body.authoritativeRecordDeclarationId, "authoritativeRecordDeclarationId", 160);
    const declaration = await this.db.authoritativeRecordDeclaration.findUnique({ where: { id: declarationId } });
    if (!declaration || declaration.transactionCaseId !== caseId || declaration.status !== "ACTIVE" || declaration.recordkeeperInstitutionId !== recordkeeperInstitutionId) {
      throw new ConflictException("active case authoritative-record declaration must name the recordkeeper");
    }
    const evidenceByGate = body.evidenceByGate && typeof body.evidenceByGate === "object" && !Array.isArray(body.evidenceByGate)
      ? body.evidenceByGate as Record<string, unknown> : {};
    const owners = { ORIGINATOR: transactionCase.ownerInstitutionId, TRUSTEE: trusteeInstitutionId, RECORDKEEPER: recordkeeperInstitutionId, ASSURANCE: assuranceProviderInstitutionId };
    const gates = [] as Array<{ gateCode: string; expectedEvidenceType: string; accountableInstitutionId: string; evidenceObjectId?: string; evidenceDigest?: string; status: string; sourceAsOfAt?: Date; expiresAt?: Date }>;
    for (const [gateCode, evidenceType, ownerRole] of PTC_TOKEN_GATE_SPECS) {
      const accountableInstitutionId = owners[ownerRole];
      const rawId = evidenceByGate[gateCode];
      if (rawId === undefined || rawId === null || rawId === "") { gates.push({ gateCode, expectedEvidenceType: evidenceType, accountableInstitutionId, status: "OPEN" }); continue; }
      const evidence = await this.requireExternalEvidence(required(rawId, `evidenceByGate.${gateCode}`, 160), caseId, accountableInstitutionId, evidenceType);
      gates.push({ gateCode, expectedEvidenceType: evidenceType, accountableInstitutionId, evidenceObjectId: evidence.id, evidenceDigest: evidence.digest, status: "VERIFIED", sourceAsOfAt: evidence.sourceAsOfAt, expiresAt: evidence.expiresAt ?? undefined });
    }
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const representationId = `ptok_${randomUUID()}`;
    const request = { caseId, programmeReference: required(body.programmeReference, "programmeReference"), trustReference: required(body.trustReference, "trustReference"),
      classReference: required(body.classReference, "classReference"), trancheDefinitionDigest: digest(body.trancheDefinitionDigest, "trancheDefinitionDigest"),
      trusteeInstitutionId, recordkeeperInstitutionId, assuranceProviderInstitutionId, declarationId,
      network: required(body.network, "network"), tokenId: required(body.tokenId, "tokenId"), evidence: gates.map((gate) => ({ code: gate.gateCode, id: gate.evidenceObjectId ?? null, digest: gate.evidenceDigest ?? null })), idempotencyKey, reason };
    const requestDigest = sha256Digest(request);
    const existing = await this.db.ptcTokenRepresentation.findUnique({ where: { transactionCaseId: caseId }, include: { evidenceGates: true, actionPlans: true } });
    if (existing) { if (existing.idempotencyKey === idempotencyKey && existing.requestDigest === requestDigest) return existing; throw new ConflictException("tokenised PTC representation already exists with different content"); }
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "PTC_TOKEN_REPRESENTATION_PROPOSE", institutionId: actor.actingInstitutionId }, tx);
      const representation = await tx.ptcTokenRepresentation.create({ data: {
        id: representationId, transactionCaseId: caseId, programmeReference: request.programmeReference,
        trustReference: request.trustReference, classReference: request.classReference, trancheDefinitionDigest: request.trancheDefinitionDigest,
        trusteeInstitutionId, recordkeeperInstitutionId, assuranceProviderInstitutionId,
        authoritativeRecordDeclarationId: declarationId, network: request.network, tokenId: request.tokenId,
        authorityMode: "MIRROR", status: gates.every((gate) => gate.status === "VERIFIED") ? "PROPOSED" : "EVIDENCE_OPEN",
        routePackRef: TOKENISED_PTC_ROUTE_PACK.ref, routePackVersion: TOKENISED_PTC_ROUTE_PACK.version,
        idempotencyKey, requestDigest, proposedByUserId: actor.actorUserId, proposedByMandateId: authority.mandateId!, proposalStepUpId: stepUpEvidenceId,
        evidenceGates: { create: gates.map((gate) => ({ id: `ptg_${randomUUID()}`, ...gate })) },
        actionPlans: { create: PTC_TOKEN_ACTIONS.map(([actionType, candidateCapabilityId], index) => ({ id: `ptp_${randomUUID()}`, actionType, sequence: (index + 1) * 10,
          candidateCapabilityId, state: "BLOCKED", blockingGateCodes: json(PTC_TOKEN_GATE_SPECS.map(([code]) => code)),
          planDigest: ptcTokenPlanDigest(representationId, actionType, PTC_TOKEN_GATE_SPECS.map(([code]) => code)) })) },
      }, include: { evidenceGates: true, actionPlans: true } });
      await appendGovernedAudit(tx, { actor: this.actor(actor), event: "rail.ptc_token.representation_proposed", detail: { caseId, representationId, requestDigest, status: representation.status, reason, dispatchProhibited: true } });
      return representation;
    });
  }

  async recordGateEvidence(actor: RoomActor, caseId: string, representationId: string, gateCode: string, body: { evidenceObjectId?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    await this.requireOwner(actor, caseId);
    const representation = await this.db.ptcTokenRepresentation.findUnique({ where: { id: representationId } });
    if (!representation || representation.transactionCaseId !== caseId || representation.status !== "EVIDENCE_OPEN") throw new NotFoundException("open tokenised PTC representation not found");
    const gate = await this.db.ptcTokenEvidenceGate.findUnique({ where: { ptcTokenRepresentationId_gateCode: { ptcTokenRepresentationId: representationId, gateCode } } });
    if (!gate || gate.status !== "OPEN" || gate.evidenceObjectId) throw new ConflictException("evidence gate is not open");
    const evidence = await this.requireExternalEvidence(required(body.evidenceObjectId, "evidenceObjectId", 160), caseId, gate.accountableInstitutionId, gate.expectedEvidenceType);
    const reason = required(body.reason, "reason", 1000); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "PTC_TOKEN_EVIDENCE_RECORD", institutionId: actor.actingInstitutionId }, tx);
      const changed = await tx.ptcTokenEvidenceGate.updateMany({ where: { id: gate.id, status: "OPEN", evidenceObjectId: null }, data: { evidenceObjectId: evidence.id, evidenceDigest: evidence.digest, status: "VERIFIED", sourceAsOfAt: evidence.sourceAsOfAt, expiresAt: evidence.expiresAt } });
      if (changed.count !== 1) throw new ConflictException("evidence gate changed concurrently");
      const remaining = await tx.ptcTokenEvidenceGate.count({ where: { ptcTokenRepresentationId: representationId, status: { not: "VERIFIED" } } });
      if (remaining === 0) await tx.ptcTokenRepresentation.updateMany({ where: { id: representationId, status: "EVIDENCE_OPEN" }, data: { status: "PROPOSED" } });
      await appendGovernedAudit(tx, { actor: this.actor(actor), event: "rail.ptc_token.evidence_recorded", detail: { caseId, representationId, gateCode, evidenceObjectId: evidence.id, evidenceDigest: evidence.digest, remainingOpenGates: remaining, reason } });
      return tx.ptcTokenEvidenceGate.findUniqueOrThrow({ where: { id: gate.id } });
    });
  }

  async review(actor: RoomActor, caseId: string, representationId: string, body: { approved?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    const { authority } = await this.requireOwner(actor, caseId);
    const representation = await this.db.ptcTokenRepresentation.findUnique({ where: { id: representationId }, include: { evidenceGates: true } });
    if (!representation || representation.transactionCaseId !== caseId) throw new NotFoundException("tokenised PTC representation not found");
    if (!['PROPOSED','EVIDENCE_OPEN'].includes(representation.status)) throw new ConflictException("representation is not reviewable");
    if (representation.proposedByUserId === actor.actorUserId) throw new ForbiddenException("proposer cannot review their own tokenised PTC representation");
    if (typeof body.approved !== "boolean") throw new BadRequestException("approved must be boolean");
    if (body.approved && representation.evidenceGates.some((gate) => gate.status !== "VERIFIED" || !gate.evidenceObjectId)) throw new ConflictException("open external evidence gates block tokenised PTC shadow readiness");
    if (body.approved) for (const gate of representation.evidenceGates) await this.requireExternalEvidence(gate.evidenceObjectId!, caseId, gate.accountableInstitutionId, gate.expectedEvidenceType, gate.evidenceDigest!);
    const reason = required(body.reason, "reason", 1000); const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "PTC_TOKEN_REPRESENTATION_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      const status = body.approved ? "SHADOW_READY" : "REJECTED";
      const changed = await tx.ptcTokenRepresentation.updateMany({ where: { id: representation.id, status: { in: ["PROPOSED", "EVIDENCE_OPEN"] } }, data: { status, reviewedByUserId: actor.actorUserId, reviewedByMandateId: authority.mandateId!, reviewStepUpId: stepUpEvidenceId, reviewReason: reason, reviewedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException("representation changed concurrently");
      await tx.ptcTokenActionPlan.updateMany({ where: { ptcTokenRepresentationId: representation.id }, data: {
        state: body.approved ? "SHADOW_READY" : "BLOCKED",
        blockingGateCodes: body.approved ? json([]) : json(PTC_TOKEN_GATE_SPECS.map(([code]) => code)),
      } });
      await appendGovernedAudit(tx, { actor: this.actor(actor), event: "rail.ptc_token.representation_reviewed", detail: { caseId, representationId, approved: body.approved, status, reason, externalInstructionCreated: false } });
      return tx.ptcTokenRepresentation.findUniqueOrThrow({ where: { id: representation.id } });
    });
  }

  private async requireCase(actor: RoomActor, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE") {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    if (!transactionCase || transactionCase.transactionRoute !== "PTC" || transactionCase.representation !== "TOKENISED" || transactionCase.marketContext !== "DOMESTIC"
      || transactionCase.placementOrListing !== "PRIVATE_PLACEMENT" || transactionCase.lifecycleLeg !== "INITIAL_TRANSFER_OR_ISSUE"
      || !TOKENISED_PTC_ROUTE_PACK.operatingModes.includes(transactionCase.operatingMode as "REPLAY" | "SHADOW")) throw new NotFoundException("tokenised PTC case not found");
    const participant = transactionCase.ownerInstitutionId === actor.actingInstitutionId || transactionCase.parties.some((party) => party.institutionId === actor.actingInstitutionId && party.status === "ACTIVE");
    if (!participant) throw new NotFoundException("tokenised PTC case not found");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const route = await this.access.evaluateRoute(actor.actingInstitutionId, { transactionRoute: "PTC", representation: "TOKENISED", assetClass: transactionCase.assetClass,
      lifecycleLeg: transactionCase.lifecycleLeg, materialFunction: "TOKEN_REPRESENTATION_MANAGEMENT", operatingMode: transactionCase.operatingMode });
    if (!route.allowed) throw new ForbiddenException(`tokenised PTC route denied: ${route.code}`);
    const parties = new Map<string, string>();
    for (const role of ["ORIGINATOR", "TRUSTEE", "RECORDKEEPER"]) { const found = transactionCase.parties.filter((party) => party.partyRole === role && party.status === "ACTIVE"); if (found.length !== 1) throw new ConflictException(`tokenised PTC requires exactly one active ${role}`); parties.set(role, found[0]!.institutionId); }
    return { transactionCase, authority, parties };
  }
  private async requireOwner(actor: RoomActor, caseId: string) { const result = await this.requireCase(actor, caseId, "OPERATE_CASE"); if (result.transactionCase.ownerInstitutionId !== actor.actingInstitutionId) throw new ForbiddenException("only the case owner may govern tokenised PTC"); return result; }
  private async assertFunction(caseId: string, materialFunction: string, institutionId: string) { const assignment = await this.db.caseFunctionAssignment.findUnique({ where: { transactionCaseId_materialFunction: { transactionCaseId: caseId, materialFunction } } }); if (!assignment || assignment.status !== "ACTIVE" || assignment.performerInstitutionId !== institutionId || assignment.performer === "PROHIBITED") throw new ConflictException(`active ${materialFunction} assignment is required`); }
  private async requireExternalEvidence(id: string, caseId: string, institutionId: string, evidenceType: string, expectedDigest?: string) {
    const item = await this.db.evidenceObject.findUnique({ where: { id }, include: { institution: { include: { admission: true } }, versions: { orderBy: { version: "desc" }, take: 1 } } });
    const version = item?.versions[0]; const now = new Date();
    if (!item || item.transactionCaseId !== caseId || item.institutionId !== institutionId || item.evidenceType !== evidenceType || item.status !== "AVAILABLE"
      || item.institution.status !== "ACTIVE" || item.institution.admission?.status !== "ADMITTED" || !version || item.currentVersion !== version.version
      || version.validationStatus !== "VALID" || version.signatureStatus !== "VERIFIED" || version.result !== "VERIFIED" || (version.expiresAt && version.expiresAt <= now)
      || (expectedDigest && version.payloadDigest !== expectedDigest) || /synthetic|fixture|demo|example/i.test(`${item.purpose}|${version.schemaId}`)) {
      throw new ConflictException(`${evidenceType} must be current independent external evidence for ${institutionId}`);
    }
    return { id: item.id, digest: version.payloadDigest, sourceAsOfAt: version.sourceAsOfAt, expiresAt: version.expiresAt };
  }
  private actor(actor: RoomActor) { return `user:${actor.actorUserId}@institution:${actor.actingInstitutionId}`; }
}
