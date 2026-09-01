import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { CommercialController } from "./commercial.controllers";

test("[PR13][ENDPOINTS] only named primary opportunity, RFQ, negotiation and allocation records are exposed", () => {
  const base = Reflect.getMetadata(PATH_METADATA, CommercialController) as string;
  const found = Object.getOwnPropertyNames(CommercialController.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (CommercialController.prototype as unknown as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
  assert.equal(found.length, 16);
  assert.ok(found.some((entry) => entry.method === "GET" && entry.path === "/v1/rail/commercial/opportunities"));
  assert.ok(found.some((entry) => entry.path.endsWith("/changes/:changeId/review")));
  assert.ok(found.some((entry) => entry.path.endsWith("/audience/:institutionId/revoke")));
  assert.ok(found.some((entry) => entry.path.endsWith("/rfqs/:rfqId/respond")));
  assert.ok(found.some((entry) => entry.path.endsWith("/allocations/:allocationId/review")));
  assert.ok(found.every((entry) => !/match|order-book|execute|settle|issue|mint|burn/.test(entry.path)));
});
