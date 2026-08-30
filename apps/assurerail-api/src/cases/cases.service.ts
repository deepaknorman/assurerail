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
import {
  ASSET_CLASS_TAXONOMY,
  FUNCTION_PERFORMER_TAXONOMY,
  LIFECYCLE_LEG_TAXONOMY,
  MARKET_CONTEXT_TAXONOMY,
  MATERIAL_FUNCTION_TAXONOMY,
  PLACEMENT_OR_LISTING_TAXONOMY,
  REPRESENTATION_TAXONOMY,
  TRANSACTION_ROUTE_TAXONOMY,
  assertTaxonomyValue,
  sha256Digest,
  toCanonicalValue,
  type VersionedTaxonomy,
} from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import { CASE_STATUSES, evaluateCaseTransition, replayCaseTransitions, type CaseStatus, type ReplayTransition } from "./case-state";

const PARTY_ROLES = ["TRANSFEROR", "TRANSFEREE", "ISSUER", "INVESTOR", "TRUST", "TRUSTEE", "ARRANGER", "SERVICER", "RTA", "DEPOSITORY", "COUNSEL", "RATING_AGENCY", "ASSURANCE_PROVIDER", "OTHER_APPROVED"] as const;
const CONDITION_KINDS = ["PRECEDENT", "SUBSEQUENT"] as const;
const CONDITION_RESULTS = ["SATISFIED", "WAIVED", "FAILED"] as const;
const NON_LIVE_MODES = ["REPLAY", "SHADOW"] as const;

function enabled(): void {
  if (inspectPersistenceFlags(process.env).transactionCase !== "shadow") throw new ForbiddenException("neutral transaction cases are disabled");
}

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const result = value.trim();
  if (result.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return result;
}

function optional(value: unknown, name: string, max = 300): string | null {
  return value === null || value === undefined || value === "" ? null : required(value, name, max);
}

function oneOf(value: unknown, name: string, values: readonly string[]): string {
  const result = required(value, name, 120);
  if (!values.includes(result)) throw new BadRequestException(`${name} must be one of: ${values.join(", ")}`);
  return result;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new BadRequestException(`${name} must be a positive safe integer`);
  return value;
}

