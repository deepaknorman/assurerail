import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { DaReplayController } from "./da-replay.controllers";

function endpoints(controller: abstract new (...args: never[]) => object) {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (controller.prototype as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as
      | RequestMethod
      | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [
      {
        method: RequestMethod[method],
        path: `/${[base, child].filter(Boolean).join("/")}`.replace(
          /\/+/g,
          "/"
        ),
      },
    ];
  });
}

test("[PR09][ENDPOINTS] DA replay is case-scoped and exposes governance, saga, repair and export separately", () => {
  const found = endpoints(DaReplayController);
  assert.equal(found.length, 13);
  assert.ok(
    found.every((entry) =>
      entry.path.startsWith("/v1/rail/cases/:caseId/da-replay")
    )
  );
  assert.ok(
    found.some(
      (entry) =>
        entry.method === "POST" &&
        entry.path.endsWith("/authorisation/:authorisationId/review")
    )
  );
  assert.ok(
    found.some(
      (entry) =>
        entry.method === "POST" &&
        entry.path.endsWith("/legs/:legId/observations")
    )
  );
  assert.ok(
    found.some(
      (entry) =>
        entry.method === "POST" && entry.path.endsWith("/legs/:legId/reconcile")
    )
  );
  assert.ok(
    found.some(
      (entry) =>
        entry.method === "POST" &&
        entry.path.endsWith("/repairs/:repairId/review")
    )
  );
  assert.ok(
    found.some(
      (entry) =>
        entry.method === "GET" && entry.path.endsWith("/comparison.csv")
    )
  );
  assert.ok(
    found.some(
      (entry) => entry.method === "GET" && entry.path.endsWith("/evidence-pack")
    )
  );
});
