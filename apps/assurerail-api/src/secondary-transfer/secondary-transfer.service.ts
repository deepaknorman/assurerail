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
import { deriveSecondaryProductJourney } from "./secondary-product";

function enabled(): void {
  const flags = inspectPersistenceFlags(process.env);
  if (flags.transactionCase !== "shadow" || flags.externalActionSaga !== "required" || flags.conventionalSecondary !== "shadow") {
    throw new ForbiddenException("conventional secondary replay is disabled");
  }
}

function productEnabled(): void {
  enabled();
  if (inspectPersistenceFlags(process.env).secondaryProduct !== "shadow") {
    throw new ForbiddenException("conventional secondary product journey is disabled");
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

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

type CreateBody = {
  idempotencyKey?: unknown; transferReference?: unknown; instrumentReference?: unknown; instrumentDigest?: unknown;
  sellerInstitutionId?: unknown; buyerInstitutionId?: unknown; trusteeInstitutionId?: unknown;
  recordkeeperInstitutionId?: unknown; quantity?: { unitCode?: unknown; units?: unknown; scale?: unknown };
  consideration?: { currency?: unknown; units?: unknown; scale?: unknown }; stepUpEvidenceId?: unknown;
};

@Injectable()
export class SecondaryTransferService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly stepUp: StepUpService) {}

  async list(actor: RoomActor) {
    productEnabled();
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "VIEW_CASE" });
    return this.db.secondaryTransfer.findMany({
      where: { OR: [
        { sellerInstitutionId: actor.actingInstitutionId }, { buyerInstitutionId: actor.actingInstitutionId },
        { trusteeInstitutionId: actor.actingInstitutionId }, { recordkeeperInstitutionId: actor.actingInstitutionId },
      ] },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, transactionCaseId: true, transactionRoute: true, transferReference: true,
        instrumentReference: true, quantityUnits: true, quantityScale: true, considerationCurrency: true,
        considerationMinorUnits: true, considerationScale: true, sellerInstitutionId: true,
        buyerInstitutionId: true, trusteeInstitutionId: true, recordkeeperInstitutionId: true,
        status: true, aggregateVersion: true, updatedAt: true,
        transactionCase: { select: { caseReference: true, operatingMode: true, lifecycleLeg: true, representation: true } },
        _count: { select: { evidence: true, legs: true, breaks: true } },
      },
    });
  }

  async productOverview(actor: RoomActor, caseId: string) {
    productEnabled();
    const { transactionCase } = await this.requireCase(actor, caseId, "VIEW_CASE");
    const route = transactionCase.transactionRoute as SecondaryRoute;
    this.assertRoute(transactionCase, route);
    const [dossier, canOperateCase, canOperateRoute, canViewEvidence] = await Promise.all([
      this.db.secondaryTransfer.findUnique({
        where: { transactionCaseId: caseId },
        include: {
          evidence: { orderBy: [{ evidenceType: "asc" }, { version: "asc" }] },
          legs: { orderBy: { sequence: "asc" } },
          breaks: { orderBy: { createdAt: "asc" }, include: { repairs: { orderBy: { createdAt: "asc" } } } },
        },
      }),
      this.may(actor, caseId, "OPERATE_CASE"),
      this.may(actor, caseId, "OPERATE_ROUTE"),
      this.may(actor, caseId, "VIEW_EVIDENCE"),
    ]);
    if (dossier && ![dossier.sellerInstitutionId, dossier.buyerInstitutionId, dossier.trusteeInstitutionId, dossier.recordkeeperInstitutionId]
      .includes(actor.actingInstitutionId)) throw new NotFoundException("secondary transfer not found");
    const latest = new Map<string, { evidenceType: string }>();
    for (const item of dossier?.evidence ?? []) latest.set(item.evidenceType, item);
    const journey = deriveSecondaryProductJourney({
      route, dossierStatus: dossier?.status ?? null, evidenceTypes: canViewEvidence ? [...latest.keys()] : [],
      matchedLegCount: dossier?.legs.filter((item) => item.state === "MATCHED").length ?? 0,
      requiredLegCount: dossier?.legs.length ?? 0,
      openBreakCount: dossier?.breaks.filter((item) => item.status === "OPEN").length ?? 0,
      approvedRepairCount: dossier?.breaks.flatMap((item) => item.repairs).filter((item) => item.status === "APPROVED").length ?? 0,
      canOperateCase, canOperateRoute, canViewEvidence,
    });
    const visibleDossier = dossier ? {
      ...dossier,
      evidence: canViewEvidence ? dossier.evidence : [],
      legs: canViewEvidence ? dossier.legs : dossier.legs.map((item) => ({ id: item.id, secondaryTransferId: item.secondaryTransferId,
        legKey: item.legKey, legType: item.legType, sequence: item.sequence, performerInstitutionId: item.performerInstitutionId,
        performerClass: item.performerClass, expectedEvidenceType: item.expectedEvidenceType, state: item.state,
        createdAt: item.createdAt, updatedAt: item.updatedAt })),
      breaks: dossier.breaks.map((item) => canViewEvidence ? item : ({ id: item.id, secondaryTransferId: item.secondaryTransferId,
        breakCode: item.breakCode, severity: item.severity, blockedCapabilities: item.blockedCapabilities,
        ownerInstitutionId: item.ownerInstitutionId, status: item.status, openedByUserId: item.openedByUserId,
        createdAt: item.createdAt, updatedAt: item.updatedAt, repairs: item.repairs.map((repair) => ({
        id: repair.id, secondaryTransferBreakId: repair.secondaryTransferBreakId,
        replacementEvidenceType: repair.replacementEvidenceType, status: repair.status,
        proposedByUserId: repair.proposedByUserId, reviewedByUserId: repair.reviewedByUserId,
        reviewReason: repair.reviewReason, proposedAt: repair.proposedAt, reviewedAt: repair.reviewedAt,
      })) })),
    } : null;
    return {
      operatingBoundary: "OBSERVE_ONLY" as const,
      authorityNotice: "AssureRail records and reconciles partner-performed secondary-transfer facts. It performs no cash, title, token, notice or authoritative-register act.",
      case: {
        id: transactionCase.id, caseReference: transactionCase.caseReference,
        ownerInstitutionId: transactionCase.ownerInstitutionId, transactionRoute: route,
        representation: transactionCase.representation, operatingMode: transactionCase.operatingMode,
        status: transactionCase.status, aggregateVersion: transactionCase.aggregateVersion,
      },
      ...journey,
      dossier: visibleDossier,
    };
  }

  async get(actor: RoomActor, caseId: string) {
    const { transactionCase } = await this.requireCase(actor, caseId, "VIEW_CASE");
    const canViewEvidence = await this.may(actor, caseId, "VIEW_EVIDENCE");
    const dossier = await this.db.secondaryTransfer.findUnique({
      where: { transactionCaseId: caseId },
      include: { evidence: { orderBy: [{ evidenceType: "asc" }, { version: "asc" }] }, legs: { orderBy: { sequence: "asc" } }, breaks: { orderBy: { createdAt: "asc" }, include: { repairs: { orderBy: { createdAt: "asc" } } } } },
    });
    if (!dossier) return null;
    if (![dossier.sellerInstitutionId, dossier.buyerInstitutionId, dossier.trusteeInstitutionId, dossier.recordkeeperInstitutionId]
      .includes(actor.actingInstitutionId)) throw new NotFoundException("secondary transfer not found");
    this.assertRoute(transactionCase, dossier.transactionRoute as SecondaryRoute);
    return { ...dossier, evidence: canViewEvidence ? dossier.evidence : [], legs: canViewEvidence ? dossier.legs : dossier.legs.map((item) => ({
      id: item.id, legKey: item.legKey, legType: item.legType, sequence: item.sequence, performerInstitutionId: item.performerInstitutionId,
      performerClass: item.performerClass, expectedEvidenceType: item.expectedEvidenceType, state: item.state,
    })), breaks: dossier.breaks.map((item) => canViewEvidence ? item : ({
      id: item.id, breakCode: item.breakCode, severity: item.severity, blockedCapabilities: item.blockedCapabilities,
      ownerInstitutionId: item.ownerInstitutionId, status: item.status, repairs: item.repairs.map((repair) => ({
        id: repair.id, replacementEvidenceType: repair.replacementEvidenceType, status: repair.status,
        proposedByUserId: repair.proposedByUserId, reviewedByUserId: repair.reviewedByUserId, reviewReason: repair.reviewReason,
      })) })), externalMutation: "NONE", ownershipAuthority: "EXTERNAL_DECLARED_RECORD" };
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
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action: "VIEW_EVIDENCE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    if (dossier.status !== "COLLECTING") throw new ConflictException("evidence can be added only while the dossier is collecting");
    const evidenceType = required(body.evidenceType, "evidenceType", 80) as SecondaryEvidenceType;
    if (!(SECONDARY_EVIDENCE_TYPES as readonly string[]).includes(evidenceType)) throw new BadRequestException("evidenceType is not governed by the secondary route pack");
    if (dossier.transactionRoute === "DA" && evidenceType === "TRUSTEE_TRANSACTION_CONTROL") throw new BadRequestException("DA must not use PTC trustee-control evidence");
    const providerInstitutionId = required(body.providerInstitutionId, "providerInstitutionId", 160);
    const evidenceObjectId = required(body.evidenceObjectId, "evidenceObjectId", 160);
    const assertionDigest = digest(body.assertionDigest, "assertionDigest");
    await this.requireEligibleEvidence(this.db, caseId, actor.actingInstitutionId, providerInstitutionId, evidenceObjectId, assertionDigest);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("SECONDARY_TRANSFER_EVIDENCE_ADD", { caseId, ...body });
    const duplicate = await this.db.secondaryTransferEvidence.findUnique({ where: { secondaryTransferId_idempotencyKey: { secondaryTransferId: dossier.id, idempotencyKey } } });
    if (duplicate) { if (duplicate.requestDigest !== requestDigest) throw new ConflictException("evidence idempotency key was reused with different content"); return duplicate; }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secondary-transfer:${dossier.id}`}))`;
      const current = await tx.secondaryTransfer.findUniqueOrThrow({ where: { id: dossier.id } });
      if (current.status !== "COLLECTING") throw new ConflictException("secondary dossier changed concurrently");
      const { latest } = await this.requireEligibleEvidence(tx, caseId, actor.actingInstitutionId,
        providerInstitutionId, evidenceObjectId, assertionDigest);
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

  async proposeRepair(actor: RoomActor, caseId: string, breakId: string, body: {
    replacementEvidenceType?: unknown; providerInstitutionId?: unknown; evidenceObjectId?: unknown;
    assertionDigest?: unknown; authorityEvidenceRef?: unknown; idempotencyKey?: unknown; stepUpEvidenceId?: unknown;
  }) {
    productEnabled();
    const { transactionCase, authority } = await this.requireCase(actor, caseId, "OPERATE_ROUTE");
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action: "VIEW_EVIDENCE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const item = await this.db.secondaryTransferBreak.findUnique({ where: { id: breakId }, include: { secondaryTransfer: true } });
    if (!item || item.secondaryTransfer.transactionCaseId !== caseId) throw new NotFoundException("secondary transfer break not found");
    if (item.ownerInstitutionId !== actor.actingInstitutionId) throw new ForbiddenException("only the accountable break owner may propose a repair");
    if (item.status !== "OPEN") throw new ConflictException("only an open break can be repaired");
    const evidenceType = required(body.replacementEvidenceType, "replacementEvidenceType", 80) as SecondaryEvidenceType;
    const permitted = item.secondaryTransfer.transactionRoute === "PTC"
      ? ["TRUSTEE_TRANSACTION_CONTROL", "AUTHORITATIVE_RECORD_AFTER"]
      : ["AUTHORITATIVE_RECORD_AFTER"];
    if (!permitted.includes(evidenceType)) throw new BadRequestException(`replacementEvidenceType must be one of: ${permitted.join(", ")}`);
    const providerInstitutionId = required(body.providerInstitutionId, "providerInstitutionId", 160);
    const evidenceObjectId = required(body.evidenceObjectId, "evidenceObjectId", 160);
    const assertionDigest = digest(body.assertionDigest, "assertionDigest");
    await this.requireEligibleEvidence(this.db, caseId, actor.actingInstitutionId, providerInstitutionId, evidenceObjectId, assertionDigest);
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = commandDigest("SECONDARY_TRANSFER_REPAIR_PROPOSE", { caseId, breakId, ...body });
    const existing = await this.db.secondaryTransferRepair.findUnique({
      where: { secondaryTransferBreakId_idempotencyKey: { secondaryTransferBreakId: breakId, idempotencyKey } },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new ConflictException("repair idempotency key was reused with different content");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secondary-transfer:${item.secondaryTransferId}`}))`;
      const current = await tx.secondaryTransferBreak.findUniqueOrThrow({ where: { id: breakId } });
      if (current.status !== "OPEN") throw new ConflictException("secondary transfer break changed concurrently");
      await this.requireEligibleEvidence(tx, caseId, actor.actingInstitutionId,
        providerInstitutionId, evidenceObjectId, assertionDigest);
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "SECONDARY_TRANSFER_REPAIR_PROPOSE", institutionId: actor.actingInstitutionId }, tx);
      const repair = await tx.secondaryTransferRepair.create({ data: {
        id: `strp_${randomUUID()}`, secondaryTransferBreakId: breakId, replacementEvidenceType: evidenceType,
        providerInstitutionId, evidenceObjectId, assertionDigest, authorityEvidenceRef, idempotencyKey,
        requestDigest, proposedByUserId: actor.actorUserId, proposedByMandateId: authority.mandateId!, proposalStepUpId: stepUpEvidenceId,
      } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.secondary_transfer.repair_proposed",
        detail: { caseId, secondaryTransferId: item.secondaryTransferId, breakId, repairId: repair.id, evidenceType, evidenceObjectId, externalMutation: "NONE" } });
      return repair;
    });
  }

  async reviewRepair(actor: RoomActor, caseId: string, breakId: string, repairId: string, body: {
    approved?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    productEnabled();
    const { authority } = await this.requireCase(actor, caseId, "OPERATE_ROUTE");
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action: "VIEW_EVIDENCE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const repair = await this.db.secondaryTransferRepair.findUnique({
      where: { id: repairId }, include: { secondaryTransferBreak: { include: { secondaryTransfer: true } } },
    });
    const item = repair?.secondaryTransferBreak;
    if (!repair || !item || item.id !== breakId || item.secondaryTransfer.transactionCaseId !== caseId) throw new NotFoundException("secondary transfer repair not found");
    if (item.ownerInstitutionId !== actor.actingInstitutionId) throw new ForbiddenException("only the accountable break owner may review a repair");
    if (repair.proposedByUserId === actor.actorUserId) throw new ForbiddenException("repair proposer cannot review their own proposal");
    if (repair.status !== "PROPOSED" || item.status !== "OPEN") throw new ConflictException("repair is no longer reviewable");
    if (typeof body.approved !== "boolean") throw new BadRequestException("approved must be boolean");
    const reason = required(body.reason, "reason", 1000);
    if (body.approved) await this.requireEligibleEvidence(this.db, caseId, actor.actingInstitutionId,
      repair.providerInstitutionId, repair.evidenceObjectId, repair.assertionDigest);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`secondary-transfer:${item.secondaryTransferId}`}))`;
      const current = await tx.secondaryTransferRepair.findUniqueOrThrow({ where: { id: repairId } });
      const currentBreak = await tx.secondaryTransferBreak.findUniqueOrThrow({ where: { id: breakId } });
      if (current.status !== "PROPOSED" || currentBreak.status !== "OPEN") throw new ConflictException("repair changed concurrently");
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actor.actorUserId, sessionId: actor.actorSessionId,
        purpose: "SECONDARY_TRANSFER_REPAIR_REVIEW", institutionId: actor.actingInstitutionId }, tx);
      let appliedEvidenceRecordId: string | null = null;
      let reconciled = false;
      if (body.approved) {
        const { latest: latestSource } = await this.requireEligibleEvidence(tx, caseId, actor.actingInstitutionId,
          repair.providerInstitutionId, repair.evidenceObjectId, repair.assertionDigest);
        const version = (await tx.secondaryTransferEvidence.aggregate({ where: { secondaryTransferId: item.secondaryTransferId, evidenceType: repair.replacementEvidenceType }, _max: { version: true } }))._max.version ?? 0;
        const evidenceRecord = await tx.secondaryTransferEvidence.create({ data: {
          id: `ste_${randomUUID()}`, secondaryTransferId: item.secondaryTransferId, evidenceType: repair.replacementEvidenceType,
          version: version + 1, providerInstitutionId: repair.providerInstitutionId, evidenceObjectId: repair.evidenceObjectId,
          evidenceResult: latestSource.result, assertionDigest: repair.assertionDigest, sourceAsOfAt: latestSource.sourceAsOfAt,
          idempotencyKey: `repair:${repair.id}`, requestDigest: repair.requestDigest, recordedByUserId: actor.actorUserId,
          recordedByMandateId: authority.mandateId!, stepUpEvidenceId,
        } });
        appliedEvidenceRecordId = evidenceRecord.id;
        const evidenceRows = await tx.secondaryTransferEvidence.findMany({ where: { secondaryTransferId: item.secondaryTransferId }, orderBy: [{ evidenceType: "asc" }, { version: "desc" }] });
        const evidenceLatest = new Map<string, SecondaryEvidenceFact>();
        for (const row of evidenceRows) if (!evidenceLatest.has(row.evidenceType)) evidenceLatest.set(row.evidenceType, {
          id: row.id, evidenceType: row.evidenceType as SecondaryEvidenceType, evidenceResult: row.evidenceResult,
          assertionDigest: row.assertionDigest, providerInstitutionId: row.providerInstitutionId,
        });
        reconciled = compareSecondaryAuthority({ route: item.secondaryTransfer.transactionRoute as SecondaryRoute, evidence: [...evidenceLatest.values()] }).matched;
        if (reconciled) {
          await tx.secondaryTransferBreak.update({ where: { id: breakId }, data: { status: "RESOLVED" } });
          await tx.secondaryTransferLeg.updateMany({ where: { secondaryTransferId: item.secondaryTransferId }, data: { state: "MATCHED" } });
          await tx.secondaryTransfer.update({ where: { id: item.secondaryTransferId }, data: { status: "RECONCILED", reconciledAt: new Date(), aggregateVersion: { increment: 1 } } });
        } else {
          await tx.secondaryTransfer.update({ where: { id: item.secondaryTransferId }, data: { aggregateVersion: { increment: 1 } } });
        }
      }
      const updated = await tx.secondaryTransferRepair.update({ where: { id: repairId }, data: {
        status: body.approved ? "APPROVED" : "REJECTED", reviewedByUserId: actor.actorUserId,
        reviewedByMandateId: authority.mandateId!, reviewStepUpId: stepUpEvidenceId, reviewReason: reason,
        appliedEvidenceRecordId, reviewedAt: new Date(),
      } });
      await appendGovernedAudit(tx, { actor: this.actorRef(actor), event: "rail.secondary_transfer.repair_reviewed",
        detail: { caseId, secondaryTransferId: item.secondaryTransferId, breakId, repairId, approved: body.approved, reconciled, appliedEvidenceRecordId, externalMutation: "NONE" } });
      return updated;
    });
  }

  async comparisonCsv(actor: RoomActor, caseId: string): Promise<string> {
    const pack = await this.evidencePack(actor, caseId);
    const rows = [["sequence", "leg_key", "leg_type", "performer_institution", "performer_class", "state", "expected_evidence_type", "expected_assertion_digest", "comparison_digest"],
      ...pack.legs.map((leg) => [leg.sequence, leg.legKey, leg.legType, leg.performerInstitutionId, leg.performerClass, leg.state, leg.expectedEvidenceType, leg.expectedAssertionDigest, leg.comparisonDigest ?? ""])];
    return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
  }

  async evidencePack(actor: RoomActor, caseId: string) {
    productEnabled();
    const { transactionCase } = await this.requireCase(actor, caseId, "VIEW_CASE");
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action: "VIEW_EVIDENCE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    const dossier = await this.db.secondaryTransfer.findUnique({ where: { transactionCaseId: caseId }, include: {
      evidence: { orderBy: [{ evidenceType: "asc" }, { version: "asc" }] }, legs: { orderBy: { sequence: "asc" } },
      breaks: { orderBy: { createdAt: "asc" }, include: { repairs: { orderBy: { createdAt: "asc" } } } },
    } });
    if (!dossier || ![dossier.sellerInstitutionId, dossier.buyerInstitutionId, dossier.trusteeInstitutionId, dossier.recordkeeperInstitutionId]
      .includes(actor.actingInstitutionId)) throw new NotFoundException("secondary transfer not found");
    this.assertRoute(transactionCase, dossier.transactionRoute as SecondaryRoute);
    const evidence = dossier.evidence.map((item) => ({ id: item.id, evidenceType: item.evidenceType, version: item.version,
      providerInstitutionId: item.providerInstitutionId, evidenceObjectId: item.evidenceObjectId, evidenceResult: item.evidenceResult,
      assertionDigest: item.assertionDigest, sourceAsOfAt: item.sourceAsOfAt.toISOString(), createdAt: item.createdAt.toISOString() }));
    const legs = dossier.legs.map((item) => ({ id: item.id, legKey: item.legKey, legType: item.legType, sequence: item.sequence,
      performerInstitutionId: item.performerInstitutionId, performerClass: item.performerClass, expectedEvidenceType: item.expectedEvidenceType,
      expectedAssertionDigest: item.expectedAssertionDigest, state: item.state, comparisonDigest: item.comparisonDigest }));
    const breaks = dossier.breaks.map((item) => ({ id: item.id, breakCode: item.breakCode, severity: item.severity,
      status: item.status, expectedDigest: item.expectedDigest, observedDigest: item.observedDigest,
      ownerInstitutionId: item.ownerInstitutionId, repairs: item.repairs.map((repair) => ({ id: repair.id,
        replacementEvidenceType: repair.replacementEvidenceType, providerInstitutionId: repair.providerInstitutionId,
        evidenceObjectId: repair.evidenceObjectId, assertionDigest: repair.assertionDigest, authorityEvidenceRef: repair.authorityEvidenceRef,
        status: repair.status, proposedByUserId: repair.proposedByUserId, reviewedByUserId: repair.reviewedByUserId,
        reviewReason: repair.reviewReason, appliedEvidenceRecordId: repair.appliedEvidenceRecordId,
        proposedAt: repair.proposedAt.toISOString(), reviewedAt: repair.reviewedAt?.toISOString() ?? null })) }));
    const content = { schema: "assurerail.secondary-evidence-pack.v1",
      operatingBoundary: "OBSERVE_ONLY", legalEffect: "NONE_ASSERTED", case: { id: caseId, caseReference: transactionCase.caseReference,
        transactionRoute: dossier.transactionRoute, representation: transactionCase.representation, operatingMode: transactionCase.operatingMode },
      dossier: { id: dossier.id, transferReference: dossier.transferReference, instrumentReference: dossier.instrumentReference,
        instrumentDigest: dossier.instrumentDigest, sellerInstitutionId: dossier.sellerInstitutionId, buyerInstitutionId: dossier.buyerInstitutionId,
        trusteeInstitutionId: dossier.trusteeInstitutionId, recordkeeperInstitutionId: dossier.recordkeeperInstitutionId,
        quantityUnits: dossier.quantityUnits, quantityScale: dossier.quantityScale, considerationCurrency: dossier.considerationCurrency,
        considerationMinorUnits: dossier.considerationMinorUnits, considerationScale: dossier.considerationScale, status: dossier.status,
        routePackRef: dossier.routePackRef, routePackVersion: dossier.routePackVersion, aggregateVersion: dossier.aggregateVersion }, evidence, legs, breaks };
    const packDigest = sha256Digest(toCanonicalValue(content));
    const generatedAt = new Date().toISOString();
    await this.db.$transaction(async (tx) => appendGovernedAudit(tx, { actor: this.actorRef(actor),
      event: "rail.secondary_transfer.evidence_snapshot_accessed",
      detail: { caseId, secondaryTransferId: dossier.id, packDigest, generatedAt, externalMutation: "NONE" } }));
    return { ...content, generatedAt, packDigest };
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

  private async requireCase(actor: RoomActor, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE" | "OPERATE_ROUTE") {
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

  private async may(actor: RoomActor, caseId: string, action: "OPERATE_CASE" | "OPERATE_ROUTE" | "VIEW_EVIDENCE"): Promise<boolean> {
    return (await this.access.evaluateHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action, scopeType: "TRANSACTION_CASE", scopeRef: caseId })).allowed;
  }

  private async requireEligibleEvidence(database: Pick<Prisma.TransactionClient, "evidenceObject" | "institution">,
    caseId: string, actingInstitutionId: string, providerInstitutionId: string, evidenceObjectId: string, assertionDigest: string) {
    const evidence = await database.evidenceObject.findUnique({ where: { id: evidenceObjectId }, include: {
      versions: { orderBy: { version: "desc" }, take: 1, include: { providerReference: true } },
      grants: { where: { granteeInstitutionId: actingInstitutionId, status: "ACTIVE" } },
    } });
    const latest = evidence?.versions[0];
    if (!evidence || evidence.transactionCaseId !== caseId || evidence.status !== "AVAILABLE" || !latest
      || latest.version !== evidence.currentVersion || latest.validationStatus !== "VALID" || latest.result !== "VERIFIED"
      || latest.signatureStatus !== "VERIFIED" || (latest.expiresAt && latest.expiresAt <= new Date())) {
      throw new BadRequestException("repair evidence must be current, signed, VERIFIED, valid, available and scoped to this case");
    }
    if (evidence.institutionId !== actingInstitutionId && !evidence.grants.some((grant) => !grant.expiresAt || grant.expiresAt > new Date())) {
      throw new NotFoundException("repair evidence not found");
    }
    if (latest.payloadDigest !== assertionDigest) throw new BadRequestException("assertionDigest must match the retained current evidence payload digest");
    if ((latest.providerReference?.institutionId ?? evidence.institutionId) !== providerInstitutionId) {
      throw new BadRequestException("repair evidence provider must match the retained provider reference or evidence owner");
    }
    const provider = await database.institution.findUnique({ where: { id: providerInstitutionId }, include: { admission: true } });
    if (!provider || provider.status !== "ACTIVE" || provider.admission?.status !== "ADMITTED") {
      throw new BadRequestException("repair evidence provider must be an admitted active institution");
    }
    return { evidence, latest };
  }

  private actorRef(actor: RoomActor): string { return `user:${actor.actorUserId}:institution:${actor.actingInstitutionId}`; }
}
