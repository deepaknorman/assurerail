import assert from "node:assert/strict";
import { test } from "node:test";
import { InternalAccessService } from "../internal-access/internal-access.service";
import { AssessmentProcessingService } from "./assessment-processing.service";

const actor = { actorUserId: "reviewer", actorSessionId: "session" };
async function enabled(run: () => Promise<void>) {
  const names = ["ASSURERAIL_ENGAGEMENT_BILLING_MODE", "ARAIL_CUSTOMER_OPERATIONS_V1"];
  const prior = names.map(name => process.env[name]);
  names.forEach(name => { process.env[name] = "shadow"; });
  try { await run(); }
  finally { names.forEach((name, index) => { if (prior[index] === undefined) delete process.env[name]; else process.env[name] = prior[index]; }); }
}

function fixture(role = "RISK_COMPLIANCE_OFFICER", institutionId = "seller-a", expired = false) {
  let reads = 0;
  const staff = new InternalAccessService({
    internalRoleAssignment: { findMany: async () => [{ id: "assignment", role, status: "ACTIVE", scopeType: "INSTITUTION", scopeRef: institutionId,
      effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + (expired ? -1 : 60_000)) }] },
    privilegedAccessRequest: { findMany: async () => [] },
  } as never, {} as never);
  const job = { id: "report", engagementId: "engagement", stage: "PREPARATION", status: "REVIEW_REQUIRED", result: { qualifications: ["SHADOW_ONLY"] } };
  const service = new AssessmentProcessingService(
    { assessmentProcessingJob: { findUnique: async () => { reads++; return job; } } } as never,
    { scoped: async (_tx: unknown, requestedInstitution: string) => { assert.equal(requestedInstitution, "seller-a"); } } as never,
    {} as never, staff, {} as never, {} as never,
  );
  return { service, job, reads: () => reads };
}

test("institution-scoped risk reviewer can inspect the preparation report they may review", () => enabled(async () => {
  const { service, job } = fixture();
  assert.strictEqual(await service.internalReport(actor, "seller-a", "engagement", "report"), job);
}));

test("existing case-preparer read permission remains valid", () => enabled(async () => {
  const { service, job } = fixture("CASE_OPERATOR");
  assert.strictEqual(await service.internalReport(actor, "seller-a", "engagement", "report"), job);
}));

test("foreign-institution, expired and unrelated staff roles cannot read a report", () => enabled(async () => {
  for (const entry of [fixture("RISK_COMPLIANCE_OFFICER", "seller-b"), fixture("RISK_COMPLIANCE_OFFICER", "seller-a", true), fixture("MANAGER")]) {
    await assert.rejects(() => entry.service.internalReport(actor, "seller-a", "engagement", "report"), /internal authority denied/);
    assert.equal(entry.reads(), 0);
  }
}));

test("authorised reviewer cannot retrieve a run from another engagement", () => enabled(async () => {
  const { service } = fixture();
  await assert.rejects(() => service.internalReport(actor, "seller-a", "other-engagement", "report"), /run not found/);
}));
