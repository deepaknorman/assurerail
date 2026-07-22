import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { VenueEventBus } from "../events/venue-events";
import { WebhooksService } from "./webhooks.service";

// The single subscriber to the VenueEventBus (DB mode). EventLog + BillingEvent are now written
// durably INSIDE the domain transaction (the transactional outbox in PrismaMintRepository.writeOutbox),
// so the sink's ONLY job is to RELAY: fan each lifecycle event out to partner webhooks. This is
// best-effort — durability of the ops timeline + revenue meter no longer depends on it (that was the
// old fire-and-forget silent-drop bug). A future reconcile/relay sweep can re-dispatch webhooks for any
// EventLog row that lacks a successful WebhookDelivery.
@Injectable()
export class EventSinkService implements OnModuleInit {
  private readonly log = new Logger("EventSink");
  constructor(
    private readonly bus: VenueEventBus,
    private readonly webhooks: WebhooksService,
  ) {}

  onModuleInit(): void {
    this.bus.on((e) => {
      void this.webhooks.dispatch(e.event, e.payload);
    });
    this.log.log("subscribed to the venue event bus (relay-only; EventLog/BillingEvent are durable in-tx)");
  }
}
