import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { audit } from "../common/audit";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import type { InstitutionAction } from "../institutions/institution-policy";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { appendGovernedAudit } from "../rooms/governed-audit";
import { PrismaService } from "../store/prisma.service";
import {
  COMMERCIAL_ALLOCATION_BASIS,
  COMMERCIAL_CHANGE_ACTIONS,
  COMMERCIAL_MESSAGE_KINDS,
  COMMERCIAL_PRICING_TYPES,
  assertCommercialWindow,
  commercialParticipationAmount,
  commercialStatusChange,
  commercialTermAmounts,
  exactPricingValue,
} from "./commercial-policy";

export interface CommercialActorContext {
  actorUserId: string;
  actorSessionId: string;
  actingInstitutionId: string;
}

const ACTIVE_CASE_STATUSES = ["DRAFT", "INTAKE_OPEN", "EVIDENCE_LOCKED", "REVIEW_PENDING", "APPROVED_FOR_EXECUTION"];
const RFQ_OUTCOMES = ["RESPOND", "DECLINE"] as const;

function enabled(): void {
  if (inspectPersistenceFlags(process.env).primaryCommercial !== "shadow") {
    throw new ForbiddenException("permissioned primary commercial venue is disabled");
  }
}

function productEnabled(): void {
  if (inspectPersistenceFlags(process.env).primaryVenueProduct !== "shadow") {
    throw new ForbiddenException("primary venue product is disabled");
  }
}

function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function optional(value: unknown, name: string, max = 500): string | null {
  return value === undefined || value === null || value === "" ? null : required(value, name, max);
}

