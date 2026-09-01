import {
  isInternalPermission,
  isInternalRole,
  permissionsForInternalRole,
  type InternalPermission,
  type InternalRole,
  type InternalScopeType,
} from "./internal-access-policy";

export const INTERNAL_WORKSPACES = [
  {
    id: "GOVERNANCE",
    title: "Governance",
    summary: "Staff authority, recertification and independently approved elevation.",
    href: "/internal#governance",
    permissions: [
      "GOVERNANCE_ASSIGNMENT_PROPOSE",
      "GOVERNANCE_ASSIGNMENT_APPROVE",
      "GOVERNANCE_ASSIGNMENT_REVOKE",
      "GOVERNANCE_RECERTIFY",
      "GOVERNANCE_ELEVATION_APPROVE",
    ],
    escalation: ["ORGADMIN", "SUPERADMIN", "SECURITY_ADMIN when privileged access is involved"],
    boundary: "Staff authority only. It never grants participant, trustee, case or customer-data authority.",
  },
  {
    id: "SYSTEM",
    title: "System operations",
    summary: "Runtime health, governed changes, capacity and recovery evidence.",
    href: "/internal#system",
    permissions: ["SYSTEM_HEALTH_VIEW", "SYSTEM_CHANGE_PROPOSE", "SYSTEM_CHANGE_APPROVE", "SYSTEM_RECOVERY_EXECUTE"],
    escalation: ["SYSADMIN", "MANAGER", "SECURITY_ADMIN", "SUPERADMIN for emergency approval"],
    boundary: "System access does not include business documents, customer cases, IAM administration or unilateral release approval.",
  },
  {
    id: "SECURITY",
    title: "Security",
    summary: "Identity, session, posture, incident and privileged-access controls.",
    href: "/internal#security",
    permissions: [
      "SECURITY_POSTURE_VIEW",
      "SECURITY_IDENTITY_MANAGE",
      "SECURITY_SESSION_REVOKE",
      "SECURITY_ELEVATION_APPROVE",
      "SECURITY_INCIDENT_MANAGE",
    ],
    escalation: ["SECURITY_ADMIN", "SYSADMIN for containment dependencies", "RISK_COMPLIANCE_OFFICER", "SUPERADMIN"],
    boundary: "Security authority cannot deploy code, operate a customer transaction or approve the holder's own elevation.",
  },
  {
    id: "OPERATIONS",
    title: "Operations",
    summary: "Work queues, case preparation, assignments and controlled repair proposals.",
    href: "/internal#operations",
    permissions: ["OPERATIONS_QUEUE_VIEW", "OPERATIONS_WORK_ASSIGN", "CASE_TASK_PREPARE", "CASE_REPAIR_PROPOSE"],
    escalation: ["CASE_OPERATOR", "MANAGER", "RISK_COMPLIANCE_OFFICER", "external transaction authority where required"],
    boundary: "Rail staff may prepare and coordinate work but cannot replace participant credit, trustee, legal or recordkeeper decisions.",
  },
  {
    id: "RECONCILIATION",
    title: "Reconciliation",
    summary: "Independent observations, breaks, repair review and controlled closure.",
    href: "/internal#reconciliation",
    permissions: [
      "RECONCILIATION_VIEW",
      "RECONCILIATION_OBSERVE",
      "RECONCILIATION_REPAIR_REVIEW",
      "RECONCILIATION_BREAK_CLOSE",
    ],
    escalation: ["RECONCILIATION_ANALYST", "MANAGER", "RISK_COMPLIANCE_OFFICER", "trustee or external recordkeeper"],
    boundary: "The recorder or repair executor cannot independently close the same break; external authority remains final where applicable.",
  },
  {
    id: "INTEGRATIONS",
    title: "Integrations",
    summary: "Certified connectors, delivery health, retry/replay and provider incidents.",
    href: "/internal#integrations",
    permissions: ["INTEGRATION_HEALTH_VIEW", "INTEGRATION_JOB_OPERATE"],
    escalation: ["INTEGRATION_OPERATOR", "SYSADMIN", "MANAGER", "provider owner"],
    boundary: "Connector operation cannot reveal unrelated case content, expose raw secrets or declare an ambiguous external result complete.",
  },
  {
    id: "SUPPORT",
    title: "Support",
    summary: "Ticket metadata, bounded diagnostics and purpose-specific elevation requests.",
    href: "/internal#support",
    permissions: ["SUPPORT_TICKET_VIEW", "SUPPORT_DIAGNOSTIC_VIEW", "SUPPORT_ELEVATION_REQUEST"],
    escalation: ["SUPPORT_ANALYST", "MANAGER", "customer/data owner", "SECURITY_ADMIN for elevation"],
    boundary: "Support has no default portfolio, document or transaction access. Elevated access is exact, ticket-bound and time-limited.",
  },
  {
    id: "RISK",
    title: "Risk and compliance",
    summary: "Exceptions, conflicts, complaints and independent control oversight.",
    href: "/internal#risk",
    permissions: ["RISK_EXCEPTION_REVIEW", "RISK_CONFLICT_REVIEW", "RISK_COMPLAINT_MANAGE"],
    escalation: ["RISK_COMPLIANCE_OFFICER", "MANAGER", "external counsel or authority according to the route"],
    boundary: "Oversight authority does not create system-administration power or permit the reviewer to operate the matter being reviewed.",
  },
  {
    id: "AUDIT",
    title: "Audit and reporting",
    summary: "Immutable control evidence, approved reports and governed export requests.",
    href: "/internal#audit",
    permissions: ["AUDIT_EVIDENCE_VIEW", "AUDIT_EXPORT_REQUEST", "REPORT_VIEW"],
    escalation: ["AUDITOR", "control owner", "RISK_COMPLIANCE_OFFICER", "SUPERADMIN only for governance evidence"],
    boundary: "Read access and export authority are separate. Viewer status never implies customer-object access or export.",
  },
] as const satisfies readonly {
  id: string;
  title: string;
  summary: string;
  href: string;
  permissions: readonly InternalPermission[];
  escalation: readonly string[];
  boundary: string;
}[];

