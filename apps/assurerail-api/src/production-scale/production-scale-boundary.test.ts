import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const source = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

test("[AR30][SCHEMA] immutable assessment, exact build and independent review fields are explicit", () => {
  const schema = source("prisma/schema.prisma");
  const migration = source(
    "prisma/migrations/20260903030000_assurerail_ar30_production_scale/migration.sql"
  );
  assert.match(schema, /model ProductionScaleAssessment \{/);
  assert.match(schema, /targetOperatingMode\s+String/);
  assert.match(schema, /buildCommit\s+String/);
  assert.match(schema, /controlDigest\s+String/);
  assert.match(schema, /assessmentDigest\s+String\s+@unique/);
  assert.match(schema, /reviewDigest\s+String\?\s+@unique/);
  assert.doesNotMatch(migration, /DROP|TRUNCATE|DELETE\s+FROM/i);
  assert.equal((migration.match(/CREATE TABLE/g) ?? []).length, 1);
  assert.equal((migration.match(/ON DELETE RESTRICT/g) ?? []).length, 1);
});

test("[AR30][API] production-scale governance separates board, snapshot, review and export", () => {
  const controller = source(
    "src/production-scale/production-scale.controller.ts"
  );
  for (const route of [
    '@Get("catalogue/v1")',
    '@Get("board")',
    '@Get("assessments")',
    '@Post("assessments")',
    '@Post("assessments/:assessmentId/review")',
    '@Get("assessments/:assessmentId/evidence-pack")',
  ])
    assert.match(
      controller,
      new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  assert.match(controller, /PRODUCTION_SCALE_VIEW/);
  assert.match(controller, /PRODUCTION_SCALE_ASSESS/);
  assert.match(controller, /PRODUCTION_SCALE_REVIEW/);
  assert.match(controller, /active participant institution/);
});

test("[AR30][OPERATIONS] the board reads every release-blocking control family", () => {
  const service = source("src/production-scale/production-scale.service.ts");
  for (const model of [
    "opsFinding",
    "opsControl",
    "reconciliationBreak",
    "tokenReconciliationBreak",
    "railLifecycleBreak",
    "secondaryTransferBreak",
    "roomParityBreak",
    "outboxMessage",
    "venueCapacityBudget",
    "customerServiceRequest",
    "internalRoleAssignment",
  ])
    assert.match(service, new RegExp(`this\\.db\\.${model}`));
  assert.match(service, /assessment generator cannot review the same snapshot/);
  assert.match(service, /control state changed after assessment/);
  assert.match(service, /This internal assessment does not accept evidence/);
  assert.match(service, /MAX_CONTROL_OBSERVATION_AGE_MS/);
  assert.match(service, /manifest\.environment !== activation\.environment/);
  assert.match(service, /opsControl\?\.killSwitch/);
  assert.match(service, /activeCapacityBudgetsMissing/);
});

test("[AR30][PERIMETER] no action dispatch or live capability is introduced", () => {
  const service = source("src/production-scale/production-scale.service.ts");
  const registry = source("src/runtime/live-capability-registry.ts");
  assert.doesNotMatch(
    service,
    /externalInstruction\.(create|update)|fetch\(|requireCapability\(/
  );
  assert.match(registry, /IMPLEMENTED_LIVE_CAPABILITIES: readonly ImplementedLiveCapability\[\] = \[\]/);
});
