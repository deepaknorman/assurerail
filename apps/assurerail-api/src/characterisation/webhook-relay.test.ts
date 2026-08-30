import assert from "node:assert/strict";
import test from "node:test";
import type { VenueEvent, VenueEventBus } from "../events/venue-events";
import { EventSinkService } from "../platform/event-sink.service";
import { WebhooksService } from "../platform/webhooks.service";

test("[CURRENT_SEQUENCE][AR-H09] the event sink starts webhook dispatch without awaiting an acknowledgement", async () => {
  let subscriber: ((event: VenueEvent) => void) | undefined;
  let dispatchStarted = false;
  let releaseDispatch: (() => void) | undefined;
  const pendingDispatch = new Promise<void>((resolve) => { releaseDispatch = resolve; });
  const bus = {
    on: (callback: (event: VenueEvent) => void) => { subscriber = callback; },
  } as unknown as VenueEventBus;
  const webhooks = {
    dispatch: async () => {
      dispatchStarted = true;
      await pendingDispatch;
    },
  } as unknown as WebhooksService;

  const sink = new EventSinkService(bus, webhooks);
  sink.onModuleInit();
  assert.ok(subscriber);
  subscriber({ event: "note.minted", payload: { noteId: "note-characterisation" }, at: "2026-08-30T00:00:00.000Z" });

  // The bus callback returns while delivery is still pending. This is a current-shape test: the
  // transactional domain outbox remains durable, but there is no durable relay claim/ack here yet.
  assert.equal(dispatchStarted, true);
  releaseDispatch?.();
  await pendingDispatch;
});

test("[CURRENT_SEQUENCE][AR-H09] failed delivery and failed delivery-log persistence are both swallowed", async () => {
  const originalFetch = globalThis.fetch;
  let deliveryAttempted = false;
  let deliveryLogAttempted = false;
  globalThis.fetch = async () => {
    deliveryAttempted = true;
    throw new Error("characterised partner outage");
  };

  try {
    const service = new WebhooksService({
      webhookSubscription: {
        findMany: async () => [{
          id: "subscription-characterisation",
          url: "https://partner.invalid/webhook",
          secret: "test-only-placeholder",
          events: ["*"],
          active: true,
        }],
      },
      webhookDelivery: {
        create: async () => {
          deliveryLogAttempted = true;
          throw new Error("characterised delivery-log outage");
        },
      },
    } as never);

    // Current behaviour resolves even though neither the partner acknowledgement nor a durable
    // failure receipt exists. PR-07/PR-12 must replace this with a claim/retry/dead-letter/replay path.
    await assert.doesNotReject(() => service.dispatch("note.minted", { noteId: "note-characterisation" }));
    assert.equal(deliveryAttempted, true);
    assert.equal(deliveryLogAttempted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