function oneOf(value: unknown, name: string, values: readonly string[]): string {
  const result = required(value, name, 120);
  if (!values.includes(result)) throw new BadRequestException(`${name} must be one of: ${values.join(", ")}`);
  return result;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${name} must be a positive safe integer`);
  }
  return value;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new BadRequestException(`${name} must be a boolean`);
  return value;
}

function date(value: unknown, name: string): Date {
  const result = new Date(required(value, name, 100));
  if (!Number.isFinite(result.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return result;
}

function json(value: unknown): Prisma.InputJsonValue {
  try { return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue; }
  catch (error) { throw new BadRequestException((error as Error).message); }
}

function policy<T>(callback: () => T): T {
  try { return callback(); }
  catch (error) { throw new BadRequestException((error as Error).message); }
}

function unique(error: unknown): boolean { return (error as { code?: string } | null)?.code === "P2002"; }

const safeTermSelect = {
  id: true, version: true, currency: true, amountUnits: true, amountScale: true,
  minimumParticipationUnits: true, maximumParticipationUnits: true, pricingType: true,
  pricingValue: true, commercialTerms: true, termSheetEvidenceObjectId: true,
  validFrom: true, expiresAt: true, termDigest: true, createdAt: true,
} satisfies Prisma.CommercialTermVersionSelect;

const safeOpportunitySummarySelect = {
  id: true, transactionCaseId: true, ownerInstitutionId: true, opportunityReference: true,
  status: true, audienceMode: true, currentTermVersion: true, aggregateVersion: true,
  opensAt: true, closesAt: true, createdAt: true, updatedAt: true,
  transactionCase: { select: { caseReference: true, transactionRoute: true, representation: true, lifecycleLeg: true, assetClass: true, operatingMode: true, status: true } },
  terms: { orderBy: { version: "desc" as const }, select: safeTermSelect },
  audienceGrants: { select: { institutionId: true, status: true, effectiveAt: true, expiresAt: true } },
  caseHandoffs: { select: { counterpartyInstitutionId: true, termVersionId: true } },
} satisfies Prisma.CommercialOpportunitySelect;

const safeOpportunityDetailSelect = {
  id: true, transactionCaseId: true, ownerInstitutionId: true, opportunityReference: true,
  status: true, audienceMode: true, currentTermVersion: true, aggregateVersion: true,
  opensAt: true, closesAt: true, createdAt: true, updatedAt: true,
  transactionCase: { select: { id: true, caseReference: true, ownerInstitutionId: true, transactionRoute: true, representation: true, lifecycleLeg: true, assetClass: true, operatingMode: true, status: true, aggregateVersion: true, evidenceLockedAt: true } },
  terms: { orderBy: { version: "asc" as const }, select: safeTermSelect },
  audienceGrants: { orderBy: { createdAt: "asc" as const }, select: { id: true, institutionId: true, status: true, purpose: true, conflictDisclosure: true, effectiveAt: true, expiresAt: true, revokedAt: true, createdAt: true } },
  changes: { orderBy: { proposedAt: "asc" as const }, select: { id: true, action: true, expectedVersion: true, fromStatus: true, toStatus: true, reason: true, status: true, proposedByUserId: true, reviewedByUserId: true, reviewReason: true, proposedAt: true, reviewedAt: true, appliedAt: true } },
  interests: { orderBy: { createdAt: "asc" as const }, select: { id: true, institutionId: true, termVersionId: true, currency: true, amountUnits: true, amountScale: true, status: true, qualifications: true, submittedByUserId: true, withdrawnByUserId: true, withdrawalReason: true, withdrawnAt: true, expiresAt: true, createdAt: true } },
  rfqs: { orderBy: { createdAt: "asc" as const }, select: { id: true, requesterInstitutionId: true, termVersionId: true, currency: true, amountUnits: true, amountScale: true, requestedTerms: true, requestedTermsDigest: true, status: true, responseTerms: true, responseTermsDigest: true, responseReason: true, requestedByUserId: true, respondedByUserId: true, respondedAt: true, expiresAt: true, createdAt: true } },
  threads: { orderBy: { createdAt: "asc" as const }, select: { id: true, commercialRfqId: true, ownerInstitutionId: true, counterpartyInstitutionId: true, status: true, createdAt: true, messages: { orderBy: { occurredAt: "asc" as const }, select: { id: true, senderInstitutionId: true, messageKind: true, body: true, termSnapshot: true, termSnapshotDigest: true, previousMessageId: true, sentByUserId: true, occurredAt: true } } } },
  allocations: { orderBy: { createdAt: "asc" as const }, select: { id: true, allocationReference: true, offereeInstitutionId: true, termVersionId: true, basisType: true, basisId: true, currency: true, amountUnits: true, amountScale: true, status: true, proposedByUserId: true, reviewedByUserId: true, reviewReason: true, reviewedAt: true, respondedByUserId: true, responseReason: true, respondedAt: true, expiresAt: true, createdAt: true } },
  caseHandoffs: { orderBy: { createdAt: "asc" as const }, select: { id: true, commercialAllocationId: true, transactionCaseId: true, termVersionId: true, audienceGrantId: true, casePartyId: true, ownerInstitutionId: true, counterpartyInstitutionId: true, counterpartyPartyRole: true, status: true, termDigest: true, audienceGrantDigest: true, allocationDigest: true, eligibilityDecisionCode: true, eligibilityCheckedAt: true, handoffDigest: true, createdByUserId: true, createdAt: true, caseParty: { select: { status: true, acceptedByUserId: true, acceptedAt: true } } } },
} satisfies Prisma.CommercialOpportunitySelect;

@Injectable()
export class CommercialService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
  ) {}

  private async authority(context: CommercialActorContext, action: InstitutionAction, caseId?: string) {
    return this.access.requireHuman({
      userId: context.actorUserId,
      institutionId: context.actingInstitutionId,
      action,
      scopeType: caseId ? "TRANSACTION_CASE" : "INSTITUTION",
      scopeRef: caseId ?? null,
    });
  }

  private async load(opportunityId: string) {
    enabled();
    const opportunity = await this.db.commercialOpportunity.findUnique({
      where: { id: opportunityId },
      include: { transactionCase: true },
    });
    if (!opportunity) throw new NotFoundException("commercial opportunity not found");
    return opportunity;
  }

  private async requireOwner(context: CommercialActorContext, caseId: string, opportunityId: string, action: InstitutionAction = "MANAGE_OPPORTUNITY") {
    const opportunity = await this.load(opportunityId);
    if (opportunity.transactionCaseId !== caseId) throw new NotFoundException("commercial opportunity not found");
    if (opportunity.ownerInstitutionId !== context.actingInstitutionId) throw new ForbiddenException("only the opportunity owner may perform this action");
    const authority = await this.authority(context, action, caseId);
    return { opportunity, authority };
  }

  private async requireAudience(context: CommercialActorContext, caseId: string, opportunityId: string, action: InstitutionAction) {
    const opportunity = await this.load(opportunityId);
    if (opportunity.transactionCaseId !== caseId) throw new NotFoundException("commercial opportunity not found");
    if (opportunity.ownerInstitutionId === context.actingInstitutionId) throw new ForbiddenException("the opportunity owner cannot act as its own counterparty");
    const now = new Date();
    const grant = await this.db.commercialAudienceGrant.findUnique({
      where: { commercialOpportunityId_institutionId: { commercialOpportunityId: opportunityId, institutionId: context.actingInstitutionId } },
    });
    if (!grant || grant.status !== "ACTIVE" || grant.effectiveAt > now || grant.expiresAt <= now) {
      throw new NotFoundException("commercial opportunity not found");
    }
    if (opportunity.status !== "PUBLISHED" || (opportunity.opensAt && opportunity.opensAt > now)
      || (opportunity.closesAt && opportunity.closesAt <= now)) {
      throw new ConflictException("commercial opportunity is not open for participant response");
    }
    const authority = await this.authority(context, action, caseId);
    return { opportunity, grant, authority };
  }

  private async requireRouteFunction(
    institutionId: string,
    transactionCase: { id: string; transactionRoute: string; representation: string; assetClass: string; lifecycleLeg: string; operatingMode: string },
    materialFunction: string,
  ): Promise<void> {
    const assignment = await this.db.caseFunctionAssignment.findUnique({
      where: { transactionCaseId_materialFunction: { transactionCaseId: transactionCase.id, materialFunction } },
    });
    const now = new Date();
    if (!assignment || assignment.status !== "ACTIVE" || assignment.performer === "PROHIBITED"
      || (assignment.effectiveAt && assignment.effectiveAt > now) || (assignment.expiresAt && assignment.expiresAt <= now)) {
      throw new ForbiddenException(`case function ${materialFunction} is not actively assigned`);
    }
    const route = await this.access.evaluateRoute(institutionId, {
      transactionRoute: transactionCase.transactionRoute,
      representation: transactionCase.representation,
      assetClass: transactionCase.assetClass,
      lifecycleLeg: transactionCase.lifecycleLeg,
      materialFunction,
      operatingMode: transactionCase.operatingMode,
    });
    if (!route.allowed) throw new ForbiddenException(`${materialFunction} route denied: ${route.code}`);
  }

  private async term(opportunityId: string, termVersionId?: string) {
    const term = termVersionId
      ? await this.db.commercialTermVersion.findUnique({ where: { id: termVersionId } })
      : await this.db.commercialTermVersion.findFirst({ where: { commercialOpportunityId: opportunityId }, orderBy: { version: "desc" } });
    if (!term || term.commercialOpportunityId !== opportunityId) throw new BadRequestException("selected commercial term version does not belong to this opportunity");
    const now = new Date();
    if (term.validFrom > now || term.expiresAt <= now) throw new ConflictException("selected commercial term version is not currently valid");
    return term;
  }

  private async lockOpportunity(tx: Prisma.TransactionClient, opportunityId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`commercial-opportunity:${opportunityId}`}))`;
    return tx.commercialOpportunity.findUniqueOrThrow({ where: { id: opportunityId } });
  }

  private async assertPublicationReady(opportunity: Awaited<ReturnType<CommercialService["load"]>>): Promise<void> {
    await Promise.all([
      this.requireRouteFunction(opportunity.ownerInstitutionId, opportunity.transactionCase, "TERM_DISPLAY"),
      this.requireRouteFunction(opportunity.ownerInstitutionId, opportunity.transactionCase, "SOLICITATION"),
      this.requireRouteFunction(opportunity.ownerInstitutionId, opportunity.transactionCase, "QUOTE_INVITATION"),
    ]);
    const now = new Date();
    const [term, audienceCount] = await Promise.all([
      this.term(opportunity.id),
      this.db.commercialAudienceGrant.count({
        where: {
          commercialOpportunityId: opportunity.id,
          status: "ACTIVE",
          effectiveAt: { lte: now },
          expiresAt: { gt: now },
        },
      }),
    ]);
    if (term.version !== opportunity.currentTermVersion) {
      throw new ConflictException("current term pointer does not match the latest valid term");
    }
    if (audienceCount === 0) {
      throw new ConflictException("a named active audience is required before publication");
    }
  }

  async list(context: CommercialActorContext) {
    enabled();
    await this.authority(context, "VIEW_OPPORTUNITY");
    const now = new Date();
    const opportunities = await this.db.commercialOpportunity.findMany({
      where: {
        OR: [
          { ownerInstitutionId: context.actingInstitutionId },
          { caseHandoffs: { some: { counterpartyInstitutionId: context.actingInstitutionId } } },
          {
            status: "PUBLISHED",
            AND: [{ OR: [{ opensAt: null }, { opensAt: { lte: now } }] }, { OR: [{ closesAt: null }, { closesAt: { gt: now } }] }],
            audienceGrants: { some: { institutionId: context.actingInstitutionId, status: "ACTIVE", effectiveAt: { lte: now }, expiresAt: { gt: now } } },
          },
        ],
      },
      select: safeOpportunitySummarySelect,
      orderBy: { createdAt: "desc" },
    });
    return opportunities.map((opportunity) => {
      const { audienceGrants, caseHandoffs, terms, ...summary } = opportunity;
      const owner = opportunity.ownerInstitutionId === context.actingInstitutionId;
      const currentAudienceAccess = ["PUBLISHED", "PAUSED"].includes(opportunity.status)
        && audienceGrants.some((grant) => grant.institutionId === context.actingInstitutionId
          && grant.status === "ACTIVE" && grant.effectiveAt <= now && grant.expiresAt > now);
      if (owner || currentAudienceAccess) return { ...summary, terms: terms.slice(0, 1) };
      const retainedTermIds = new Set(caseHandoffs
        .filter((handoff) => handoff.counterpartyInstitutionId === context.actingInstitutionId)
        .map((handoff) => handoff.termVersionId));
      return { ...summary, terms: terms.filter((term) => retainedTermIds.has(term.id)) };
    });
  }

  async get(context: CommercialActorContext, caseId: string, opportunityId: string) {
    const opportunity = await this.load(opportunityId);
    if (opportunity.transactionCaseId !== caseId) throw new NotFoundException("commercial opportunity not found");
    const owner = opportunity.ownerInstitutionId === context.actingInstitutionId;
    if (owner) await this.authority(context, "VIEW_OPPORTUNITY", caseId);
    else {
      const now = new Date();
      const [grant, handoffs] = await Promise.all([
        this.db.commercialAudienceGrant.findUnique({ where: { commercialOpportunityId_institutionId: { commercialOpportunityId: opportunityId, institutionId: context.actingInstitutionId } } }),
        this.db.commercialCaseHandoff.findMany({ where: { commercialOpportunityId: opportunityId, counterpartyInstitutionId: context.actingInstitutionId }, select: { id: true, termVersionId: true, commercialAllocationId: true } }),
      ]);
      const currentAudienceAccess = Boolean(grant && grant.status === "ACTIVE" && grant.effectiveAt <= now
        && grant.expiresAt > now && ["PUBLISHED", "PAUSED"].includes(opportunity.status));
      if (!currentAudienceAccess && handoffs.length === 0) throw new NotFoundException("commercial opportunity not found");
      await this.authority(context, "VIEW_OPPORTUNITY", caseId);
      if (!currentAudienceAccess) {
        const retainedTermIds = new Set(handoffs.map((handoff) => handoff.termVersionId));
        const retainedAllocationIds = new Set(handoffs.map((handoff) => handoff.commercialAllocationId));
        const detail = await this.db.commercialOpportunity.findUniqueOrThrow({ where: { id: opportunityId }, select: safeOpportunityDetailSelect });
        return {
          ...detail,
          terms: detail.terms.filter((entry) => retainedTermIds.has(entry.id)),
          audienceGrants: detail.audienceGrants.filter((entry) => entry.institutionId === context.actingInstitutionId),
          changes: [],
          interests: [],
          rfqs: [],
          threads: [],
          allocations: detail.allocations.filter((entry) => retainedAllocationIds.has(entry.id)),
          caseHandoffs: detail.caseHandoffs.filter((entry) => entry.counterpartyInstitutionId === context.actingInstitutionId),
        };
      }
    }
    const detail = await this.db.commercialOpportunity.findUniqueOrThrow({ where: { id: opportunityId }, select: safeOpportunityDetailSelect });
    if (owner) return detail;
    return {
      ...detail,
      audienceGrants: detail.audienceGrants.filter((entry) => entry.institutionId === context.actingInstitutionId),
      changes: [],
      interests: detail.interests.filter((entry) => entry.institutionId === context.actingInstitutionId),
      rfqs: detail.rfqs.filter((entry) => entry.requesterInstitutionId === context.actingInstitutionId),
      threads: detail.threads.filter((entry) => entry.counterpartyInstitutionId === context.actingInstitutionId),
      allocations: detail.allocations.filter((entry) => entry.offereeInstitutionId === context.actingInstitutionId),
      caseHandoffs: detail.caseHandoffs.filter((entry) => entry.counterpartyInstitutionId === context.actingInstitutionId),
    };
  }

  async createOpportunity(context: CommercialActorContext, caseId: string, body: {
    idempotencyKey?: unknown; opportunityReference?: unknown; opensAt?: unknown; closesAt?: unknown; stepUpEvidenceId?: unknown;
  }) {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId } });
    if (!transactionCase || transactionCase.ownerInstitutionId !== context.actingInstitutionId) throw new NotFoundException("transaction case not found");
    if (!ACTIVE_CASE_STATUSES.includes(transactionCase.status)) throw new ConflictException("terminal or execution-stage case cannot create a primary opportunity");
    if (transactionCase.lifecycleLeg !== "INITIAL_TRANSFER_OR_ISSUE") throw new BadRequestException("PR-13 supports primary opportunities only");
    const authority = await this.authority(context, "MANAGE_OPPORTUNITY", caseId);
    await this.requireRouteFunction(context.actingInstitutionId, transactionCase, "TERM_DISPLAY");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const opportunityReference = required(body.opportunityReference, "opportunityReference", 160);
    const opensAt = date(body.opensAt, "opensAt");
    const closesAt = date(body.closesAt, "closesAt");
    policy(() => assertCommercialWindow(opensAt, closesAt));
    const requestDigest = sha256Digest({ caseId, opportunityReference, opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString(), audienceMode: "NAMED_INSTITUTIONS" });
    const existing = await this.db.commercialOpportunity.findUnique({ where: { ownerInstitutionId_creationIdempotencyKey: { ownerInstitutionId: context.actingInstitutionId, creationIdempotencyKey: idempotencyKey } } });
    if (existing) {
      if (existing.creationRequestDigest !== requestDigest) throw new ConflictException("opportunity idempotency key was reused with different content");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const created = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_OPPORTUNITY_CREATE", institutionId: context.actingInstitutionId }, tx);
        return tx.commercialOpportunity.create({ data: {
          id: `cop_${randomUUID()}`, transactionCaseId: caseId, ownerInstitutionId: context.actingInstitutionId,
          opportunityReference, opensAt, closesAt, creationIdempotencyKey: idempotencyKey,
          creationRequestDigest: requestDigest, createdByUserId: context.actorUserId, createdByMandateId: authority.mandateId!,
        } });
      });
      audit("rail.commercial.opportunity_created", { caseId, opportunityId: created.id, actorUserId: context.actorUserId, actingInstitutionId: context.actingInstitutionId });
      return created;
    } catch (error) { if (unique(error)) throw new ConflictException("opportunity reference or idempotency key already exists"); throw error; }
  }

  async createTerm(context: CommercialActorContext, caseId: string, opportunityId: string, body: {
    currency?: unknown; amountUnits?: unknown; amountScale?: unknown; minimumParticipationUnits?: unknown;
    maximumParticipationUnits?: unknown; pricingType?: unknown; pricingValue?: unknown; pricingExtensionProfileRef?: unknown;
    commercialTerms?: unknown; termSheetEvidenceObjectId?: unknown; validFrom?: unknown; expiresAt?: unknown;
    reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId);
    if (!["DRAFT", "PAUSED"].includes(opportunity.status)) throw new ConflictException("terms can change only while an opportunity is draft or paused");
    await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "TERM_DISPLAY");
    const amounts = policy(() => commercialTermAmounts({
      currency: body.currency,
      amountUnits: body.amountUnits,
      amountScale: body.amountScale,
      minimumParticipationUnits: body.minimumParticipationUnits,
      maximumParticipationUnits: body.maximumParticipationUnits,
    }));
    const pricingType = oneOf(body.pricingType, "pricingType", COMMERCIAL_PRICING_TYPES);
    const pricingValue = policy(() => exactPricingValue(body.pricingValue));
    const pricingExtensionProfileRef = pricingType === "OTHER_APPROVED"
      ? required(body.pricingExtensionProfileRef, "pricingExtensionProfileRef", 300)
      : optional(body.pricingExtensionProfileRef, "pricingExtensionProfileRef", 300);
    const commercialTerms = json({ terms: body.commercialTerms ?? {}, pricingExtensionProfileRef });
    const validFrom = date(body.validFrom, "validFrom");
    const expiresAt = date(body.expiresAt, "expiresAt");
    policy(() => assertCommercialWindow(validFrom, expiresAt));
    if ((opportunity.opensAt && validFrom < opportunity.opensAt) || (opportunity.closesAt && expiresAt > opportunity.closesAt)) {
      throw new BadRequestException("term validity must remain within the opportunity window");
    }
    const termSheetEvidenceObjectId = optional(body.termSheetEvidenceObjectId, "termSheetEvidenceObjectId", 160);
    if (termSheetEvidenceObjectId) {
      const evidence = await this.db.evidenceObject.findUnique({ where: { id: termSheetEvidenceObjectId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
      const latest = evidence?.versions[0];
      if (!evidence || evidence.transactionCaseId !== caseId || evidence.status !== "AVAILABLE" || !latest
        || latest.validationStatus !== "VALID" || (latest.expiresAt && latest.expiresAt <= new Date())) {
        throw new BadRequestException("term-sheet evidence must be current, valid, available and case-scoped");
      }
    }
    const reason = required(body.reason, "reason", 1000);
    const termDigest = sha256Digest({ opportunityId, currency: amounts.amount.currency, amountUnits: amounts.amount.units,
      amountScale: amounts.amount.scale, minimumParticipationUnits: amounts.minimum.units,
      maximumParticipationUnits: amounts.maximum?.units ?? null, pricingType, pricingValue,
      commercialTerms, termSheetEvidenceObjectId, validFrom: validFrom.toISOString(), expiresAt: expiresAt.toISOString(), reason });
    const existing = await this.db.commercialTermVersion.findUnique({ where: { commercialOpportunityId_termDigest: { commercialOpportunityId: opportunityId, termDigest } } });
    if (existing) return existing;
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      if (!["DRAFT", "PAUSED"].includes(current.status)) throw new ConflictException("opportunity state changed before term creation");
      const version = (current.currentTermVersion ?? 0) + 1;
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_TERM_CREATE", institutionId: context.actingInstitutionId }, tx);
      const term = await tx.commercialTermVersion.create({ data: {
        id: `cterm_${randomUUID()}`, commercialOpportunityId: opportunityId, version,
        currency: amounts.amount.currency, amountUnits: amounts.amount.units, amountScale: amounts.amount.scale,
        minimumParticipationUnits: amounts.minimum.units, maximumParticipationUnits: amounts.maximum?.units ?? null,
        pricingType, pricingValue, commercialTerms, termSheetEvidenceObjectId, validFrom, expiresAt, termDigest, reason,
        createdByUserId: context.actorUserId, createdByMandateId: authority.mandateId!, stepUpEvidenceId,
      } });
      await tx.commercialOpportunity.update({ where: { id: opportunityId }, data: { currentTermVersion: version, aggregateVersion: { increment: 1 } } });
      return term;
    });
  }

  async inviteAudience(context: CommercialActorContext, caseId: string, opportunityId: string, body: {
    institutionId?: unknown; purpose?: unknown; conflictDisclosure?: unknown; effectiveAt?: unknown; expiresAt?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId);
    if (["WITHDRAWN", "CLOSED"].includes(opportunity.status)) throw new ConflictException("terminal opportunity cannot invite an audience");
    await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "QUOTE_INVITATION");
    const institutionId = required(body.institutionId, "institutionId", 160);
    if (institutionId === context.actingInstitutionId) throw new BadRequestException("opportunity owner cannot invite itself");
    await this.requireRouteFunction(institutionId, opportunity.transactionCase, "TERM_DISPLAY");
    const purpose = oneOf(body.purpose, "purpose", ["TERM_DISPLAY_AND_RFQ"]);
    const conflictDisclosure = json(body.conflictDisclosure);
    const effectiveAt = date(body.effectiveAt, "effectiveAt");
    const expiresAt = date(body.expiresAt, "expiresAt");
    policy(() => assertCommercialWindow(effectiveAt, expiresAt));
    if ((opportunity.opensAt && effectiveAt < opportunity.opensAt) || (opportunity.closesAt && expiresAt > opportunity.closesAt)) {
      throw new BadRequestException("audience grant validity must remain within the opportunity window");
    }
    const invitationDigest = sha256Digest({ opportunityId, institutionId, purpose, conflictDisclosure, effectiveAt: effectiveAt.toISOString(), expiresAt: expiresAt.toISOString() });
    const existing = await this.db.commercialAudienceGrant.findUnique({ where: { commercialOpportunityId_institutionId: { commercialOpportunityId: opportunityId, institutionId } } });
    if (existing) {
      if (existing.invitationDigest !== invitationDigest) throw new ConflictException("institution already has a different audience grant");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      if (["WITHDRAWN", "CLOSED"].includes(current.status)) {
        throw new ConflictException("terminal opportunity cannot invite an audience");
      }
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_AUDIENCE_INVITE", institutionId: context.actingInstitutionId }, tx);
      return tx.commercialAudienceGrant.create({ data: {
        id: `cagr_${randomUUID()}`, commercialOpportunityId: opportunityId, institutionId, purpose,
        conflictDisclosure, effectiveAt, expiresAt, invitationDigest, invitedByUserId: context.actorUserId,
        invitedByMandateId: authority.mandateId!, stepUpEvidenceId,
      } });
    });
  }

  async revokeAudience(context: CommercialActorContext, caseId: string, opportunityId: string, institutionId: string, body: {
    reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { authority } = await this.requireOwner(context, caseId, opportunityId);
    const grant = await this.db.commercialAudienceGrant.findUnique({
      where: { commercialOpportunityId_institutionId: { commercialOpportunityId: opportunityId, institutionId } },
    });
    if (!grant) throw new NotFoundException("commercial audience grant not found");
    if (grant.status !== "ACTIVE") throw new ConflictException("commercial audience grant is already inactive");
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.lockOpportunity(tx, opportunityId);
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: context.actorUserId,
        sessionId: context.actorSessionId,
        purpose: "COMMERCIAL_AUDIENCE_REVOKE",
        institutionId: context.actingInstitutionId,
      }, tx);
      const changed = await tx.commercialAudienceGrant.updateMany({
        where: { id: grant.id, status: "ACTIVE" },
        data: {
          status: "REVOKED",
          revokedByUserId: context.actorUserId,
          revocationReason: reason,
          revokedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new ConflictException("commercial audience grant changed concurrently");
      audit("rail.commercial.audience_revoked", {
        opportunityId,
        institutionId,
        reason,
        actorUserId: context.actorUserId,
        authorityMandateId: authority.mandateId,
      });
      return tx.commercialAudienceGrant.findUniqueOrThrow({ where: { id: grant.id } });
    });
  }

  async proposeChange(context: CommercialActorContext, caseId: string, opportunityId: string, body: {
    action?: unknown; expectedVersion?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId);
    const action = oneOf(body.action, "action", COMMERCIAL_CHANGE_ACTIONS);
    const expectedVersion = positiveInteger(body.expectedVersion, "expectedVersion");
    if (opportunity.aggregateVersion !== expectedVersion) throw new ConflictException("stale opportunity aggregate version");
    const transition = policy(() => commercialStatusChange(opportunity.status, action));
    if (["PUBLISH", "RESUME"].includes(action)) {
      await this.assertPublicationReady(opportunity);
    }
    const reason = required(body.reason, "reason", 1000);
    const proposalDigest = sha256Digest({ opportunityId, action, expectedVersion, ...transition, reason });
    const existing = await this.db.commercialOpportunityChange.findUnique({ where: { commercialOpportunityId_proposalDigest: { commercialOpportunityId: opportunityId, proposalDigest } } });
    if (existing) return existing;
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_CHANGE_PROPOSE", institutionId: context.actingInstitutionId }, tx);
      return tx.commercialOpportunityChange.create({ data: {
        id: `cochg_${randomUUID()}`, commercialOpportunityId: opportunityId, action, expectedVersion,
        fromStatus: transition.fromStatus, toStatus: transition.toStatus, reason, proposalDigest,
        proposedByUserId: context.actorUserId, proposedByMandateId: authority.mandateId!, proposalStepUpId: stepUpEvidenceId,
      } });
    });
  }

  async reviewChange(context: CommercialActorContext, caseId: string, opportunityId: string, changeId: string, body: {
    approve?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId);
    const change = await this.db.commercialOpportunityChange.findUnique({ where: { id: changeId } });
    if (!change || change.commercialOpportunityId !== opportunityId) throw new NotFoundException("opportunity change not found");
    if (change.status !== "PENDING") throw new ConflictException("opportunity change is already terminal");
    if (change.proposedByUserId === context.actorUserId) throw new ForbiddenException("change proposer cannot review their own proposal");
    if (opportunity.aggregateVersion !== change.expectedVersion || opportunity.status !== change.fromStatus) {
      throw new ConflictException("opportunity changed after this proposal");
    }
    const approve = boolean(body.approve, "approve");
    if (approve && ["PUBLISH", "RESUME"].includes(change.action)) {
      await this.assertPublicationReady(opportunity);
    }
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      if (approve && ["PUBLISH", "RESUME"].includes(change.action)) {
        const [currentTerm, activeAudience] = await Promise.all([
          tx.commercialTermVersion.findFirst({
            where: { commercialOpportunityId: opportunityId, validFrom: { lte: now }, expiresAt: { gt: now } },
            orderBy: { version: "desc" },
          }),
          tx.commercialAudienceGrant.count({
            where: {
              commercialOpportunityId: opportunityId,
              status: "ACTIVE",
              effectiveAt: { lte: now },
              expiresAt: { gt: now },
            },
          }),
        ]);
        if (!currentTerm || currentTerm.version !== current.currentTermVersion || activeAudience === 0) {
          throw new ConflictException("publication term or named audience changed before review");
        }
      }
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_CHANGE_REVIEW", institutionId: context.actingInstitutionId }, tx);
      const claimed = await tx.commercialOpportunityChange.updateMany({ where: { id: changeId, status: "PENDING", reviewedByUserId: null }, data: {
        status: approve ? "APPROVED" : "REJECTED", reviewedByUserId: context.actorUserId,
        reviewedByMandateId: authority.mandateId, reviewStepUpId: stepUpEvidenceId,
        reviewReason: reason, reviewedAt: now, appliedAt: approve ? now : null,
      } });
      if (claimed.count !== 1) throw new ConflictException("opportunity change was concurrently reviewed");
      if (approve) {
        const changed = await tx.commercialOpportunity.updateMany({ where: { id: opportunityId, aggregateVersion: change.expectedVersion, status: change.fromStatus }, data: {
          status: change.toStatus, aggregateVersion: { increment: 1 },
        } });
        if (changed.count !== 1) throw new ConflictException("opportunity state changed concurrently");
      }
      return tx.commercialOpportunityChange.findUniqueOrThrow({ where: { id: changeId } });
    });
  }

  async submitInterest(context: CommercialActorContext, caseId: string, opportunityId: string, body: {
    termVersionId?: unknown; currency?: unknown; amountUnits?: unknown; amountScale?: unknown; qualifications?: unknown;
    idempotencyKey?: unknown; expiresAt?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireAudience(context, caseId, opportunityId, "RESPOND_OPPORTUNITY");
    await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "SOLICITATION");
    const term = await this.term(opportunityId, required(body.termVersionId, "termVersionId", 160));
    if (term.version !== opportunity.currentTermVersion) throw new ConflictException("interest must reference the current term version");
    const amount = policy(() => commercialParticipationAmount({
      currency: body.currency,
      amountUnits: body.amountUnits,
      amountScale: body.amountScale,
    }, term));
    const qualifications = json(body.qualifications);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const expiresAt = date(body.expiresAt, "expiresAt");
    if (expiresAt <= new Date() || expiresAt > term.expiresAt) throw new BadRequestException("interest expiry must be future and within the selected term validity");
    const requestDigest = sha256Digest({ opportunityId, institutionId: context.actingInstitutionId, termVersionId: term.id,
      currency: amount.currency, amountUnits: amount.units, amountScale: amount.scale, qualifications, expiresAt: expiresAt.toISOString() });
    const existing = await this.db.commercialInterestIndication.findUnique({ where: { commercialOpportunityId_institutionId_idempotencyKey: { commercialOpportunityId: opportunityId, institutionId: context.actingInstitutionId, idempotencyKey } } });
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new ConflictException("interest idempotency key was reused with different content");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      const now = new Date();
      const grant = await tx.commercialAudienceGrant.findUnique({
        where: {
          commercialOpportunityId_institutionId: {
            commercialOpportunityId: opportunityId,
            institutionId: context.actingInstitutionId,
          },
        },
      });
      if (current.status !== "PUBLISHED" || current.currentTermVersion !== term.version || term.expiresAt <= now
        || (current.opensAt && current.opensAt > now) || (current.closesAt && current.closesAt <= now)
        || !grant || grant.status !== "ACTIVE" || grant.effectiveAt > now || grant.expiresAt <= now) {
        throw new ConflictException("opportunity, current term or audience authority changed before interest submission");
      }
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_INTEREST_SUBMIT", institutionId: context.actingInstitutionId }, tx);
      return tx.commercialInterestIndication.create({ data: {
        id: `ci_${randomUUID()}`, commercialOpportunityId: opportunityId, institutionId: context.actingInstitutionId,
        termVersionId: term.id, currency: amount.currency, amountUnits: amount.units, amountScale: amount.scale,
        qualifications, idempotencyKey, requestDigest, submittedByUserId: context.actorUserId,
        submittedByMandateId: authority.mandateId!, submissionStepUpId: stepUpEvidenceId, expiresAt,
      } });
    });
  }

  async withdrawInterest(context: CommercialActorContext, caseId: string, opportunityId: string, interestId: string, body: { reason?: unknown; stepUpEvidenceId?: unknown }) {
    const opportunity = await this.load(opportunityId);
    if (opportunity.transactionCaseId !== caseId) throw new NotFoundException("commercial opportunity not found");
    const authority = await this.authority(context, "RESPOND_OPPORTUNITY", caseId);
    const interest = await this.db.commercialInterestIndication.findUnique({ where: { id: interestId } });
    if (!interest || interest.commercialOpportunityId !== opportunityId || interest.institutionId !== context.actingInstitutionId) throw new NotFoundException("interest indication not found");
    if (interest.status !== "SUBMITTED") throw new ConflictException("interest indication is not withdrawable");
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_INTEREST_WITHDRAW", institutionId: context.actingInstitutionId }, tx);
      const changed = await tx.commercialInterestIndication.updateMany({ where: { id: interestId, status: "SUBMITTED" }, data: {
        status: "WITHDRAWN", withdrawnByUserId: context.actorUserId, withdrawalStepUpId: stepUpEvidenceId,
        withdrawalReason: reason, withdrawnAt: new Date(),
      } });
      if (changed.count !== 1) throw new ConflictException("interest indication changed concurrently");
      audit("rail.commercial.interest_withdrawn", { opportunityId, interestId, actorUserId: context.actorUserId, authorityMandateId: authority.mandateId });
      return tx.commercialInterestIndication.findUniqueOrThrow({ where: { id: interestId } });
    });
  }

  async submitRfq(context: CommercialActorContext, caseId: string, opportunityId: string, body: {
    termVersionId?: unknown; currency?: unknown; amountUnits?: unknown; amountScale?: unknown;
    requestedTerms?: unknown; idempotencyKey?: unknown; expiresAt?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireAudience(context, caseId, opportunityId, "NEGOTIATE_TERMS");
    await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "QUOTE_INVITATION");
    const term = await this.term(opportunityId, required(body.termVersionId, "termVersionId", 160));
    if (term.version !== opportunity.currentTermVersion) throw new ConflictException("RFQ must reference the current term version");
    const amount = policy(() => commercialParticipationAmount({
      currency: body.currency,
      amountUnits: body.amountUnits,
      amountScale: body.amountScale,
    }, term));
    const requestedTerms = json(body.requestedTerms);
    const requestedTermsDigest = sha256Digest(requestedTerms);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const expiresAt = date(body.expiresAt, "expiresAt");
    if (expiresAt <= new Date() || expiresAt > term.expiresAt) throw new BadRequestException("RFQ expiry must be future and within selected term validity");
    const requestDigest = sha256Digest({ opportunityId, requesterInstitutionId: context.actingInstitutionId, termVersionId: term.id,
      currency: amount.currency, amountUnits: amount.units, amountScale: amount.scale, requestedTermsDigest, expiresAt: expiresAt.toISOString() });
    const existing = await this.db.commercialRfq.findUnique({ where: { commercialOpportunityId_requesterInstitutionId_idempotencyKey: { commercialOpportunityId: opportunityId, requesterInstitutionId: context.actingInstitutionId, idempotencyKey } }, include: { threads: true } });
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new ConflictException("RFQ idempotency key was reused with different content");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      const now = new Date();
      const grant = await tx.commercialAudienceGrant.findUnique({
        where: {
          commercialOpportunityId_institutionId: {
            commercialOpportunityId: opportunityId,
            institutionId: context.actingInstitutionId,
          },
        },
      });
      if (current.status !== "PUBLISHED" || current.currentTermVersion !== term.version || term.expiresAt <= now
        || (current.opensAt && current.opensAt > now) || (current.closesAt && current.closesAt <= now)
        || !grant || grant.status !== "ACTIVE" || grant.effectiveAt > now || grant.expiresAt <= now) {
        throw new ConflictException("opportunity, current term or audience authority changed before RFQ submission");
      }
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_RFQ_SUBMIT", institutionId: context.actingInstitutionId }, tx);
      const rfq = await tx.commercialRfq.create({ data: {
        id: `crfq_${randomUUID()}`, commercialOpportunityId: opportunityId, requesterInstitutionId: context.actingInstitutionId,
        termVersionId: term.id, currency: amount.currency, amountUnits: amount.units, amountScale: amount.scale,
        requestedTerms, requestedTermsDigest, idempotencyKey, requestDigest, requestedByUserId: context.actorUserId,
        requestedByMandateId: authority.mandateId!, requestStepUpId: stepUpEvidenceId, expiresAt,
      } });
      const thread = await tx.commercialNegotiationThread.create({ data: {
        id: `cth_${randomUUID()}`, commercialOpportunityId: opportunityId, commercialRfqId: rfq.id,
        ownerInstitutionId: opportunity.ownerInstitutionId, counterpartyInstitutionId: context.actingInstitutionId,
      } });
      return { ...rfq, threads: [thread] };
    });
  }

  async respondRfq(context: CommercialActorContext, caseId: string, opportunityId: string, rfqId: string, body: {
    outcome?: unknown; responseTerms?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId);
    const rfq = await this.db.commercialRfq.findUnique({ where: { id: rfqId } });
    if (!rfq || rfq.commercialOpportunityId !== opportunityId) throw new NotFoundException("RFQ not found");
    if (rfq.status !== "OPEN" || rfq.expiresAt <= new Date()) throw new ConflictException("RFQ is not open");
    const outcome = oneOf(body.outcome, "outcome", RFQ_OUTCOMES);
    if (outcome === "RESPOND") {
      if (opportunity.status !== "PUBLISHED") throw new ConflictException("RFQ response is paused or closed");
      await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "NEGOTIATION");
    }
    const responseTerms = outcome === "RESPOND" ? json(body.responseTerms) : Prisma.JsonNull;
    const responseTermsDigest = outcome === "RESPOND" ? sha256Digest(responseTerms as Prisma.InputJsonValue) : null;
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      if (outcome === "RESPOND" && current.status !== "PUBLISHED") {
        throw new ConflictException("RFQ response is paused or closed");
      }
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_RFQ_RESPOND", institutionId: context.actingInstitutionId }, tx);
      const changed = await tx.commercialRfq.updateMany({ where: { id: rfqId, status: "OPEN" }, data: {
        status: outcome === "RESPOND" ? "RESPONDED" : "DECLINED", responseTerms,
        responseTermsDigest, responseReason: reason, respondedByUserId: context.actorUserId,
        respondedByMandateId: authority.mandateId, responseStepUpId: stepUpEvidenceId, respondedAt: new Date(),
      } });
      if (changed.count !== 1) throw new ConflictException("RFQ changed concurrently");
      return tx.commercialRfq.findUniqueOrThrow({ where: { id: rfqId }, include: { threads: true } });
    });
  }

  async postMessage(context: CommercialActorContext, caseId: string, opportunityId: string, threadId: string, body: {
    messageKind?: unknown; message?: unknown; termSnapshot?: unknown; previousMessageId?: unknown;
    idempotencyKey?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const opportunity = await this.load(opportunityId);
    if (opportunity.transactionCaseId !== caseId) throw new NotFoundException("commercial opportunity not found");
    if (opportunity.status !== "PUBLISHED") throw new ConflictException("negotiation is paused or closed");
    const thread = await this.db.commercialNegotiationThread.findUnique({ where: { id: threadId } });
    if (!thread || thread.commercialOpportunityId !== opportunityId
      || ![thread.ownerInstitutionId, thread.counterpartyInstitutionId].includes(context.actingInstitutionId)) {
      throw new NotFoundException("negotiation thread not found");
    }
    if (thread.status !== "OPEN") throw new ConflictException("negotiation thread is closed");
    if (context.actingInstitutionId === thread.counterpartyInstitutionId) {
      await this.requireAudience(context, caseId, opportunityId, "NEGOTIATE_TERMS");
    } else await this.authority(context, "NEGOTIATE_TERMS", caseId);
    await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "NEGOTIATION");
    const authority = await this.authority(context, "NEGOTIATE_TERMS", caseId);
    const messageKind = oneOf(body.messageKind, "messageKind", COMMERCIAL_MESSAGE_KINDS);
    const message = required(body.message, "message", 8_000);
    const termSnapshot = body.termSnapshot === undefined || body.termSnapshot === null ? null : json(body.termSnapshot);
    if (["PROPOSAL", "COUNTER"].includes(messageKind) && !termSnapshot) throw new BadRequestException(`${messageKind} requires a canonical term snapshot`);
    const termSnapshotDigest = termSnapshot ? sha256Digest(termSnapshot) : null;
    const previousMessageId = optional(body.previousMessageId, "previousMessageId", 160);
    if (previousMessageId) {
      const previous = await this.db.commercialNegotiationMessage.findUnique({ where: { id: previousMessageId } });
      if (!previous || previous.negotiationThreadId !== threadId) throw new BadRequestException("previousMessageId must belong to this thread");
    }
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const requestDigest = sha256Digest({ threadId, senderInstitutionId: context.actingInstitutionId, messageKind, message, termSnapshotDigest, previousMessageId });
    const existing = await this.db.commercialNegotiationMessage.findUnique({ where: { negotiationThreadId_idempotencyKey: { negotiationThreadId: threadId, idempotencyKey } } });
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new ConflictException("message idempotency key was reused with different content");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      if (current.status !== "PUBLISHED") throw new ConflictException("negotiation is paused or closed");
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_MESSAGE_POST", institutionId: context.actingInstitutionId }, tx);
      return tx.commercialNegotiationMessage.create({ data: {
        id: `cmsg_${randomUUID()}`, negotiationThreadId: threadId, senderInstitutionId: context.actingInstitutionId,
        messageKind, body: message, termSnapshot: termSnapshot ?? Prisma.JsonNull, termSnapshotDigest,
        previousMessageId, idempotencyKey, requestDigest, sentByUserId: context.actorUserId,
        sentByMandateId: authority.mandateId!, stepUpEvidenceId,
      } });
    });
  }

  private async assertAllocationBasis(opportunityId: string, offereeInstitutionId: string, basisType: string, basisId: string): Promise<void> {
    if (basisType === "INTEREST") {
      const interest = await this.db.commercialInterestIndication.findUnique({ where: { id: basisId } });
      if (!interest || interest.commercialOpportunityId !== opportunityId || interest.institutionId !== offereeInstitutionId || interest.status !== "SUBMITTED") {
        throw new BadRequestException("allocation interest basis is not an active indication from the offeree");
      }
      return;
    }
    if (basisType === "RFQ") {
      const rfq = await this.db.commercialRfq.findUnique({ where: { id: basisId } });
      if (!rfq || rfq.commercialOpportunityId !== opportunityId || rfq.requesterInstitutionId !== offereeInstitutionId || !["OPEN", "RESPONDED"].includes(rfq.status)) {
        throw new BadRequestException("allocation RFQ basis is not attributable to the offeree");
      }
      return;
    }
    const thread = await this.db.commercialNegotiationThread.findUnique({ where: { id: basisId } });
    if (!thread || thread.commercialOpportunityId !== opportunityId || thread.counterpartyInstitutionId !== offereeInstitutionId) {
      throw new BadRequestException("allocation negotiation basis is not attributable to the offeree");
    }
  }

  async proposeAllocation(context: CommercialActorContext, caseId: string, opportunityId: string, body: {
    allocationReference?: unknown; offereeInstitutionId?: unknown; termVersionId?: unknown; basisType?: unknown; basisId?: unknown;
    currency?: unknown; amountUnits?: unknown; amountScale?: unknown; idempotencyKey?: unknown; expiresAt?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId, "MANAGE_ALLOCATION");
    if (opportunity.status !== "PUBLISHED") throw new ConflictException("allocations can be proposed only while the opportunity is published");
    await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "ALLOCATION");
    const offereeInstitutionId = required(body.offereeInstitutionId, "offereeInstitutionId", 160);
    const grant = await this.db.commercialAudienceGrant.findUnique({ where: { commercialOpportunityId_institutionId: { commercialOpportunityId: opportunityId, institutionId: offereeInstitutionId } } });
    if (!grant || grant.status !== "ACTIVE" || grant.expiresAt <= new Date()) throw new BadRequestException("allocation offeree must have an active audience grant");
    const term = await this.term(opportunityId, required(body.termVersionId, "termVersionId", 160));
    if (term.version !== opportunity.currentTermVersion) throw new ConflictException("allocation must use the current term version");
    const basisType = oneOf(body.basisType, "basisType", COMMERCIAL_ALLOCATION_BASIS);
    const basisId = required(body.basisId, "basisId", 160);
    await this.assertAllocationBasis(opportunityId, offereeInstitutionId, basisType, basisId);
    const amount = policy(() => commercialParticipationAmount({
      currency: body.currency,
      amountUnits: body.amountUnits,
      amountScale: body.amountScale,
    }, term));
    const allocationReference = required(body.allocationReference, "allocationReference", 160);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const expiresAt = date(body.expiresAt, "expiresAt");
    if (expiresAt <= new Date() || expiresAt > term.expiresAt || expiresAt > grant.expiresAt) throw new BadRequestException("allocation expiry must fit current term and audience validity");
    const proposalDigest = sha256Digest({ opportunityId, allocationReference, offereeInstitutionId, termVersionId: term.id,
      basisType, basisId, currency: amount.currency, amountUnits: amount.units, amountScale: amount.scale, expiresAt: expiresAt.toISOString() });
    const existing = await this.db.commercialAllocation.findUnique({ where: { commercialOpportunityId_idempotencyKey: { commercialOpportunityId: opportunityId, idempotencyKey } } });
    if (existing) {
      if (existing.proposalDigest !== proposalDigest) throw new ConflictException("allocation idempotency key was reused with different content");
      return existing;
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      return await this.db.$transaction(async (tx) => {
        const current = await this.lockOpportunity(tx, opportunityId);
        const currentGrant = await tx.commercialAudienceGrant.findUnique({
          where: {
            commercialOpportunityId_institutionId: {
              commercialOpportunityId: opportunityId,
              institutionId: offereeInstitutionId,
            },
          },
        });
        if (current.status !== "PUBLISHED" || current.currentTermVersion !== term.version
          || !currentGrant || currentGrant.status !== "ACTIVE"
          || currentGrant.effectiveAt > new Date() || currentGrant.expiresAt <= new Date()) {
          throw new ConflictException("opportunity, current term or audience authority changed before allocation proposal");
        }
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_ALLOCATION_PROPOSE", institutionId: context.actingInstitutionId }, tx);
        return tx.commercialAllocation.create({ data: {
          id: `calloc_${randomUUID()}`, commercialOpportunityId: opportunityId, allocationReference,
          offereeInstitutionId, termVersionId: term.id, basisType, basisId, currency: amount.currency,
          amountUnits: amount.units, amountScale: amount.scale, idempotencyKey, proposalDigest,
          proposedByUserId: context.actorUserId, proposedByMandateId: authority.mandateId!,
          proposalStepUpId: stepUpEvidenceId, expiresAt,
        } });
      });
    } catch (error) { if (unique(error)) throw new ConflictException("allocation reference or idempotency key already exists"); throw error; }
  }

  async reviewAllocation(context: CommercialActorContext, caseId: string, opportunityId: string, allocationId: string, body: {
    approve?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId, "MANAGE_ALLOCATION");
    const allocation = await this.db.commercialAllocation.findUnique({ where: { id: allocationId }, include: { termVersion: true } });
    if (!allocation || allocation.commercialOpportunityId !== opportunityId) throw new NotFoundException("allocation not found");
    if (allocation.status !== "PROPOSED") throw new ConflictException("allocation is already terminal or offered");
    if (allocation.proposedByUserId === context.actorUserId) throw new ForbiddenException("allocation proposer cannot review their own proposal");
    const approve = boolean(body.approve, "approve");
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();
    if (approve && (opportunity.status !== "PUBLISHED" || allocation.expiresAt <= now)) throw new ConflictException("allocation can no longer be offered");
    if (approve) {
      await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "ALLOCATION");
      const currentTerm = await this.term(opportunityId, allocation.termVersionId);
      if (currentTerm.version !== opportunity.currentTermVersion) {
        throw new ConflictException("allocation no longer references the current term version");
      }
      const grant = await this.db.commercialAudienceGrant.findUnique({
        where: {
          commercialOpportunityId_institutionId: {
            commercialOpportunityId: opportunityId,
            institutionId: allocation.offereeInstitutionId,
          },
        },
      });
      if (!grant || grant.status !== "ACTIVE" || grant.effectiveAt > now || grant.expiresAt <= now) {
        throw new ConflictException("allocation audience authority is no longer active");
      }
    }
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`commercial-allocation:${opportunityId}`}))`;
      if (approve) {
        const currentGrant = await tx.commercialAudienceGrant.findUnique({
          where: {
            commercialOpportunityId_institutionId: {
              commercialOpportunityId: opportunityId,
              institutionId: allocation.offereeInstitutionId,
            },
          },
        });
        if (current.status !== "PUBLISHED" || current.currentTermVersion !== allocation.termVersion.version
          || allocation.expiresAt <= new Date() || !currentGrant || currentGrant.status !== "ACTIVE"
          || currentGrant.effectiveAt > new Date() || currentGrant.expiresAt <= new Date()) {
          throw new ConflictException("opportunity, current term, allocation or audience authority changed before review");
        }
        const committed = await tx.commercialAllocation.findMany({ where: {
          commercialOpportunityId: opportunityId, termVersionId: allocation.termVersionId,
          status: { in: ["OFFERED", "ACCEPTED"] }, id: { not: allocationId },
        }, select: { amountUnits: true } });
        const reserved = committed.reduce((sum, row) => sum + BigInt(row.amountUnits), 0n) + BigInt(allocation.amountUnits);
        if (reserved > BigInt(allocation.termVersion.amountUnits)) throw new ConflictException("allocation would exceed the selected term amount");
      }
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_ALLOCATION_REVIEW", institutionId: context.actingInstitutionId }, tx);
      const changed = await tx.commercialAllocation.updateMany({ where: { id: allocationId, status: "PROPOSED", reviewedByUserId: null }, data: {
        status: approve ? "OFFERED" : "REJECTED_INTERNAL", reviewedByUserId: context.actorUserId,
        reviewedByMandateId: authority.mandateId, reviewStepUpId: stepUpEvidenceId,
        reviewReason: reason, reviewedAt: now,
      } });
      if (changed.count !== 1) throw new ConflictException("allocation changed concurrently");
      return tx.commercialAllocation.findUniqueOrThrow({ where: { id: allocationId } });
    });
  }

  async respondAllocation(context: CommercialActorContext, caseId: string, opportunityId: string, allocationId: string, body: {
    accept?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    const opportunity = await this.load(opportunityId);
    if (opportunity.transactionCaseId !== caseId) throw new NotFoundException("commercial opportunity not found");
    const authority = await this.authority(context, "MANAGE_ALLOCATION", caseId);
    const allocation = await this.db.commercialAllocation.findUnique({ where: { id: allocationId } });
    if (!allocation || allocation.commercialOpportunityId !== opportunityId || allocation.offereeInstitutionId !== context.actingInstitutionId) throw new NotFoundException("allocation not found");
    if (allocation.status !== "OFFERED") throw new ConflictException("allocation is not open for response");
    const accept = boolean(body.accept, "accept");
    if (accept) {
      if (allocation.expiresAt <= new Date()) throw new ConflictException("allocation is expired");
      await this.requireAudience(context, caseId, opportunityId, "MANAGE_ALLOCATION");
      await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "ALLOCATION");
    }
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    return this.db.$transaction(async (tx) => {
      const current = await this.lockOpportunity(tx, opportunityId);
      if (accept) {
        const [currentGrant, currentTerm] = await Promise.all([
          tx.commercialAudienceGrant.findUnique({
            where: {
              commercialOpportunityId_institutionId: {
                commercialOpportunityId: opportunityId,
                institutionId: context.actingInstitutionId,
              },
            },
          }),
          tx.commercialTermVersion.findUnique({ where: { id: allocation.termVersionId } }),
        ]);
        const now = new Date();
        if (current.status !== "PUBLISHED" || allocation.expiresAt <= now
          || !currentTerm || currentTerm.version !== current.currentTermVersion || currentTerm.expiresAt <= now
          || !currentGrant || currentGrant.status !== "ACTIVE"
          || currentGrant.effectiveAt > now || currentGrant.expiresAt <= now) {
          throw new ConflictException("allocation, current term or audience authority changed before acceptance");
        }
      }
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_ALLOCATION_RESPOND", institutionId: context.actingInstitutionId }, tx);
      const changed = await tx.commercialAllocation.updateMany({ where: { id: allocationId, status: "OFFERED", respondedByUserId: null }, data: {
        status: accept ? "ACCEPTED" : "DECLINED", respondedByUserId: context.actorUserId,
        respondedByMandateId: authority.mandateId, responseStepUpId: stepUpEvidenceId,
        responseReason: reason, respondedAt: new Date(),
      } });
      if (changed.count !== 1) throw new ConflictException("allocation changed concurrently");
      if (accept && allocation.basisType === "INTEREST") {
        await tx.commercialInterestIndication.updateMany({ where: { id: allocation.basisId, status: "SUBMITTED" }, data: { status: "CONVERTED" } });
      }
      audit("rail.commercial.allocation_responded", { opportunityId, allocationId, accepted: accept, actorUserId: context.actorUserId });
      return tx.commercialAllocation.findUniqueOrThrow({ where: { id: allocationId } });
    });
  }

  async prepareCaseHandoff(context: CommercialActorContext, caseId: string, opportunityId: string, allocationId: string, body: {
    idempotencyKey?: unknown; reason?: unknown; stepUpEvidenceId?: unknown;
  }) {
    productEnabled();
    const { opportunity, authority } = await this.requireOwner(context, caseId, opportunityId, "MANAGE_ALLOCATION");
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const reason = required(body.reason, "reason", 1_000);
    const requestDigest = sha256Digest({ caseId, opportunityId, allocationId, reason });
    const replay = await this.db.commercialCaseHandoff.findUnique({ where: { commercialOpportunityId_idempotencyKey: { commercialOpportunityId: opportunityId, idempotencyKey } }, select: { id: true, requestDigest: true } });
    if (replay) {
      if (replay.requestDigest !== requestDigest) throw new ConflictException("case handoff idempotency key conflicts with retained content");
      return this.loadCaseHandoff(replay.id);
    }
    if (!["DRAFT", "INTAKE_OPEN"].includes(opportunity.transactionCase.status) || opportunity.transactionCase.evidenceLockedAt) {
      throw new ConflictException("commercial handoff requires an unlocked draft or intake-open transaction case");
    }
    await this.requireRouteFunction(context.actingInstitutionId, opportunity.transactionCase, "ALLOCATION");
    const allocation = await this.db.commercialAllocation.findUnique({ where: { id: allocationId }, include: { termVersion: true } });
    if (!allocation || allocation.commercialOpportunityId !== opportunityId) throw new NotFoundException("accepted allocation not found");
    const now = new Date();
    if (allocation.status !== "ACCEPTED" || !allocation.respondedAt) throw new ConflictException("counterparty acceptance of the allocation is required before case handoff");
    if (opportunity.status !== "PUBLISHED" || (opportunity.opensAt && opportunity.opensAt > now)
      || (opportunity.closesAt && opportunity.closesAt <= now) || allocation.expiresAt <= now
      || allocation.termVersion.validFrom > now || allocation.termVersion.expiresAt <= now) {
      throw new ConflictException("opportunity, accepted allocation and current term must remain open and current for case handoff");
    }
    if (allocation.termVersion.version !== opportunity.currentTermVersion) throw new ConflictException("accepted allocation no longer references the current opportunity term");
    const existingForAllocation = await this.db.commercialCaseHandoff.findUnique({ where: { commercialAllocationId: allocationId } });
    if (existingForAllocation) throw new ConflictException("accepted allocation already has a case handoff");
    const [counterparty, grant, route] = await Promise.all([
      this.db.institution.findUnique({ where: { id: allocation.offereeInstitutionId }, include: { admission: true } }),
      this.db.commercialAudienceGrant.findUnique({ where: { commercialOpportunityId_institutionId: { commercialOpportunityId: opportunityId, institutionId: allocation.offereeInstitutionId } } }),
      this.access.evaluateRoute(allocation.offereeInstitutionId, { transactionRoute: opportunity.transactionCase.transactionRoute, representation: opportunity.transactionCase.representation, assetClass: opportunity.transactionCase.assetClass, lifecycleLeg: opportunity.transactionCase.lifecycleLeg, materialFunction: "ALLOCATION", operatingMode: opportunity.transactionCase.operatingMode }),
    ]);
    if (!counterparty || counterparty.status !== "ACTIVE" || counterparty.admission?.status !== "ADMITTED") throw new ConflictException("accepted counterparty is not an active admitted participant");
    if (!grant || grant.status !== "ACTIVE" || grant.effectiveAt > now || grant.expiresAt <= now) throw new ConflictException("accepted counterparty no longer has a current named-audience grant");
    if (!route.allowed) throw new ForbiddenException(`accepted counterparty allocation route denied: ${route.code}`);
    const counterpartyPartyRole = opportunity.transactionCase.transactionRoute === "DA" ? "TRANSFEREE" : "INVESTOR";
    const handoffId = `chand_${randomUUID()}`;
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const handoff = await this.db.$transaction(async (tx) => {
        const current = await this.lockOpportunity(tx, opportunityId);
        const [currentCase, currentAllocation, currentGrant, currentAssignment] = await Promise.all([
          tx.transactionCase.findUniqueOrThrow({ where: { id: caseId } }),
          tx.commercialAllocation.findUniqueOrThrow({ where: { id: allocationId }, include: { termVersion: true } }),
          tx.commercialAudienceGrant.findUniqueOrThrow({ where: { commercialOpportunityId_institutionId: { commercialOpportunityId: opportunityId, institutionId: allocation.offereeInstitutionId } } }),
          tx.caseFunctionAssignment.findUnique({ where: { transactionCaseId_materialFunction: { transactionCaseId: caseId, materialFunction: "ALLOCATION" } } }),
        ]);
        const checkedAt = new Date();
        if (current.transactionCaseId !== caseId || current.currentTermVersion !== currentAllocation.termVersion.version
          || current.status !== "PUBLISHED" || (current.opensAt && current.opensAt > checkedAt)
          || (current.closesAt && current.closesAt <= checkedAt)
          || currentAllocation.commercialOpportunityId !== opportunityId || currentAllocation.status !== "ACCEPTED"
          || !currentAllocation.respondedAt || !["DRAFT", "INTAKE_OPEN"].includes(currentCase.status) || currentCase.evidenceLockedAt
          || currentAllocation.expiresAt <= checkedAt || currentAllocation.termVersion.validFrom > checkedAt
          || currentAllocation.termVersion.expiresAt <= checkedAt || currentGrant.status !== "ACTIVE"
          || currentGrant.effectiveAt > checkedAt || currentGrant.expiresAt <= checkedAt
          || !currentAssignment || currentAssignment.status !== "ACTIVE" || currentAssignment.performer === "PROHIBITED"
          || (currentAssignment.effectiveAt && currentAssignment.effectiveAt > checkedAt)
          || (currentAssignment.expiresAt && currentAssignment.expiresAt <= checkedAt)) {
          throw new ConflictException("opportunity, allocation, case or audience authority changed before handoff");
        }
        const currentRoute = await this.access.evaluateRoute(currentAllocation.offereeInstitutionId, {
          transactionRoute: currentCase.transactionRoute,
          representation: currentCase.representation,
          assetClass: currentCase.assetClass,
          lifecycleLeg: currentCase.lifecycleLeg,
          materialFunction: "ALLOCATION",
          operatingMode: currentCase.operatingMode,
        }, checkedAt, tx);
        if (!currentRoute.allowed) throw new ForbiddenException(`accepted counterparty allocation route changed before handoff: ${currentRoute.code}`);
        const allocationDigest = sha256Digest({ allocationId: currentAllocation.id, allocationReference: currentAllocation.allocationReference, offereeInstitutionId: currentAllocation.offereeInstitutionId, termVersionId: currentAllocation.termVersionId, currency: currentAllocation.currency, amountUnits: currentAllocation.amountUnits, amountScale: currentAllocation.amountScale, status: currentAllocation.status, proposalDigest: currentAllocation.proposalDigest, respondedAt: currentAllocation.respondedAt.toISOString() });
        const handoffDigest = sha256Digest({ caseId, opportunityId, allocationId, termVersionId: currentAllocation.termVersionId, termDigest: currentAllocation.termVersion.termDigest, audienceGrantId: currentGrant.id, audienceGrantDigest: currentGrant.invitationDigest, allocationDigest, ownerInstitutionId: current.ownerInstitutionId, counterpartyInstitutionId: currentAllocation.offereeInstitutionId, counterpartyPartyRole, eligibilityDecisionCode: currentRoute.code, eligibilityCheckedAt: checkedAt.toISOString() });
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: context.actorUserId, sessionId: context.actorSessionId, purpose: "COMMERCIAL_CASE_HANDOFF", institutionId: context.actingInstitutionId }, tx);
        let party = await tx.caseParty.findUnique({ where: { transactionCaseId_institutionId_partyRole: { transactionCaseId: caseId, institutionId: currentAllocation.offereeInstitutionId, partyRole: counterpartyPartyRole } } });
        if (party && !["PROPOSED", "ACTIVE"].includes(party.status)) throw new ConflictException("the counterparty case role is no longer available for handoff");
        if (!party) {
          party = await tx.caseParty.create({ data: { id: `cparty_${randomUUID()}`, transactionCaseId: caseId, institutionId: currentAllocation.offereeInstitutionId, partyRole: counterpartyPartyRole, status: "PROPOSED", authorityEvidenceRef: `commercial-handoff:${handoffId}`, createdByUserId: context.actorUserId } });
          await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
        }
        const status = "HANDOFF_RECORDED";
        const created = await tx.commercialCaseHandoff.create({ data: { id: handoffId, commercialOpportunityId: opportunityId, commercialAllocationId: allocationId, transactionCaseId: caseId, termVersionId: currentAllocation.termVersionId, audienceGrantId: currentGrant.id, casePartyId: party.id, ownerInstitutionId: current.ownerInstitutionId, counterpartyInstitutionId: currentAllocation.offereeInstitutionId, counterpartyPartyRole, status, termDigest: currentAllocation.termVersion.termDigest, audienceGrantDigest: currentGrant.invitationDigest, allocationDigest, eligibilityDecisionCode: currentRoute.code, eligibilityCheckedAt: checkedAt, handoffDigest, idempotencyKey, requestDigest, createdByUserId: context.actorUserId, createdByMandateId: authority.mandateId!, stepUpEvidenceId } });
        await appendGovernedAudit(tx, { actor: `user:${context.actorUserId}@institution:${context.actingInstitutionId}`, event: "rail.commercial.case_handoff_prepared", detail: { caseId, opportunityId, allocationId, handoffId, handoffDigest, counterpartyInstitutionId: currentAllocation.offereeInstitutionId, counterpartyPartyRole, status, reason } });
        return created;
      });
      audit("rail.commercial.case_handoff_prepared", { caseId, opportunityId, allocationId, handoffId: handoff.id, actorUserId: context.actorUserId });
      return this.loadCaseHandoff(handoff.id);
    } catch (error) {
      const retained = await this.db.commercialCaseHandoff.findUnique({ where: { commercialOpportunityId_idempotencyKey: { commercialOpportunityId: opportunityId, idempotencyKey } }, select: { id: true, requestDigest: true } });
      if (retained?.requestDigest === requestDigest) return this.loadCaseHandoff(retained.id);
      if (unique(error)) throw new ConflictException("accepted allocation or idempotency key already has a retained handoff");
      throw error;
    }
  }

  private loadCaseHandoff(id: string) {
    return this.db.commercialCaseHandoff.findUniqueOrThrow({ where: { id }, select: { id: true, commercialOpportunityId: true, commercialAllocationId: true, transactionCaseId: true, termVersionId: true, audienceGrantId: true, casePartyId: true, ownerInstitutionId: true, counterpartyInstitutionId: true, counterpartyPartyRole: true, status: true, termDigest: true, audienceGrantDigest: true, allocationDigest: true, eligibilityDecisionCode: true, eligibilityCheckedAt: true, handoffDigest: true, createdByUserId: true, createdAt: true, caseParty: { select: { status: true, acceptedByUserId: true, acceptedAt: true } } } });
  }
}
