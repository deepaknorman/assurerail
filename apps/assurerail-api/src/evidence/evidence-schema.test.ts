import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260830220000_assurerail_pr05_evidence_intake/migration.sql"), "utf8");

test("[PR05][SCHEMA] connector, immutable evidence, document and access records are explicit", () => {
  for (const model of ["ConnectorRegistration", "ConnectorCertification", "EvidenceObject", "EvidenceVersion", "RailDocumentFamily", "RailDocumentVersion", "EvidenceAccessGrant", "EvidenceAccessReceipt", "EvidenceRetentionEvent"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`), model);
  }
  assert.match(schema, /@@unique\(\[evidenceObjectId, version\]\)/);
  assert.match(schema, /storageRef\s+String\s+@unique/);
  assert.match(schema, /legalHold\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /eventDigest\s+String\s+@unique/);
});

test("[PR05][MIGRATION] evidence migration is additive and legacy bytes become nullable, not discarded", () => {
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.match(migration, /ALTER TABLE "Document" ALTER COLUMN "data" DROP NOT NULL/);
  assert.match(migration, /CREATE TABLE "EvidenceVersion"/);
  assert.match(migration, /CREATE TABLE "EvidenceRetentionEvent"/);
  assert.match(migration, /EvidenceVersion_evidenceObjectId_payloadDigest_key/);
});
