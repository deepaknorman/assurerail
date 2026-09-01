import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { isLiveCapabilityImplemented } from "../runtime/live-capability-registry";
import { PtcTokenController } from "./ptc-token.controllers";
import { PTC_TOKEN_ACTIONS, PTC_TOKEN_GATE_SPECS, TOKENISED_PTC_ROUTE_PACK, ptcTokenPlanDigest } from "./ptc-token-policy";
const root = path.resolve(__dirname, "../..");
const source = (relative: string) => readFileSync(path.join(root, relative), "utf8");

test("[PR16][ROUTE] tokenised PTC is a separate mirror route with complete PTC evidence gates", () => {
  assert.equal(TOKENISED_PTC_ROUTE_PACK.route, "PTC"); assert.equal(TOKENISED_PTC_ROUTE_PACK.representation, "TOKENISED");
  assert.equal(TOKENISED_PTC_ROUTE_PACK.authorityMode, "MIRROR"); assert.equal(PTC_TOKEN_GATE_SPECS.length, 14);
  for (const code of ["HISTORIC_PTC_REPLAY_ACCEPTED","TRUSTEE_TRANSACTION_CONTROL","ASSURANCE_RESULT","AUTHORITATIVE_RECORD_ACK","TRUSTEE_RECORD_RECONCILIATION","TOKEN_LEGAL_FINALITY","TOKEN_CUSTODY_OPERATING"]) assert.ok(PTC_TOKEN_GATE_SPECS.some(([gate]) => gate === code));
});

test("[PR16][ACTION] issue, transfer, distribution, lifecycle and burn plans are deterministic and dormant", () => {
  assert.equal(PTC_TOKEN_ACTIONS.length, 5); assert.equal(new Set(PTC_TOKEN_ACTIONS.map(([, id]) => id)).size, 5);
  assert.ok(PTC_TOKEN_ACTIONS.every(([, id]) => !isLiveCapabilityImplemented(id)));
  assert.equal(ptcTokenPlanDigest("r1", "ISSUE", ["B", "A"]), ptcTokenPlanDigest("r1", "ISSUE", ["A", "B"]));
});

test("[PR16][API] only case-scoped read, evidence, proposal and independent review are exposed", () => {
  const base = Reflect.getMetadata(PATH_METADATA, PtcTokenController) as string;
  const routes = Object.getOwnPropertyNames(PtcTokenController.prototype).flatMap((name) => { if (name === "constructor") return []; const handler = (PtcTokenController.prototype as unknown as Record<string, unknown>)[name]; if (typeof handler !== "function") return []; const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined; if (method === undefined) return []; return [{ method: RequestMethod[method], path: `/${[base, Reflect.getMetadata(PATH_METADATA, handler) as string].filter(Boolean).join("/")}`.replace(/\/+/g,"/") }]; });
  assert.equal(routes.length, 4); assert.ok(routes.every((route) => route.path.startsWith("/v1/rail/cases/:caseId/ptc-token")));
  assert.ok(routes.every((route) => !/issue|allot|transfer|burn|dispatch/.test(route.path)));
});

test("[PR16][PERIMETER] service rejects synthetic proof and creates no external instruction", () => {
  const service = source("src/ptc-token/ptc-token.service.ts"); const migration = source("prisma/migrations/20260902160000_assurerail_pr16_tokenised_ptc_shadow/migration.sql");
  assert.match(service, /synthetic\|fixture\|demo\|example/); assert.match(service, /externalInstructionCreated: false/);
  assert.doesNotMatch(service, /externalInstruction\.create|egress\.post|vault\.get/); assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
  assert.equal((migration.match(/ON DELETE RESTRICT/g) ?? []).length, 9);
});
