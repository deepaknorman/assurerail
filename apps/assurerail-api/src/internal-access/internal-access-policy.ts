/**
 * Internal staff authority is intentionally separate from participant/case authority.
 * These values are immutable policy vocabulary: a UI label may be friendlier, but it must not
 * broaden the underlying role or permission.
 */
export const INTERNAL_ROLES = [
  "SUPERADMIN",
  "SYSADMIN",
  "SECURITY_ADMIN",
  "ORGADMIN",
  "MANAGER",
  "CASE_OPERATOR",
  "RECONCILIATION_ANALYST",
  "INTEGRATION_OPERATOR",
  "RISK_COMPLIANCE_OFFICER",
  "SUPPORT_ANALYST",
  "AUDITOR",
  "VIEWER",
] as const;
export type InternalRole = (typeof INTERNAL_ROLES)[number];

export const INTERNAL_PERMISSIONS = [
  "GOVERNANCE_ASSIGNMENT_PROPOSE",
  "GOVERNANCE_ASSIGNMENT_APPROVE",
  "GOVERNANCE_ASSIGNMENT_REVOKE",
  "GOVERNANCE_RECERTIFY",
  "GOVERNANCE_ELEVATION_APPROVE",
  "READINESS_VIEW",
  "READINESS_GATE_PROPOSE",
  "READINESS_GATE_REVIEW",
  "DEPLOYMENT_ACTIVATION_REGISTER",
  "DEPLOYMENT_ACTIVATION_REVOKE",
  "SYSTEM_HEALTH_VIEW",
  "SYSTEM_CHANGE_PROPOSE",
  "SYSTEM_CHANGE_APPROVE",
  "SYSTEM_RECOVERY_EXECUTE",
  "SECURITY_POSTURE_VIEW",
  "SECURITY_IDENTITY_MANAGE",
  "SECURITY_SESSION_REVOKE",
  "SECURITY_ELEVATION_APPROVE",
  "SECURITY_INCIDENT_MANAGE",
  "OPERATIONS_QUEUE_VIEW",
  "OPERATIONS_WORK_ASSIGN",
  "CASE_TASK_PREPARE",
  "CASE_REPAIR_PROPOSE",
  "RECONCILIATION_VIEW",
  "RECONCILIATION_OBSERVE",
  "RECONCILIATION_REPAIR_REVIEW",
  "RECONCILIATION_BREAK_CLOSE",
  "INTEGRATION_HEALTH_VIEW",
  "INTEGRATION_JOB_OPERATE",
  "SUPPORT_TICKET_VIEW",
  "SUPPORT_DIAGNOSTIC_VIEW",
  "SUPPORT_ELEVATION_REQUEST",
  "RISK_EXCEPTION_REVIEW",
  "RISK_CONFLICT_REVIEW",
  "RISK_COMPLAINT_MANAGE",
  "AUDIT_EVIDENCE_VIEW",
  "AUDIT_EXPORT_REQUEST",
  "REPORT_VIEW",
] as const;
export type InternalPermission = (typeof INTERNAL_PERMISSIONS)[number];

export const INTERNAL_SCOPE_TYPES = ["GLOBAL", "OPERATING_UNIT", "ENVIRONMENT", "CASE", "SUPPORT_TICKET"] as const;
export type InternalScopeType = (typeof INTERNAL_SCOPE_TYPES)[number];

export const INTERNAL_ASSIGNMENT_STATUSES = ["PROPOSED", "ACTIVE", "REJECTED", "SUSPENDED", "EXPIRED", "REVOKED", "SUPERSEDED"] as const;
export type InternalAssignmentStatus = (typeof INTERNAL_ASSIGNMENT_STATUSES)[number];

export const PRIVILEGED_ACCESS_STATUSES = ["REQUESTED", "APPROVED", "ACTIVE", "DENIED", "EXPIRED", "REVOKED", "CLOSED"] as const;
export type PrivilegedAccessStatus = (typeof PRIVILEGED_ACCESS_STATUSES)[number];

