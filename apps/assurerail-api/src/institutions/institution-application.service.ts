import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { audit } from "../common/audit";
import { assertSha256Digest, sha256Digest, toCanonicalValue } from "../contracts/v1";
import { PrismaService } from "../store/prisma.service";
import { evaluateInstitutionEvidence } from "./institution-policy";
import { InstitutionAccessService } from "./institution-access.service";
import { StepUpService } from "./step-up.service";

const EVIDENCE_RESULTS = [
  "VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "FAILED", "EXPIRED", "NOT_APPLICABLE", "REVIEW_REQUIRED",
] as const;
const EVIDENCE_SIGNATURE_STATUSES = ["VERIFIED", "PRESENT_UNVERIFIED", "NOT_PROVIDED", "INVALID"] as const;
const ADMISSION_DECISIONS = ["ADMIT", "REJECT", "SUSPEND", "REVOKE", "RECERTIFY", "REINSTATE"] as const;
const BOOTSTRAP_ACTIONS = [
  "VIEW_INSTITUTION", "ADMINISTER_MEMBERS", "PROPOSE_AUTHORITY", "APPROVE_AUTHORITY", "MANAGE_APPOINTMENTS",
] as const;

function required(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${name} exceeds ${max} characters`);
  return trimmed;
}

function email(value: unknown, name: string): string {
  const normalized = required(value, name, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new BadRequestException(`${name} must be an email address`);
  return normalized;
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value ?? {}) as unknown as Prisma.InputJsonValue;
}

function date(value: unknown, name: string): Date {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${name} is required`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${name} must be an ISO-8601 timestamp`);
  return parsed;
}

function optionalDate(value: unknown, name: string): Date | null {
  return value === undefined || value === null || value === "" ? null : date(value, name);
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new BadRequestException(`${name} must be an array of non-empty strings`);
  }
  return [...new Set(value.map((entry) => entry.trim()))];
}

function requiredObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value as Record<string, unknown>).length === 0) {
    throw new BadRequestException(`${name} must be a non-empty object`);
  }
  return value as Record<string, unknown>;
}

function plainObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function uniqueConstraint(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

@Injectable()
export class InstitutionApplicationService {
  constructor(
    private readonly db: PrismaService,
    private readonly stepUp: StepUpService,
    private readonly access: InstitutionAccessService,
  ) {}

  async listForUser(userId: string) {
    return this.db.institutionMember.findMany({
      where: { userId },
      select: {
        id: true,
        membershipRole: true,
        status: true,
        effectiveAt: true,
        expiresAt: true,
        institution: {
          select: {
            id: true,
            legalName: true,
            institutionKind: true,
            jurisdiction: true,
            status: true,
            admission: { select: { status: true, effectiveAt: true, expiresAt: true, reviewDueAt: true } },
          },
        },
        mandates: {
          where: { status: "ACTIVE" },
          select: { id: true, action: true, scopeType: true, scopeRef: true, effectiveAt: true, expiresAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getWorkspaceForUser(userId: string, institutionId: string, activeInstitutionId?: string | null) {
    const membership = await this.db.institutionMember.findUnique({
      where: { institutionId_userId: { institutionId, userId } },
      include: { institution: { include: { admission: true } } },
    });
    if (!membership) throw new NotFoundException("institution workspace not found");

    const preAdmission = ["PENDING_ADMISSION", "INVITED"].includes(membership.status)
      && ["APPLICANT", "ADMIN"].includes(membership.membershipRole);
    if (preAdmission) return this.preAdmissionWorkspace(userId, institutionId, membership.id);
    if (activeInstitutionId !== institutionId) {
      throw new ForbiddenException("institution workspace requires the matching active session context");
    }

    const view = await this.access.evaluateHuman({
      userId,
      institutionId,
      action: "VIEW_INSTITUTION",
    });
    if (!view.allowed) throw new ForbiddenException(`institution workspace denied: ${view.code}`);

    const [adminMembers, proposeAuthority, approveAuthority, manageAppointments] = await Promise.all([
      this.access.evaluateHuman({ userId, institutionId, action: "ADMINISTER_MEMBERS" }),
      this.access.evaluateHuman({ userId, institutionId, action: "PROPOSE_AUTHORITY" }),
      this.access.evaluateHuman({ userId, institutionId, action: "APPROVE_AUTHORITY" }),
      this.access.evaluateHuman({ userId, institutionId, action: "MANAGE_APPOINTMENTS" }),
    ]);
    const privileged = adminMembers.allowed || proposeAuthority.allowed || approveAuthority.allowed || manageAppointments.allowed;
    const institution = await this.db.institution.findUniqueOrThrow({
      where: { id: institutionId },
      select: {
        id: true,
        legalName: true,
        institutionKind: true,
        jurisdiction: true,
        legalIdentifiers: true,
        status: true,
        suspensionReason: true,
        suspendedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        admission: {
          select: {
            id: true,
            status: true,
            termsVersion: true,
            rulebookVersion: true,
            riskClass: true,
            reviewDueAt: true,
            effectiveAt: true,
            expiresAt: true,
            decisionReason: true,
            decisions: privileged ? {
              orderBy: { proposedAt: "desc" },
              select: {
                id: true, decisionType: true, status: true, reason: true, proposedAt: true,
                reviewedAt: true, reviewNote: true, proposedByUserId: true, reviewedByUserId: true,
              },
            } : false,
          },
        },
        evidenceSnapshots: {
          orderBy: { sourceAsOfAt: "desc" },
          select: {
            id: true, providerReferenceId: true, providerInstitutionRef: true, evidenceType: true,
            schemaId: true, schemaVersion: true, payloadDigest: true, signatureStatus: true,
            result: true, verificationMethod: true, independenceClass: true,
            crossCheckExpected: true, crossCheckAchieved: true, qualifications: true,
            sourceAsOfAt: true, expiresAt: true, supersedesSnapshotId: true, createdAt: true,
          },
        },
        members: {
          where: privileged ? undefined : { userId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true, userId: true, invitedEmail: true, membershipRole: true, status: true,
            effectiveAt: true, expiresAt: true, recertificationDueAt: true, suspendedAt: true,
            revokedAt: true, revocationReason: true,
            mandates: {
              orderBy: [{ action: "asc" }, { version: "desc" }],
              select: {
                id: true, action: true, scopeType: true, scopeRef: true, limits: true,
                conditions: true, delegationBasis: true, authorityEvidenceRef: true, status: true,
                version: true, supersedesMandateId: true, proposedByUserId: true,
                approvedByUserId: true, approvalReason: true, effectiveAt: true, expiresAt: true,
              },
            },
          },
        },
        appointments: manageAppointments.allowed ? {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, institutionId: true, transactionCaseId: true, appointmentRole: true, appointeeInstitutionId: true,
            appointeeProviderRef: true, scope: true, conflictDisclosure: true, status: true,
            proposedByUserId: true, acceptedByUserId: true, effectiveAt: true, expiresAt: true,
          },
        } : false,
        routeEntitlements: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, transactionRoute: true, representation: true, assetClass: true,
            lifecycleLeg: true, materialFunction: true, functionPerformer: true, routePackRef: true,
            permissionEvidenceRef: true, operatingModes: true, limits: true, conditions: true,
            status: true, proposedByUserId: true, approvedByUserId: true, approvalReason: true,
            effectiveAt: true, expiresAt: true,
          },
        },
        changeProposals: privileged ? {
          where: { status: "PENDING" },
          orderBy: { proposedAt: "asc" },
          select: {
            id: true, targetType: true, targetId: true, changeType: true, fromStatus: true,
            reason: true, status: true, proposedByUserId: true, proposedAt: true,
          },
        } : false,
      },
    });
    const incomingAppointments = manageAppointments.allowed ? await this.db.appointment.findMany({
      where: { appointeeInstitutionId: institutionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, institutionId: true, transactionCaseId: true, appointmentRole: true,
        appointeeInstitutionId: true, appointeeProviderRef: true, scope: true,
        conflictDisclosure: true, status: true, proposedByUserId: true,
        acceptedByUserId: true, effectiveAt: true, expiresAt: true,
      },
    }) : [];
    const appointments = manageAppointments.allowed
      ? [...institution.appointments, ...incomingAppointments.filter((incoming) => !institution.appointments.some((owned) => owned.id === incoming.id))]
        .map((appointment) => ({
          ...appointment,
          direction: appointment.institutionId === institutionId ? "OUTGOING" : "INCOMING",
        }))
      : [];
    const connectors = await this.db.connectorRegistration.groupBy({
      by: ["status"],
      where: { institutionId },
      _count: { _all: true },
    });
    const connectorCount = connectors.reduce((sum, entry) => sum + entry._count._all, 0);
    const certifiedCount = connectors.find((entry) => entry.status === "CERTIFIED_SHADOW")?._count._all ?? 0;
    return {
      accessLevel: privileged ? "GOVERNANCE" : "SELF",
      capabilities: {
        view: true,
        administerMembers: adminMembers.allowed,
        proposeAuthority: proposeAuthority.allowed,
        approveAuthority: approveAuthority.allowed,
        manageAppointments: manageAppointments.allowed,
        proposeRouteEntitlement: proposeAuthority.allowed,
      },
      evidenceGaps: this.evidenceGaps(institution.evidenceSnapshots, institution.admission?.status ?? null),
      connectorReadiness: {
        status: certifiedCount > 0 ? "CERTIFIED_SHADOW" : connectorCount > 0 ? "PENDING_CERTIFICATION" : "NOT_REGISTERED",
        grantsAuthority: false,
        message: certifiedCount > 0
          ? `${certifiedCount} of ${connectorCount} connector registrations have a current replay/shadow certification.`
          : connectorCount > 0
            ? `${connectorCount} connector registrations exist; none has a current replay/shadow certification.`
            : "No provider-neutral connector is registered for this institution.",
      },
      institution: { ...institution, appointments },
    };
  }

  async listAdminWorkQueue(actorUserId: string) {
    await this.requirePlatformAdmin(actorUserId);
    const institutions = await this.db.institution.findMany({
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true, legalName: true, institutionKind: true, jurisdiction: true, status: true,
        createdAt: true, updatedAt: true,
        admission: {
          select: {
            id: true, status: true, riskClass: true, reviewDueAt: true, effectiveAt: true,
            expiresAt: true,
            decisions: {
              where: { status: "PENDING" },
              orderBy: { proposedAt: "asc" },
              select: { id: true, decisionType: true, reason: true, proposedByUserId: true, proposedAt: true },
            },
          },
        },
        _count: { select: { evidenceSnapshots: true, members: true, routeEntitlements: true } },
        routeEntitlements: {
          where: { status: "PROPOSED" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true, transactionRoute: true, representation: true, assetClass: true,
            materialFunction: true, functionPerformer: true, operatingModes: true,
            proposedByUserId: true, createdAt: true,
          },
        },
      },
    });
    return {
      institutions,
      counts: {
        applications: institutions.filter((entry) => ["APPLIED", "UNDER_REVIEW"].includes(entry.admission?.status ?? "")).length,
        admissionReviews: institutions.reduce((sum, entry) => sum + (entry.admission?.decisions.length ?? 0), 0),
        routeReviews: institutions.reduce((sum, entry) => sum + entry.routeEntitlements.length, 0),
      },
    };
  }

  async getAdminWorkspace(actorUserId: string, institutionId: string) {
    await this.requirePlatformAdmin(actorUserId);
    const institution = await this.db.institution.findUnique({
      where: { id: institutionId },
      include: {
        admission: { include: { decisions: { orderBy: { proposedAt: "desc" } } } },
        evidenceSnapshots: { orderBy: { sourceAsOfAt: "desc" } },
        members: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true, userId: true, invitedEmail: true, membershipRole: true, status: true,
            acceptedAt: true, effectiveAt: true, expiresAt: true, recertificationDueAt: true,
          },
        },
        routeEntitlements: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { createdAt: "desc" } },
        changeProposals: { where: { status: "PENDING" }, orderBy: { proposedAt: "asc" } },
      },
    });
    if (!institution) throw new NotFoundException("institution not found");
    return {
      institution,
      evidenceGaps: this.evidenceGaps(institution.evidenceSnapshots, institution.admission?.status ?? null),
      operatorBoundary: {
        mayReviewAdmission: true,
        mayReviewRouteEntitlement: true,
        mayActForInstitution: false,
        supportImpersonationAvailable: false,
      },
    };
  }

  private async preAdmissionWorkspace(userId: string, institutionId: string, membershipId: string) {
    const institution = await this.db.institution.findUniqueOrThrow({
      where: { id: institutionId },
      select: {
        id: true, legalName: true, institutionKind: true, jurisdiction: true, status: true,
        createdAt: true, updatedAt: true,
        admission: {
          select: {
            status: true, termsVersion: true, rulebookVersion: true, reviewDueAt: true,
            effectiveAt: true, expiresAt: true, decisionReason: true,
          },
        },
        evidenceSnapshots: {
          orderBy: { sourceAsOfAt: "desc" },
          select: {
            id: true, providerReferenceId: true, providerInstitutionRef: true, evidenceType: true,
            schemaId: true, schemaVersion: true, payloadDigest: true, signatureStatus: true,
            result: true, verificationMethod: true, independenceClass: true,
            crossCheckExpected: true, crossCheckAchieved: true, qualifications: true,
            sourceAsOfAt: true, expiresAt: true, supersedesSnapshotId: true, createdAt: true,
          },
        },
        members: {
          where: { OR: [{ id: membershipId }, { membershipRole: { in: ["APPLICANT", "ADMIN"] } }] },
          orderBy: { createdAt: "asc" },
          select: {
            id: true, userId: true, invitedEmail: true, membershipRole: true, status: true,
            acceptedAt: true, expiresAt: true,
          },
        },
      },
    });
    return {
      accessLevel: "APPLICATION",
      capabilities: {
        view: true,
        administerMembers: false,
        proposeAuthority: false,
        approveAuthority: false,
        manageAppointments: false,
        proposeRouteEntitlement: false,
      },
      evidenceGaps: this.evidenceGaps(institution.evidenceSnapshots, institution.admission?.status ?? null),
      connectorReadiness: {
        status: "NOT_AVAILABLE_PRE_ADMISSION",
        grantsAuthority: false,
        message: "Connector setup does not begin before participant admission.",
      },
      viewer: { userId, membershipId },
      institution: { ...institution, appointments: [], routeEntitlements: [], changeProposals: [] },
    };
  }

  private evidenceGaps(
    evidence: readonly {
      result: string;
      signatureStatus: string;
      expiresAt: Date;
      crossCheckExpected: Prisma.JsonValue;
      crossCheckAchieved: Prisma.JsonValue;
    }[],
    admissionStatus: string | null,
  ) {
    const acceptable = evidence.filter((snapshot) => evaluateInstitutionEvidence({
      now: new Date(),
      result: snapshot.result,
      signatureStatus: snapshot.signatureStatus,
      expiresAt: snapshot.expiresAt,
      crossCheckExpected: snapshot.crossCheckExpected,
      crossCheckAchieved: snapshot.crossCheckAchieved,
    }).allowed);
    return [
      ...(evidence.length === 0 ? [{ code: "NO_EVIDENCE", message: "No institution evidence snapshot is recorded." }] : []),
      ...(evidence.length > 0 && acceptable.length === 0
        ? [{ code: "NO_CURRENT_VERIFIED_EVIDENCE", message: "No retained evidence currently passes signature, result, cross-check and expiry policy." }]
        : []),
      ...(!["ADMITTED", "SUSPENDED"].includes(admissionStatus ?? "")
        ? [{ code: "NOT_ADMITTED", message: "Participant admission has not become effective." }]
        : []),
    ];
  }

  async apply(actorUserId: string, body: {
    legalName?: string;
    institutionKind?: string;
    jurisdiction?: string;
    legalIdentifiers?: unknown;
    termsVersion?: string;
    rulebookVersion?: string;
    initialAdminEmails?: unknown;
  }) {
    const applicant = await this.db.venueUser.findUnique({ where: { id: actorUserId } });
    if (!applicant?.identityVerifiedAt || !applicant.did) {
      throw new ForbiddenException("identity binding must be completed before an institution application");
    }
    const legalName = required(body.legalName, "legalName");
    const institutionKind = required(body.institutionKind, "institutionKind", 80);
    const jurisdiction = required(body.jurisdiction, "jurisdiction", 80);
    const termsVersion = required(body.termsVersion, "termsVersion", 80);
    const rulebookVersion = required(body.rulebookVersion, "rulebookVersion", 80);
    const initialAdminEmails = stringArray(body.initialAdminEmails ?? [], "initialAdminEmails").map((value) => email(value, "initialAdminEmails[]"));
    if (initialAdminEmails.length > 5) throw new BadRequestException("at most five initial administrators may be proposed");
    const allAdminEmails = [...new Set([applicant.email.toLowerCase(), ...initialAdminEmails])].sort();
    if (allAdminEmails.length < 2) {
      throw new BadRequestException("at least one additional initial administrator is required for two-person governance");
    }
    const legalIdentifiers = json(requiredObject(body.legalIdentifiers, "legalIdentifiers"));
    const applicationDigest = sha256Digest({
      legalName,
      institutionKind,
      jurisdiction,
      legalIdentifiers,
      termsVersion,
      rulebookVersion,
      initialAdminEmails: allAdminEmails,
      applicantUserId: actorUserId,
    });

    const result = await this.db.$transaction(async (tx) => {
      const existing = await tx.institutionMember.findFirst({
        where: { userId: actorUserId, membershipRole: "APPLICANT", status: { in: ["PENDING_ADMISSION", "ACTIVE"] } },
      });
      if (existing) throw new ConflictException("user already has an active institution application");

      const users = [];
      for (const adminEmail of allAdminEmails) {
        const existingUser = await tx.venueUser.findUnique({ where: { email: adminEmail } });
        users.push(existingUser ?? await tx.venueUser.create({
          data: {
            id: `vu_${randomUUID()}`,
            email: adminEmail,
            role: "INVESTOR",
            status: "PENDING",
            allowlisted: false,
          },
        }));
      }
      const institution = await tx.institution.create({
        data: {
          id: `inst_${randomUUID()}`,
          legalName,
          institutionKind,
          jurisdiction,
          legalIdentifiers,
          applicantUserId: actorUserId,
          admission: {
            create: {
              id: `padm_${randomUUID()}`,
              termsVersion,
              rulebookVersion,
              applicationDigest,
            },
          },
        },
      });
      for (const user of users) {
        await tx.institutionMember.create({
          data: {
            id: `imem_${randomUUID()}`,
            institutionId: institution.id,
            userId: user.id,
            invitedEmail: user.email,
            membershipRole: user.id === actorUserId ? "APPLICANT" : "ADMIN",
            status: "PENDING_ADMISSION",
            invitedByUserId: actorUserId,
            invitationDigest: sha256Digest({ institutionId: institution.id, userId: user.id, applicationDigest }),
            acceptedAt: user.id === actorUserId ? new Date() : null,
          },
        });
      }
      return institution;
    });
    audit("institution.application.created", { actorUserId, institutionId: result.id, applicationDigest });
    return { institutionId: result.id, status: result.status, applicationDigest };
  }

  async recordEvidence(actorUserId: string, institutionId: string, body: {
    providerReferenceId?: string | null;
    providerInstitutionRef?: string;
    evidenceType?: string;
    schemaId?: string;
    schemaVersion?: string;
    payloadDigest?: string;
    signatureStatus?: string;
    result?: string;
    verificationMethod?: string;
    independenceClass?: string;
    assertions?: unknown;
    crossCheckExpected?: unknown;
    crossCheckAchieved?: unknown;
    qualifications?: unknown;
    sourceAsOfAt?: string;
    expiresAt?: string;
    supersedesSnapshotId?: string | null;
    storageRef?: string | null;
  }) {
    await this.requirePlatformAdmin(actorUserId);
    const institution = await this.db.institution.findUnique({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException("institution not found");
    const providerReferenceId = body.providerReferenceId ? required(body.providerReferenceId, "providerReferenceId", 160) : null;
    if (providerReferenceId) {
      const provider = await this.db.providerReference.findUnique({ where: { id: providerReferenceId } });
      if (!provider || provider.status !== "ACTIVE") throw new BadRequestException("providerReferenceId must identify an active registered provider");
    }
    const supersedesSnapshotId = body.supersedesSnapshotId ? required(body.supersedesSnapshotId, "supersedesSnapshotId", 160) : null;
    const previous = supersedesSnapshotId
      ? await this.db.institutionEvidenceSnapshot.findUnique({ where: { id: supersedesSnapshotId } })
      : null;
    if (supersedesSnapshotId && (!previous || previous.institutionId !== institutionId)) {
      throw new BadRequestException("supersedesSnapshotId must identify evidence for this institution");
    }
    const payloadDigest = assertSha256Digest(required(body.payloadDigest, "payloadDigest"), "payloadDigest");
    const result = required(body.result, "result", 40);
    if (!(EVIDENCE_RESULTS as readonly string[]).includes(result)) {
      throw new BadRequestException(`result must be one of: ${EVIDENCE_RESULTS.join(", ")}`);
    }
    const signatureStatus = required(body.signatureStatus, "signatureStatus", 40);
    if (!(EVIDENCE_SIGNATURE_STATUSES as readonly string[]).includes(signatureStatus)) {
      throw new BadRequestException(`signatureStatus must be one of: ${EVIDENCE_SIGNATURE_STATUSES.join(", ")}`);
    }
    const sourceAsOfAt = date(body.sourceAsOfAt, "sourceAsOfAt");
    const expiresAt = date(body.expiresAt, "expiresAt");
    if (expiresAt <= sourceAsOfAt) throw new BadRequestException("expiresAt must be after sourceAsOfAt");
    if (sourceAsOfAt.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException("sourceAsOfAt cannot be materially in the future");
    const evidenceType = required(body.evidenceType, "evidenceType", 120);
    if (previous && (previous.evidenceType !== evidenceType || previous.providerReferenceId !== providerReferenceId)) {
      throw new BadRequestException("superseded evidence must have the same evidence type and provider reference");
    }
    const crossCheckExpected = stringArray(body.crossCheckExpected ?? [], "crossCheckExpected");
    const crossCheckAchieved = plainObject(body.crossCheckAchieved ?? {}, "crossCheckAchieved");

    let snapshot;
    try {
      snapshot = await this.db.institutionEvidenceSnapshot.create({
        data: {
          id: `ies_${randomUUID()}`,
          institutionId,
          providerReferenceId,
          providerInstitutionRef: required(body.providerInstitutionRef, "providerInstitutionRef"),
          evidenceType,
          schemaId: required(body.schemaId, "schemaId", 160),
          schemaVersion: required(body.schemaVersion, "schemaVersion", 80),
          payloadDigest,
          signatureStatus,
          result,
          verificationMethod: required(body.verificationMethod, "verificationMethod", 200),
          independenceClass: required(body.independenceClass, "independenceClass", 80),
          assertions: json(body.assertions ?? {}),
          crossCheckExpected: json(crossCheckExpected),
          crossCheckAchieved: json(crossCheckAchieved),
          qualifications: json(body.qualifications ?? {}),
          sourceAsOfAt,
          expiresAt,
          supersedesSnapshotId,
          storageRef: body.storageRef || null,
          createdByUserId: actorUserId,
        },
      });
    } catch (error) {
      if (uniqueConstraint(error)) throw new ConflictException("this evidence payload is already recorded for the institution");
      throw error;
    }
    const policy = evaluateInstitutionEvidence({
      now: new Date(),
      result: snapshot.result,
      signatureStatus: snapshot.signatureStatus,
      expiresAt: snapshot.expiresAt,
      crossCheckExpected: snapshot.crossCheckExpected,
      crossCheckAchieved: snapshot.crossCheckAchieved,
    });
    audit("institution.evidence.recorded", { actorUserId, institutionId, snapshotId: snapshot.id, policy: policy.code });
    return { snapshot, admissionEligible: policy };
  }

  async proposeDecision(actorUserId: string, institutionId: string, body: {
    decisionType?: string;
    reason?: string;
    evidenceSnapshotIds?: unknown;
    riskClass?: string | null;
    expiresAt?: string | null;
    reviewDueAt?: string | null;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    await this.requirePlatformAdmin(actorUserId);
    const decisionType = required(body.decisionType, "decisionType", 40);
    if (!(ADMISSION_DECISIONS as readonly string[]).includes(decisionType)) {
      throw new BadRequestException(`decisionType must be one of: ${ADMISSION_DECISIONS.join(", ")}`);
    }
    const evidenceSnapshotIds = stringArray(body.evidenceSnapshotIds ?? [], "evidenceSnapshotIds");
    const admission = await this.db.participantAdmission.findUnique({ where: { institutionId } });
    if (!admission) throw new NotFoundException("participant admission not found");
    const allowedFrom: Readonly<Record<string, readonly string[]>> = {
      ADMIT: ["APPLIED"],
      REJECT: ["APPLIED"],
      SUSPEND: ["ADMITTED"],
      REVOKE: ["ADMITTED", "SUSPENDED"],
      RECERTIFY: ["ADMITTED"],
      REINSTATE: ["SUSPENDED"],
    };
    if (!allowedFrom[decisionType]?.includes(admission.status)) {
      throw new ConflictException(`${decisionType} is not allowed from admission status ${admission.status}`);
    }
    const evidence = await this.db.institutionEvidenceSnapshot.findMany({ where: { id: { in: evidenceSnapshotIds }, institutionId } });
    if (evidence.length !== evidenceSnapshotIds.length) throw new BadRequestException("every evidence snapshot must belong to the institution");
    if (["ADMIT", "RECERTIFY", "REINSTATE"].includes(decisionType)) {
      if (evidence.length === 0) throw new BadRequestException(`${decisionType} requires at least one evidence snapshot`);
      const failures = evidence.map((snapshot) => ({
        id: snapshot.id,
        result: evaluateInstitutionEvidence({
          now: new Date(),
          result: snapshot.result,
          signatureStatus: snapshot.signatureStatus,
          expiresAt: snapshot.expiresAt,
          crossCheckExpected: snapshot.crossCheckExpected,
          crossCheckAchieved: snapshot.crossCheckAchieved,
        }),
      })).filter((entry) => !entry.result.allowed);
      if (failures.length) throw new BadRequestException(`admission evidence is not acceptable: ${failures.map((f) => `${f.id}:${f.result.code}`).join(", ")}`);
    }
    const proposal = {
      institutionId,
      admissionId: admission.id,
      decisionType,
      reason: required(body.reason, "reason", 1_000),
      evidenceSnapshotIds: [...evidenceSnapshotIds].sort(),
      riskClass: body.riskClass ? required(body.riskClass, "riskClass", 80) : null,
      expiresAt: optionalDate(body.expiresAt, "expiresAt")?.toISOString() ?? null,
      reviewDueAt: optionalDate(body.reviewDueAt, "reviewDueAt")?.toISOString() ?? null,
    };
    if (proposal.expiresAt && new Date(proposal.expiresAt) <= new Date()) {
      throw new BadRequestException("expiresAt must be in the future");
    }
    if (proposal.reviewDueAt && new Date(proposal.reviewDueAt) <= new Date()) {
      throw new BadRequestException("reviewDueAt must be in the future");
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    let decision;
    try {
      decision = await this.db.$transaction(async (tx) => {
        await this.stepUp.consume({
          evidenceId: stepUpEvidenceId,
          userId: actorUserId,
          sessionId: actorSessionId,
          purpose: "PARTICIPANT_ADMISSION_PROPOSE",
          institutionId,
        }, tx);
        return tx.participantAdmissionDecision.create({
          data: {
            id: `padmd_${randomUUID()}`,
            participantAdmissionId: admission.id,
            decisionType,
            fromAdmissionStatus: admission.status,
            reason: proposal.reason,
            evidenceSnapshotIds: json(proposal.evidenceSnapshotIds),
            proposedRiskClass: proposal.riskClass,
            proposedExpiresAt: proposal.expiresAt ? new Date(proposal.expiresAt) : null,
            proposedReviewDueAt: proposal.reviewDueAt ? new Date(proposal.reviewDueAt) : null,
            proposalDigest: sha256Digest(proposal),
            proposedByUserId: actorUserId,
            proposalStepUpId: stepUpEvidenceId,
          },
        });
      });
    } catch (error) {
      if (uniqueConstraint(error)) throw new ConflictException("an admission decision is already pending for this participant");
      throw error;
    }
    audit("institution.admission.decision_proposed", { actorUserId, institutionId, decisionId: decision.id, decisionType });
    return decision;
  }

  async reviewDecision(actorUserId: string, decisionId: string, body: {
    approve?: boolean;
    reviewNote?: string;
    stepUpEvidenceId?: string;
  }, actorSessionId: string) {
    const current = await this.db.participantAdmissionDecision.findUnique({
      where: { id: decisionId },
      include: { participantAdmission: { include: { institution: true } } },
    });
    if (!current) throw new NotFoundException("admission decision not found");
    if (current.status !== "PENDING") throw new ConflictException("admission decision is already terminal");
    if (current.proposedByUserId === actorUserId) throw new ForbiddenException("maker cannot review their own admission decision");
    await this.requirePlatformAdmin(actorUserId);
    const institutionId = current.participantAdmission.institutionId;
    const approve = body.approve === true;
    if (approve && ["ADMIT", "RECERTIFY", "REINSTATE"].includes(current.decisionType)) {
      const evidenceIds = Array.isArray(current.evidenceSnapshotIds)
        ? current.evidenceSnapshotIds.filter((value): value is string => typeof value === "string")
        : [];
      const evidence = await this.db.institutionEvidenceSnapshot.findMany({
        where: { id: { in: evidenceIds }, institutionId },
      });
      const failures = evidence.length !== evidenceIds.length ? ["MISSING_EVIDENCE"] : evidence.flatMap((snapshot) => {
        const result = evaluateInstitutionEvidence({
          now: new Date(),
          result: snapshot.result,
          signatureStatus: snapshot.signatureStatus,
          expiresAt: snapshot.expiresAt,
          crossCheckExpected: snapshot.crossCheckExpected,
          crossCheckAchieved: snapshot.crossCheckAchieved,
        });
        return result.allowed ? [] : [`${snapshot.id}:${result.code}`];
      });
      if (failures.length > 0) throw new BadRequestException(`admission evidence is no longer acceptable: ${failures.join(", ")}`);
    }
    const stepUpEvidenceId = required(body.stepUpEvidenceId, "stepUpEvidenceId", 160);
    const now = new Date();

    const reviewed = await this.db.$transaction(async (tx) => {
      await this.stepUp.consume({
        evidenceId: stepUpEvidenceId,
        userId: actorUserId,
        sessionId: actorSessionId,
        purpose: "PARTICIPANT_ADMISSION_REVIEW",
        institutionId,
      }, tx);
      const claimed = await tx.participantAdmissionDecision.updateMany({
        where: { id: decisionId, status: "PENDING", reviewedByUserId: null },
        data: {
          status: approve ? "APPROVED" : "REJECTED",
          reviewedByUserId: actorUserId,
          reviewStepUpId: stepUpEvidenceId,
          reviewNote: required(body.reviewNote, "reviewNote", 1_000),
          reviewedAt: now,
          appliedAt: approve ? now : null,
        },
      });
      if (claimed.count !== 1) throw new ConflictException("admission decision was concurrently reviewed");
      if (approve) await this.applyDecision(tx, {
        ...current,
        reviewedByUserId: actorUserId,
        reviewStepUpId: stepUpEvidenceId,
      }, now);
      return tx.participantAdmissionDecision.findUniqueOrThrow({ where: { id: decisionId } });
    });
    audit("institution.admission.decision_reviewed", {
      actorUserId,
      institutionId,
      decisionId,
      approved: approve,
      decisionType: current.decisionType,
    });
    return reviewed;
  }

  private async applyDecision(tx: Prisma.TransactionClient, decision: {
    id: string;
    participantAdmissionId: string;
    decisionType: string;
    fromAdmissionStatus: string;
    reason: string;
    proposedRiskClass: string | null;
    proposedExpiresAt: Date | null;
    proposedReviewDueAt: Date | null;
    proposedByUserId: string;
    proposalStepUpId: string;
    reviewedByUserId: string;
    reviewStepUpId: string;
    participantAdmission: { institutionId: string; institution: { applicantUserId: string } };
  }, now: Date) {
    const institutionId = decision.participantAdmission.institutionId;
    const active = ["ADMIT", "RECERTIFY", "REINSTATE"].includes(decision.decisionType);
    const admissionStatus = active ? "ADMITTED"
      : decision.decisionType === "REJECT" ? "REJECTED"
        : decision.decisionType === "SUSPEND" ? "SUSPENDED" : "REVOKED";
    const institutionStatus = active ? "ACTIVE"
      : decision.decisionType === "REJECT" ? "APPLICANT"
        : decision.decisionType === "SUSPEND" ? "SUSPENDED" : "REVOKED";
    const admissionUpdated = await tx.participantAdmission.updateMany({
      where: { id: decision.participantAdmissionId, status: decision.fromAdmissionStatus },
      data: {
        status: admissionStatus,
        riskClass: decision.proposedRiskClass,
        reviewDueAt: decision.proposedReviewDueAt,
        expiresAt: decision.proposedExpiresAt,
        effectiveAt: active ? now : undefined,
        suspendedAt: decision.decisionType === "SUSPEND" ? now : undefined,
        revokedAt: decision.decisionType === "REVOKE" ? now : undefined,
        decisionReason: decision.reason,
      },
    });
    if (admissionUpdated.count !== 1) throw new ConflictException("participant admission changed after the proposal was made");
    await tx.institution.update({
      where: { id: institutionId },
      data: {
        status: institutionStatus,
        suspendedAt: decision.decisionType === "SUSPEND" ? now : active ? null : undefined,
        revokedAt: decision.decisionType === "REVOKE" ? now : active ? null : undefined,
        suspensionReason: decision.decisionType === "SUSPEND" ? "Approved admission suspension decision" : active ? null : undefined,
      },
    });
    if (!active) return;

    const initialAdmins = await tx.institutionMember.findMany({
      where: {
        institutionId,
        membershipRole: { in: ["APPLICANT", "ADMIN"] },
        bootstrapApprovedDecisionId: null,
        OR: [
          { userId: decision.participantAdmission.institution.applicantUserId },
          { status: "PENDING_ADMISSION" },
        ],
      },
    });
    for (const member of initialAdmins) {
      await tx.institutionMember.update({
        where: { id: member.id },
        data: {
          bootstrapApprovedDecisionId: decision.id,
          status: member.userId === decision.participantAdmission.institution.applicantUserId ? "ACTIVE" : "PENDING_ADMISSION",
          effectiveAt: member.userId === decision.participantAdmission.institution.applicantUserId ? now : null,
        },
      });
      if (member.userId === decision.participantAdmission.institution.applicantUserId) {
        await this.createBootstrapMandates(tx, member.id, institutionId, decision, now);
      }
    }
  }

  async createBootstrapMandates(tx: Prisma.TransactionClient, memberId: string, institutionId: string, decision: {
    id: string;
    proposedByUserId: string;
    proposalStepUpId: string;
  } & { reviewedByUserId?: string | null; reviewStepUpId?: string | null }, now: Date) {
    if (!decision.reviewedByUserId || !decision.reviewStepUpId) {
      throw new ConflictException("approved admission decision lacks reviewer evidence");
    }
    for (const action of BOOTSTRAP_ACTIONS) {
      await tx.authorityMandate.create({
        data: {
          id: `amnd_${randomUUID()}`,
          institutionId,
          memberId,
          action,
          scopeType: "INSTITUTION",
          scopeRef: null,
          scopeKey: "",
          limits: json({}),
          conditions: json({ bootstrap: true, admissionDecisionId: decision.id }),
          delegationBasis: "APPROVED_PARTICIPANT_ADMISSION",
          authorityEvidenceRef: decision.id,
          status: "ACTIVE",
          proposedByUserId: decision.proposedByUserId,
          proposalStepUpId: decision.proposalStepUpId,
          approvedByUserId: decision.reviewedByUserId,
          approvalStepUpId: decision.reviewStepUpId,
          approvalReason: "Initial administrator authority approved with participant admission",
          effectiveAt: now,
        },
      });
    }
  }

  private async requirePlatformAdmin(userId: string): Promise<void> {
    const user = await this.db.venueUser.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE" || !["ADMIN", "SUPERADMIN"].includes(user.platformRole ?? "")) {
      throw new ForbiddenException("active platform administrator required");
    }
  }
}