function optionalDate(value: unknown, name: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(required(value, name, 80));
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

function taxonomy<T extends string>(source: VersionedTaxonomy<T>, value: unknown, name: string): T {
  try { return assertTaxonomyValue(source, value, name); }
  catch (error) { throw new BadRequestException((error as Error).message); }
}

function unique(error: unknown): boolean { return (error as { code?: string } | null)?.code === "P2002"; }

@Injectable()
export class CasesService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService,
  ) {}

  async list(actorUserId: string, actingInstitutionId: string) {
    enabled();
    await this.access.requireHuman({ userId: actorUserId, institutionId: actingInstitutionId, action: "VIEW_CASE" });
    return this.db.transactionCase.findMany({
      where: { OR: [{ ownerInstitutionId: actingInstitutionId }, { parties: { some: { institutionId: actingInstitutionId, status: "ACTIVE" } } }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, caseReference: true, ownerInstitutionId: true, transactionRoute: true, representation: true,
        assetClass: true, lifecycleLeg: true, operatingMode: true, status: true, routeState: true,
        currentVersion: true, aggregateVersion: true, evidenceLockedAt: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async get(actorUserId: string, actingInstitutionId: string, caseId: string) {
    const transactionCase = await this.requireCase(actorUserId, actingInstitutionId, caseId, "VIEW_CASE");
    return this.db.transactionCase.findUniqueOrThrow({
      where: { id: transactionCase.id },
      include: {
        versions: { orderBy: { version: "asc" } }, parties: { orderBy: { createdAt: "asc" } },
        functionAssignments: { orderBy: { materialFunction: "asc" } }, conditions: { orderBy: { createdAt: "asc" } },
        decisions: { orderBy: { createdAt: "asc" }, include: { approvals: true } },
        transitions: { orderBy: { resultingVersion: "asc" } },
      },
    });
  }

  async create(actorUserId: string, actingInstitutionId: string, actorSessionId: string, body: {
    idempotencyKey?: string; caseReference?: string; transactionRoute?: string; representation?: string;
    jurisdiction?: string; marketContext?: string; placementOrListing?: string; lifecycleLeg?: string;
    assetClass?: string; operatingMode?: string; routePackRef?: string; routePackVersion?: string;
    extensionProfileRef?: string | null; initialSpec?: unknown; reason?: string; authorityEvidenceRef?: string; stepUpEvidenceId?: string;
  }) {
    enabled();
    const authority = await this.access.requireHuman({ userId: actorUserId, institutionId: actingInstitutionId, action: "OPERATE_CASE" });
    const transactionRoute = taxonomy(TRANSACTION_ROUTE_TAXONOMY, body.transactionRoute, "transactionRoute");
    const representation = taxonomy(REPRESENTATION_TAXONOMY, body.representation, "representation");
    const assetClass = taxonomy(ASSET_CLASS_TAXONOMY, body.assetClass, "assetClass");
    const lifecycleLeg = taxonomy(LIFECYCLE_LEG_TAXONOMY, body.lifecycleLeg, "lifecycleLeg");
    const marketContext = taxonomy(MARKET_CONTEXT_TAXONOMY, body.marketContext, "marketContext");
    const placementOrListing = taxonomy(PLACEMENT_OR_LISTING_TAXONOMY, body.placementOrListing, "placementOrListing");
    const operatingMode = oneOf(body.operatingMode, "operatingMode", NON_LIVE_MODES);
    const caseReference = required(body.caseReference, "caseReference", 160);
    const jurisdiction = required(body.jurisdiction, "jurisdiction", 80);
    const routePackRef = required(body.routePackRef, "routePackRef", 240);
    const routePackVersion = required(body.routePackVersion, "routePackVersion", 80);
    const extensionRequired = assetClass === "OTHER_APPROVED_EXPOSURE"
      || marketContext === "OTHER_APPROVED" || placementOrListing === "OTHER_APPROVED";
    const extensionProfileRef = extensionRequired
      ? required(body.extensionProfileRef, "extensionProfileRef", 300)
      : optional(body.extensionProfileRef, "extensionProfileRef", 300);
    const route = { transactionRoute, representation, assetClass, lifecycleLeg, materialFunction: "ASSET_OR_INSTRUMENT_ADMISSION", operatingMode };
    const routeDecision = await this.access.evaluateRoute(actingInstitutionId, route);
    if (!routeDecision.allowed) throw new ForbiddenException(`case route denied: ${routeDecision.code}`);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const initialSpec = json(body.initialSpec);
    const reason = required(body.reason, "reason", 1000);
    const authorityEvidenceRef = required(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const creationRequestDigest = sha256Digest({
      caseReference, transactionRoute, representation, jurisdiction, marketContext, placementOrListing,
      lifecycleLeg, assetClass, operatingMode, routePackRef, routePackVersion, extensionProfileRef,
      initialSpec, reason, authorityEvidenceRef,
    });
    const existing = await this.db.transactionCase.findUnique({
      where: { ownerInstitutionId_creationIdempotencyKey: { ownerInstitutionId: actingInstitutionId, creationIdempotencyKey: idempotencyKey } },
    });
    if (existing) {
      if (existing.creationRequestDigest !== creationRequestDigest) throw new ConflictException("case idempotency key was reused with different content");
      return this.loadCase(existing.id);
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const specDigest = sha256Digest(initialSpec);
    let transactionCase;
    try {
      transactionCase = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_CREATE", institutionId: actingInstitutionId }, tx);
        const caseId = `case_${randomUUID()}`;
        const created = await tx.transactionCase.create({ data: {
          id: caseId, caseReference, ownerInstitutionId: actingInstitutionId,
          transactionRoute, representation, jurisdiction, marketContext, placementOrListing, lifecycleLeg, assetClass,
          operatingMode, routePackRef, routePackVersion, extensionProfileRef,
          creationIdempotencyKey: idempotencyKey, creationRequestDigest,
          createdByUserId: actorUserId, createdByMandateId: authority.mandateId!,
        } });
        await tx.caseVersion.create({ data: {
          id: `cver_${randomUUID()}`, transactionCaseId: caseId, version: 1, spec: initialSpec, specDigest,
          reason, createdByUserId: actorUserId, createdByMandateId: authority.mandateId!,
        } });
        await tx.caseParty.create({ data: {
          id: `cparty_${randomUUID()}`, transactionCaseId: caseId, institutionId: actingInstitutionId,
          partyRole: transactionRoute === "DA" ? "TRANSFEROR" : "ISSUER", status: "ACTIVE",
          authorityMandateId: authority.mandateId, authorityEvidenceRef,
          acceptedByUserId: actorUserId, acceptedAt: new Date(), createdByUserId: actorUserId,
        } });
        return created;
      });
    } catch (error) {
      if (!unique(error)) throw error;
      const replay = await this.db.transactionCase.findUnique({
        where: { ownerInstitutionId_creationIdempotencyKey: { ownerInstitutionId: actingInstitutionId, creationIdempotencyKey: idempotencyKey } },
      });
      if (!replay || replay.creationRequestDigest !== creationRequestDigest) throw new ConflictException("case reference or idempotency key conflicts with another request");
      transactionCase = replay;
    }
    audit("rail.case.created", { actorUserId, actingInstitutionId, caseId: transactionCase.id, transactionRoute, representation, operatingMode });
    return this.loadCase(transactionCase.id);
  }

  async createVersion(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, body: {
    expectedVersion?: number; spec?: unknown; reason?: string; stepUpEvidenceId?: string;
  }) {
    const transactionCase = await this.requireCaseOwner(actorUserId, actingInstitutionId, caseId);
    if (transactionCase.evidenceLockedAt || !["DRAFT", "INTAKE_OPEN"].includes(transactionCase.status)) {
      throw new ConflictException("case specification is immutable after evidence lock");
    }
    const expectedVersion = positiveInteger(body.expectedVersion, "expectedVersion");
    if (transactionCase.currentVersion !== expectedVersion) throw new ConflictException("stale case version");
    const spec = json(body.spec); const specDigest = sha256Digest(spec);
    const reason = required(body.reason, "reason", 1000);
    const existing = await this.db.caseVersion.findUnique({ where: { transactionCaseId_specDigest: { transactionCaseId: caseId, specDigest } } });
    if (existing) {
      if (existing.reason !== reason) throw new ConflictException("case version content was replayed with a different reason");
      return existing;
    }
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_VERSION_CREATE", institutionId: actingInstitutionId }, tx);
      const changed = await tx.transactionCase.updateMany({ where: { id: caseId, currentVersion: expectedVersion, evidenceLockedAt: null }, data: { currentVersion: { increment: 1 }, aggregateVersion: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException("case version changed concurrently");
      const previous = await tx.caseVersion.findUniqueOrThrow({ where: { transactionCaseId_version: { transactionCaseId: caseId, version: expectedVersion } } });
      return tx.caseVersion.create({ data: {
        id: `cver_${randomUUID()}`, transactionCaseId: caseId, version: expectedVersion + 1, spec, specDigest,
        reason, supersedesVersionId: previous.id,
        createdByUserId: actorUserId, createdByMandateId: authority.mandateId!,
      } });
    });
    audit("rail.case.version_created", { actorUserId, actingInstitutionId, caseId, version: created.version, specDigest });
    return created;
  }

  async addParty(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, body: {
    institutionId?: string; partyRole?: string; appointmentId?: string | null; authorityEvidenceRef?: string; stepUpEvidenceId?: string;
  }) {
    const transactionCase = await this.requireCaseOwner(actorUserId, actingInstitutionId, caseId);
    this.assertPreLock(transactionCase.status);
    const institutionId = required(body.institutionId, "institutionId", 160);
    const institution = await this.db.institution.findUnique({ where: { id: institutionId }, include: { admission: true } });
    if (!institution || institution.status !== "ACTIVE" || institution.admission?.status !== "ADMITTED") throw new BadRequestException("case party must be an admitted active institution");
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const party = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_PARTY_CHANGE", institutionId: actingInstitutionId }, tx);
        const result = await tx.caseParty.create({ data: {
          id: `cparty_${randomUUID()}`, transactionCaseId: caseId, institutionId,
          partyRole: oneOf(body.partyRole, "partyRole", PARTY_ROLES), status: institutionId === actingInstitutionId ? "ACTIVE" : "PROPOSED",
          authorityMandateId: institutionId === actingInstitutionId ? authority.mandateId : null,
          appointmentId: optional(body.appointmentId, "appointmentId", 160), authorityEvidenceRef: required(body.authorityEvidenceRef, "authorityEvidenceRef", 500),
          acceptedByUserId: institutionId === actingInstitutionId ? actorUserId : null, acceptedAt: institutionId === actingInstitutionId ? new Date() : null,
          createdByUserId: actorUserId,
        } });
        await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
        return result;
      });
      audit("rail.case.party_proposed", { actorUserId, actingInstitutionId, caseId, partyId: party.id, institutionId });
      return party;
    } catch (error) { if (unique(error)) throw new ConflictException("case party role already exists"); throw error; }
  }

  async acceptParty(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, partyId: string, body: { stepUpEvidenceId?: string }) {
    const transactionCase = await this.requireCase(actorUserId, actingInstitutionId, caseId, "OPERATE_CASE", true);
    this.assertPreLock(transactionCase.status);
    const party = await this.db.caseParty.findUnique({ where: { id: partyId } });
    if (!party || party.transactionCaseId !== caseId || party.institutionId !== actingInstitutionId) throw new NotFoundException("case party not found");
    if (party.status !== "PROPOSED") throw new ConflictException("case party is not awaiting acceptance");
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId, true);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const accepted = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_PARTY_CHANGE", institutionId: actingInstitutionId }, tx);
      const changed = await tx.caseParty.updateMany({ where: { id: partyId, status: "PROPOSED" }, data: { status: "ACTIVE", authorityMandateId: authority.mandateId, acceptedByUserId: actorUserId, acceptedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException("case party was concurrently changed");
      await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
      return tx.caseParty.findUniqueOrThrow({ where: { id: partyId } });
    });
    audit("rail.case.party_accepted", { actorUserId, actingInstitutionId, caseId, partyId });
    return accepted;
  }

  async assignFunction(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, body: {
    materialFunction?: string; performer?: string; performerInstitutionId?: string | null; appointmentId?: string | null;
    authorityEvidenceRef?: string | null; permissionEvidenceRef?: string | null; expiresAt?: string | null; stepUpEvidenceId?: string;
  }) {
    const transactionCase = await this.requireCaseOwner(actorUserId, actingInstitutionId, caseId);
    this.assertPreLock(transactionCase.status);
    const materialFunction = taxonomy(MATERIAL_FUNCTION_TAXONOMY, body.materialFunction, "materialFunction");
    const performer = taxonomy(FUNCTION_PERFORMER_TAXONOMY, body.performer, "performer");
    const performerInstitutionId = optional(body.performerInstitutionId, "performerInstitutionId", 160);
    const appointmentId = optional(body.appointmentId, "appointmentId", 160);
    const authorityEvidenceRef = optional(body.authorityEvidenceRef, "authorityEvidenceRef", 500);
    const permissionEvidenceRef = optional(body.permissionEvidenceRef, "permissionEvidenceRef", 500);
    if (performer !== "PROHIBITED" && !performerInstitutionId) throw new BadRequestException("non-prohibited function requires a performer institution");
    if (performer === "PROHIBITED" && performerInstitutionId) throw new BadRequestException("prohibited function cannot name a performer institution");
    if (["LICENSED_PARTNER", "EXTERNAL_AUTHORITY"].includes(performer) && !appointmentId) {
      throw new BadRequestException(`${performer} function requires an active appointment`);
    }
    if (performer !== "PROHIBITED" && !authorityEvidenceRef) {
      throw new BadRequestException("non-prohibited function requires authority evidence");
    }
    if (["OWNED_AUTHORISED", "LICENSED_PARTNER"].includes(performer) && !permissionEvidenceRef) {
      throw new BadRequestException(`${performer} function requires permission evidence`);
    }
    if (performerInstitutionId) {
      const route = await this.access.evaluateRoute(performerInstitutionId, {
        transactionRoute: transactionCase.transactionRoute, representation: transactionCase.representation,
        assetClass: transactionCase.assetClass, lifecycleLeg: transactionCase.lifecycleLeg,
        materialFunction, operatingMode: transactionCase.operatingMode,
      });
      if (!route.allowed) throw new ForbiddenException(`function performer route denied: ${route.code}`);
      const party = await this.db.caseParty.findFirst({ where: { transactionCaseId: caseId, institutionId: performerInstitutionId, status: "ACTIVE" } });
      if (!party) throw new BadRequestException("function performer must be an active case party");
    }
    if (appointmentId) await this.requireActiveAppointment(appointmentId, caseId, performerInstitutionId);
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const assignment = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_FUNCTION_ASSIGN", institutionId: actingInstitutionId }, tx);
        const result = await tx.caseFunctionAssignment.create({ data: {
          id: `cfunc_${randomUUID()}`, transactionCaseId: caseId, materialFunction, performer, performerInstitutionId,
          appointmentId, authorityEvidenceRef, permissionEvidenceRef, status: "ACTIVE", effectiveAt: new Date(),
          expiresAt: optionalDate(body.expiresAt, "expiresAt"), createdByUserId: actorUserId,
        } });
        await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
        return result;
      });
      audit("rail.case.function_assigned", { actorUserId, actingInstitutionId, caseId, materialFunction, performer, authorityMandateId: authority.mandateId });
      return assignment;
    } catch (error) { if (unique(error)) throw new ConflictException("material function already assigned"); throw error; }
  }

  async addCondition(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, body: {
    conditionKind?: string; code?: string; description?: string; ownerInstitutionId?: string; dueAt?: string | null;
    waiverAuthorityRef?: string | null; stepUpEvidenceId?: string;
  }) {
    const transactionCase = await this.requireCaseOwner(actorUserId, actingInstitutionId, caseId);
    if (["COMPLETED", "CANCELLED", "FAILED"].includes(transactionCase.status)) throw new ConflictException("terminal case cannot receive conditions");
    const ownerInstitutionId = required(body.ownerInstitutionId, "ownerInstitutionId", 160);
    const party = await this.db.caseParty.findFirst({ where: { transactionCaseId: caseId, institutionId: ownerInstitutionId, status: "ACTIVE" } });
    if (!party) throw new BadRequestException("condition owner must be an active case party");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const condition = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_CONDITION_CHANGE", institutionId: actingInstitutionId }, tx);
        const result = await tx.caseCondition.create({ data: {
          id: `ccond_${randomUUID()}`, transactionCaseId: caseId, conditionKind: oneOf(body.conditionKind, "conditionKind", CONDITION_KINDS),
          code: required(body.code, "code", 120), description: required(body.description, "description", 1000), ownerInstitutionId,
          dueAt: optionalDate(body.dueAt, "dueAt"),
          waiverAuthorityRef: optional(body.waiverAuthorityRef, "waiverAuthorityRef", 500), createdByUserId: actorUserId,
        } });
        await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
        return result;
      });
      return condition;
    } catch (error) { if (unique(error)) throw new ConflictException("condition code already exists"); throw error; }
  }

  async resolveCondition(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, conditionId: string, body: {
    result?: string; evidenceObjectId?: string | null; reason?: string; stepUpEvidenceId?: string;
  }) {
    await this.requireCase(actorUserId, actingInstitutionId, caseId, "OPERATE_CASE");
    const condition = await this.db.caseCondition.findUnique({ where: { id: conditionId } });
    if (!condition || condition.transactionCaseId !== caseId) throw new NotFoundException("case condition not found");
    if (condition.status !== "OPEN") throw new ConflictException("condition is already resolved");
    if (condition.ownerInstitutionId !== actingInstitutionId) throw new ForbiddenException("only the condition owner can resolve it");
    const result = oneOf(body.result, "result", CONDITION_RESULTS);
    if (result === "WAIVED" && !condition.waiverAuthorityRef) throw new ForbiddenException("condition has no declared waiver authority");
    const evidenceObjectId = optional(body.evidenceObjectId, "evidenceObjectId", 160);
    if (result === "SATISFIED") {
      if (!evidenceObjectId) throw new BadRequestException("satisfied condition requires evidence");
      const evidence = await this.db.evidenceObject.findUnique({
        where: { id: evidenceObjectId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      const latest = evidence?.versions[0];
      if (!evidence || evidence.transactionCaseId !== caseId || evidence.status !== "AVAILABLE"
        || !latest || latest.validationStatus !== "VALID" || (latest.expiresAt && latest.expiresAt <= new Date())) {
        throw new BadRequestException("condition evidence must be current, valid, available and case-scoped");
      }
    }
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const resolved = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_CONDITION_CHANGE", institutionId: actingInstitutionId }, tx);
      const changed = await tx.caseCondition.updateMany({ where: { id: conditionId, status: "OPEN" }, data: {
        status: result, evidenceObjectId, resolutionReason: required(body.reason, "reason", 1000), resolvedByUserId: actorUserId, resolvedAt: new Date(),
      } });
      if (changed.count !== 1) throw new ConflictException("condition was concurrently resolved");
      await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
      return tx.caseCondition.findUniqueOrThrow({ where: { id: conditionId } });
    });
    audit("rail.case.condition_resolved", { actorUserId, actingInstitutionId, caseId, conditionId, result, authorityMandateId: authority.mandateId });
    return resolved;
  }

  async proposeDecision(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, body: {
    decisionType?: string; proposal?: unknown; reason?: string; stepUpEvidenceId?: string;
  }) {
    const transactionCase = await this.requireCase(actorUserId, actingInstitutionId, caseId, "OPERATE_CASE");
    if (["COMPLETED", "CANCELLED", "FAILED"].includes(transactionCase.status)) throw new ConflictException("terminal case cannot receive decisions");
    const decisionType = required(body.decisionType, "decisionType", 160);
    if (decisionType === "CASE_APPROVAL" && transactionCase.status !== "REVIEW_PENDING") {
      throw new ConflictException("CASE_APPROVAL can be proposed only while the case is awaiting review");
    }
    if (decisionType.startsWith("CASE_RECOVERY:") && transactionCase.status !== "BLOCKED") {
      throw new ConflictException("case recovery can be proposed only while the case is blocked");
    }
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId);
    const proposal = json(body.proposal); const proposalDigest = sha256Digest(proposal);
    const evidenceBundleDigest = await this.evidenceBundleDigest(caseId);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    try {
      const decision = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_DECISION_PROPOSE", institutionId: actingInstitutionId }, tx);
        const result = await tx.caseDecision.create({ data: {
          id: `cdec_${randomUUID()}`, transactionCaseId: caseId, decisionType,
          proposal, proposalDigest, rulePackRef: transactionCase.routePackRef, rulePackVersion: transactionCase.routePackVersion,
          evidenceBundleDigest, caseAggregateVersion: transactionCase.aggregateVersion,
          reason: required(body.reason, "reason", 1000), proposedByUserId: actorUserId,
          proposedByMandateId: authority.mandateId!, proposalStepUpId: stepUpEvidenceId,
        } });
        await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
        return result;
      });
      return decision;
    } catch (error) { if (unique(error)) throw new ConflictException("identical case decision already exists"); throw error; }
  }

  async reviewDecision(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, decisionId: string, body: {
    approve?: boolean; reason?: string; stepUpEvidenceId?: string;
  }) {
    const transactionCase = await this.requireCase(actorUserId, actingInstitutionId, caseId, "OPERATE_CASE");
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId);
    const decision = await this.db.caseDecision.findUnique({ where: { id: decisionId } });
    if (!decision || decision.transactionCaseId !== caseId) throw new NotFoundException("case decision not found");
    if (decision.status !== "PROPOSED") throw new ConflictException("case decision is already terminal");
    if (decision.proposedByUserId === actorUserId) throw new ForbiddenException("decision maker cannot review their own proposal");
    if (transactionCase.aggregateVersion !== decision.caseAggregateVersion + 1) {
      throw new ConflictException("case changed after the decision proposal");
    }
    const currentBundle = await this.evidenceBundleDigest(caseId);
    if (currentBundle !== decision.evidenceBundleDigest) throw new ConflictException("case evidence changed after the decision proposal");
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const outcome = body.approve === true ? "APPROVED" : "REJECTED";
    if (outcome === "APPROVED" && decision.decisionType === "CASE_APPROVAL") {
      const currentStatus = oneOf(transactionCase.status, "current case status", CASE_STATUSES) as CaseStatus;
      const facts = await this.guardFacts(caseId, currentStatus, "");
      if (facts.evidenceCount === 0 || facts.unavailableEvidenceCount > 0) {
        throw new ConflictException("case decision cannot be approved with missing, invalid or expired evidence");
      }
    }
    const reason = required(body.reason, "reason", 1000);
    const approvalDigest = sha256Digest({ decisionId, outcome, actorUserId, actingInstitutionId, reason, currentBundle, stepUpEvidenceId });
    const reviewed = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_DECISION_REVIEW", institutionId: actingInstitutionId }, tx);
      const claimed = await tx.caseDecision.updateMany({ where: { id: decisionId, status: "PROPOSED", reviewedByUserId: null }, data: {
        status: outcome, reviewedByUserId: actorUserId, reviewStepUpId: stepUpEvidenceId, reviewReason: reason, effectiveAt: outcome === "APPROVED" ? new Date() : null,
      } });
      if (claimed.count !== 1) throw new ConflictException("case decision was concurrently reviewed");
      await tx.caseApproval.create({ data: {
        id: `cappr_${randomUUID()}`, caseDecisionId: decisionId, outcome, checkerUserId: actorUserId,
        checkerMandateId: authority.mandateId!, stepUpEvidenceId, reason, approvalDigest,
      } });
      await tx.transactionCase.update({ where: { id: caseId }, data: { aggregateVersion: { increment: 1 } } });
      return tx.caseDecision.findUniqueOrThrow({ where: { id: decisionId }, include: { approvals: true } });
    });
    audit("rail.case.decision_reviewed", { actorUserId, actingInstitutionId, caseId, decisionId, outcome });
    return reviewed;
  }

  async transition(actorUserId: string, actingInstitutionId: string, actorSessionId: string, caseId: string, body: {
    command?: string; idempotencyKey?: string; expectedAggregateVersion?: number; toStatus?: string;
    reason?: string; stepUpEvidenceId?: string;
  }) {
    const transactionCase = await this.requireCase(actorUserId, actingInstitutionId, caseId, "OPERATE_CASE");
    const authority = await this.caseAuthority(actorUserId, actingInstitutionId, caseId);
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 200);
    const command = required(body.command, "command", 160);
    const expectedVersion = positiveInteger(body.expectedAggregateVersion, "expectedAggregateVersion");
    const toStatus = oneOf(body.toStatus, "toStatus", CASE_STATUSES) as CaseStatus;
    const reason = required(body.reason, "reason", 1000);
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const requestDigest = sha256Digest({ caseId, command, expectedVersion, toStatus, reason, stepUpEvidenceId });
    const existing = await this.db.caseTransition.findUnique({ where: { transactionCaseId_idempotencyKey: { transactionCaseId: caseId, idempotencyKey } } });
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new ConflictException("transition idempotency key was reused with a different command");
      return existing;
    }
    if (transactionCase.aggregateVersion !== expectedVersion) throw new ConflictException("stale case aggregate version");
    const fromStatus = oneOf(transactionCase.status, "current case status", CASE_STATUSES) as CaseStatus;
    const facts = await this.guardFacts(caseId, toStatus, reason);
    const guard = evaluateCaseTransition(fromStatus, toStatus, facts);
    if (!guard.allowed) throw new ConflictException(`case transition blocked: ${guard.code}`);
    const evidenceBundleDigest = await this.evidenceBundleDigest(caseId);
    const occurredAt = new Date();
    const transitionDigest = sha256Digest({ caseId, command, idempotencyKey, requestDigest, fromStatus, toStatus, expectedVersion, resultingVersion: expectedVersion + 1, guard, evidenceBundleDigest, rulePackRef: transactionCase.routePackRef, routePackVersion: transactionCase.routePackVersion, actorUserId, actingInstitutionId, authorityMandateId: authority.mandateId, stepUpEvidenceId, reason, occurredAt: occurredAt.toISOString() });
    let transition;
    try {
      transition = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({ evidenceId: stepUpEvidenceId, userId: actorUserId, sessionId: actorSessionId, purpose: "CASE_TRANSITION", institutionId: actingInstitutionId }, tx);
        const changed = await tx.transactionCase.updateMany({ where: { id: caseId, aggregateVersion: expectedVersion, status: fromStatus }, data: {
          status: toStatus, aggregateVersion: expectedVersion + 1,
          evidenceLockedAt: toStatus === "EVIDENCE_LOCKED" ? occurredAt : transactionCase.evidenceLockedAt,
          completedAt: toStatus === "COMPLETED" ? occurredAt : null, cancelledAt: toStatus === "CANCELLED" ? occurredAt : null,
        } });
        if (changed.count !== 1) throw new ConflictException("case transition lost its optimistic-concurrency claim");
        return tx.caseTransition.create({ data: {
          id: `ctrans_${randomUUID()}`, transactionCaseId: caseId, command, idempotencyKey, requestDigest,
          fromStatus, toStatus, expectedVersion, resultingVersion: expectedVersion + 1, guardResult: json({ ...guard, reason }),
          evidenceBundleDigest, rulePackRef: transactionCase.routePackRef, rulePackVersion: transactionCase.routePackVersion,
          actorUserId, actingInstitutionId, authorityMandateId: authority.mandateId!, stepUpEvidenceId, transitionDigest, occurredAt,
        } });
      });
    } catch (error) {
      const replay = await this.db.caseTransition.findUnique({ where: { transactionCaseId_idempotencyKey: { transactionCaseId: caseId, idempotencyKey } } });
      if (replay?.requestDigest === requestDigest) return replay;
      if (!unique(error)) throw error;
      throw new ConflictException("transition idempotency or resulting version conflicts with another command");
    }
    audit("rail.case.transitioned", { actorUserId, actingInstitutionId, caseId, fromStatus, toStatus, transitionDigest });
    return transition;
  }

  async replay(actorUserId: string, actingInstitutionId: string, caseId: string) {
    const transactionCase = await this.requireCase(actorUserId, actingInstitutionId, caseId, "VIEW_CASE");
    const exported = await this.exportCase(caseId);
    const exportDigest = sha256Digest(exported);
    const replay = replayCaseTransitions(exported.transitions as unknown as readonly ReplayTransition[], transactionCase.status);
    const { replayStatus, previousResultingVersion, failures } = replay;
    const replayDigest = sha256Digest({ exportDigest, replayStatus, previousResultingVersion, failures });
    const receipt = await this.db.caseReplayReceipt.upsert({
      where: { transactionCaseId_aggregateVersion_replayDigest: { transactionCaseId: caseId, aggregateVersion: transactionCase.aggregateVersion, replayDigest } },
      create: { id: `creplay_${randomUUID()}`, transactionCaseId: caseId, aggregateVersion: transactionCase.aggregateVersion, exportDigest, replayDigest, result: failures.length ? "FAILED" : "REPRODUCED", detail: json({ replayStatus, previousResultingVersion, failures }), requestedByUserId: actorUserId },
      update: {},
    });
    return { receipt, export: exported };
  }

  private async requireCase(actorUserId: string, actingInstitutionId: string, caseId: string, action: "VIEW_CASE" | "OPERATE_CASE", allowProposedParty = false) {
    enabled();
    const transactionCase = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: { parties: true } });
    if (!transactionCase) throw new NotFoundException("transaction case not found");
    const party = transactionCase.parties.find((item) => item.institutionId === actingInstitutionId && (item.status === "ACTIVE" || (allowProposedParty && item.status === "PROPOSED")));
    if (transactionCase.ownerInstitutionId !== actingInstitutionId && !party) throw new NotFoundException("transaction case not found");
    await this.access.requireHuman({ userId: actorUserId, institutionId: actingInstitutionId, action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    return transactionCase;
  }

  private async requireCaseOwner(actorUserId: string, actingInstitutionId: string, caseId: string) {
    const transactionCase = await this.requireCase(actorUserId, actingInstitutionId, caseId, "OPERATE_CASE");
    if (transactionCase.ownerInstitutionId !== actingInstitutionId) throw new ForbiddenException("only the case owner may change this record");
    return transactionCase;
  }

  private caseAuthority(actorUserId: string, actingInstitutionId: string, caseId: string, _allowProposedParty = false) {
    return this.access.requireHuman({ userId: actorUserId, institutionId: actingInstitutionId, action: "OPERATE_CASE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
  }

  private assertPreLock(status: string): void {
    if (!["DRAFT", "INTAKE_OPEN"].includes(status)) throw new ConflictException("case parties and function assignments are immutable after evidence lock");
  }

  private async requireActiveAppointment(appointmentId: string, caseId: string, appointeeInstitutionId: string | null): Promise<void> {
    const appointment = await this.db.appointment.findUnique({ where: { id: appointmentId } });
    const now = new Date();
    if (!appointment || appointment.status !== "ACTIVE"
      || (appointment.effectiveAt && appointment.effectiveAt > now)
      || (appointment.expiresAt && appointment.expiresAt <= now)) {
      throw new BadRequestException("function appointment must be active and effective");
    }
    if (appointment.transactionCaseId && appointment.transactionCaseId !== caseId) {
      throw new BadRequestException("function appointment is scoped to another transaction case");
    }
    if (appointment.appointeeInstitutionId !== appointeeInstitutionId) {
      throw new BadRequestException("function appointment does not identify the declared performer institution");
    }
  }

  private async evidenceBundleDigest(caseId: string): Promise<string> {
    const evidence = await this.db.evidenceObject.findMany({
      where: { transactionCaseId: caseId }, orderBy: { id: "asc" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    return sha256Digest(evidence.map((item) => ({
      evidenceObjectId: item.id, status: item.status, currentVersion: item.currentVersion,
      versionId: item.versions[0]?.id ?? null, payloadDigest: item.versions[0]?.payloadDigest ?? null,
      validationStatus: item.versions[0]?.validationStatus ?? null, result: item.versions[0]?.result ?? null,
      expiresAt: item.versions[0]?.expiresAt?.toISOString() ?? null,
    })));
  }

  private async guardFacts(caseId: string, toStatus: CaseStatus, reason: string) {
    const now = new Date();
    const flags = inspectPersistenceFlags(process.env);
    const pr09Enabled = flags.externalActionSaga === "required" && flags.daReplay === "allow_list";
    const [parties, assignments, evidence, openConditions, approvedDecisions, saga, openSagaBreaks, incompleteSourceCompletions] = await Promise.all([
      this.db.caseParty.count({ where: { transactionCaseId: caseId, status: "ACTIVE" } }),
      this.db.caseFunctionAssignment.findMany({ where: {
        transactionCaseId: caseId,
        status: "ACTIVE",
        AND: [
          { OR: [{ effectiveAt: null }, { effectiveAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      } }),
      this.db.evidenceObject.findMany({ where: { transactionCaseId: caseId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } }),
      this.db.caseCondition.count({ where: { transactionCaseId: caseId, conditionKind: "PRECEDENT", status: "OPEN" } }),
      this.db.caseDecision.findMany({ where: { transactionCaseId: caseId, status: "APPROVED" } }),
      pr09Enabled
        ? this.db.settlementSaga.findFirst({
          where: { transactionCaseId: caseId }, orderBy: { sagaVersion: "desc" },
          include: { legs: { where: { required: true }, select: { state: true } } },
        })
        : Promise.resolve(null),
      pr09Enabled
        ? this.db.reconciliationBreak.count({ where: { transactionCaseId: caseId, status: { not: "RESOLVED" } } })
        : Promise.resolve(0),
      pr09Enabled
        ? this.db.sourceCompletion.count({ where: { transactionCaseId: caseId, reconciliationState: { not: "MATCHED" } } })
        : Promise.resolve(0),
    ]);
    const unavailable = evidence.filter((item) => {
      const latest = item.versions[0];
      return item.status !== "AVAILABLE" || !latest || latest.validationStatus !== "VALID" || Boolean(latest.expiresAt && latest.expiresAt <= now);
    }).length;
    const requiredLegs = saga?.legs ?? [];
    const externalSagaReady = Boolean(pr09Enabled && saga?.executionMode === "OBSERVE_ONLY"
      && ["READY", "EXECUTING", "OBSERVED", "RECONCILED"].includes(saga.state));
    const externalSagaObserved = Boolean(externalSagaReady && requiredLegs.length > 0
      && requiredLegs.every((leg) => ["OBSERVED", "RECONCILED"].includes(leg.state)) && openSagaBreaks === 0);
    return {
      activePartyCount: parties, functionAssignmentCount: assignments.length,
      prohibitedFunctionCount: assignments.filter((item) => item.performer === "PROHIBITED").length,
      evidenceCount: evidence.length, unavailableEvidenceCount: unavailable,
      openPrecedentConditionCount: openConditions,
      approvedCaseDecisionCount: approvedDecisions.filter((item) => item.decisionType === "CASE_APPROVAL").length,
      externalSagaReady, externalSagaObserved,
      completionReconciled: Boolean(externalSagaObserved && saga?.state === "RECONCILED"
        && openSagaBreaks === 0 && incompleteSourceCompletions === 0),
      cancellationApproved: approvedDecisions.some((item) => item.decisionType === "CASE_CANCELLATION"),
      blockReasonPresent: reason.length > 0,
      recoveryTarget: approvedDecisions.some((item) => item.decisionType === `CASE_RECOVERY:${toStatus}`) ? toStatus : null,
    };
  }

  private async exportCase(caseId: string): Promise<Record<string, unknown>> {
    return this.loadCase(caseId);
  }

  private async loadCase(caseId: string): Promise<Record<string, unknown>> {
    const item = await this.db.transactionCase.findUniqueOrThrow({
      where: { id: caseId },
      include: {
        versions: { orderBy: { version: "asc" } }, parties: { orderBy: { id: "asc" } },
        functionAssignments: { orderBy: { materialFunction: "asc" } }, conditions: { orderBy: { code: "asc" } },
        decisions: { orderBy: { id: "asc" }, include: { approvals: { orderBy: { id: "asc" } } } },
        transitions: { orderBy: { resultingVersion: "asc" } },
      },
    });
    return toCanonicalValue(JSON.parse(JSON.stringify(item))) as unknown as Record<string, unknown>;
  }
}
