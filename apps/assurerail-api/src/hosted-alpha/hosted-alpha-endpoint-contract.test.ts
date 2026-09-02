import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const controller = readFileSync(path.join(__dirname, "hosted-alpha.controller.js"), "utf8");
const service = readFileSync(path.join(__dirname, "hosted-alpha.service.js"), "utf8");
const app = readFileSync(path.resolve(__dirname, "../app.module.js"), "utf8");

test("[AR21][CONTRACT] task endpoint is active-institution scoped and shadow gated", () => {
  assert.match(controller, /path institution must match active session context/);
  assert.match(controller, /v1\/rail\/institutions\/:institutionId\/hosted-alpha/);
  assert.match(service, /hosted alpha action centre is disabled/);
  assert.match(service, /VIEW_INSTITUTION/);
  assert.match(service, /Task visibility is not command authority/);
  assert.match(app, /HostedAlphaModule/);
});

test("[AR21][CONTRACT] task response excludes the legacy platform-wide activity feed", () => {
  assert.doesNotMatch(service, /auditLog|venue\/activity/);
  assert.match(service, /ownerInstitutionId: actingInstitutionId/);
  assert.match(service, /offereeInstitutionId: actingInstitutionId/);
  assert.match(service, /institutionId: actingInstitutionId/);
});