const ROLE_PERMISSIONS: Record<InternalRole, readonly InternalPermission[]> = {
  SUPERADMIN: [
    "GOVERNANCE_ASSIGNMENT_APPROVE",
    "GOVERNANCE_ASSIGNMENT_REVOKE",
    "GOVERNANCE_RECERTIFY",
    "GOVERNANCE_ELEVATION_APPROVE",
    "READINESS_VIEW",
    "DEPLOYMENT_ACTIVATION_REVOKE",
  ],
  SYSADMIN: [
    "SYSTEM_HEALTH_VIEW",
    "SYSTEM_CHANGE_PROPOSE",
    "SYSTEM_CHANGE_APPROVE",
    "SYSTEM_RECOVERY_EXECUTE",
    "INTEGRATION_HEALTH_VIEW",
    "READINESS_VIEW",
    "READINESS_GATE_PROPOSE",
    "DEPLOYMENT_ACTIVATION_REGISTER",
  ],
  SECURITY_ADMIN: [
    "SECURITY_POSTURE_VIEW",
    "SECURITY_IDENTITY_MANAGE",
    "SECURITY_SESSION_REVOKE",
    "SECURITY_ELEVATION_APPROVE",
    "SECURITY_INCIDENT_MANAGE",
    "READINESS_VIEW",
    "READINESS_GATE_REVIEW",
  ],
  ORGADMIN: [
    "GOVERNANCE_ASSIGNMENT_PROPOSE",
    "GOVERNANCE_RECERTIFY",
    "READINESS_VIEW",
  ],
  MANAGER: [
    "OPERATIONS_QUEUE_VIEW",
    "OPERATIONS_WORK_ASSIGN",
    "RECONCILIATION_VIEW",
    "INTEGRATION_HEALTH_VIEW",
    "SUPPORT_TICKET_VIEW",
    "RISK_COMPLAINT_MANAGE",
    "READINESS_VIEW",
    "READINESS_GATE_PROPOSE",
  ],
  CASE_OPERATOR: [
    "OPERATIONS_QUEUE_VIEW",
    "CASE_TASK_PREPARE",
    "CASE_REPAIR_PROPOSE",
  ],
  RECONCILIATION_ANALYST: [
    "RECONCILIATION_VIEW",
    "RECONCILIATION_OBSERVE",
    "RECONCILIATION_REPAIR_REVIEW",
    "RECONCILIATION_BREAK_CLOSE",
  ],
  INTEGRATION_OPERATOR: [
    "INTEGRATION_HEALTH_VIEW",
    "INTEGRATION_JOB_OPERATE",
  ],
  RISK_COMPLIANCE_OFFICER: [
    "RISK_EXCEPTION_REVIEW",
    "RISK_CONFLICT_REVIEW",
    "RISK_COMPLAINT_MANAGE",
    "RECONCILIATION_VIEW",
    "READINESS_VIEW",
    "READINESS_GATE_REVIEW",
  ],
  SUPPORT_ANALYST: [
    "SUPPORT_TICKET_VIEW",
    "SUPPORT_DIAGNOSTIC_VIEW",
    "SUPPORT_ELEVATION_REQUEST",
  ],
  AUDITOR: [
    "AUDIT_EVIDENCE_VIEW",
    "AUDIT_EXPORT_REQUEST",
    "REPORT_VIEW",
    "READINESS_VIEW",
  ],
  VIEWER: ["REPORT_VIEW", "READINESS_VIEW"],
};

export interface InternalAssignmentPolicyInput {
  role: string;
  status: string;
  scopeType: string;
  scopeRef: string | null;
  effectiveAt: Date | null;
  expiresAt: Date | null;
  permission: InternalPermission;
  requestedScopeType: InternalScopeType;
  requestedScopeRef: string | null;
  now: Date;
}

export interface InternalPolicyDecision {
  allowed: boolean;
  code: string;
  matchedRole?: InternalRole;
}

