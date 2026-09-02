import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { TokenisedProductController, TokenisedProductRegistryController } from "./tokenised-product.controllers";

function routes(controller: object) {
  const ctor = controller as { prototype: Record<string, unknown> };
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  return Object.getOwnPropertyNames(ctor.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = ctor.prototype[name]; if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/").replace(/\/$/, "") }];
  });
}

test("[AR28][API] tokenised product adds only scoped reads and evidence export", () => {
  const found = [...routes(TokenisedProductRegistryController), ...routes(TokenisedProductController)];
  assert.deepEqual(found, [
    { method: "GET", path: "/v1/rail/tokenised-routes" },
    { method: "GET", path: "/v1/rail/cases/:caseId/tokenised-product" },
    { method: "GET", path: "/v1/rail/cases/:caseId/tokenised-product/evidence-pack" },
  ]);
  assert.ok(found.every((item) => item.method === "GET"));
  assert.ok(found.every((item) => !/mint|issue|allot|transfer|burn|dispatch/.test(item.path)));
});
