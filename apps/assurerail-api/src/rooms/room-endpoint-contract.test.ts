import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RoomsController } from "./rooms.controllers";

test("[PR07][ENDPOINTS] room comparison APIs are case-scoped and expose no create/grant/message mutation", () => {
  const base = Reflect.getMetadata(PATH_METADATA, RoomsController) as string;
  const found = Object.getOwnPropertyNames(RoomsController.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (RoomsController.prototype as unknown as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
  assert.equal(found.length, 10);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/cases/:caseId/rooms")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/legacy-imports")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:roomId/parity-runs")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/parity-breaks/:breakId/resolve")));
  assert.ok(found.every((entry) => !entry.path.endsWith("/grants") && !entry.path.endsWith("/messages") || entry.method === "GET"));
});
