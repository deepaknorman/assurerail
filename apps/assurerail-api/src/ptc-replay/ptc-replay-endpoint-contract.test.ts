import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { PtcReplayController } from "./ptc-replay.controllers";

test("[PR10d][ENDPOINTS] PTC replay exposes case-scoped planning, observation, repair, reconciliation and evidence reads", () => {
  const base = Reflect.getMetadata(PATH_METADATA, PtcReplayController) as string;
  const found = Object.getOwnPropertyNames(PtcReplayController.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (PtcReplayController.prototype as unknown as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
  assert.equal(found.length, 12);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/cases/:caseId/ptc-replay")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/authorisation/:authorisationId/review")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/sagas")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/legs/:legId/observations")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/legs/:legId/reconcile")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/breaks/:breakId/repairs")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/breaks/:breakId/repairs/:repairId/review")));
  assert.ok(found.some((entry) => entry.method === "GET" && entry.path.endsWith("/comparison")));
  assert.ok(found.some((entry) => entry.method === "GET" && entry.path.endsWith("/evidence-pack")));
  assert.ok(found.every((entry) => !/dispatch|settle|allot/.test(entry.path)));
});
