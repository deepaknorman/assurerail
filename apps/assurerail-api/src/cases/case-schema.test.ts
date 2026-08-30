import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260830230000_assurerail_pr06_transaction_case/migration.sql"), "utf8");
const caseModel = schema.slice(schema.indexOf("model TransactionCase {"), schema.indexOf("model CaseVersion {"));

test("[PR06][SCHEMA] neutral cases keep route, representation, authority, version and replay facts explicit", () => {
  for (const model of ["TransactionCase", "CaseVersion", "CaseParty", "CaseFunctionAssignment", "CaseCondition", "CaseDecision", "CaseApproval", "CaseTransition", "CaseReplayReceipt"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`), model);
  }
  assert.match(caseModel, /transactionRoute\s+String/);
  assert.match(caseModel, /representation\s+String/);
  assert.match(caseModel, /routePackVersion\s+String/);
  assert.match(caseModel, /creationRequestDigest\s+String/);
  assert.doesNotMatch(caseModel, /poolId|claId|noteId|tokenId/);
  assert.match(schema, /@@unique\(\[transactionCaseId, idempotencyKey\]\)/);
  assert.match(schema, /requestDigest\s+String/);
  assert.match(schema, /caseAggregateVersion\s+Int/);
});

test("[PR06][MIGRATION] case persistence is additive and every relationship is restrictive", () => {
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.equal((migration.match(/CREATE TABLE/g) ?? []).length, 9);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) ?? []).length >= 11);
  assert.match(migration, /CaseTransition_case_idempotency_key/);
  assert.match(migration, /CaseReplayReceipt_case_version_replay_key/);
});
