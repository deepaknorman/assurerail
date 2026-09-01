export const REQUIRED_ENFORCEMENT_ROLES = [
  "SUPERADMIN",
  "SYSADMIN",
  "SECURITY_ADMIN",
  "ORGADMIN",
  "MANAGER",
  "RECONCILIATION_ANALYST",
  "RISK_COMPLIANCE_OFFICER",
  "AUDITOR",
] as const;

export interface EnforcementAssignment {
  userId: string;
  role: string;
  status: string;
  scopeType: string;
  scopeRef: string | null;
  effectiveAt: Date | null;
  expiresAt: Date | null;
  user: { status: string; identityVerifiedAt: Date | null };
}

export function evaluateInternalEnforcementCoverage(assignments: readonly EnforcementAssignment[], now = new Date()): string[] {
  const errors: string[] = [];
  const active = assignments.filter((assignment) => assignment.status === "ACTIVE"
    && assignment.scopeType === "GLOBAL" && assignment.scopeRef === null
    && assignment.effectiveAt && assignment.effectiveAt <= now
    && assignment.expiresAt && assignment.expiresAt > now
    && assignment.user.status === "ACTIVE" && assignment.user.identityVerifiedAt);
  for (const role of REQUIRED_ENFORCEMENT_ROLES) {
    if (!active.some((assignment) => assignment.role === role)) errors.push(`active identity-bound GLOBAL ${role} assignment is required`);
  }
  const superadmins = new Set(active.filter((assignment) => assignment.role === "SUPERADMIN").map((assignment) => assignment.userId));
  if (superadmins.size < 2) errors.push("at least two independent active GLOBAL SUPERADMIN holders are required");
  const sysadmins = new Set(active.filter((assignment) => assignment.role === "SYSADMIN").map((assignment) => assignment.userId));
  const securityAdmins = new Set(active.filter((assignment) => assignment.role === "SECURITY_ADMIN").map((assignment) => assignment.userId));
  if ([...sysadmins].some((userId) => securityAdmins.has(userId))) errors.push("SYSADMIN and SECURITY_ADMIN must have operationally separate holders");
  const criticalHolders = new Set(active.filter((assignment) => ["SUPERADMIN", "SYSADMIN", "SECURITY_ADMIN", "RISK_COMPLIANCE_OFFICER", "AUDITOR"].includes(assignment.role)).map((assignment) => assignment.userId));
  if (criticalHolders.size < 6) errors.push("critical governance, system, security, risk and audit coverage requires at least six distinct people");
  return errors;
}
