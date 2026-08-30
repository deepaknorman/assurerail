import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schema = readFileSync(
  resolve(process.cwd(), "prisma/schema.prisma"),
  "utf8"
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    "prisma/migrations/20260831190000_assurerail_pr09_da_replay_saga/migration.sql"
  ),
  "utf8"
);
const service = readFileSync(
  resolve(process.cwd(), "src/da-replay/da-replay.service.ts"),
  "utf8"
);

test("[PR09][SCHEMA] saga facts, append-only observations, authority, breaks and repairs remain explicit", () => {
  for (const model of [
    "DaReplayAuthorisation",
    "SettlementSaga",
    "SettlementLeg",
    "SagaLegObservation",
    "AuthoritativeRecordDeclaration",
    "AuthoritativeRecordSnapshot",
    "ReconciliationBreak",
    "SagaRepairAction",
  ])
    assert.match(schema, new RegExp(`model ${model} \\{`), model);
  assert.match(schema, /executionMode\s+String\s+@default\("OBSERVE_ONLY"\)/);
  assert.match(schema, /@@unique\(\[settlementLegId, version\]\)/);
  assert.match(schema, /independentlyClosedByUserId\s+String\?/);
  assert.match(schema, /historicOutcomeDigest\s+String/);
  assert.match(schema, /reviewIdempotencyKey\s+String\?/);
  assert.match(schema, /reconciliationRequestDigest\s+String\?/);
  assert.match(schema, /historicOutcomeEvidenceObjectId\s+String/);
  assert.match(schema, /transfereeCreditDecisionEvidenceObjectId\s+String/);
  assert.match(schema, /executedTransferDocumentEvidenceObjectId\s+String/);
  assert.match(schema, /declarationEvidenceObjectId\s+String/);
  assert.match(schema, /SettlementLeg_saga_reconciliation_idempotency_key/);
});

test("[PR09][MIGRATION] migration is additive and history relationships are restrictive", () => {
  assert.doesNotMatch(
    migration,
    /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i
  );
  assert.equal((migration.match(/CREATE TABLE/g) ?? []).length, 8);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) ?? []).length >= 17);
  assert.match(migration, /SettlementLeg_settlementSagaId_sequence_key/);
  assert.match(migration, /SettlementLeg_saga_reconciliation_idempotency_key/);
  assert.match(
    migration,
    /SagaLegObservation_settlementLegId_idempotencyKey_key/
  );
});

test("[PR09][PERIMETER] replay service imports no payment, token, anchor or external-egress adapter", () => {
  assert.doesNotMatch(
    service,
    /settlement\.adapter|hcs\.adapter|hts\.adapter|WebhookEgress|\.dispatch\(/
  );
  assert.match(service, /NO_MONEY_TITLE_REGISTER_OR_NOTICE_ACTION_DISPATCHED/);
  assert.match(service, /executionMode:\s*"OBSERVE_ONLY"/);
});
