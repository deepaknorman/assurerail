import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RoomAuthorityController, RoomInvitationsController, RoomsController } from "./rooms.controllers";
import { LegacyRoomProxyController } from "./legacy-room-proxy.controller";
import { SourceCompletionController, SourceCompletionInternalController } from "../completion/source-completion.controllers";

function endpoints(controller: Function) {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const prototype = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = prototype[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    const path = `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/").replace(/\/$/, "");
    return [{ method: RequestMethod[method], path: path || "/" }];
  });
}

test("[PR07][ENDPOINTS] migration and parity APIs remain case-scoped after the additive PR-08 room commands", () => {
  const found = endpoints(RoomsController);
  assert.equal(found.length, 14);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/cases/:caseId/rooms")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/legacy-imports")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:roomId/parity-runs")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/parity-breaks/:breakId/resolve")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:roomId/invitations")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:roomId/messages")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/:roomId/close")));
});

test("[PR08][ENDPOINTS] write authority and token acceptance are separate governed surfaces", () => {
  const authority = endpoints(RoomAuthorityController);
  const invitations = endpoints(RoomInvitationsController);
  assert.deepEqual(authority.map((entry) => `${entry.method} ${entry.path}`).sort(), [
    "GET /v1/rail/cases/:caseId/room-authority",
    "POST /v1/rail/cases/:caseId/room-authority/proposals",
    "POST /v1/rail/cases/:caseId/room-authority/proposals/:changeId/review",
  ]);
  assert.deepEqual(invitations.map((entry) => `${entry.method} ${entry.path}`).sort(), [
    "GET /v1/rail/room-invitations/:token",
    "POST /v1/rail/room-invitations/:token/accept",
  ]);
});

test("[PR08][ENDPOINTS] compatibility and completion surfaces are narrow and explicit", () => {
  assert.deepEqual(endpoints(LegacyRoomProxyController), [{ method: "POST", path: "/internal/v1/legacy-room-proxy" }]);
  assert.deepEqual(endpoints(SourceCompletionController).map((entry) => `${entry.method} ${entry.path}`).sort(), [
    "GET /v1/rail/cases/:caseId/source-completions",
    "POST /v1/rail/cases/:caseId/source-completions",
    "POST /v1/rail/cases/:caseId/source-completions/:completionId/reconcile",
  ]);
  assert.deepEqual(endpoints(SourceCompletionInternalController), [{ method: "POST", path: "/internal/v1/source-completions/:completionId/acknowledgements" }]);
});
