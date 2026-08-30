import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { CasesController } from "./cases.controllers";

function endpoints(controller: abstract new (...args: never[]) => object) {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (controller.prototype as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
}

test("[PR06][ENDPOINTS] case commands use the versioned neutral namespace", () => {
  const found = endpoints(CasesController);
  assert.equal(found.length, 13);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/cases")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:caseId/transitions")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:caseId/replay")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:caseId/parties/:partyId/accept")));
  assert.ok(found.every((entry) => !entry.path.includes("poolId") && !entry.path.includes("noteId") && !entry.path.includes("claId")));
});
