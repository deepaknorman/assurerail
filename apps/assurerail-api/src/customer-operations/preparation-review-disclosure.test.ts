import assert from "node:assert/strict";
import { test } from "node:test";
import { preparationReviewDisclosure } from "./preparation-review-disclosure";
import { AssessmentProcessingService } from "./assessment-processing.service";

const report = (qualification: Record<string, unknown>) => ({
  id: "preparation-test", stage: "PREPARATION", status: "RELEASED", resultDigest: "sha256:reviewed-result",
  reviewSnapshot: { resultDigest: "sha256:reviewed-result", qualification },
});

test("released synthetic qualification is explicit, including legacy demo references", () => {
  for (const qualification of [
    { qualificationRef: "reviewer:test", syntheticDemoOnly: true },
    { qualificationRef: "demo://founder-preparation/reviewer" },
    { qualificationRef: "demo://founder-preparation/reviewer", syntheticDemoOnly: false },
  ]) {
    const disclosure = preparationReviewDisclosure(report(qualification));
    assert.equal(disclosure?.status, "SYNTHETIC_DEMONSTRATION_ONLY");
    assert.match(disclosure!.label, /synthetic qualification.*demonstration only; not professional sign-off/);
  }
  assert.equal(preparationReviewDisclosure(report({ qualificationRef: "qualification:approved" }))?.status, "PLATFORM_APPROVED");
});

test("qualification disclosure requires the reviewed digest and never implies Initial Assessment sign-off", () => {
  const job = report({ qualificationRef: "demo://test" });
  assert.equal(preparationReviewDisclosure({ ...job, reviewSnapshot: null })?.status, "UNAVAILABLE");
  assert.equal(preparationReviewDisclosure({ ...job, resultDigest: "sha256:changed" })?.status, "UNAVAILABLE");
  assert.equal(preparationReviewDisclosure(report({ qualificationRef: "" }))?.status, "UNAVAILABLE");
  for (const status of ["REVIEW_REQUIRED", "REJECTED", "FAILED"]) assert.equal(preparationReviewDisclosure({ ...job, status }), null);
  assert.equal(preparationReviewDisclosure({ ...job, stage: "INITIAL", status: "AUTO_RELEASED" }), null);
});

test("participant report output carries captured qualification without changing the result or digest", async () => {
  const result = { analysis: { findings: [] }, qualifications: ["SHADOW_ONLY"] };
  const job = { ...report({ qualificationRef: "demo://test", syntheticDemoOnly: true }), result };
  const service = new AssessmentProcessingService(
    { assessmentProcessingJob: { findMany: async () => [job] } } as never,
    { participant: async () => {}, evidenceAuthority: async () => {}, scoped: async () => {} } as never,
    {} as never, {} as never, {} as never, {} as never,
  );
  const [released] = await service.list({ actorUserId: "seller", actorSessionId: "session", actingInstitutionId: "demo-institution" }, "engagement");
  assert.equal(released.review?.status, "SYNTHETIC_DEMONSTRATION_ONLY");
  assert.equal(released.resultDigest, job.resultDigest);
  assert.strictEqual(released.result, result);
  assert.deepEqual(result, { analysis: { findings: [] }, qualifications: ["SHADOW_ONLY"] });
});
