import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { SecondaryTransferController } from "./secondary-transfer.controllers";

test("[PR14][ENDPOINTS] secondary surface records evidence and review only", () => {
  const base = Reflect.getMetadata(PATH_METADATA, SecondaryTransferController) as string;
  const found = Object.getOwnPropertyNames(SecondaryTransferController.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (SecondaryTransferController.prototype as unknown as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    return [{ method: RequestMethod[method], path: `/${[base, Reflect.getMetadata(PATH_METADATA, handler) as string].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
  assert.equal(found.length, 5);
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/evidence")));
  assert.ok(found.some((entry) => entry.path.endsWith("/review")));
  assert.ok(found.every((entry) => !/execute|settle|trade|dispatch|register-update|mint|burn/.test(entry.path)));
});
