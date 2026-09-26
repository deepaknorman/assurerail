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
  const events: Record<string, unknown>[] = [];
  const staff = new InternalAccessService({
    internalRoleAssignment: { findMany: async () => [{ id: "assignment", role, status: "ACTIVE", scopeType: "INSTITUTION", scopeRef: institutionId,
      effectiveAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + (expired ? -1 : 60_000)) }] },
    privilegedAccessRequest: { findMany: async () => [] },
  } as never, {} as never);
  const job = { id: "report", engagementId: "engagement", stage: "PREPARATION", status: "REVIEW_REQUIRED", requestedByUserId: "preparer", resultDigest: "sha256:report", result: { qualifications: ["SHADOW_ONLY"] } };
  const db = {
    assessmentProcessingJob: { findUnique: async () => { reads++; return job; } },
    internalAccessEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { events.push(data); return data; } },
  };
  const service = new AssessmentProcessingService(
    db as never,
    { scoped: async (_tx: unknown, requestedInstitution: string) => { assert.equal(requestedInstitution, "seller-a"); return { scope: { assetFamily: "VEHICLE_EV" } }; },
      transaction: async (run: (tx: typeof db) => Promise<unknown>) => run(db) } as never,
    {} as never, staff, {} as never, {} as never,
  );
  return { service, job, db, events, reads: () => reads };
}

test("institution-scoped risk reviewer can inspect the preparation report they may review", () => enabled(async () => {
  const { service, job, events } = fixture();
  assert.strictEqual(await service.internalReport(actor, "seller-a", "engagement", "report"), job);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "ASSESSMENT_REPORT_READ");
  assert.equal(events[0].permission, "RISK_EXCEPTION_REVIEW");
  assert.equal(events[0].internalRoleAssignmentId, "assignment");
  assert.equal(events[0].scopeRef, "seller-a");
  assert.equal(events[0].requestId, "report");
  assert.match(String(events[0].payloadDigest), /^sha256:[a-f0-9]{64}$/);
  assert(!JSON.stringify(events).includes("SHADOW_ONLY"));
}));

test("existing case-preparer read permission remains valid", () => enabled(async () => {
  const { service, job, events } = fixture("CASE_OPERATOR");
  assert.strictEqual(await service.internalReport(actor, "seller-a", "engagement", "report"), job);
  assert.equal(events[0].permission, "CASE_TASK_PREPARE");
}));

test("foreign-institution, expired and unrelated staff roles cannot read a report", () => enabled(async () => {
  for (const entry of [fixture("RISK_COMPLIANCE_OFFICER", "seller-b"), fixture("RISK_COMPLIANCE_OFFICER", "seller-a", true), fixture("MANAGER")]) {
    await assert.rejects(() => entry.service.internalReport(actor, "seller-a", "engagement", "report"), /internal authority denied/);
    assert.equal(entry.reads(), 0);
    assert.equal(entry.events.length, 0);
  }
}));

test("authorised reviewer cannot retrieve a run from another engagement", () => enabled(async () => {
  const { service, events } = fixture();
  await assert.rejects(() => service.internalReport(actor, "seller-a", "other-engagement", "report"), /run not found/);
  assert.equal(events.length, 0);
}));

test("restricted report is not returned if the access event cannot be persisted", () => enabled(async () => {
  const { service, db } = fixture();
  db.internalAccessEvent.create = async () => { throw new Error("AUDIT_UNAVAILABLE"); };
  await assert.rejects(() => service.internalReport(actor, "seller-a", "engagement", "report"), /AUDIT_UNAVAILABLE/);
}));

test("case preparer read permission does not permit preparation sign-off", () => enabled(async () => {
  const { service, reads } = fixture("CASE_OPERATOR");
  await assert.rejects(() => service.review(actor, "seller-a", "engagement", "report", { decision: "RELEASE", resultDigest: "sha256:report" }), /internal authority denied/);
  assert.equal(reads(), 0);
}));

test("a risk reviewer who requested the run cannot sign their own preparation", () => enabled(async () => {
  const { service, job } = fixture(); job.requestedByUserId = actor.actorUserId;
  for (const decision of ["RELEASE", "REJECT"]) {
    await assert.rejects(() => service.review(actor, "seller-a", "engagement", "report", { decision, resultDigest: job.resultDigest }), /independent reviewer required/);
  }
  assert.equal(job.status, "REVIEW_REQUIRED");
}));
