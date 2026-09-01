import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { assertSha256Digest, sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import {
  buildSecondaryReplayPlan,
  compareSecondaryAuthority,
  CONVENTIONAL_SECONDARY_ROUTE_PACKS,
  normaliseSecondaryValues,
  SECONDARY_EVIDENCE_TYPES,
  type SecondaryEvidenceType,
  type SecondaryEvidenceFact,
  type SecondaryRoute,
} from "./secondary-route-pack";

function enabled(): void {
  const flags = inspectPersistenceFlags(process.env);
  if (flags.transactionCase !== "shadow" || flags.externalActionSaga !== "required" || flags.conventionalSecondary !== "shadow") {
    throw new ForbiddenException("conventional secondary replay is disabled");
  }
}

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new BadRequestException(`${name} must be a positive safe integer`);
  return value;
}

function digest(value: unknown, name: string): string {
  try { return assertSha256Digest(value, name); }
  catch (error) { throw new BadRequestException((error as Error).message); }
}

function commandDigest(scope: string, body: Readonly<Record<string, unknown>>): string {
  const { stepUpEvidenceId: _stepUpEvidenceId, ...request } = body;
  return sha256Digest({ scope, request: toCanonicalValue(request) });
}

function unique(error: unknown): boolean { return (error as { code?: string } | null)?.code === "P2002"; }

type CreateBody = {
  idempotencyKey?: unknown; transferReference?: unknown; instrumentReference?: unknown; instrumentDigest?: unknown;
  sellerInstitutionId?: unknown; buyerInstitutionId?: unknown; trusteeInstitutionId?: unknown;
  recordkeeperInstitutionId?: unknown; quantity?: { unitCode?: unknown; units?: unknown; scale?: unknown };
  consideration?: { currency?: unknown; units?: unknown; scale?: unknown }; stepUpEvidenceId?: unknown;
};

