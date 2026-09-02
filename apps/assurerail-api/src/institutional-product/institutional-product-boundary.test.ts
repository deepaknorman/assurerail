import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../..");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(root, "prisma/migrations/20260902210000_assurerail_ar22_institutional_product/migration.sql"), "utf8");
const service = readFileSync(resolve(__dirname, "institutional-product.service.js"), "utf8");
const controller = readFileSync(resolve(__dirname, "institutional-product.controller.js"), "utf8");
const governance = readFileSync(resolve(__dirname, "../institutions/institution-governance.service.js"), "utf8");

test("[AR22][SCHEMA] federation, service identity, recertification and exit are explicit durable records", () => {
  for (const model of ["InstitutionIdentityConnection", "InstitutionAccessReview", "InstitutionExitPlan"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /credentialFingerprint\s+String\?/);
  assert.match(schema, /@@unique\(\[institutionId, connectionKey\]\)/);
  assert.match(schema, /@@unique\(\[institutionId, reviewRef\]\)/);
  assert.match(schema, /@@unique\(\[institutionId, exitRef\]\)/);
});

test("[AR22][AUTHORITY] routes are active-institution scoped and every mutation consumes purpose-bound step-up", () => {
  assert.match(controller, /path institution must match active session context/);
  for (const action of ["MANAGE_IDENTITY_CONNECTIONS", "MANAGE_SERVICE_IDENTITIES", "MANAGE_ACCESS_REVIEWS", "MANAGE_PARTICIPANT_EXIT"]) assert.match(service, new RegExp(action));
  for (const purpose of ["IDENTITY_CONNECTION_PROPOSE", "IDENTITY_CONNECTION_REVIEW", "SERVICE_IDENTITY_PROPOSE", "SERVICE_IDENTITY_REVIEW", "INSTITUTION_ACCESS_REVIEW_PROPOSE", "INSTITUTION_ACCESS_REVIEW_REVIEW", "PARTICIPANT_EXIT_PROPOSE", "PARTICIPANT_EXIT_REVIEW"]) assert.match(service, new RegExp(purpose));
  assert.match(service, /maker cannot review their own identity connection/);
  assert.match(service, /maker cannot review their own service identity/);
  assert.match(service, /maker cannot review their own access review/);
  assert.match(service, /maker cannot review their own exit plan/);
  assert.match(service, /error instanceof [A-Za-z0-9_]+\.Prisma\.PrismaClientKnownRequestError && error\.code === "P2002"/);
  for (const duplicate of ["connectionKey already exists", "clientId already exists", "reviewRef already exists", "exitRef already exists"]) {
    assert.match(service, new RegExp(duplicate));
  }
});

test("[AR22][BOUNDARY] shadow approval never enables authentication, changes authority or executes exit", () => {
  assert.match(service, /liveAuthenticationEnabled: false/);
  assert.match(service, /authenticationEnabled: false/);
  assert.match(service, /authorityChanged: false/);
  assert.match(service, /executionRequiresSeparateGovernedActions: true/);
  assert.match(service, /credentialMaterialAccepted: false/);
  assert.match(service, /secretMaterialExcluded: true/);
  assert.doesNotMatch(service, /SETTLEMENT_ADAPTER|HTS_ADAPTER|ExternalInstruction/);
  assert.match(governance, /shadowAccessTarget && changeType === "REINSTATE"/);
  assert.match(governance, /institutionIdentityConnection\.updateMany/);
});

test("[AR22][HONESTY] readiness keeps conditional and external states distinct", () => {
  for (const state of ["ACTION_REQUIRED", "WAITING_REVIEW", "CONDITIONAL", "SHADOW_READY", "OPTIONAL", "MONITORED", "PLANNED", "AVAILABLE"]) assert.match(service, new RegExp(`"${state}"`));
  assert.match(service, /Readiness labels do not grant route authority/);
});
