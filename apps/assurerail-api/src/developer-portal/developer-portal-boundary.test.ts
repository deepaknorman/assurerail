import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../..");
const controller = readFileSync(resolve(__dirname, "developer-portal.controller.js"), "utf8");
const service = readFileSync(resolve(__dirname, "developer-portal.service.js"), "utf8");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");

test("[PR19][ENDPOINTS] developer routes are institution-scoped and separate contracts, clients, conformance, delivery and exit", () => {
  assert.match(controller, /institutions\/:institutionId\/developer/);
  for (const route of ["contracts/v1", "sandbox/fixtures/v1", "clients", "conformance-runs", "webhooks", "deliveries", "exit-exports"]) assert.match(controller, new RegExp(route));
  assert.match(controller, /path institution must match active session context/);
});

test("[PR19][SECRETS] participant list and exit projections omit Vault references", () => {
  const listBlock = service.slice(service.indexOf("async listClients"), service.indexOf("async registerClient"));
  const exportBlock = service.slice(service.indexOf("async exportIntegration"), service.indexOf("private authorised"));
  assert.doesNotMatch(listBlock, /credentialVaultRef:/);
  assert.doesNotMatch(exportBlock, /credentialVaultRef:/);
  assert.match(exportBlock, /secretsExcluded: true/);
});

test("[PR19][SCHEMA] client credentials, conformance and exit manifests are versioned and restrictive", () => {
  for (const model of ["DeveloperClientRegistration", "DeveloperCredentialVersion", "DeveloperConformanceRun", "IntegrationExitExport"]) assert.match(schema, new RegExp(`model ${model}`));
  assert.match(schema, /currentCredentialVersion\s+Int/);
  assert.match(schema, /sandboxNonEvidence\s+Boolean\s+@default\(true\)/);
  assert.match(schema, /manifestDigest\s+String/);
});
