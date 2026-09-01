import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../../");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(root, "prisma/migrations/20260901200000_assurerail_pr11_tokenised_da_representation/migration.sql"), "utf8");
const service = readFileSync(resolve(__dirname, "token-representation.service.js"), "utf8");

test("[PR11][SCHEMA] token representation is case- and Note-unique with an explicit legal-record declaration", () => {
  for (const model of ["TokenRepresentation", "TokenAction", "TokenReconciliationSnapshot", "TokenReconciliationBreak"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /transactionCaseId\s+String\s+@unique/);
  assert.match(schema, /noteId\s+String\s+@unique/);
  assert.match(schema, /authoritativeRecordDeclarationId\s+String/);
  assert.match(schema, /authorityMode\s+String\s+@default\("MIRROR"\)/);
});

test("[PR11][SAFETY] governed token actions are observe-only and cannot invoke external adapters", () => {
  assert.match(schema, /executionMode\s+String\s+@default\("OBSERVE_ONLY"\)/);
  assert.match(service, /executionMode: "OBSERVE_ONLY", dispatchProhibited: true/);
  assert.doesNotMatch(service, /selectHtsAdapter|selectHcsAdapter|selectSettlementAdapter/);
  assert.match(service, /tokenised-DA representation adapter is disabled/);
  assert.match(service, /authorityMode !== "MIRROR"/);
});
