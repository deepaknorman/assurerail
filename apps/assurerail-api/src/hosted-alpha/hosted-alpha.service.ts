import { ForbiddenException, Injectable } from "@nestjs/common";
import type { InstitutionAction } from "../institutions/institution-policy";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { PrismaService } from "../store/prisma.service";
import {
  dueState,
  orderHostedAlphaTasks,
  taskCounts,
  type HostedAlphaTask,
  type HostedAlphaTaskPriority,
} from "./hosted-alpha-policy";

const OPEN_CASE_STATUSES = ["DRAFT", "INTAKE_OPEN", "EVIDENCE_LOCKED", "IN_REVIEW", "READY", "IN_PROGRESS", "COMPLETION_PENDING"];

function enabled() {
  if (inspectPersistenceFlags(process.env).hostedAlpha !== "shadow") {
    throw new ForbiddenException("hosted alpha action centre is disabled");
  }
}

function encoded(value: string): string { return encodeURIComponent(value); }
function iso(value: Date | null): string | null { return value?.toISOString() ?? null; }
function priorityForDue(base: HostedAlphaTaskPriority, dueAt: Date | null, now: Date): HostedAlphaTaskPriority {
  if (dueAt && dueAt <= now) return base === "CRITICAL" ? "CRITICAL" : "HIGH";
  return base;
}