@Injectable()
export class SecondaryTransferService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly stepUp: StepUpService) {}

  async get(actor: RoomActor, caseId: string) {
    const { transactionCase } = await this.requireCase(actor, caseId, "VIEW_CASE");
    const dossier = await this.db.secondaryTransfer.findUnique({
      where: { transactionCaseId: caseId },
      include: { evidence: { orderBy: [{ evidenceType: "asc" }, { version: "asc" }] }, legs: { orderBy: { sequence: "asc" } }, breaks: { orderBy: { createdAt: "asc" } } },
    });
    if (!dossier) return null;
    if (![dossier.sellerInstitutionId, dossier.buyerInstitutionId, dossier.trusteeInstitutionId, dossier.recordkeeperInstitutionId]
      .includes(actor.actingInstitutionId)) throw new NotFoundException("secondary transfer not found");
    this.assertRoute(transactionCase, dossier.transactionRoute as SecondaryRoute);
    return { ...dossier, externalMutation: "NONE", ownershipAuthority: "EXTERNAL_DECLARED_RECORD" };
  }

  async create(actor: RoomActor, caseId: string, body: CreateBody) {
    const { transactionCase, authority } = await this.requireCase(actor, caseId, "OPERATE_CASE");
    const route = transactionCase.transactionRoute as SecondaryRoute;
    this.assertRoute(transactionCase, route);
    const sellerInstitutionId = required(body.sellerInstitutionId, "sellerInstitutionId", 160);
    const buyerInstitutionId = required(body.buyerInstitutionId, "buyerInstitutionId", 160);
    const recordkeeperInstitutionId = required(body.recordkeeperInstitutionId, "recordkeeperInstitutionId", 160);
    const trusteeInstitutionId = body.trusteeInstitutionId === undefined || body.trusteeInstitutionId === null || body.trusteeInstitutionId === ""
      ? null : required(body.trusteeInstitutionId, "trusteeInstitutionId", 160);
    if (sellerInstitutionId !== actor.actingInstitutionId || transactionCase.ownerInstitutionId !== sellerInstitutionId) {
      throw new ForbiddenException("the active case-owning seller institution must create the secondary dossier");
    }
    if (sellerInstitutionId === buyerInstitutionId) throw new BadRequestException("seller and buyer must be distinct institutions");
    if (route === "PTC" && !trusteeInstitutionId) throw new BadRequestException("PTC secondary replay requires a trustee institution");
    if (route === "DA" && trusteeInstitutionId) throw new BadRequestException("DA secondary replay must not inject a trustee role");
    await this.assertFoundation(transactionCase, { sellerInstitutionId, buyerInstitutionId, trusteeInstitutionId, recordkeeperInstitutionId });
    let values;
    try { values = normaliseSecondaryValues(body); }
    catch (error) { throw new BadRequestException((error as Error).message); }
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const transferReference = required(body.transferReference, "transferReference", 160);
    const instrumentReference = required(body.instrumentReference, "instrumentReference", 300);
    const instrumentDigest = digest(body.instrumentDigest, "instrumentDigest");
    const pack = CONVENTIONAL_SECONDARY_ROUTE_PACKS[route];
    const requestDigest = commandDigest("SECONDARY_TRANSFER_CREATE", { caseId, ...body });
    const existing = await this.db.secondaryTransfer.findUnique({ where: { transactionCaseId: caseId } });
    if (existing) {
      if (existing.creationIdempotencyKey !== idempotencyKey || existing.creationRequestDigest !== requestDigest) {
        throw new ConflictException("this case already has a different secondary-transfer dossier");
      }
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const created = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
          purpose: "SECONDARY_TRANSFER_CREATE", institutionId: actor.actingInstitutionId }, tx);
        const dossier = await tx.secondaryTransfer.create({ data: {
          id: `str_${randomUUID()}`, transactionCaseId: caseId, transactionRoute: route,
          routePackRef: pack.ref, routePackVersion: pack.version, transferReference, instrumentReference,
          instrumentDigest, sellerInstitutionId, buyerInstitutionId, trusteeInstitutionId, recordkeeperInstitutionId,
          quantityUnits: values.quantity.units, quantityScale: values.quantity.scale,
          considerationCurrency: values.consideration.currency, considerationMinorUnits: values.consideration.units,
          considerationScale: values.consideration.scale, creationIdempotencyKey: idempotencyKey,
          creationRequestDigest: requestDigest, createdByUserId: actor.actorUserId, createdByMandateId: authority.mandateId!,
        } });
        await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.secondary_transfer.created",
          detail: { caseId, secondaryTransferId: dossier.id, route, externalMutation: "NONE" } });
        return dossier;
      });
      audit("rail.secondary_transfer.created", { caseId, secondaryTransferId: created.id, actorUserId: actor.actorUserId });
      return created;
    } catch (error) { if (unique(error)) throw new ConflictException("secondary transfer reference or idempotency key already exists"); throw error; }
  }

  async addEvidence(actor: RoomActor, caseId: string, body: {
    evidenceType?: unknown; providerInstitutionId?: unknown; evidenceObjectId?: unknown;
    assertionDigest?: unknown; idempotencyKey?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { dossier, authority } = await this.requireSeller(actor, caseId);
    if (dossier.status !== "COLLECTING") throw new ConflictException("evidence can be added only while the dossier is collecting");
    const evidenceType = required(body.evidenceType, "evidenceType", 80) as SecondaryEvidenceType;
    if (!(SECONDARY_EVIDENCE_TYPES as readonly string[]).includes(evidenceType)) throw new BadRequestException("evidenceType is not governed by the secondary route pack");
    if (dossier.transactionRoute === "DA" && evidenceType === "TRUSTEE_TRANSACTION_CONTROL") throw new BadRequestException("DA must not use PTC trustee-control evidence");
    const providerInstitutionId = required(body.providerInstitutionId, "providerInstitutionId", 160);
    const evidenceObjectId = required(body.evidenceObjectId, "evidenceObjectId", 160);
    const assertionDigest = digest(body.assertionDigest, "assertionDigest");
    const evidence = await this.db.evidenceObject.findUnique({ where: { id: evidenceObjectId }, include: {
      versions: { orderBy: { version: "desc" }, take: 1, include: { providerReference: true } },
    } });
    const latest = evidence?.versions[0];
    if (!evidence || evidence.transactionCaseId !== caseId || evidence.status !== "AVAILABLE" || !latest
      || latest.version !== evidence.currentVersion || latest.validationStatus !== "VALID" || latest.result !== "VERIFIED"
      || (latest.expiresAt && latest.expiresAt <= new Date())) {
      throw new BadRequestException("secondary evidence must be current, VERIFIED, valid, available and scoped to this case");
    }
    if ((latest.providerReference?.institutionId ?? evidence.institutionId) !== providerInstitutionId) {
      throw new BadRequestException("evidence provider must match the retained provider reference or evidence owner");
    }
    const provider = await this.db.institution.findUnique({ where: { id: providerInstitutionId }, include: { admission: true } });
    if (!provider || provider.status !== "ACTIVE" || provider.admission?.status !== "ADMITTED") throw new BadRequestException("evidence provider must be an admitted active institution");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("SECONDARY_TRANSFER_EVIDENCE_ADD", { caseId, ...body });
    const duplicate = await this.db.secondaryTransferEvidence.findUnique({ where: { secondaryTransferId_idempotencyKey: { secondaryTransferId: dossier.id, idempotencyKey } } });
    if (duplicate) { if (duplicate.requestDigest !== requestDigest) throw new ConflictException("evidence idempotency key was reused with different content"); return duplicate; }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secondary-transfer:${dossier.id}`}))`;
      const current = await tx.secondaryTransfer.findUniqueOrThrow({ where: { id: dossier.id } });
      if (current.status !== "COLLECTING") throw new ConflictException("secondary dossier changed concurrently");
      const version = (await tx.secondaryTransferEvidence.aggregate({ where: { secondaryTransferId: dossier.id, evidenceType }, _max: { version: true } }))._max.version ?? 0;
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "SECONDARY_TRANSFER_EVIDENCE_RECORD", institutionId: actor.actingInstitutionId }, tx);
      const created = await tx.secondaryTransferEvidence.create({ data: {
        id: `ste_${randomUUID()}`, secondaryTransferId: dossier.id, evidenceType, version: version + 1,
        providerInstitutionId, evidenceObjectId, evidenceResult: latest.result, assertionDigest,
        sourceAsOfAt: latest.sourceAsOfAt, idempotencyKey, requestDigest, recordedByUserId: actor.actorUserId,
        recordedByMandateId: authority.mandateId!, stepUpEvidenceId,
      } });
      await tx.secondaryTransfer.update({ where: { id: dossier.id }, data: { aggregateVersion: { increment: 1 } } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.secondary_transfer.evidence_recorded",
        detail: { caseId, secondaryTransferId: dossier.id, evidenceType, evidenceRecordId: created.id, evidenceObjectId } });
      return created;
    });
  }

  async propose(actor: RoomActor, caseId: string, body: { expectedVersion?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    const { dossier, authority } = await this.requireSeller(actor, caseId);
    if (dossier.status !== "COLLECTING") throw new ConflictException("only a collecting dossier can be proposed");
    const expectedVersion = positiveInteger(body.expectedVersion, "expectedVersion");
    if (dossier.aggregateVersion !== expectedVersion) throw new ConflictException("stale secondary dossier version");
    const latest = await this.latestEvidence(dossier.id);
    try { buildSecondaryReplayPlan({ route: dossier.transactionRoute as SecondaryRoute, sellerInstitutionId: dossier.sellerInstitutionId,
      buyerInstitutionId: dossier.buyerInstitutionId, trusteeInstitutionId: dossier.trusteeInstitutionId,
      recordkeeperInstitutionId: dossier.recordkeeperInstitutionId, instrumentDigest: dossier.instrumentDigest, evidence: latest }); }
    catch (error) { throw new ConflictException((error as Error).message); }
    const reason = required(body.reason, "reason", 1000);
    const proposalDigest = sha256Digest({ secondaryTransferId: dossier.id, expectedVersion, reason,
      evidence: latest.map((item) => ({ type: item.evidenceType, version: item.version, assertionDigest: item.assertionDigest })) });
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const changed = await tx.secondaryTransfer.updateMany({ where: { id: dossier.id, status: "COLLECTING", aggregateVersion: expectedVersion }, data: {
        status: "PROPOSED", proposedByUserId: actor.actorUserId, proposedByMandateId: authority.mandateId!, proposalStepUpId: stepUpEvidenceId,
        proposalDigest, proposedAt: new Date(), aggregateVersion: { increment: 1 },
      } });
      if (changed.count !== 1) throw new ConflictException("secondary dossier changed concurrently");
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "SECONDARY_TRANSFER_PROPOSE", institutionId: actor.actingInstitutionId }, tx);
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.secondary_transfer.proposed", detail: { caseId, secondaryTransferId: dossier.id, proposalDigest } });
      return tx.secondaryTransfer.findUniqueOrThrow({ where: { id: dossier.id } });
    });
  }

  async review(actor: RoomActor, caseId: string, body: { approved?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    const { dossier, authority } = await this.requireSeller(actor, caseId);
    if (dossier.status !== "PROPOSED") throw new ConflictException("secondary dossier is not awaiting review");
    if (dossier.proposedByUserId === actor.actorUserId) throw new ForbiddenException("dossier proposer cannot review their own proposal");
    if (typeof body.approved !== "boolean") throw new BadRequestException("approved must be boolean");
    const reason = required(body.reason, "reason", 1000);
    const latest = await this.latestEvidence(dossier.id);
    let plan;
    try { plan = buildSecondaryReplayPlan({ route: dossier.transactionRoute as SecondaryRoute, sellerInstitutionId: dossier.sellerInstitutionId,
      buyerInstitutionId: dossier.buyerInstitutionId, trusteeInstitutionId: dossier.trusteeInstitutionId,
      recordkeeperInstitutionId: dossier.recordkeeperInstitutionId, instrumentDigest: dossier.instrumentDigest, evidence: latest }); }
    catch (error) { throw new ConflictException((error as Error).message); }
    const comparison = compareSecondaryAuthority({ route: dossier.transactionRoute as SecondaryRoute, evidence: latest });
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secondary-transfer:${dossier.id}`}))`;
      const current = await tx.secondaryTransfer.findUniqueOrThrow({ where: { id: dossier.id } });
      if (current.status !== "PROPOSED" || current.proposalDigest !== dossier.proposalDigest) throw new ConflictException("secondary dossier changed concurrently");
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "SECONDARY_TRANSFER_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      if (body.approved) {
        await tx.secondaryTransferLeg.createMany({ data: plan.map((leg) => ({
          id: `stl_${randomUUID()}`, secondaryTransferId: dossier.id, ...leg, state: comparison.matched ? "MATCHED" : "BREAK_OPEN",
        })) });
        if (!comparison.matched) await tx.secondaryTransferBreak.create({ data: {
          id: `stb_${randomUUID()}`, secondaryTransferId: dossier.id, breakCode: comparison.breakCode!, severity: "CRITICAL",
          expectedDigest: comparison.expectedDigest || sha256Digest("missing"), observedDigest: comparison.observedDigest || sha256Digest("missing"),
          blockedCapabilities: ["EXECUTION", "CASH_SETTLEMENT", "AUTHORITATIVE_REGISTER_UPDATE"],
          ownerInstitutionId: dossier.transactionRoute === "PTC" ? dossier.trusteeInstitutionId! : dossier.recordkeeperInstitutionId,
          detail: { route: dossier.transactionRoute, ownershipSource: "EXTERNAL_DECLARED_RECORD", syntheticEvidenceAccepted: false } as Prisma.InputJsonValue,
          openedByUserId: actor.actorUserId,
        } });
      }
      const status = !body.approved ? "REJECTED" : comparison.matched ? "RECONCILED" : "BREAK_OPEN";
      const updated = await tx.secondaryTransfer.update({ where: { id: dossier.id }, data: {
        status, reviewedByUserId: actor.actorUserId, reviewedByMandateId: authority.mandateId!, reviewStepUpId: stepUpEvidenceId,
        reviewReason: reason, reviewedAt: new Date(), reconciledAt: status === "RECONCILED" ? new Date() : null, aggregateVersion: { increment: 1 },
      } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.secondary_transfer.reviewed",
        detail: { caseId, secondaryTransferId: dossier.id, approved: body.approved, status, comparisonBreakCode: comparison.breakCode, externalMutation: "NONE" } });
      return updated;
    });
  }

  private async latestEvidence(secondaryTransferId: string): Promise<Array<SecondaryEvidenceFact & { version: number }>> {
    const rows = await this.db.secondaryTransferEvidence.findMany({ where: { secondaryTransferId }, orderBy: [{ evidenceType: "asc" }, { version: "desc" }] });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!latest.has(row.evidenceType)) latest.set(row.evidenceType, row);
    return [...latest.values()].map((row) => ({
      id: row.id,
      evidenceType: row.evidenceType as SecondaryEvidenceType,
      evidenceResult: row.evidenceResult,
      assertionDigest: row.assertionDigest,
      providerInstitutionId: row.providerInstitutionId,
      version: row.version,
    }));
  }

  private async requireCase(actor: RoomActor, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE") {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    if (!transactionCase) throw new NotFoundException("transaction case not found");
    const participant = transactionCase.ownerInstitutionId === actor.actingInstitutionId
      || transactionCase.parties.some((party) => party.institutionId === actor.actingInstitutionId && party.status === "ACTIVE");
    if (!participant) throw new NotFoundException("transaction case not found");
    const authority = await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    return { transactionCase, authority };
  }

  private async requireSeller(actor: RoomActor, caseId: string) {
    const { transactionCase, authority } = await this.requireCase(actor, caseId, "OPERATE_CASE");
    const dossier = await this.db.secondaryTransfer.findUnique({ where: { transactionCaseId: caseId } });
    if (!dossier || dossier.sellerInstitutionId !== actor.actingInstitutionId) throw new ForbiddenException("only the case seller may govern the secondary dossier");
    this.assertRoute(transactionCase, dossier.transactionRoute as SecondaryRoute);
    return { transactionCase, dossier, authority };
  }

  private assertRoute(transactionCase: { transactionRoute: string; representation: string; lifecycleLeg: string; operatingMode: string; routePackRef: string; routePackVersion: string; marketContext: string; jurisdiction: string }, route: SecondaryRoute): void {
    const pack = CONVENTIONAL_SECONDARY_ROUTE_PACKS[route];
    if (!pack || transactionCase.transactionRoute !== pack.transactionRoute || transactionCase.representation !== pack.representation
      || transactionCase.lifecycleLeg !== pack.lifecycleLeg || transactionCase.marketContext !== "DOMESTIC" || transactionCase.jurisdiction !== "IN"
      || transactionCase.routePackRef !== pack.ref || transactionCase.routePackVersion !== pack.version
      || !pack.operatingModes.includes(transactionCase.operatingMode as "REPLAY" | "SHADOW")) {
      throw new BadRequestException("case is outside the conventional secondary replay route pack");
    }
  }

  private async assertFoundation(transactionCase: { id: string; transactionRoute: string; representation: string; assetClass: string; lifecycleLeg: string; operatingMode: string; parties: Array<{ institutionId: string; partyRole: string; status: string }> }, ids: { sellerInstitutionId: string; buyerInstitutionId: string; trusteeInstitutionId: string | null; recordkeeperInstitutionId: string }) {
    const requiredParties = new Map<string, string>([["SECONDARY_SELLER", ids.sellerInstitutionId], ["SECONDARY_BUYER", ids.buyerInstitutionId], ["RECORDKEEPER", ids.recordkeeperInstitutionId]]);
    if (transactionCase.transactionRoute === "PTC") requiredParties.set("TRUSTEE", ids.trusteeInstitutionId!);
    for (const [role, institutionId] of requiredParties) {
      if (!transactionCase.parties.some((party) => party.partyRole === role && party.institutionId === institutionId && party.status === "ACTIVE")) {
        throw new ConflictException(`secondary route requires active ${role} party ${institutionId}`);
      }
    }
    const functions = [
      ["SECONDARY_TRANSFER_OR_TRADING", ids.sellerInstitutionId], ["EXECUTION", ids.sellerInstitutionId],
      ["CASH_SETTLEMENT", ids.sellerInstitutionId], ["AUTHORITATIVE_REGISTER_UPDATE", ids.recordkeeperInstitutionId],
      ...(transactionCase.transactionRoute === "PTC" ? [["TRUSTEE_TRANSACTION_CONTROL", ids.trusteeInstitutionId!]] : []),
    ];
    for (const [materialFunction, performerInstitutionId] of functions) {
      const assignment = await this.db.caseFunctionAssignment.findUnique({ where: { transactionCaseId_materialFunction: { transactionCaseId: transactionCase.id, materialFunction } } });
      if (!assignment || assignment.status !== "ACTIVE" || assignment.performer === "PROHIBITED" || assignment.performerInstitutionId !== performerInstitutionId) {
        throw new ConflictException(`secondary route requires active ${materialFunction} assignment to ${performerInstitutionId}`);
      }
      const entitlement = await this.access.evaluateRoute(performerInstitutionId, {
        transactionRoute: transactionCase.transactionRoute, representation: transactionCase.representation,
        assetClass: transactionCase.assetClass, lifecycleLeg: transactionCase.lifecycleLeg, materialFunction, operatingMode: transactionCase.operatingMode,
      });
      if (!entitlement.allowed) throw new ForbiddenException(`${materialFunction} route denied for ${performerInstitutionId}: ${entitlement.code}`);
    }
  }

  private actorRef(actor: RoomActor): string { return `user:${actor.actorUserId}:institution:${actor.actingInstitutionId}`; }
}
