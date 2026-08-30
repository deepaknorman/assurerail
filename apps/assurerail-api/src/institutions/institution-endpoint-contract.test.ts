import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ADMIN_KEY } from "../auth/roles.decorator";
import { InstitutionAdminController, InstitutionController } from "./institution.controllers";

type ControllerClass = abstract new (...args: never[]) => object;

function path(base: unknown, child: unknown): string {
  return `/${[base, child].flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean).join("/")}`;
}

function endpoints(controller: ControllerClass) {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as unknown;
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (controller.prototype as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const admin = Reflect.getMetadata(ADMIN_KEY, handler) ?? Reflect.getMetadata(ADMIN_KEY, controller) ?? false;
    return [{
      method: RequestMethod[method],
      path: path(base, Reflect.getMetadata(PATH_METADATA, handler)),
      access: admin ? "PLATFORM_ADMIN" : "AUTHENTICATED_WITH_SERVICE_AUTHORITY",
    }];
  }).sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

test("[PR04][ENDPOINTS] institutional routes are versioned and have an explicit access boundary", () => {
  const found = [...endpoints(InstitutionController), ...endpoints(InstitutionAdminController)]
    .sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
  assert.equal(found.length, 19);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/")));
  assert.equal(found.filter((entry) => entry.access === "PLATFORM_ADMIN").length, 6);
  assert.deepEqual(found.map((entry) => `${entry.method} ${entry.path}`), [
    "POST /v1/rail/admin/admission-decisions/:decisionId/review",
    "GET /v1/rail/admin/institutions",
    "GET /v1/rail/admin/institutions/:institutionId",
    "POST /v1/rail/admin/institutions/:institutionId/admission-decisions",
    "POST /v1/rail/admin/institutions/:institutionId/evidence",
    "POST /v1/rail/admin/route-entitlements/:entitlementId/review",
    "GET /v1/rail/institutions",
    "POST /v1/rail/institutions",
    "GET /v1/rail/institutions/:institutionId",
    "POST /v1/rail/institutions/:institutionId/appointments",
    "POST /v1/rail/institutions/:institutionId/mandates",
    "POST /v1/rail/institutions/:institutionId/members/invitations",
    "POST /v1/rail/institutions/:institutionId/route-entitlements",
    "POST /v1/rail/institutions/:institutionId/route-entitlements/evaluate",
    "POST /v1/rail/institutions/:institutionId/status-changes",
    "POST /v1/rail/institutions/appointments/:appointmentId/accept",
    "POST /v1/rail/institutions/mandates/:mandateId/review",
    "POST /v1/rail/institutions/memberships/:memberId/accept",
    "POST /v1/rail/institutions/status-changes/:proposalId/review",
  ]);
});

test("[PR03][ENDPOINTS] institution module is mounted only in explicit participant-admission shadow mode", () => {
  const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../../src/app.module.ts"), "utf8") as string;
  assert.match(source, /participantAdmission === "shadow"/);
  assert.match(source, /InstitutionsModule/);
});

test("[PR03][FLAGS] route-entitlement APIs are unavailable while compare mode is off", async () => {
  const previous = process.env.ARAIL_ROUTE_ENTITLEMENT_ENFORCE;
  process.env.ARAIL_ROUTE_ENTITLEMENT_ENFORCE = "off";
  try {
    const controller = new InstitutionController({} as never, {} as never, {} as never);
    assert.throws(
      () => controller.proposeRouteEntitlement(
        { user: { id: "user-1", activeInstitution: { institutionId: "inst-1" } } } as never,
        "inst-1",
        {} as never,
      ),
      ForbiddenException,
    );
  } finally {
    if (previous === undefined) delete process.env.ARAIL_ROUTE_ENTITLEMENT_ENFORCE;
    else process.env.ARAIL_ROUTE_ENTITLEMENT_ENFORCE = previous;
  }
});
