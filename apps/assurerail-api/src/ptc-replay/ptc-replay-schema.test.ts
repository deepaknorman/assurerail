import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(
  process.cwd(),
  "prisma/migrations/20260901150000_assurerail_pr10_ptc_replay_foundation/migration.sql",
), "utf8");
const routePack = readFileSync(resolve(process.cwd(), "src/ptc-replay/ptc-route-pack.ts"), "utf8");
const planningService = readFileSync(resolve(process.cwd(), "src/ptc-replay/ptc-replay.service.ts"), "utf8");

test("[PR10][SCHEMA] PTC authorisation and generic immutable saga evidence remain explicit", () => {
  assert.match(schema, /model PtcReplayAuthorisation \{/);
  assert.match(schema, /model SagaEvidenceLink \{/);
  assert.match(schema, /transactionRoute\s+String\s+@default\("DA"\)/);
  assert.match(schema, /routeEvidenceBundleDigest\s+String/);
  assert.match(schema, /@@unique\(\[settlementSagaId, evidenceRole\]\)/);
  assert.match(schema, /@@unique\(\[settlementSagaId, sequence\]\)/);
  assert.match(schema, /transfereeCreditDecisionEvidenceObjectId\s+String\?/);
  assert.match(schema, /executedTransferDocumentEvidenceObjectId\s+String\?/);
});

test("[PR10][MIGRATION] existing DA rows are backfilled without destructive transformation", () => {
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  assert.match(migration, /ADD COLUMN "transactionRoute" TEXT NOT NULL DEFAULT 'DA'/);
  assert.match(migration, /SET "routeEvidenceBundleDigest" = "planDigest"/);
  assert.equal((migration.match(/DROP NOT NULL/g) ?? []).length, 3);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) ?? []).length >= 3);
});

test("[PR10][PERIMETER] the PTC foundation remains observe-only and imports no token, payment or external-egress adapter", () => {
  assert.match(routePack, /executionMode: "OBSERVE_ONLY"/);
  assert.doesNotMatch(routePack, /settlement\.adapter|hcs\.adapter|hts\.adapter|WebhookEgress|\.dispatch\(/);
  assert.doesNotMatch(routePack, /\bNote\b|mint|burn/i);
  assert.doesNotMatch(planningService, /settlement\.adapter|hcs\.adapter|hts\.adapter|WebhookEgress|\.dispatch\(/);
  assert.doesNotMatch(planningService, /\bNote\b|mint|burn/i);
  assert.match(planningService, /transactionRoute: "PTC"/);
  assert.match(planningService, /executionMode: "OBSERVE_ONLY"/);
});
