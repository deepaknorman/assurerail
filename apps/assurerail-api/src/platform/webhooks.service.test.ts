import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { WebhooksService } from "./webhooks.service";

test("[PR02][AR-H09] new subscriptions store only a Vault reference and remain inactive until verified", async () => {
  let created: Record<string, unknown> | undefined;
  let provisioned: Record<string, unknown> | undefined;
  let validated: string | undefined;
  const service = new WebhooksService({
    webhookSubscription: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created = data;
        return { ...data, createdAt: new Date(), updatedAt: new Date() };
      },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        provisioned = data;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        ...created,
        ...provisioned,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  } as never, {
    put: async (id: string) => `vault-kv-v2://secret/assurerail/webhooks/${id}#hmacSecret`,
  } as never, {
    validateEndpoint: async (url: string) => { validated = url; },
  } as never);

  const result = await service.subscribe("https://hooks.example.com/rail", ["note.minted", "note.minted"]);
  assert.equal(validated, "https://hooks.example.com/rail");
  assert.equal(created?.secret, null);
  assert.equal(created?.secretVaultRef, null);
  assert.match(String(provisioned?.secretVaultRef), /^vault-kv-v2:\/\/secret\/assurerail\/webhooks\//);
  assert.equal(created?.active, false);
  assert.equal(created?.endpointStatus, "PENDING_VERIFICATION");
  assert.equal((created?.events as string[]).length, 1);
  assert.equal(typeof result.secret, "string");
  assert.ok(result.secret.length >= 43);
});

test("[PR02][AR-H09] failed Vault provisioning leaves a disabled operator-visible subscription", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const service = new WebhooksService({
    webhookSubscription: {
      create: async ({ data }: { data: Record<string, unknown> }) => data,
      updateMany: async (args: Record<string, unknown>) => {
        updates.push(args);
        return { count: 1 };
      },
    },
  } as never, {
    put: async () => { throw new Error("test Vault outage"); },
  } as never, {
    validateEndpoint: async () => undefined,
  } as never);

  await assert.rejects(
    () => service.subscribe("https://hooks.example.com/rail", ["note.minted"]),
    /test Vault outage/,
  );
  assert.equal((updates[0].data as { endpointStatus: string }).endpointStatus, "DISABLED");
  assert.match(
    (updates[0].data as { disabledReason: string }).disabledReason,
    /OPERATOR_REPAIR/,
  );
});

test("[PR02][AR-H09] endpoint challenge must be echoed and HMAC-signed before activation", async () => {
  let challengeWrite: Record<string, unknown> | undefined;
  let activationWhere: Record<string, unknown> | undefined;
  const service = new WebhooksService({
    webhookSubscription: {
      findUnique: async () => ({
        id: "whs_verify",
        url: "https://hooks.example.com/rail",
        secretVaultRef: "vault-kv-v2://secret/assurerail/webhooks/whs_verify#hmacSecret",
        endpointStatus: "PENDING_VERIFICATION",
        revokedAt: null,
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        challengeWrite = data;
        return { id: "whs_verify" };
      },
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        activationWhere = where;
        return { count: 1 };
      },
    },
  } as never, {
    get: async () => "test-only-vault-secret-with-sufficient-length",
  } as never, {
    validateEndpoint: async () => undefined,
    post: async (_url: string, body: string) => {
      const challenge = (JSON.parse(body) as { challenge: string }).challenge;
      return {
        status: 200,
        ok: true,
        body: JSON.stringify({ challenge }),
        challengeSignature: `sha256=${createHmac("sha256", "test-only-vault-secret-with-sufficient-length").update(challenge).digest("hex")}`,
      };
    },
  } as never);

  const result = await service.verify("whs_verify");
  assert.equal(result.active, true);
  assert.equal(challengeWrite?.active, false);
  assert.equal(challengeWrite?.endpointStatus, "PENDING_VERIFICATION");
  assert.equal((activationWhere?.verificationChallengeHash as string), challengeWrite?.verificationChallengeHash);
});

test("[PR02][AR-H09] durable relay blocks a payload whose stored bytes no longer match its digest", async () => {
  let vaultRead = false;
  let egress = false;
  const service = new WebhooksService({
    webhookDelivery: {
      findUnique: async () => ({
        id: "whd_1",
        subscriptionId: "whs_1",
        outboxMessageId: "out_1",
        payloadDigest: "sha256:not-the-current-payload",
        attempt: 1,
      }),
    },
    webhookSubscription: {
      findUnique: async () => ({
        id: "whs_1",
        url: "https://hooks.example.com/rail",
        secretVaultRef: "vault-kv-v2://secret/assurerail/webhooks/whs_1#hmacSecret",
        active: true,
        endpointStatus: "VERIFIED",
        revokedAt: null,
      }),
    },
    outboxMessage: {
      findUnique: async () => ({
        id: "out_1",
        event: "note.minted",
        payload: { noteId: "note_1" },
        payloadDigest: "sha256:not-the-current-payload",
        createdAt: new Date(),
      }),
    },
  } as never, {
    get: async () => {
      vaultRead = true;
      return "test-only-vault-secret-with-sufficient-length";
    },
  } as never, {
    post: async () => {
      egress = true;
      return { status: 200, ok: true, body: "" };
    },
  } as never);
  const result = await service.deliverDurable("whd_1");
  assert.equal(result.blocked, true);
  assert.equal(result.errorCode, "PAYLOAD_DIGEST_MISMATCH");
  assert.equal(vaultRead, false);
  assert.equal(egress, false);
});
