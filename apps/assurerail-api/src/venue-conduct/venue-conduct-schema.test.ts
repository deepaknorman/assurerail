import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../../");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(root, "prisma/migrations/20260902170000_assurerail_pr17_venue_conduct/migration.sql"), "utf8");
const service = readFileSync(resolve(__dirname, "venue-conduct.service.js"), "utf8");

test("[PR17][SCHEMA] policy, signals, review queues, complaints, corrections, controls and capacity are explicit", () => {
  for (const model of [
    "ConductPolicyRelease", "VenueConductSignal", "VenueConductAlert", "VenueConductInvestigation",
    "VenueComplaint", "VenueCorrection", "VenueControlAction", "VenueCapacityBudget", "VenueCapacityObservation",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /evidentialClassification\s+String\s+@default\("REVIEW_REQUIRED"\)/);
  assert.match(schema, /legalHold\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /priorDigest\s+String/);
  assert.match(schema, /correctedDigest\s+String/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});

test("[PR17][PERIMETER] internal conduct tooling cannot dispatch transactions or declare legal breach", () => {
  assert.doesNotMatch(service, /selectSettlementAdapter|selectHtsAdapter|selectHcsAdapter|\.dispatch\(|ExternalInstruction/);
  assert.doesNotMatch(service, /LEGAL_VIOLATION|MISCONDUCT_CONFIRMED|AUTOMATIC_SANCTION/);
  assert.match(service, /REVIEW_REQUIRED/);
  assert.match(service, /proposer cannot review the same/);
  assert.match(service, /synthetic\/demo\/fixture\/example/);
});
