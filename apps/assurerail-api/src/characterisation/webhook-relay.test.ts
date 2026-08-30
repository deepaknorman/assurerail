import assert from "node:assert/strict";
import test from "node:test";
import type { VenueEvent, VenueEventBus } from "../events/venue-events";
import { EventSinkService } from "../platform/event-sink.service";
import { WebhooksService } from "../platform/webhooks.service";

test("[TRANSITIONAL_LEGACY][AR-H09] legacy mode starts webhook dispatch after the durable lifecycle commit", async () => {
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

  // Legacy mode stays available for rollback/observation. Durable/shadow mode does not subscribe
  // this in-process path; OutboxRelayService owns the persisted work instead.
  assert.equal(dispatchStarted, true);
  releaseDispatch?.();
  await pendingDispatch;
});

test("[PR02][AR-H09] legacy relay refuses egress when it cannot create a delivery receipt first", async () => {
  let deliveryLogAttempted = false;
  let egressAttempted = false;
  const service = new WebhooksService({
      webhookSubscription: {
        findMany: async () => [{
          id: "subscription-characterisation",
          url: "https://partner.invalid/webhook",
          secretVaultRef: "vault-kv-v2://secret/assurerail/webhooks/subscription-characterisation#hmacSecret",
          events: ["*"],
          active: true,
          endpointStatus: "VERIFIED",
          revokedAt: null,
        }],
      },
      webhookDelivery: {
        create: async () => {
          deliveryLogAttempted = true;
          throw new Error("characterised delivery-log outage");
        },
      },
    } as never, {
      get: async () => "test-only-placeholder-with-sufficient-length",
    } as never, {
      post: async () => {
        egressAttempted = true;
        return { status: 200, ok: true, body: "ok" };
      },
    } as never);

  await assert.rejects(
    () => service.dispatch("note.minted", { noteId: "note-characterisation" }),
    /characterised delivery-log outage/,
  );
  assert.equal(deliveryLogAttempted, true);
  assert.equal(egressAttempted, false);
});
