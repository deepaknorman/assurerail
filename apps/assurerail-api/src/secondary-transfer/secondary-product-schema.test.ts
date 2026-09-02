import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260903000000_assurerail_ar27_secondary_product/migration.sql"), "utf8");

test("[AR27][SCHEMA] repair is additive, attributable and bound to retained evidence", () => {
  for (const token of ["model SecondaryTransferRepair", "secondaryTransferBreakId", "replacementEvidenceType", "providerInstitutionId", "evidenceObjectId", "assertionDigest", "authorityEvidenceRef", "proposedByUserId", "reviewedByUserId", "appliedEvidenceRecordId"]) assert.match(schema, new RegExp(token));
  assert.match(migration, /CREATE TABLE "SecondaryTransferRepair"/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE\s+"/i);
});
