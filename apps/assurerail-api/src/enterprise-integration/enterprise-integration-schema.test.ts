import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
const root = path.resolve(__dirname, "../..");
const source = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

test("[AR29][SCHEMA] profiles, gates, health and case bindings are explicit and restrictive", () => {
  const schema = source("prisma/schema.prisma");
  const migration = source(
    "prisma/migrations/20260903020000_assurerail_ar29_enterprise_integration/migration.sql"
  );
  for (const model of [
    "EnterpriseIntegrationProfile",
    "EnterpriseIntegrationGate",
    "EnterpriseCaseIntegrationBinding",
    "EnterpriseIntegrationHealthObservation",
  ])
    assert.match(schema, new RegExp(`model ${model} \\{`));
  for (const table of [
    "EnterpriseIntegrationProfile",
    "EnterpriseIntegrationGate",
    "EnterpriseCaseIntegrationBinding",
    "EnterpriseIntegrationHealthObservation",
  ])
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
  assert.equal((migration.match(/ON DELETE RESTRICT/g) ?? []).length, 9);
  assert.doesNotMatch(migration, /ON DELETE CASCADE|DROP TABLE|DROP COLUMN/);
});

test("[AR29][API] all integration routes are institution/case scoped and expose no dispatch callback", () => {
  const controller = source(
    "src/enterprise-integration/enterprise-integration.controller.ts"
  );
  assert.match(
    controller,
    /v1\/rail\/institutions\/:institutionId\/integrations/
  );
  assert.match(controller, /v1\/rail\/cases\/:caseId\/integrations/);
  assert.match(
    controller,
    /path institution must match active session context/
  );
  assert.doesNotMatch(
    controller,
    /dispatch|callback|webhook|execute|payment|sign|stamp/i
  );
});
