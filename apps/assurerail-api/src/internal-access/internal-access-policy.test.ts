import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateIndependentApproval,
  evaluateInternalAssignment,
  internalRoleCanSatisfyExternalAuthority,
  permissionsForInternalRole,
} from "./internal-access-policy";

const NOW = new Date("2026-09-01T12:00:00.000Z");

const activeSysadmin = {
  role: "SYSADMIN",
  status: "ACTIVE",
  scopeType: "ENVIRONMENT",
  scopeRef: "prod-in",
  effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
  expiresAt: new Date("2026-12-01T00:00:00.000Z"),
  now: NOW,
} as const;

test("[OP01][RBAC] each role is a bounded permission bundle, not a global administrator", () => {
  assert.deepEqual(evaluateInternalAssignment({
    ...activeSysadmin,
    permission: "SYSTEM_HEALTH_VIEW",
    requestedScopeType: "ENVIRONMENT",
    requestedScopeRef: "prod-in",
  }), { allowed: true, code: "INTERNAL_AUTHORISED", matchedRole: "SYSADMIN" });
  assert.equal(evaluateInternalAssignment({
    ...activeSysadmin,
    permission: "SECURITY_IDENTITY_MANAGE",
    requestedScopeType: "ENVIRONMENT",
    requestedScopeRef: "prod-in",
  }).code, "INTERNAL_PERMISSION_NOT_GRANTED");
  assert.equal(permissionsForInternalRole("SUPERADMIN").includes("CASE_TASK_PREPARE"), false);
});

test("[OP01][RBAC] inactive, expired and wrong-scope assignments fail closed", () => {
  const request = {
    ...activeSysadmin,
    permission: "SYSTEM_HEALTH_VIEW" as const,
    requestedScopeType: "ENVIRONMENT" as const,
    requestedScopeRef: "prod-in",
  };
  assert.equal(evaluateInternalAssignment({ ...request, status: "SUSPENDED" }).code, "INTERNAL_ASSIGNMENT_NOT_ACTIVE");
  assert.equal(evaluateInternalAssignment({ ...request, effectiveAt: null }).code, "INTERNAL_ASSIGNMENT_EFFECTIVE_PERIOD_REQUIRED");
  assert.equal(evaluateInternalAssignment({ ...request, expiresAt: null }).code, "INTERNAL_ASSIGNMENT_EFFECTIVE_PERIOD_REQUIRED");
  assert.equal(evaluateInternalAssignment({ ...request, expiresAt: NOW }).code, "INTERNAL_ASSIGNMENT_OUTSIDE_EFFECTIVE_PERIOD");
  assert.equal(evaluateInternalAssignment({ ...request, requestedScopeRef: "staging-in" }).code, "INTERNAL_SCOPE_MISMATCH");
});

test("[OP01][RBAC] global reporting does not make a viewer a customer-data or operating role", () => {
  const viewer = {
    role: "VIEWER",
    status: "ACTIVE",
    scopeType: "GLOBAL",
    scopeRef: null,
    effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
    expiresAt: new Date("2026-10-01T00:00:00.000Z"),
    now: NOW,
  };
  assert.equal(evaluateInternalAssignment({
    ...viewer,
    permission: "REPORT_VIEW",
    requestedScopeType: "OPERATING_UNIT",
    requestedScopeRef: "governance",
  }).allowed, true);
  assert.equal(evaluateInternalAssignment({
    ...viewer,
    permission: "CASE_TASK_PREPARE",
    requestedScopeType: "CASE",
    requestedScopeRef: "case-1",
  }).code, "INTERNAL_PERMISSION_NOT_GRANTED");
});

test("[OP01][RBAC] maker-checker prevents self approval and self reconciliation closure", () => {
  assert.equal(evaluateIndependentApproval({ actorUserId: "u1", proposerUserId: "u1" }).code, "SELF_APPROVAL_PROHIBITED");
  assert.equal(evaluateIndependentApproval({ actorUserId: "u2", proposerUserId: "u1", subjectUserId: "u2" }).code, "SUBJECT_CANNOT_APPROVE_OWN_ASSIGNMENT");
  assert.equal(evaluateIndependentApproval({
    actorUserId: "u2", proposerUserId: "u1", priorExecutorUserId: "u2", requiresIndependentExecutor: true,
  }).code, "EXECUTOR_CANNOT_INDEPENDENTLY_REVIEW");
  assert.equal(evaluateIndependentApproval({ actorUserId: "u3", proposerUserId: "u1", priorExecutorUserId: "u2", requiresIndependentExecutor: true }).allowed, true);
});

test("[OP01][RBAC] staff access can never become external transaction authority", () => {
  assert.equal(internalRoleCanSatisfyExternalAuthority(), false);
});
