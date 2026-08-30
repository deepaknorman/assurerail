import assert from "node:assert/strict";
import test from "node:test";
import { deliveryJobState, OutboxRelayService } from "./outbox-relay.service";

test("[PR02][RELAY] delivery state is retryable only within the bounded attempt budget", () => {
  assert.equal(deliveryJobState({ delivered: true, retryable: false, blocked: false }, 1, 8), "DELIVERED");
  assert.equal(deliveryJobState({ delivered: false, retryable: true, blocked: false }, 7, 8), "RETRY");
  assert.equal(deliveryJobState({ delivered: false, retryable: true, blocked: false }, 8, 8), "DEAD_LETTER");
  assert.equal(deliveryJobState({ delivered: false, retryable: false, blocked: false }, 1, 8), "DEAD_LETTER");
  assert.equal(deliveryJobState({ delivered: false, retryable: true, blocked: true }, 1, 8), "BLOCKED");
});

test("[PR02][RELAY] a reclaimed durable delivery keeps its stable ID and reaches terminal acknowledgement", async () => {
  const previous = process.env.ARAIL_DURABLE_RELAY_MODE;
  process.env.ARAIL_DURABLE_RELAY_MODE = "durable";
  const updates: Array<Record<string, unknown>> = [];
  let query = 0;
  const db = {
    $queryRaw: async () => {
      query += 1;
      return query === 1 ? [] : [{ id: "whd_stable-restart-id", attempt: 2 }];
    },
    webhookDelivery: {
      updateMany: async (args: Record<string, unknown>) => {
        updates.push(args);
        return { count: 1 };
      },
    },
  };
  let deliveredId: string | undefined;
  const webhooks = {
    deliverDurable: async (id: string) => {
      deliveredId = id;
      return {
        delivered: true,
        retryable: false,
        blocked: false,
        statusCode: 204,
        errorCode: null,
        errorMessage: null,
        responseDigest: "sha256:test-only",
      };
    },
  };
  try {
    const relay = new OutboxRelayService(db as never, webhooks as never);
    const result = await relay.runOnce();
    assert.deepEqual(result, { fanout: 0, delivered: 1 });
    assert.equal(deliveredId, "whd_stable-restart-id");
    assert.equal((updates[0].data as { state: string }).state, "DELIVERED");
    assert.equal((updates[0].where as { id: string }).id, "whd_stable-restart-id");
  } finally {
    if (previous === undefined) delete process.env.ARAIL_DURABLE_RELAY_MODE;
    else process.env.ARAIL_DURABLE_RELAY_MODE = previous;
  }
});

test("[PR02][RELAY] fanout excludes events created before endpoint verification", async () => {
  const previous = process.env.ARAIL_DURABLE_RELAY_MODE;
  process.env.ARAIL_DURABLE_RELAY_MODE = "shadow";
  const eventCreatedAt = new Date("2026-08-30T10:00:00.000Z");
  let subscriptionWhere: Record<string, unknown> | undefined;
  let claimed = false;
  const tx = {
    outboxMessage: {
      findFirst: async () => ({
        id: "out_pre-verification-boundary",
        event: "note.minted",
        payloadDigest: "sha256:test-only",
        createdAt: eventCreatedAt,
      }),
      updateMany: async () => ({ count: 1 }),
    },
    webhookSubscription: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        subscriptionWhere = where;
        return [];
      },
    },
    webhookDelivery: { createMany: async () => ({ count: 0 }) },
  };
  const db = {
    $queryRaw: async () => {
      if (claimed) return [];
      claimed = true;
      return [{ id: "out_pre-verification-boundary", event: "note.minted", payloadDigest: "sha256:test-only" }];
    },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  };
  try {
    const relay = new OutboxRelayService(db as never, {} as never);
    await relay.runOnce();
    assert.deepEqual(subscriptionWhere?.verifiedAt, { lte: eventCreatedAt });
  } finally {
    if (previous === undefined) delete process.env.ARAIL_DURABLE_RELAY_MODE;
    else process.env.ARAIL_DURABLE_RELAY_MODE = previous;
  }
});