@Injectable()
export class HostedAlphaService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService) {}

  private async allowed(userId: string, institutionId: string, action: InstitutionAction): Promise<boolean> {
    return (await this.access.evaluateHuman({ userId, institutionId, action })).allowed;
  }

  async tasks(input: { actorUserId: string; actingInstitutionId: string }) {
    enabled();
    const { actorUserId, actingInstitutionId } = input;
    await this.access.requireHuman({ userId: actorUserId, institutionId: actingInstitutionId, action: "VIEW_INSTITUTION" });
    const now = new Date();
    const evidenceWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
    const [canApproveAuthority, canManageAppointments, canViewCase, canOperateCase, canViewEvidence,
      canRespondOpportunity, canViewCustomerOperations, canManageIdentityConnections,
      canManageServiceIdentities, canManageAccessReviews, canManageParticipantExit] = await Promise.all([
      this.allowed(actorUserId, actingInstitutionId, "APPROVE_AUTHORITY"),
      this.allowed(actorUserId, actingInstitutionId, "MANAGE_APPOINTMENTS"),
      this.allowed(actorUserId, actingInstitutionId, "VIEW_CASE"),
      this.allowed(actorUserId, actingInstitutionId, "OPERATE_CASE"),
      this.allowed(actorUserId, actingInstitutionId, "VIEW_EVIDENCE"),
      this.allowed(actorUserId, actingInstitutionId, "RESPOND_OPPORTUNITY"),
      this.allowed(actorUserId, actingInstitutionId, "VIEW_CUSTOMER_OPERATIONS"),
      this.allowed(actorUserId, actingInstitutionId, "MANAGE_IDENTITY_CONNECTIONS"),
      this.allowed(actorUserId, actingInstitutionId, "MANAGE_SERVICE_IDENTITIES"),
      this.allowed(actorUserId, actingInstitutionId, "MANAGE_ACCESS_REVIEWS"),
      this.allowed(actorUserId, actingInstitutionId, "MANAGE_PARTICIPANT_EXIT"),
    ]);
    const tasks: HostedAlphaTask[] = [];
    const add = (task: HostedAlphaTask) => tasks.push(task);

    if (canApproveAuthority) {
      const [mandates, entitlements, changes] = await Promise.all([
        this.db.authorityMandate.findMany({ where: { institutionId: actingInstitutionId, status: "PROPOSED", proposedByUserId: { not: actorUserId } }, select: { id: true, action: true, member: { select: { invitedEmail: true } }, expiresAt: true } }),
        this.db.routeEntitlement.findMany({ where: { institutionId: actingInstitutionId, status: "PROPOSED", proposedByUserId: { not: actorUserId } }, select: { id: true, transactionRoute: true, representation: true, materialFunction: true, expiresAt: true } }),
        this.db.institutionChangeProposal.findMany({ where: { institutionId: actingInstitutionId, status: "PENDING", proposedByUserId: { not: actorUserId }, targetType: { notIn: ["IDENTITY_CONNECTION", "SERVICE_PRINCIPAL"] } }, select: { id: true, targetType: true, changeType: true, proposedAt: true } }),
      ]);
      for (const item of mandates) add({ id: `mandate:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: dueState(item.expiresAt, now), title: "Review authority mandate", summary: `${item.action} for ${item.member.invitedEmail}; independent review required.`, href: `/institutions/${encoded(actingInstitutionId)}`, sourceType: "AUTHORITY_MANDATE", sourceId: item.id, transactionCaseId: null, requiredAction: "APPROVE_AUTHORITY", dueAt: iso(item.expiresAt), operatingBoundary: "SHADOW" });
      for (const item of entitlements) add({ id: `entitlement:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: dueState(item.expiresAt, now), title: "Review route entitlement", summary: `${item.transactionRoute} · ${item.representation} · ${item.materialFunction}`, href: `/institutions/${encoded(actingInstitutionId)}`, sourceType: "ROUTE_ENTITLEMENT", sourceId: item.id, transactionCaseId: null, requiredAction: "APPROVE_AUTHORITY", dueAt: iso(item.expiresAt), operatingBoundary: "SHADOW" });
      for (const item of changes) add({ id: `institution-change:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: "OPEN", title: "Review institutional status change", summary: `${item.changeType} ${item.targetType}; maker-checker review required.`, href: `/institutions/${encoded(actingInstitutionId)}`, sourceType: "INSTITUTION_CHANGE", sourceId: item.id, transactionCaseId: null, requiredAction: "APPROVE_AUTHORITY", dueAt: null, operatingBoundary: "SHADOW" });
    }

    if (canManageAppointments) {
      const appointments = await this.db.appointment.findMany({ where: { appointeeInstitutionId: actingInstitutionId, status: "PROPOSED", proposedByUserId: { not: actorUserId } }, select: { id: true, institutionId: true, transactionCaseId: true, appointmentRole: true, expiresAt: true } });
      for (const item of appointments) add({ id: `appointment:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: dueState(item.expiresAt, now), title: "Accept or decline appointment", summary: `${item.appointmentRole} appointment proposed by ${item.institutionId}.`, href: `/institutions/${encoded(actingInstitutionId)}`, sourceType: "APPOINTMENT", sourceId: item.id, transactionCaseId: item.transactionCaseId, requiredAction: "MANAGE_APPOINTMENTS", dueAt: iso(item.expiresAt), operatingBoundary: "SHADOW" });
    }

    if (canManageIdentityConnections) {
      const [connections, changes] = await Promise.all([
        this.db.institutionIdentityConnection.findMany({ where: { institutionId: actingInstitutionId, status: "PROPOSED", proposedByUserId: { not: actorUserId } }, select: { id: true, displayName: true, protocol: true, expiresAt: true } }),
        this.db.institutionChangeProposal.findMany({ where: { institutionId: actingInstitutionId, targetType: "IDENTITY_CONNECTION", status: "PENDING", proposedByUserId: { not: actorUserId } }, select: { id: true, changeType: true, targetId: true } }),
      ]);
      for (const item of connections) add({ id: `identity-connection:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: dueState(item.expiresAt, now), title: "Review identity federation metadata", summary: `${item.displayName} · ${item.protocol} · shadow metadata only`, href: "/workspace/institution", sourceType: "INSTITUTION_IDENTITY_CONNECTION", sourceId: item.id, transactionCaseId: null, requiredAction: "MANAGE_IDENTITY_CONNECTIONS", dueAt: iso(item.expiresAt), operatingBoundary: "SHADOW" });
      for (const item of changes) add({ id: `identity-connection-change:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: "OPEN", title: "Review identity federation status change", summary: `${item.changeType} · ${item.targetId}`, href: "/workspace/institution", sourceType: "INSTITUTION_CHANGE", sourceId: item.id, transactionCaseId: null, requiredAction: "MANAGE_IDENTITY_CONNECTIONS", dueAt: null, operatingBoundary: "SHADOW" });
    }
    if (canManageServiceIdentities) {
      const [principals, changes] = await Promise.all([
        this.db.institutionServicePrincipal.findMany({ where: { institutionId: actingInstitutionId, status: "PENDING", proposedByUserId: { not: actorUserId } }, select: { id: true, displayName: true, clientId: true, expiresAt: true } }),
        this.db.institutionChangeProposal.findMany({ where: { institutionId: actingInstitutionId, targetType: "SERVICE_PRINCIPAL", status: "PENDING", proposedByUserId: { not: actorUserId } }, select: { id: true, changeType: true, targetId: true } }),
      ]);
      for (const item of principals) add({ id: `service-identity:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: dueState(item.expiresAt, now), title: "Review service identity", summary: `${item.displayName} · ${item.clientId} · authentication remains disabled`, href: "/workspace/institution", sourceType: "INSTITUTION_SERVICE_PRINCIPAL", sourceId: item.id, transactionCaseId: null, requiredAction: "MANAGE_SERVICE_IDENTITIES", dueAt: iso(item.expiresAt), operatingBoundary: "SHADOW" });
      for (const item of changes) add({ id: `service-identity-change:${item.id}`, category: "GOVERNANCE", priority: "HIGH", dueState: "OPEN", title: "Review service identity status change", summary: `${item.changeType} · ${item.targetId}`, href: "/workspace/institution", sourceType: "INSTITUTION_CHANGE", sourceId: item.id, transactionCaseId: null, requiredAction: "MANAGE_SERVICE_IDENTITIES", dueAt: null, operatingBoundary: "SHADOW" });
    }
    if (canManageAccessReviews) {
      const reviews = await this.db.institutionAccessReview.findMany({ where: { institutionId: actingInstitutionId, status: "PROPOSED", proposedByUserId: { not: actorUserId } }, select: { id: true, reviewRef: true, dueAt: true } });
      for (const item of reviews) add({ id: `access-review:${item.id}`, category: "GOVERNANCE", priority: priorityForDue("HIGH", item.dueAt, now), dueState: dueState(item.dueAt, now), title: "Complete periodic access review", summary: `${item.reviewRef} · independent conclusion required`, href: "/workspace/institution", sourceType: "INSTITUTION_ACCESS_REVIEW", sourceId: item.id, transactionCaseId: null, requiredAction: "MANAGE_ACCESS_REVIEWS", dueAt: iso(item.dueAt), operatingBoundary: "SHADOW" });
    }
    if (canManageParticipantExit) {
      const exits = await this.db.institutionExitPlan.findMany({ where: { institutionId: actingInstitutionId, status: "PROPOSED", proposedByUserId: { not: actorUserId } }, select: { id: true, exitRef: true, requestedEffectiveAt: true } });
      for (const item of exits) add({ id: `exit-plan:${item.id}`, category: "SERVICE", priority: "HIGH", dueState: dueState(item.requestedEffectiveAt, now), title: "Review participant exit plan", summary: `${item.exitRef} · approval does not execute suspension, revocation or deletion`, href: "/workspace/institution", sourceType: "INSTITUTION_EXIT_PLAN", sourceId: item.id, transactionCaseId: null, requiredAction: "MANAGE_PARTICIPANT_EXIT", dueAt: iso(item.requestedEffectiveAt), operatingBoundary: "SHADOW" });
    }

    const visibleCases = canViewCase ? await this.db.transactionCase.findMany({
      where: { status: { in: OPEN_CASE_STATUSES }, OR: [{ ownerInstitutionId: actingInstitutionId }, { parties: { some: { institutionId: actingInstitutionId, status: { in: ["PROPOSED", "ACTIVE"] } } } }] },
      select: { id: true, caseReference: true },
    }) : [];
    const caseReference = new Map(visibleCases.map((item) => [item.id, item.caseReference]));
    const caseIds = visibleCases.map((item) => item.id);

    if (canOperateCase && caseIds.length) {
      const [parties, conditions, decisions, breaks, secondaryBreaks] = await Promise.all([
        this.db.caseParty.findMany({ where: { transactionCaseId: { in: caseIds }, institutionId: actingInstitutionId, status: "PROPOSED" }, select: { id: true, transactionCaseId: true, partyRole: true } }),
        this.db.caseCondition.findMany({ where: { transactionCaseId: { in: caseIds }, ownerInstitutionId: actingInstitutionId, status: "OPEN" }, select: { id: true, transactionCaseId: true, code: true, description: true, dueAt: true } }),
        this.db.caseDecision.findMany({ where: { transactionCaseId: { in: caseIds }, status: "PROPOSED", proposedByUserId: { not: actorUserId } }, select: { id: true, transactionCaseId: true, decisionType: true, createdAt: true } }),
        this.db.reconciliationBreak.findMany({ where: { transactionCaseId: { in: caseIds }, ownerInstitutionId: actingInstitutionId, status: { not: "RESOLVED" } }, select: { id: true, transactionCaseId: true, breakCode: true, severity: true, dueAt: true } }),
        this.db.secondaryTransferBreak.findMany({ where: { ownerInstitutionId: actingInstitutionId, status: "OPEN", secondaryTransfer: { transactionCaseId: { in: caseIds } } }, select: { id: true, breakCode: true, severity: true, createdAt: true, secondaryTransfer: { select: { transactionCaseId: true } } } }),
      ]);
      for (const item of parties) add({ id: `party:${item.id}`, category: "CASE", priority: "HIGH", dueState: "OPEN", title: "Review case-party invitation", summary: `${item.partyRole} · ${caseReference.get(item.transactionCaseId) ?? item.transactionCaseId}`, href: `/workspace/cases/${encoded(item.transactionCaseId)}`, sourceType: "CASE_PARTY", sourceId: item.id, transactionCaseId: item.transactionCaseId, requiredAction: "OPERATE_CASE", dueAt: null, operatingBoundary: "SHADOW" });
      for (const item of conditions) add({ id: `condition:${item.id}`, category: "CASE", priority: priorityForDue("NORMAL", item.dueAt, now), dueState: dueState(item.dueAt, now), title: "Resolve case condition", summary: `${item.code} · ${item.description}`, href: `/workspace/cases/${encoded(item.transactionCaseId)}`, sourceType: "CASE_CONDITION", sourceId: item.id, transactionCaseId: item.transactionCaseId, requiredAction: "OPERATE_CASE", dueAt: iso(item.dueAt), operatingBoundary: "SHADOW" });
      for (const item of decisions) add({ id: `decision:${item.id}`, category: "CASE", priority: "HIGH", dueState: "OPEN", title: "Review case decision", summary: `${item.decisionType} · ${caseReference.get(item.transactionCaseId) ?? item.transactionCaseId}`, href: `/workspace/cases/${encoded(item.transactionCaseId)}`, sourceType: "CASE_DECISION", sourceId: item.id, transactionCaseId: item.transactionCaseId, requiredAction: "OPERATE_CASE", dueAt: null, operatingBoundary: "SHADOW" });
      for (const item of breaks) add({ id: `break:${item.id}`, category: "RECONCILIATION", priority: item.severity === "CRITICAL" ? "CRITICAL" : priorityForDue("HIGH", item.dueAt, now), dueState: dueState(item.dueAt, now), title: "Reconciliation break requires action", summary: `${item.breakCode} · ${caseReference.get(item.transactionCaseId) ?? item.transactionCaseId}`, href: `/workspace/cases/${encoded(item.transactionCaseId)}`, sourceType: "RECONCILIATION_BREAK", sourceId: item.id, transactionCaseId: item.transactionCaseId, requiredAction: "OPERATE_CASE", dueAt: iso(item.dueAt), operatingBoundary: "SHADOW" });
      for (const item of secondaryBreaks) { const caseId = item.secondaryTransfer.transactionCaseId; add({ id: `secondary-break:${item.id}`, category: "RECONCILIATION", priority: item.severity === "CRITICAL" ? "CRITICAL" : "HIGH", dueState: "OPEN", title: "Secondary-transfer break requires action", summary: `${item.breakCode} · ${caseReference.get(caseId) ?? caseId}`, href: `/workspace/cases/${encoded(caseId)}`, sourceType: "SECONDARY_TRANSFER_BREAK", sourceId: item.id, transactionCaseId: caseId, requiredAction: "OPERATE_CASE", dueAt: null, operatingBoundary: "SHADOW" }); }
    }

    if (canViewEvidence) {
      const evidence = await this.db.evidenceObject.findMany({ where: { institutionId: actingInstitutionId, status: { in: ["AVAILABLE", "QUARANTINED", "EXPIRED"] }, OR: [{ status: { in: ["QUARANTINED", "EXPIRED"] } }, { versions: { some: { expiresAt: { lte: evidenceWindow } } } }] }, select: { id: true, transactionCaseId: true, evidenceType: true, status: true, versions: { orderBy: { version: "desc" }, take: 1, select: { expiresAt: true, validationStatus: true } } } });
      for (const item of evidence) { const version = item.versions[0]; const expiry = version?.expiresAt ?? null; const failed = item.status === "QUARANTINED" || item.status === "EXPIRED" || version?.validationStatus === "QUARANTINED" || version?.validationStatus === "EXPIRED"; add({ id: `evidence:${item.id}`, category: "EVIDENCE", priority: failed ? "HIGH" : "NORMAL", dueState: failed && !expiry ? "OPEN" : dueState(expiry, now), title: failed ? "Evidence cannot satisfy a gate" : "Evidence expires soon", summary: `${item.evidenceType} · ${item.status} · ${version?.validationStatus ?? "NO_VERSION"}`, href: `/institutions/${encoded(actingInstitutionId)}/evidence`, sourceType: "EVIDENCE_OBJECT", sourceId: item.id, transactionCaseId: item.transactionCaseId, requiredAction: "VIEW_EVIDENCE", dueAt: iso(expiry), operatingBoundary: "SHADOW" }); }
    }

    if (canRespondOpportunity) {
      const allocations = await this.db.commercialAllocation.findMany({ where: { offereeInstitutionId: actingInstitutionId, status: "OFFERED", expiresAt: { gt: now } }, select: { id: true, allocationReference: true, expiresAt: true, commercialOpportunity: { select: { id: true, opportunityReference: true, transactionCaseId: true } } } });
      for (const item of allocations) { const opportunity = item.commercialOpportunity; add({ id: `allocation:${item.id}`, category: "COMMERCIAL", priority: priorityForDue("NORMAL", item.expiresAt, now), dueState: dueState(item.expiresAt, now), title: "Respond to allocation", summary: `${item.allocationReference} · ${opportunity.opportunityReference}`, href: `/workspace/opportunities/${encoded(opportunity.id)}?caseId=${encoded(opportunity.transactionCaseId)}`, sourceType: "COMMERCIAL_ALLOCATION", sourceId: item.id, transactionCaseId: opportunity.transactionCaseId, requiredAction: "RESPOND_OPPORTUNITY", dueAt: iso(item.expiresAt), operatingBoundary: "SHADOW" }); }
    }

    if (canViewCustomerOperations) {
      const requests = await this.db.customerServiceRequest.findMany({ where: { institutionId: actingInstitutionId, status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_CUSTOMER"] } }, select: { id: true, transactionCaseId: true, requestRef: true, subject: true, status: true, priority: true, slaDueAt: true } });
      for (const item of requests) { const waiting = item.status === "WAITING_CUSTOMER"; add({ id: `service:${item.id}`, category: "SERVICE", priority: item.priority === "CRITICAL" ? "CRITICAL" : waiting ? "HIGH" : "LOW", dueState: waiting ? dueState(item.slaDueAt, now) : "WATCH", title: waiting ? "Customer response required" : "Service request in progress", summary: `${item.requestRef} · ${item.subject} · ${item.status}`, href: "/workspace/operations", sourceType: "CUSTOMER_SERVICE_REQUEST", sourceId: item.id, transactionCaseId: item.transactionCaseId, requiredAction: waiting ? "VIEW_CUSTOMER_OPERATIONS" : "VIEW_CUSTOMER_OPERATIONS", dueAt: iso(item.slaDueAt), operatingBoundary: "SHADOW" }); }
    }

    const ordered = orderHostedAlphaTasks(tasks);
    return {
      generatedAt: now.toISOString(),
      institutionId: actingInstitutionId,
      actorUserId,
      operatingBoundary: "SHADOW" as const,
      authorityNotice: "Task visibility is not command authority. Every destination rechecks membership, mandate, appointment, case and route scope.",
      counts: taskCounts(ordered),
      tasks: ordered,
    };
  }
}
