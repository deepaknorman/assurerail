import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { VenueConductController } from "./venue-conduct.controllers";

test("[PR17][ENDPOINTS] conduct tooling is internal and separates observation, review, controls and capacity", () => {
  const base = Reflect.getMetadata(PATH_METADATA, VenueConductController) as string;
  const found = Object.getOwnPropertyNames(VenueConductController.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (VenueConductController.prototype as unknown as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
  assert.equal(found.length, 18);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/internal/venue-conduct/")));
  assert.ok(found.some((entry) => entry.path.endsWith("/policies/:policyId/review")));
  assert.ok(found.some((entry) => entry.path.endsWith("/alerts/:alertId/review")));
  assert.ok(found.some((entry) => entry.path.endsWith("/corrections/:correctionId/review")));
  assert.ok(found.some((entry) => entry.path.endsWith("/controls/:controlId/review")));
  assert.ok(found.some((entry) => entry.path.endsWith("/capacity/budgets/:budgetId/observations")));
  assert.ok(found.every((entry) => !/execute|settle|mint|burn|allot|transfer-title/.test(entry.path)));
});
