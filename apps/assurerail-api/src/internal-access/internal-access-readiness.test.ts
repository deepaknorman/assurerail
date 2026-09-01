import assert from "node:assert/strict";
import test from "node:test";
import { evaluateInternalEnforcementCoverage, REQUIRED_ENFORCEMENT_ROLES, type EnforcementAssignment } from "./internal-access-readiness";

const now = new Date("2026-09-02T00:00:00.000Z");
const future = new Date("2026-10-01T00:00:00.000Z");
const past = new Date("2026-09-01T00:00:00.000Z");

function assignment(role: string, userId: string): EnforcementAssignment {
  return { userId, role, status: "ACTIVE", scopeType: "GLOBAL", scopeRef: null, effectiveAt: past, expiresAt: future, user: { status: "ACTIVE", identityVerifiedAt: past } };
}

test("[PR12][OP01c] enforcement requires complete, separated, identity-bound staff coverage", () => {
  const fixtures = REQUIRED_ENFORCEMENT_ROLES.map((role, index) => assignment(role, `staff-${index + 1}`));
  fixtures.push(assignment("SUPERADMIN", "staff-superadmin-2"));
  assert.deepEqual(evaluateInternalEnforcementCoverage(fixtures, now), []);
});

test("[PR12][OP01c] expired, participant-scoped and concentrated critical assignments do not pass", () => {
  const fixtures = REQUIRED_ENFORCEMENT_ROLES.map((role) => assignment(role, "same-person"));
  fixtures[0] = { ...fixtures[0], expiresAt: past };
  fixtures[1] = { ...fixtures[1], scopeType: "ENVIRONMENT", scopeRef: "prod" };
  const errors = evaluateInternalEnforcementCoverage(fixtures, now).join("\n");
  assert.match(errors, /SUPERADMIN/);
  assert.match(errors, /SYSADMIN/);
  assert.match(errors, /six distinct people/);

  const concentrated = REQUIRED_ENFORCEMENT_ROLES.map((role, index) => assignment(role, index < 3 ? "same-technical-admin" : `staff-${index}`));
  concentrated.push(assignment("SUPERADMIN", "second-superadmin"));
  assert.match(evaluateInternalEnforcementCoverage(concentrated, now).join("\n"), /operationally separate/);
});
