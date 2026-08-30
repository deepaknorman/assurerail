import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ADMIN_KEY } from "../auth/roles.decorator";
import { EvidenceAdminController, EvidenceController } from "./evidence.controllers";

function endpoints(controller: abstract new (...args: never[]) => object) {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (controller.prototype as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/"), admin: Boolean(Reflect.getMetadata(ADMIN_KEY, controller)) }];
  });
}

test("[PR05][ENDPOINTS] evidence routes are versioned and administration remains separate", () => {
  const found = [...endpoints(EvidenceController), ...endpoints(EvidenceAdminController)].sort((a, b) => `${a.path}${a.method}`.localeCompare(`${b.path}${b.method}`));
  assert.equal(found.length, 11);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/")));
  assert.equal(found.filter((entry) => entry.admin).length, 2);
  assert.ok(found.some((entry) => entry.path.endsWith("/evidence/:evidenceObjectId/download") && entry.method === "GET"));
  assert.ok(found.some((entry) => entry.path.endsWith("/connector-certifications/:certificationId/review") && entry.admin));
  assert.ok(found.some((entry) => entry.path.endsWith("/evidence/:evidenceObjectId/legal-hold") && entry.admin));
});
