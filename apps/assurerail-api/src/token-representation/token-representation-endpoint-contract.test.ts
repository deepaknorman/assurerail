import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { TokenRepresentationController } from "./token-representation.controllers";

test("[PR11][API] governed tokenised-DA exposes only case-scoped linkage, action observation and reconciliation", () => {
  const base = Reflect.getMetadata(PATH_METADATA, TokenRepresentationController) as string;
  const found = Object.getOwnPropertyNames(TokenRepresentationController.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (TokenRepresentationController.prototype as unknown as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
  assert.equal(found.length, 5);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/cases/:caseId/token-representation")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/link")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/actions")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/actions/:actionId/observations")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/reconciliations")));
  assert.ok(found.every((entry) => !/mint|burn|settle|dispatch/.test(entry.path)));
});
