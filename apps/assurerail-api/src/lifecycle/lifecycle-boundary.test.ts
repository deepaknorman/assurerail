import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const service = readFileSync(resolve(process.cwd(), "src/lifecycle/lifecycle.service.ts"), "utf8");
const controller = readFileSync(resolve(process.cwd(), "src/lifecycle/lifecycle.controller.ts"), "utf8");
const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260902220000_assurerail_ar25_lifecycle_product/migration.sql"), "utf8");

test("[AR25][PERIMETER] lifecycle is observe-only and contains no external dispatch path", () => {
  assert.match(service, /operatingBoundary: "OBSERVE_ONLY"/);
  assert.match(service, /does not service assets, move funds, deliver legal notices/);
  assert.doesNotMatch(service, /\.dispatch\(|ExternalInstruction|SettlementAdapter|HtsAdapter|HcsAdapter/);
});
test("[AR25][AUTHORITY] events require assigned institution, verified evidence and independent reconciliation", () => {
  assert.match(service, /only the assigned accountable institution may record this event/);
  assert.match(service, /signatureStatus !== "VERIFIED"/);
  assert.match(service, /event recorder cannot reconcile their own observation/);
  assert.match(service, /payloadDigest !== observedDigest/);
  assert.match(service, /prior required obligation is not observed/);
  assert.match(service, /await this\.requireLifecycleFunction/);
  assert.match(service, /this\.access\.evaluateRoute/);
  assert.match(service, /latest\.version !== evidence\.currentVersion/);
  assert.match(service, /finalityClass !== "FINAL"/);
  assert.match(service, /observedAt cannot be materially in the future/);
});

test("[AR25][MINIMISATION] overview and command results use an explicit safe projection", () => {
  assert.match(service, /satisfies Prisma\.RailLifecyclePlanSelect/);
  assert.match(service, /select: safePlanSelect/);
  const projection = service.slice(service.indexOf("const safePlanSelect"), service.indexOf("satisfies Prisma.RailLifecyclePlanSelect"));
  for (const sensitive of ["expected: true", "observed: true", "requestDigest: true", "createdByMandateId: true", "reconciliationStepUpId: true", "recordedByMandateId: true"]) assert.doesNotMatch(projection, new RegExp(sensitive));
});

test("[AR25][API] lifecycle surface is case scoped", () => {
  assert.match(controller, /@Controller\("v1\/rail\/cases\/:caseId\/lifecycle"\)/);
  assert.equal((controller.match(/@(Get|Post)\(/g) ?? []).length, 4);
});

test("[AR25][SCHEMA] lifecycle records are additive, immutable and restrict deletion", () => {
  for (const model of ["RailLifecyclePlan", "RailLifecycleObligation", "RailLifecycleEvent", "RailLifecycleBreak"]) assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) ?? []).length >= 9);
  assert.match(schema, /@@unique\(\[lifecycleObligationId, version\]\)/);
  assert.match(schema, /@@unique\(\[lifecycleObligationId, idempotencyKey\]\)/);
  assert.match(schema, /lifecycleEventId\s+String\s+@unique/);
});