export interface InternalWorkspaceSource {
  source: "ASSIGNMENT" | "ELEVATION";
  sourceId: string;
  role: InternalRole | null;
  scopeType: InternalScopeType;
  scopeRef: string | null;
  expiresAt: Date | null;
}

export interface InternalWorkspaceView {
  id: string;
  title: string;
  summary: string;
  href: string;
  permissions: readonly InternalPermission[];
  escalation: readonly string[];
  boundary: string;
  sources: readonly InternalWorkspaceSource[];
}

type AssignmentLike = {
  id: string;
  role: string;
  status: string;
  scopeType: string;
  scopeRef: string | null;
  effectiveAt: Date | null;
  expiresAt: Date | null;
};

type ElevationLike = {
  id: string;
  requestedPermission: string;
  status: string;
  scopeType: string;
  scopeRef: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
};

function activeAt(now: Date, startsAt: Date | null, expiresAt: Date | null): boolean {
  return (!startsAt || startsAt <= now) && (!expiresAt || expiresAt > now);
}

function validScope(scopeType: string, scopeRef: string | null): scopeType is InternalScopeType {
  if (!["GLOBAL", "OPERATING_UNIT", "ENVIRONMENT", "CASE", "SUPPORT_TICKET"].includes(scopeType)) return false;
  return scopeType === "GLOBAL" ? scopeRef === null : typeof scopeRef === "string" && scopeRef.trim().length > 0;
}

/**
 * Builds navigation metadata only. It does not authorise a workspace command or resource read;
 * every such operation still evaluates its exact permission, scope and resource policy server-side.
 */
export function resolveInternalWorkspaces(input: {
  assignments: readonly AssignmentLike[];
  elevations: readonly ElevationLike[];
  now?: Date;
}): readonly InternalWorkspaceView[] {
  const now = input.now ?? new Date();
  const grants = new Map<InternalPermission, InternalWorkspaceSource[]>();
  const append = (permission: InternalPermission, source: InternalWorkspaceSource) => {
    const existing = grants.get(permission) ?? [];
    existing.push(source);
    grants.set(permission, existing);
  };

  for (const assignment of input.assignments) {
    if (
      assignment.status !== "ACTIVE"
      || !isInternalRole(assignment.role)
      || !assignment.effectiveAt
      || !assignment.expiresAt
      || !activeAt(now, assignment.effectiveAt, assignment.expiresAt)
      || !validScope(assignment.scopeType, assignment.scopeRef)
    ) continue;
    for (const permission of permissionsForInternalRole(assignment.role)) {
      append(permission, {
        source: "ASSIGNMENT",
        sourceId: assignment.id,
        role: assignment.role,
        scopeType: assignment.scopeType as InternalScopeType,
        scopeRef: assignment.scopeRef,
        expiresAt: assignment.expiresAt,
      });
    }
  }

  for (const elevation of input.elevations) {
    if (
      elevation.status !== "ACTIVE"
      || !isInternalPermission(elevation.requestedPermission)
      || !elevation.expiresAt
      || !activeAt(now, elevation.startsAt, elevation.expiresAt)
      || !validScope(elevation.scopeType, elevation.scopeRef)
    ) continue;
    append(elevation.requestedPermission, {
      source: "ELEVATION",
      sourceId: elevation.id,
      role: null,
      scopeType: elevation.scopeType as InternalScopeType,
      scopeRef: elevation.scopeRef,
      expiresAt: elevation.expiresAt,
    });
  }

  return INTERNAL_WORKSPACES.flatMap((workspace) => {
    const permissions = workspace.permissions.filter((permission) => grants.has(permission));
    if (permissions.length === 0) return [];
    const sources = permissions
      .flatMap((permission) => grants.get(permission) ?? [])
      .filter((source, index, all) => all.findIndex((candidate) => candidate.sourceId === source.sourceId) === index);
    return [{ ...workspace, permissions, sources }];
  });
}