function activeDuring(now: Date, effectiveAt: Date | null, expiresAt: Date | null): boolean {
  return (!effectiveAt || effectiveAt.getTime() <= now.getTime())
    && (!expiresAt || expiresAt.getTime() > now.getTime());
}

export function isInternalRole(role: string): role is InternalRole {
  return (INTERNAL_ROLES as readonly string[]).includes(role);
}

export function isInternalPermission(permission: string): permission is InternalPermission {
  return (INTERNAL_PERMISSIONS as readonly string[]).includes(permission);
}

export function isInternalScopeType(scopeType: string): scopeType is InternalScopeType {
  return (INTERNAL_SCOPE_TYPES as readonly string[]).includes(scopeType);
}

/**
 * Scope is deliberately exact except for an explicit GLOBAL staff assignment. GLOBAL does not imply
 * customer-data access because there is no customer-data permission in this policy vocabulary.
 */
function scopeMatches(input: InternalAssignmentPolicyInput): boolean {
  if (input.scopeType === "GLOBAL") return true;
  return input.scopeType === input.requestedScopeType && input.scopeRef === input.requestedScopeRef;
}

/** Pure, fail-closed policy evaluator for one active internal assignment. */
export function evaluateInternalAssignment(input: InternalAssignmentPolicyInput): InternalPolicyDecision {
  if (!isInternalRole(input.role)) return { allowed: false, code: "INTERNAL_ROLE_UNRECOGNISED" };
  if (input.status !== "ACTIVE") return { allowed: false, code: "INTERNAL_ASSIGNMENT_NOT_ACTIVE" };
  if (!input.effectiveAt || !input.expiresAt) {
    return { allowed: false, code: "INTERNAL_ASSIGNMENT_EFFECTIVE_PERIOD_REQUIRED" };
  }
  if (!activeDuring(input.now, input.effectiveAt, input.expiresAt)) {
    return { allowed: false, code: "INTERNAL_ASSIGNMENT_OUTSIDE_EFFECTIVE_PERIOD" };
  }
  if (!scopeMatches(input)) return { allowed: false, code: "INTERNAL_SCOPE_MISMATCH" };
  if (!ROLE_PERMISSIONS[input.role].includes(input.permission)) {
    return { allowed: false, code: "INTERNAL_PERMISSION_NOT_GRANTED", matchedRole: input.role };
  }
  return { allowed: true, code: "INTERNAL_AUTHORISED", matchedRole: input.role };
}

/** Maker/checker gate used before a reviewer/approver decision is even considered. */
export function evaluateIndependentApproval(input: {
  actorUserId: string;
  proposerUserId: string;
  subjectUserId?: string | null;
  priorExecutorUserId?: string | null;
  requiresIndependentExecutor?: boolean;
}): InternalPolicyDecision {
  if (!input.actorUserId) return { allowed: false, code: "INTERNAL_ACTOR_REQUIRED" };
  if (input.actorUserId === input.proposerUserId) return { allowed: false, code: "SELF_APPROVAL_PROHIBITED" };
  if (input.subjectUserId && input.actorUserId === input.subjectUserId) return { allowed: false, code: "SUBJECT_CANNOT_APPROVE_OWN_ASSIGNMENT" };
  if (input.requiresIndependentExecutor && input.actorUserId === input.priorExecutorUserId) {
    return { allowed: false, code: "EXECUTOR_CANNOT_INDEPENDENTLY_REVIEW" };
  }
  return { allowed: true, code: "INDEPENDENT_REVIEWER" };
}

/**
 * An internal job title/assignment must never satisfy an external participant, trustee, recordkeeper
 * or other material-function test. Those tests use InstitutionMember/Mandate/Appointment records.
 */
export function internalRoleCanSatisfyExternalAuthority(): false {
  return false;
}

export function permissionsForInternalRole(role: InternalRole): readonly InternalPermission[] {
  return ROLE_PERMISSIONS[role];
}
