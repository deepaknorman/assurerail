import assert from "node:assert/strict";
import test from "node:test";
import { DEVELOPER_CONTRACT_CATALOGUE_V1, SANDBOX_FIXTURE_SET_V1, evaluateSoftwareConformance } from "./developer-contracts";

const digest = `sha256:${"a".repeat(64)}`;

test("[PR19] published fixtures are conspicuously synthetic and do not claim certification", () => {
  assert.equal(SANDBOX_FIXTURE_SET_V1.sandboxNonEvidence, true);
  assert.match(SANDBOX_FIXTURE_SET_V1.warning, /not transaction, legal, trustee, connector-certification or authoritative-record evidence/);
  assert.equal(DEVELOPER_CONTRACT_CATALOGUE_V1.authority, "API enforcement; documentation does not grant an action");
});

test("[PR19] complete exact observations can pass software conformance only", () => {
  const result = evaluateSoftwareConformance(SANDBOX_FIXTURE_SET_V1.fixtures.map((fixture) => ({ fixtureId: fixture.id, observedStatus: fixture.expectedStatus, responseDigest: digest })));
  assert.equal(result.result, "PASSED_SOFTWARE");
  assert.ok(result.assertions.every((item) => item.passed));
  assert.match(result.inputDigest, /^sha256:[a-f0-9]{64}$/);
});

test("[PR19] missing evidence is review-required and wrong or extra observations fail", () => {
  assert.equal(evaluateSoftwareConformance([]).result, "REVIEW_REQUIRED");
  const observations = SANDBOX_FIXTURE_SET_V1.fixtures.map((fixture) => ({ fixtureId: fixture.id, observedStatus: fixture.expectedStatus, responseDigest: digest }));
  observations[0].observedStatus = "ACCEPTED_WITH_DIFFERENT_RESULT";
  assert.equal(evaluateSoftwareConformance(observations).result, "FAILED_SOFTWARE");
  assert.equal(evaluateSoftwareConformance([...observations.slice(1), { fixtureId: "invented", observedStatus: "ACCEPTED", responseDigest: digest }]).result, "REVIEW_REQUIRED");
});
