import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../../");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(root, "prisma/migrations/20260902140000_assurerail_pr14_conventional_secondary/migration.sql"), "utf8");
const service = readFileSync(resolve(__dirname, "secondary-transfer.service.js"), "utf8");

test("[PR14][SCHEMA] secondary dossiers retain evidence versions, ordered legs and explicit breaks", () => {
  for (const model of ["SecondaryTransfer", "SecondaryTransferEvidence", "SecondaryTransferLeg", "SecondaryTransferBreak"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /executionMode\s+String\s+@default\("OBSERVE_ONLY"\)/);
  assert.match(schema, /@@unique\(\[secondaryTransferId, evidenceType, version\]/);
  assert.match(service, /PTC_TRUSTEE_RECORDKEEPER_DISAGREEMENT|compareSecondaryAuthority/);
  assert.match(service, /externalMutation: "NONE"/);
  assert.doesNotMatch(service, /selectSettlementAdapter|selectHtsAdapter|selectHcsAdapter|\.dispatch\(|mint\(|burn\(/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) ?? []).length >= 10);
});
