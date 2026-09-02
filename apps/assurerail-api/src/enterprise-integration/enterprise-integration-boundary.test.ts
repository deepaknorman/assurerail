import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
const root = path.resolve(__dirname, "../..");
const source = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

test("[AR29][BOUNDARY] integration governance cannot dispatch, certify or store secrets", () => {
  const service = source(
    "src/enterprise-integration/enterprise-integration.service.ts"
  );
  const policy = source(
    "src/enterprise-integration/enterprise-integration-policy.ts"
  );
  assert.match(policy, /dispatchPermitted: false/);
  assert.match(policy, /softwareConformanceIsCertification: false/);
  assert.match(policy, /credentialsStored: false/);
  assert.doesNotMatch(
    service,
    /externalInstruction\.(create|update)|fetch\(|credentialVaultRef|secretValue|payment\(|sign\(|stamp\(/
  );
  assert.doesNotMatch(service, /return \{ \.\.\.profile/);
});

test("[AR29][AUTHORITY] case binding requires active route function performer and current readiness", () => {
  const service = source(
    "src/enterprise-integration/enterprise-integration.service.ts"
  );
  assert.match(
    service,
    /item\.materialFunction === materialFunction && item\.status === "ACTIVE"/
  );
  assert.match(
    service,
    /assignment\.performerInstitutionId !== profile\.institutionId/
  );
  assert.match(service, /profile readiness is no longer current/);
  assert.match(service, /binding maker cannot review their own proposal/);
  assert.match(
    service,
    /parties:\s*\{\s*some:\s*\{\s*institutionId:\s*actor\.actingInstitutionId,\s*status:\s*"ACTIVE"/
  );
});
