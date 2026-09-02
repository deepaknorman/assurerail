import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import {
  ENTERPRISE_CONNECTOR_CLASSES,
  ENTERPRISE_INTEGRATION_BOUNDARY,
  type EnterpriseConnectorClass,
  deriveEnterpriseReadiness,
  gatesForConnectorClass,
} from "./enterprise-integration-policy";

export type EnterpriseActor = {
  actorUserId: string;
  actorSessionId: string;
  actingInstitutionId: string;
};
const DIRECTIONS = ["INBOUND", "OUTBOUND", "BIDIRECTIONAL"] as const;
const HEALTH = ["HEALTHY", "DEGRADED", "UNAVAILABLE", "UNKNOWN"] as const;
const ROUTE_SCOPE = ["DA", "PTC", "CONVENTIONAL", "TOKENISED"] as const;
const DATA_CLASSIFICATIONS = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "RESTRICTED",
] as const;
const json = (value: unknown) =>
  toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
function enabled() {
  if (inspectPersistenceFlags(process.env).enterpriseIntegration !== "shadow")
    throw new ForbiddenException("enterprise integration product is disabled");
}
function required(value: unknown, name: string, max = 500) {
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestException(`${name} is required`);
  const text = value.trim();
  if (text.length > max)
    throw new BadRequestException(`${name} exceeds ${max} characters`);
  return text;
}
function oneOf<T extends readonly string[]>(
  value: unknown,
  name: string,
  values: T
): T[number] {
  const text = required(value, name, 100);
  if (!values.includes(text as T[number]))
    throw new BadRequestException(
      `${name} must be one of ${values.join(", ")}`
    );
  return text as T[number];
}
function stringList(value: unknown, name: string, max = 50) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > max ||
    value.some((item) => typeof item !== "string" || !item.trim())
  )
    throw new BadRequestException(`${name} must contain 1 to ${max} strings`);
  return [...new Set(value.map((item) => String(item).trim()))].sort();
}
function digest(value: unknown, name: string) {
  const text = required(value, name, 80);
  if (!/^sha256:[a-f0-9]{64}$/.test(text))
    throw new BadRequestException(`${name} must be a lowercase sha256 digest`);
  return text;
}
function isoDate(value: unknown, name: string) {
  const parsed = new Date(required(value, name, 80));
  if (!Number.isFinite(parsed.getTime()))
    throw new BadRequestException(`${name} must be ISO-8601`);
  return parsed;
}
function boundedPolicy(value: unknown, name: string): Prisma.InputJsonValue {
  const canonical = toCanonicalValue(value ?? {});
  const walk = (item: unknown): void => {
    if (Array.isArray(item)) return item.forEach(walk);
    if (item && typeof item === "object")
      for (const [key, child] of Object.entries(item)) {
        if (
          /secret|password|credential|private.?key|access.?token|refresh.?token/i.test(
            key
          )
        )
          throw new BadRequestException(
            `${name} cannot contain secret or credential fields`
          );
        walk(child);
      }
  };
  walk(canonical);
  if (Buffer.byteLength(JSON.stringify(canonical), "utf8") > 16_384)
    throw new BadRequestException(`${name} exceeds 16384 bytes`);
  return canonical as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class EnterpriseIntegrationService {
  constructor(
    private readonly db: PrismaService,
    private readonly access: InstitutionAccessService,
    private readonly stepUp: StepUpService
  ) {}

  async catalogue(actor: EnterpriseActor) {
    enabled();
    await this.authorise(actor, "VIEW_INSTITUTION");
    return {
      version: "1.0.0",
      connectorClasses: ENTERPRISE_CONNECTOR_CLASSES.map((connectorClass) => ({
        connectorClass,
        gates: gatesForConnectorClass(connectorClass),
      })),
      boundary: ENTERPRISE_INTEGRATION_BOUNDARY,
    };
  }

  async listProfiles(actor: EnterpriseActor) {
    enabled();
    await this.authorise(actor, "VIEW_INSTITUTION");
    const profiles = await this.db.enterpriseIntegrationProfile.findMany({
      where: { institutionId: actor.actingInstitutionId },
      include: {
        connectorRegistration: {
          select: {
            connectorKey: true,
            displayName: true,
            transport: true,
            status: true,
          },
        },
        gates: {
          orderBy: { gateCode: "asc" },
          include: {
            evidenceObject: {
              include: {
                institution: { include: { admission: true } },
                versions: { orderBy: { version: "desc" }, take: 1 },
              },
            },
          },
        },
        healthObservations: { orderBy: { sequence: "desc" }, take: 1 },
        bindings: {
          select: {
            id: true,
            transactionCaseId: true,
            materialFunction: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return profiles.map((profile) => this.view(profile));
  }

  async proposeProfile(actor: EnterpriseActor, body: Record<string, unknown>) {
    enabled();
    const authority = await this.authorise(
      actor,
      "MANAGE_DEVELOPER_INTEGRATION"
    );
    const connectorRegistrationId = required(
      body.connectorRegistrationId,
      "connectorRegistrationId",
      160
    );
    const connectorClass = oneOf(
      body.connectorClass,
      "connectorClass",
      ENTERPRISE_CONNECTOR_CLASSES
    );
    const direction = oneOf(body.direction, "direction", DIRECTIONS);
    const materialFunctions = stringList(
      body.materialFunctions,
      "materialFunctions"
    );
    if (materialFunctions.some((item) => !/^[A-Z][A-Z0-9_]{1,119}$/.test(item)))
      throw new BadRequestException(
        "materialFunctions must use governed uppercase identifiers"
      );
    const routeScope = stringList(body.routeScope, "routeScope");
    if (
      routeScope.some((item) => !ROUTE_SCOPE.includes(item as never)) ||
      !routeScope.some((item) => ["DA", "PTC"].includes(item)) ||
      !routeScope.some((item) => ["CONVENTIONAL", "TOKENISED"].includes(item))
    )
      throw new BadRequestException(
        "routeScope must contain governed route and representation values"
      );
    const dataClassification = oneOf(
      body.dataClassification,
      "dataClassification",
      DATA_CLASSIFICATIONS
    );
    const serviceLevel = boundedPolicy(body.serviceLevel, "serviceLevel");
    const reconciliationPolicy = boundedPolicy(
      body.reconciliationPolicy,
      "reconciliationPolicy"
    );
    const authorityPolicy = boundedPolicy(
      body.authorityPolicy,
      "authorityPolicy"
    );
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 160);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const request = toCanonicalValue({
      connectorRegistrationId,
      connectorClass,
      direction,
      materialFunctions,
      routeScope,
      dataClassification,
      serviceLevel,
      reconciliationPolicy,
      authorityPolicy,
    });
    const requestDigest = sha256Digest(request);
    const existing = await this.db.enterpriseIntegrationProfile.findUnique({
      where: {
        institutionId_idempotencyKey: {
          institutionId: actor.actingInstitutionId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest)
        throw new ConflictException(
          "idempotency key was used for a different profile"
        );
      return this.profileResult(existing);
    }
    const connector = await this.db.connectorRegistration.findFirst({
      where: {
        id: connectorRegistrationId,
        institutionId: actor.actingInstitutionId,
        status: { notIn: ["SUSPENDED", "REVOKED"] },
      },
      include: {
        enterpriseIntegrationProfiles: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    if (!connector)
      throw new NotFoundException("eligible connector registration not found");
    const version =
      (connector.enterpriseIntegrationProfiles[0]?.version ?? 0) + 1;
    const profileDigest = sha256Digest({
      profileSchemaVersion: "1.0.0",
      profileRevision: version,
      ...(request as Record<string, unknown>),
    });
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "ENTERPRISE_PROFILE_PROPOSE",
          institutionId: actor.actingInstitutionId,
        },
        tx
      );
      return tx.enterpriseIntegrationProfile.create({
        data: {
          id: `eip_${randomUUID()}`,
          institutionId: actor.actingInstitutionId,
          connectorRegistrationId,
          version,
          connectorClass,
          direction,
          materialFunctions: json(materialFunctions),
          routeScope: json(routeScope),
          dataClassification,
          serviceLevel,
          reconciliationPolicy,
          authorityPolicy,
          status: "PROPOSED",
          profileDigest,
          idempotencyKey,
          requestDigest,
          proposedByUserId: actor.actorUserId,
          proposedByMandateId: authority.mandateId!,
          proposalStepUpId: stepUpEvidenceId,
          gates: {
            create: gatesForConnectorClass(connectorClass).map((gate) => ({
              id: `eig_${randomUUID()}`,
              gateCode: gate.code,
              gateKind: gate.kind,
              accountableParty: gate.accountableParty,
              qualifications: json([]),
            })),
          },
        },
        include: { gates: true },
      });
    });
    return this.profileResult(created);
  }

  async attachConformance(
    actor: EnterpriseActor,
    profileId: string,
    body: Record<string, unknown>
  ) {
    enabled();
    const authority = await this.authorise(actor, "OPERATE_CONNECTORS");
    const profile = await this.profile(actor, profileId);
    const developerConformanceRunId = required(
      body.developerConformanceRunId,
      "developerConformanceRunId",
      160
    );
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const run = await this.db.developerConformanceRun.findFirst({
      where: {
        id: developerConformanceRunId,
        institutionId: actor.actingInstitutionId,
        connectorRegistrationId: profile.connectorRegistrationId,
      },
    });
    if (!run || run.result !== "PASSED_SOFTWARE" || !run.sandboxNonEvidence)
      throw new ConflictException(
        "a passed software-only conformance run for this connector is required"
      );
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "ENTERPRISE_GATE_RECORD",
          institutionId: actor.actingInstitutionId,
        },
        tx
      );
      const changed = await tx.enterpriseIntegrationGate.updateMany({
        where: {
          enterpriseIntegrationProfileId: profileId,
          gateCode: "SOFTWARE_CONFORMANCE",
          status: "OPEN",
        },
        data: {
          status: "SOFTWARE_PASSED",
          developerConformanceRunId,
          evidenceDigest: run.resultDigest,
          sourceAsOfAt: run.createdAt,
          qualifications: json(["SOFTWARE_ONLY", "SANDBOX_NON_EVIDENCE"]),
          recordedByUserId: actor.actorUserId,
          recordedByMandateId: authority.mandateId!,
          stepUpEvidenceId,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "software conformance gate is already recorded; create a new profile version to replace evidence"
        );
      return tx.enterpriseIntegrationGate.findUniqueOrThrow({
        where: {
          enterpriseIntegrationProfileId_gateCode: {
            enterpriseIntegrationProfileId: profileId,
            gateCode: "SOFTWARE_CONFORMANCE",
          },
        },
      });
    });
    return this.gateResult(updated);
  }

  async attachExternalEvidence(
    actor: EnterpriseActor,
    profileId: string,
    gateCode: string,
    body: Record<string, unknown>
  ) {
    enabled();
    const authority = await this.authorise(
      actor,
      "MANAGE_DEVELOPER_INTEGRATION"
    );
    await this.profile(actor, profileId);
    const evidenceObjectId = required(
      body.evidenceObjectId,
      "evidenceObjectId",
      160
    );
    const evidenceDigest = digest(body.evidenceDigest, "evidenceDigest");
    const requestedExpiry = body.expiresAt
      ? isoDate(body.expiresAt, "expiresAt")
      : null;
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const gate = await this.db.enterpriseIntegrationGate.findUnique({
      where: {
        enterpriseIntegrationProfileId_gateCode: {
          enterpriseIntegrationProfileId: profileId,
          gateCode,
        },
      },
    });
    if (!gate || gate.gateKind !== "EXTERNAL_EVIDENCE")
      throw new NotFoundException("external evidence gate not found");
    const evidence = await this.db.evidenceObject.findFirst({
      where: {
        id: evidenceObjectId,
        institutionId: actor.actingInstitutionId,
        status: "AVAILABLE",
      },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    const version = evidence?.versions[0];
    const expectedType = `ENTERPRISE_INTEGRATION_${gateCode}`;
    const expectedPurpose = `ENTERPRISE_INTEGRATION_GATE:${profileId}:${gateCode}`;
    if (
      !evidence ||
      !version ||
      evidence.evidenceType !== expectedType ||
      evidence.purpose !== expectedPurpose ||
      evidence.currentVersion !== version.version ||
      version.payloadDigest !== evidenceDigest ||
      version.validationStatus !== "VALID" ||
      version.signatureStatus !== "VERIFIED" ||
      version.result !== "VERIFIED" ||
      (version.expiresAt && version.expiresAt <= new Date())
    )
      throw new ConflictException(
        "current signed, gate-scoped and verified evidence matching the supplied digest is required"
      );
    const expiresAt = requestedExpiry ?? version.expiresAt;
    if (
      !expiresAt ||
      expiresAt <= new Date() ||
      (version.expiresAt && expiresAt > version.expiresAt)
    )
      throw new BadRequestException(
        "a future gate expiry no later than evidence expiry is required"
      );
    const qualifications = stringList(
      body.qualifications ?? ["NONE"],
      "qualifications",
      50
    );
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "ENTERPRISE_GATE_RECORD",
          institutionId: actor.actingInstitutionId,
        },
        tx
      );
      const changed = await tx.enterpriseIntegrationGate.updateMany({
        where: { id: gate.id, status: "OPEN" },
        data: {
          status: "VERIFIED",
          evidenceObjectId,
          evidenceDigest,
          sourceAsOfAt: version.sourceAsOfAt,
          expiresAt,
          qualifications: json(qualifications),
          recordedByUserId: actor.actorUserId,
          recordedByMandateId: authority.mandateId!,
          stepUpEvidenceId,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          "external gate evidence is already recorded; create a new profile version to replace evidence"
        );
      return tx.enterpriseIntegrationGate.findUniqueOrThrow({
        where: { id: gate.id },
      });
    });
    return this.gateResult(updated);
  }

  async recordHealth(
    actor: EnterpriseActor,
    profileId: string,
    body: Record<string, unknown>
  ) {
    enabled();
    const authority = await this.authorise(actor, "OPERATE_CONNECTORS");
    const profile = await this.profile(actor, profileId);
    const observedStatus = oneOf(body.observedStatus, "observedStatus", HEALTH);
    const source = required(body.source, "source", 200);
    const sourceAsOfAt = isoDate(body.sourceAsOfAt, "sourceAsOfAt");
    const evidenceDigest = digest(body.evidenceDigest, "evidenceDigest");
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    if (sourceAsOfAt > new Date())
      throw new BadRequestException("sourceAsOfAt cannot be in the future");
    const existing =
      await this.db.enterpriseIntegrationHealthObservation.findFirst({
        where: { enterpriseIntegrationProfileId: profile.id, evidenceDigest },
      });
    if (existing) return this.healthResult(existing);
    const last = await this.db.enterpriseIntegrationHealthObservation.findFirst(
      {
        where: { enterpriseIntegrationProfileId: profile.id },
        orderBy: { sequence: "desc" },
      }
    );
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "ENTERPRISE_HEALTH_RECORD",
          institutionId: actor.actingInstitutionId,
        },
        tx
      );
      return tx.enterpriseIntegrationHealthObservation.create({
        data: {
          id: `eih_${randomUUID()}`,
          enterpriseIntegrationProfileId: profile.id,
          sequence: (last?.sequence ?? 0) + 1,
          observedStatus,
          source,
          sourceAsOfAt,
          evidenceDigest,
          detail: boundedPolicy(body.detail, "detail"),
          recordedByUserId: actor.actorUserId,
          recordedByMandateId: authority.mandateId!,
        },
      });
    });
    return this.healthResult(created);
  }

  async reviewProfile(
    actor: EnterpriseActor,
    profileId: string,
    body: Record<string, unknown>
  ) {
    enabled();
    await this.authorise(actor, "MANAGE_DEVELOPER_INTEGRATION");
    const profile = await this.profile(actor, profileId, true);
    if (profile.status !== "PROPOSED")
      throw new ConflictException("only a proposed profile can be reviewed");
    if (profile.proposedByUserId === actor.actorUserId)
      throw new ForbiddenException(
        "profile maker cannot review their own proposal"
      );
    const decision = oneOf(body.decision, "decision", [
      "APPROVE",
      "REJECT",
    ] as const);
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const readiness = this.profileReadiness(profile);
    if (decision === "APPROVE" && !readiness.shadowReady)
      throw new ConflictException(
        "all current external gates, software conformance and a healthy observation are required"
      );
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "ENTERPRISE_PROFILE_REVIEW",
          institutionId: actor.actingInstitutionId,
        },
        tx
      );
      const changed = await tx.enterpriseIntegrationProfile.updateMany({
        where: { id: profileId, status: "PROPOSED" },
        data: {
          status: decision === "APPROVE" ? "SHADOW_READY" : "REJECTED",
          reviewedByUserId: actor.actorUserId,
          reviewStepUpId: stepUpEvidenceId,
          reviewReason: reason,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("profile changed during review");
      return tx.enterpriseIntegrationProfile.findUniqueOrThrow({
        where: { id: profileId },
      });
    });
    return this.profileResult(updated);
  }

  async listCaseBindings(actor: EnterpriseActor, caseId: string) {
    enabled();
    await this.caseAccess(actor, caseId);
    const bindings = await this.db.enterpriseCaseIntegrationBinding.findMany({
      where: { transactionCaseId: caseId },
      include: {
        enterpriseIntegrationProfile: {
          include: {
            connectorRegistration: true,
            gates: {
              include: {
                evidenceObject: {
                  include: {
                    institution: { include: { admission: true } },
                    versions: { orderBy: { version: "desc" }, take: 1 },
                  },
                },
              },
            },
            healthObservations: { orderBy: { sequence: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return bindings.map((binding) => {
      const profileView = this.view(binding.enterpriseIntegrationProfile);
      const effectiveStatus =
        binding.status === "SHADOW_READY" && !profileView.readiness.shadowReady
          ? "SAFE_PAUSED"
          : binding.status;
      return {
        id: binding.id,
        transactionCaseId: binding.transactionCaseId,
        materialFunction: binding.materialFunction,
        performerInstitutionId: binding.performerInstitutionId,
        direction: binding.direction,
        authorityClass: binding.authorityClass,
        status: binding.status,
        effectiveStatus,
        reviewedAt: binding.reviewedAt,
        createdAt: binding.createdAt,
        enterpriseIntegrationProfile: profileView,
      };
    });
  }

  async proposeCaseBinding(
    actor: EnterpriseActor,
    caseId: string,
    body: Record<string, unknown>
  ) {
    enabled();
    const authority = await this.caseAccess(actor, caseId, "OPERATE_CASE");
    const enterpriseIntegrationProfileId = required(
      body.enterpriseIntegrationProfileId,
      "enterpriseIntegrationProfileId",
      160
    );
    const materialFunction = required(
      body.materialFunction,
      "materialFunction",
      160
    );
    const idempotencyKey = required(body.idempotencyKey, "idempotencyKey", 160);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const [caseItem, profile] = await Promise.all([
      this.db.transactionCase.findUnique({
        where: { id: caseId },
        include: { functionAssignments: true },
      }),
      this.db.enterpriseIntegrationProfile.findUnique({
        where: { id: enterpriseIntegrationProfileId },
        include: {
          connectorRegistration: true,
          gates: {
            include: {
              evidenceObject: {
                include: {
                  institution: { include: { admission: true } },
                  versions: { orderBy: { version: "desc" }, take: 1 },
                },
              },
            },
          },
          healthObservations: { orderBy: { sequence: "desc" }, take: 1 },
        },
      }),
    ]);
    if (!caseItem || !profile || profile.status !== "SHADOW_READY")
      throw new NotFoundException("shadow-ready profile or case not found");
    const routeScope = profile.routeScope as string[];
    const functions = profile.materialFunctions as string[];
    const assignment = caseItem.functionAssignments.find(
      (item) =>
        item.materialFunction === materialFunction && item.status === "ACTIVE"
    );
    if (
      !routeScope.includes(caseItem.transactionRoute) ||
      !routeScope.includes(caseItem.representation) ||
      !functions.includes(materialFunction) ||
      !assignment ||
      assignment.performerInstitutionId !== profile.institutionId
    )
      throw new ConflictException(
        "profile does not match the case route, representation and active function performer"
      );
    const readiness = this.profileReadiness(profile);
    if (!readiness.shadowReady)
      throw new ConflictException("profile readiness is no longer current");
    const request = {
      enterpriseIntegrationProfileId,
      materialFunction,
      performerInstitutionId: profile.institutionId,
      direction: profile.direction,
      authorityClass: assignment.performer,
    };
    const requestDigest = sha256Digest(request);
    const existing = await this.db.enterpriseCaseIntegrationBinding.findUnique({
      where: {
        transactionCaseId_idempotencyKey: {
          transactionCaseId: caseId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestDigest !== requestDigest)
        throw new ConflictException(
          "idempotency key was used for a different binding"
        );
      return this.bindingResult(existing);
    }
    const created = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "ENTERPRISE_BINDING_PROPOSE",
          institutionId: actor.actingInstitutionId,
        },
        tx
      );
      return tx.enterpriseCaseIntegrationBinding.create({
        data: {
          id: `eib_${randomUUID()}`,
          transactionCaseId: caseId,
          enterpriseIntegrationProfileId,
          materialFunction,
          performerInstitutionId: profile.institutionId,
          direction: profile.direction,
          authorityClass: assignment.performer,
          idempotencyKey,
          requestDigest,
          proposedByUserId: actor.actorUserId,
          proposedByMandateId: authority.mandateId!,
          proposalStepUpId: stepUpEvidenceId,
        },
      });
    });
    return this.bindingResult(created);
  }

  async reviewCaseBinding(
    actor: EnterpriseActor,
    caseId: string,
    bindingId: string,
    body: Record<string, unknown>
  ) {
    enabled();
    await this.caseAccess(actor, caseId, "OPERATE_CASE");
    const binding = await this.db.enterpriseCaseIntegrationBinding.findFirst({
      where: { id: bindingId, transactionCaseId: caseId },
      include: {
        enterpriseIntegrationProfile: {
          include: {
            connectorRegistration: true,
            gates: {
              include: {
                evidenceObject: {
                  include: {
                    institution: { include: { admission: true } },
                    versions: { orderBy: { version: "desc" }, take: 1 },
                  },
                },
              },
            },
            healthObservations: { orderBy: { sequence: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!binding)
      throw new NotFoundException("case integration binding not found");
    if (binding.status !== "PROPOSED")
      throw new ConflictException("only a proposed binding can be reviewed");
    if (binding.proposedByUserId === actor.actorUserId)
      throw new ForbiddenException(
        "binding maker cannot review their own proposal"
      );
    const decision = oneOf(body.decision, "decision", [
      "APPROVE",
      "REJECT",
    ] as const);
    const reason = required(body.reason, "reason", 1_000);
    const stepUpEvidenceId = required(
      body.stepUpEvidenceId,
      "stepUpEvidenceId",
      160
    );
    const readiness = this.profileReadiness(
      binding.enterpriseIntegrationProfile
    );
    if (
      decision === "APPROVE" &&
      (!readiness.shadowReady ||
        binding.enterpriseIntegrationProfile.status !== "SHADOW_READY")
    )
      throw new ConflictException("profile readiness is no longer current");
    const updated = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume(
        {
          evidenceId: stepUpEvidenceId,
          userId: actor.actorUserId,
          sessionId: actor.actorSessionId,
          purpose: "ENTERPRISE_BINDING_REVIEW",
          institutionId: actor.actingInstitutionId,
        },
        tx
      );
      const changed = await tx.enterpriseCaseIntegrationBinding.updateMany({
        where: { id: bindingId, status: "PROPOSED" },
        data: {
          status: decision === "APPROVE" ? "SHADOW_READY" : "REJECTED",
          reviewedByUserId: actor.actorUserId,
          reviewStepUpId: stepUpEvidenceId,
          reviewReason: reason,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("binding changed during review");
      return tx.enterpriseCaseIntegrationBinding.findUniqueOrThrow({
        where: { id: bindingId },
      });
    });
    return this.bindingResult(updated);
  }

  async evidencePack(actor: EnterpriseActor, profileId: string) {
    enabled();
    await this.authorise(actor, "VIEW_EVIDENCE");
    const profile = await this.profile(actor, profileId, true);
    const safe = {
      packVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
      boundary: ENTERPRISE_INTEGRATION_BOUNDARY,
      profile: this.view(profile),
      secretsExcluded: true,
    };
    const payload = toCanonicalValue(JSON.parse(JSON.stringify(safe)));
    return { payload, manifestDigest: sha256Digest(payload) };
  }

  private authorise(
    actor: EnterpriseActor,
    action: Parameters<InstitutionAccessService["requireHuman"]>[0]["action"]
  ) {
    return this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action,
    });
  }
  private async caseAccess(
    actor: EnterpriseActor,
    caseId: string,
    action: "VIEW_CASE" | "OPERATE_CASE" = "VIEW_CASE"
  ) {
    const item = await this.db.transactionCase.findFirst({
      where: {
        id: caseId,
        OR: [
          { ownerInstitutionId: actor.actingInstitutionId },
          {
            parties: {
              some: {
                institutionId: actor.actingInstitutionId,
                status: "ACTIVE",
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!item) throw new NotFoundException("transaction case not found");
    return this.access.requireHuman({
      userId: actor.actorUserId,
      institutionId: actor.actingInstitutionId,
      action,
      scopeType: "TRANSACTION_CASE",
      scopeRef: caseId,
    });
  }
  private async profile(
    actor: EnterpriseActor,
    id: string,
    full = false
  ): Promise<any> {
    const item = await this.db.enterpriseIntegrationProfile.findFirst({
      where: { id, institutionId: actor.actingInstitutionId },
      include: full
        ? {
            connectorRegistration: true,
            gates: {
              orderBy: { gateCode: "asc" },
              include: {
                evidenceObject: {
                  include: {
                    institution: { include: { admission: true } },
                    versions: { orderBy: { version: "desc" }, take: 1 },
                  },
                },
              },
            },
            healthObservations: { orderBy: { sequence: "desc" }, take: 1 },
            bindings: true,
          }
        : undefined,
    });
    if (!item)
      throw new NotFoundException("enterprise integration profile not found");
    return item;
  }
  private currentGates(gates: any[]) {
    const now = new Date();
    return gates.map((gate) => {
      if (gate.gateKind !== "EXTERNAL_EVIDENCE" || gate.status !== "VERIFIED")
        return gate;
      const object = gate.evidenceObject;
      const version = object?.versions?.[0];
      const admission = object?.institution?.admission;
      const current =
        object?.status === "AVAILABLE" &&
        object?.institution?.status === "ACTIVE" &&
        admission?.status === "ADMITTED" &&
        (!admission.effectiveAt || admission.effectiveAt <= now) &&
        (!admission.expiresAt || admission.expiresAt > now) &&
        version &&
        object.currentVersion === version.version &&
        version.validationStatus === "VALID" &&
        version.signatureStatus === "VERIFIED" &&
        version.result === "VERIFIED" &&
        version.payloadDigest === gate.evidenceDigest &&
        (!version.expiresAt || version.expiresAt > now);
      return current ? gate : { ...gate, status: "REVIEW_REQUIRED" };
    });
  }
  private profileReadiness(profile: any) {
    const observation = profile.healthObservations?.[0];
    const base = deriveEnterpriseReadiness(
      this.currentGates(profile.gates ?? []),
      observation?.observedStatus ?? null,
      new Date(),
      observation?.sourceAsOfAt
    );
    const connectorEligible =
      profile.connectorRegistration?.status === "CERTIFIED_SHADOW";
    return {
      ...base,
      connectorEligible,
      shadowReady: base.shadowReady && connectorEligible,
      safePaused: base.safePaused || !connectorEligible,
    };
  }
  private view(profile: any) {
    const current = this.currentGates(profile.gates ?? []);
    const gates = current.map((gate) => ({
      id: gate.id,
      gateCode: gate.gateCode,
      gateKind: gate.gateKind,
      status: gate.status,
      currentStatus: gate.status,
      accountableParty: gate.accountableParty,
      evidenceObjectId: gate.evidenceObjectId,
      evidenceDigest: gate.evidenceDigest,
      sourceAsOfAt: gate.sourceAsOfAt,
      expiresAt: gate.expiresAt,
      qualifications: gate.qualifications,
    }));
    const readiness = this.profileReadiness({ ...profile, gates });
    return {
      id: profile.id,
      institutionId: profile.institutionId,
      connectorRegistrationId: profile.connectorRegistrationId,
      version: profile.version,
      connectorClass: profile.connectorClass,
      direction: profile.direction,
      materialFunctions: profile.materialFunctions,
      routeScope: profile.routeScope,
      dataClassification: profile.dataClassification,
      serviceLevel: profile.serviceLevel,
      reconciliationPolicy: profile.reconciliationPolicy,
      authorityPolicy: profile.authorityPolicy,
      status: profile.status,
      profileDigest: profile.profileDigest,
      reviewedByUserId: profile.reviewedByUserId,
      reviewReason: profile.reviewReason,
      reviewedAt: profile.reviewedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      connectorRegistration: profile.connectorRegistration
        ? {
            id: profile.connectorRegistration.id,
            connectorKey: profile.connectorRegistration.connectorKey,
            displayName: profile.connectorRegistration.displayName,
            connectorType: profile.connectorRegistration.connectorType,
            transport: profile.connectorRegistration.transport,
            schemaProfiles: profile.connectorRegistration.schemaProfiles,
            status: profile.connectorRegistration.status,
          }
        : undefined,
      gates,
      healthObservations: (profile.healthObservations ?? []).map(
        (item: any) => ({
          id: item.id,
          sequence: item.sequence,
          observedStatus: item.observedStatus,
          source: item.source,
          sourceAsOfAt: item.sourceAsOfAt,
          evidenceDigest: item.evidenceDigest,
          detail: item.detail,
          createdAt: item.createdAt,
        })
      ),
      bindings: (profile.bindings ?? []).map((item: any) => ({
        id: item.id,
        transactionCaseId: item.transactionCaseId,
        materialFunction: item.materialFunction,
        performerInstitutionId: item.performerInstitutionId,
        direction: item.direction,
        authorityClass: item.authorityClass,
        status: item.status,
        reviewedAt: item.reviewedAt,
        createdAt: item.createdAt,
      })),
      readiness,
      boundary: ENTERPRISE_INTEGRATION_BOUNDARY,
    };
  }
  private profileResult(item: any) {
    return {
      id: item.id,
      institutionId: item.institutionId,
      connectorRegistrationId: item.connectorRegistrationId,
      version: item.version,
      connectorClass: item.connectorClass,
      direction: item.direction,
      status: item.status,
      profileDigest: item.profileDigest,
      gates: item.gates?.map((gate: any) => this.gateResult(gate)),
    };
  }
  private gateResult(item: any) {
    return {
      id: item.id,
      gateCode: item.gateCode,
      gateKind: item.gateKind,
      status: item.status,
      accountableParty: item.accountableParty,
      evidenceObjectId: item.evidenceObjectId,
      evidenceDigest: item.evidenceDigest,
      sourceAsOfAt: item.sourceAsOfAt,
      expiresAt: item.expiresAt,
      qualifications: item.qualifications,
    };
  }
  private healthResult(item: any) {
    return {
      id: item.id,
      enterpriseIntegrationProfileId: item.enterpriseIntegrationProfileId,
      sequence: item.sequence,
      observedStatus: item.observedStatus,
      source: item.source,
      sourceAsOfAt: item.sourceAsOfAt,
      evidenceDigest: item.evidenceDigest,
      detail: item.detail,
      createdAt: item.createdAt,
    };
  }
  private bindingResult(item: any) {
    return {
      id: item.id,
      transactionCaseId: item.transactionCaseId,
      enterpriseIntegrationProfileId: item.enterpriseIntegrationProfileId,
      materialFunction: item.materialFunction,
      performerInstitutionId: item.performerInstitutionId,
      direction: item.direction,
      authorityClass: item.authorityClass,
      status: item.status,
      reviewedAt: item.reviewedAt,
      createdAt: item.createdAt,
    };
  }
}
