import assert from "node:assert/strict";
import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { sha256Digest } from "../contracts/v1";
import { isLiveCapabilityImplemented } from "../runtime/live-capability-registry";
import { LIVE_TOKEN_CONNECTOR_ACTION_TYPES, TOKEN_ACTION_CAPABILITIES, verifyTokenConnectorAcknowledgement } from "./token-connector.service";
import { TokenConnectorController } from "./token-representation.controllers";

const root = path.resolve(__dirname, "../..");
const source = (relative: string) => readFileSync(path.join(root, relative), "utf8");

function signed(overrides: Record<string, unknown> = {}) {
  const secret = "test-only-token-connector-secret-000000000000";
  const observation = {
    externalAcknowledgementId: "ack-provider-1",
    instructionId: "ext-1",
    instructionRequestDigest: `sha256:${"1".repeat(64)}`,
    expectedDigest: `sha256:${"2".repeat(64)}`,
    status: "SUCCEEDED",
    finalityClass: "FINAL",
    externalTransactionRef: "ledger-tx-1",
    outcomeDigest: `sha256:${"3".repeat(64)}`,
    acknowledgedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
  return { secret, body: { ...observation, signature: createHmac("sha256", secret).update(sha256Digest(observation)).digest("hex") } };
}

test("[PR15][ACK] a final provider acknowledgement binds the exact instruction and expected action", () => {
  const { secret, body } = signed();
  const verified = verifyTokenConnectorAcknowledgement(body, {
    instructionId: "ext-1", instructionRequestDigest: `sha256:${"1".repeat(64)}`, expectedDigest: `sha256:${"2".repeat(64)}`,
  }, secret, new Date("2026-09-02T00:01:00.000Z"));
  assert.equal(verified.observation.externalTransactionRef, "ledger-tx-1");
  const { signature: _signature, ...observation } = body;
  assert.equal(verified.responseDigest, sha256Digest(observation));
});

test("[PR15][ACK] tamper, wrong instruction, non-final result and future timestamps fail closed", () => {
  const base = signed();
  assert.throws(() => verifyTokenConnectorAcknowledgement({ ...base.body, outcomeDigest: `sha256:${"4".repeat(64)}` }, {
    instructionId: "ext-1", instructionRequestDigest: `sha256:${"1".repeat(64)}`, expectedDigest: `sha256:${"2".repeat(64)}`,
  }, base.secret, new Date("2026-09-02T00:01:00.000Z")), /signature verification failed/);
  for (const override of [{ instructionId: "wrong" }, { status: "PENDING" }, { acknowledgedAt: "2026-09-02T01:00:00.000Z" }]) {
    const attempt = signed(override);
    assert.throws(() => verifyTokenConnectorAcknowledgement(attempt.body, {
      instructionId: "ext-1", instructionRequestDigest: `sha256:${"1".repeat(64)}`, expectedDigest: `sha256:${"2".repeat(64)}`,
    }, attempt.secret, new Date("2026-09-02T00:01:00.000Z")));
  }
});

test("[PR15][CAPABILITY] every connector-governed token action has a distinct dormant capability and payment stays separate", () => {
  assert.equal(Object.keys(TOKEN_ACTION_CAPABILITIES).length, 5);
  assert.equal(new Set(Object.values(TOKEN_ACTION_CAPABILITIES)).size, 5);
  assert.ok(!LIVE_TOKEN_CONNECTOR_ACTION_TYPES.includes("PAYMENT" as never));
  assert.ok(Object.values(TOKEN_ACTION_CAPABILITIES).every((value) => value.startsWith("assurerail.da.token.")));
  assert.ok(Object.values(TOKEN_ACTION_CAPABILITIES).every((value) => !isLiveCapabilityImplemented(value)),
    "candidate capabilities must remain outside the live registry until independent external gates close");
});

test("[PR15][API] connector governance and live preparation remain case-scoped and expose no raw callback", () => {
  const base = Reflect.getMetadata(PATH_METADATA, TokenConnectorController) as string;
  const found = Object.getOwnPropertyNames(TokenConnectorController.prototype).flatMap((name) => {
    if (name === "constructor") return [];
    const handler = (TokenConnectorController.prototype as unknown as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
    if (method === undefined) return [];
    const child = Reflect.getMetadata(PATH_METADATA, handler) as string;
    return [{ method: RequestMethod[method], path: `/${[base, child].filter(Boolean).join("/")}`.replace(/\/+/g, "/") }];
  });
  assert.equal(found.length, 5);
  assert.ok(found.every((entry) => entry.path.startsWith("/v1/rail/cases/:caseId/token-representation/connector")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/actions")));
  assert.ok(found.some((entry) => entry.method === "POST" && entry.path.endsWith("/safe-pause")));
  assert.ok(found.every((entry) => !/callback|webhook|private-key/.test(entry.path)));
});

test("[PR15][PERIMETER] live dispatch is durable, Vault-backed, SSRF-guarded and post-action reconciliation remains mandatory", () => {
  const service = source("src/token-representation/token-connector.service.ts");
  const worker = source("src/token-representation/token-connector.worker.ts");
  const migration = source("prisma/migrations/20260902150000_assurerail_pr15_token_connector_custody/migration.sql");
  assert.match(service, /activation\.requireCapability\(capabilityId\)/);
  assert.match(service, /vault\.get\(/);
  assert.match(service, /egress\.post\(/);
  assert.match(service, /authorityMode: "MIRROR"/);
  assert.match(service, /postActionReconciliationRequired: true/);
  assert.match(worker, /FOR UPDATE OF instruction SKIP LOCKED/);
  assert.match(worker, /instruction\."state" IN \('PENDING', 'AMBIGUOUS'\)/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
  assert.doesNotMatch(service, /\b(privateKey|mnemonic|seedPhrase)\s*:/);
});
