import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(process.cwd(), "prisma/migrations/20260830190000_assurerail_pr02_persistence_foundation/migration.sql"),
  "utf8",
);

test("[PR02][SCHEMA] neutral persistence models and ownership columns are additive", () => {
  for (const model of [
    "ProviderReference",
    "SourceReference",
    "IntakeSubmission",
    "IntakeReceipt",
    "IdempotencyRecord",
    "InboxMessage",
    "OutboxMessage",
    "ExternalInstruction",
    "ExternalAcknowledgement",
    "MigrationReceipt",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`), model);
  }
  assert.match(schema, /@@unique\(\[scope, key\]\)/);
  assert.match(schema, /@@unique\(\[providerReferenceId, idempotencyKey\]\)/);
  assert.match(schema, /eventLogId\s+String\?\s+@unique/);
  assert.match(schema, /transactionCaseId\s+String\?/);
  assert.match(schema, /institutionId\s+String\?/);
});

test("[PR02][MIGRATION] migration preserves legacy domain tables and disables/clears plaintext webhook secrets", () => {
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|RENAME\s+(?:TABLE|COLUMN)/i);
  assert.match(migration, /LEGACY_PLAINTEXT_SECRET_CLEARED_REPROVISION_AND_VERIFY/);
  assert.match(migration, /"secret"\s*=\s*NULL/);
  assert.match(migration, /"active"\s*=\s*false/);
  assert.match(migration, /CREATE TABLE "OutboxMessage"/);
  assert.match(migration, /WebhookDelivery_state_nextAttemptAt_idx/);
  assert.match(migration, /OutboxMessage_state_nextAttemptAt_idx/);
});
