import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const source = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("[PR12][SCHEMA] readiness, immutable decisions and signed activation bindings are explicit and additive", () => {
  const schema = source("prisma/schema.prisma");
  for (const model of ["OperationalReadinessGate", "OperationalReadinessDecision", "DeploymentActivation", "DeploymentActivationGate"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.match(schema, /currentDecisionId\s+String\?\s+@unique/);
  assert.match(schema, /manifestDigest\s+String\s+@unique/);
  assert.match(schema, /status\s+String\s+@default\("DRAFT"\)/);
  assert.match(schema, /proposalStepUpId\s+String/);
  assert.match(schema, /approvalDigest\s+String\?\s+@unique/);
  assert.match(schema, /@@id\(\[deploymentActivationId, readinessGateId\]\)/);
});

test("[PR12][MIGRATION] readiness history is restrictive and no existing table is rewritten", () => {
  const migration = source("prisma/migrations/20260902010000_assurerail_pr12_operational_readiness/migration.sql");
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
  assert.equal((migration.match(/CREATE TABLE/g) ?? []).length, 4);
  assert.equal((migration.match(/ON DELETE RESTRICT/g) ?? []).length, 5);
  assert.match(migration, /"status" TEXT NOT NULL DEFAULT 'DRAFT'/);
});

test("[PR12][API] readiness governance has separate propose, review, activation and revocation commands", () => {
  const controller = source("src/operational-readiness/operational-readiness.controllers.ts");
  for (const route of [
    '@Get("gates")', '@Post("gates")', '@Post("gates/:gateId/review")', '@Get("activations")',
    '@Post("activations")', '@Post("activations/:activationId/review")', '@Post("activations/:activationId/revoke")',
  ]) assert.match(controller, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(controller, /SuperAdminOnly|AdminOnly/);
});

test("[PR12][EVIDENCE] service rejects synthetic external proof and binds manifests to current durable decisions", () => {
  const service = source("src/operational-readiness/operational-readiness.service.ts");
  assert.match(service, /synthetic\|fixture\|demo\|example/i);
  assert.match(service, /proposer\/owner cannot independently accept/);
  assert.match(service, /does not match a current accepted durable decision/);
  assert.match(service, /activation proposer cannot approve the same release/);
  assert.match(service, /changed or expired after activation proposal/);
  assert.match(service, /approvalDigest/);
});

test("[PR12][SAFETY] every legacy direct external-effect family carries the live-mode fence", () => {
  for (const file of [
    "src/mint/mint.service.ts",
    "src/dvp/dvp.service.ts",
    "src/amortise/amortise.service.ts",
    "src/closure/close.service.ts",
    "src/surveillance/surveillance.service.ts",
    "src/breakglass/breakglass.service.ts",
  ]) {
    const implementation = source(file);
    assert.match(implementation, /assertLegacyExternalEffectPathAllowed\(/, file);
  }
});

test("[PR12][SAFETY] a signed manifest can only narrow capabilities implemented by the build", () => {
  const runtime = source("src/runtime/runtime-profile.ts");
  const registry = source("src/runtime/live-capability-registry.ts");
  assert.match(runtime, /isLiveCapabilityImplemented\(capability\.id\)/);
  assert.match(registry, /IMPLEMENTED_LIVE_CAPABILITY_IDS = \[\] as const/);
});
