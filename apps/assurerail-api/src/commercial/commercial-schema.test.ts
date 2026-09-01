import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../../");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(root, "prisma/migrations/20260902030000_assurerail_pr13_primary_commercial_venue/migration.sql"), "utf8");
const service = readFileSync(resolve(__dirname, "commercial.service.js"), "utf8");

test("[PR13][SCHEMA] commercial records are case-, institution- and immutable-version scoped", () => {
  for (const model of [
    "CommercialOpportunity", "CommercialTermVersion", "CommercialAudienceGrant",
    "CommercialOpportunityChange", "CommercialInterestIndication", "CommercialRfq",
    "CommercialNegotiationThread", "CommercialNegotiationMessage", "CommercialAllocation",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /audienceMode\s+String\s+@default\("NAMED_INSTITUTIONS"\)/);
  assert.match(schema, /@@unique\(\[commercialOpportunityId, version\]\)/);
  assert.match(schema, /@@unique\(\[commercialOpportunityId, institutionId, idempotencyKey\]\)/);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) ?? []).length >= 15);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});

test("[PR13][PERIMETER] commercial interaction cannot match, execute, settle, issue or dispatch", () => {
  assert.doesNotMatch(service, /selectSettlementAdapter|selectHtsAdapter|selectHcsAdapter|WebhookEgress|\.dispatch\(/);
  assert.doesNotMatch(service, /automaticMatch|executeTrade|settleTrade|mint\(|burn\(/);
  assert.match(service, /permissioned primary commercial venue is disabled/);
  assert.match(service, /lifecycleLeg !== "INITIAL_TRANSFER_OR_ISSUE"/);
  assert.match(service, /opportunity owner cannot act as its own counterparty/);
  assert.match(service, /change proposer cannot review their own proposal/);
  assert.match(service, /allocation proposer cannot review their own proposal/);
  assert.match(service, /commercial-opportunity:/);
  assert.match(service, /commercial-allocation:/);
  assert.match(service, /COMMERCIAL_AUDIENCE_REVOKE/);
});
