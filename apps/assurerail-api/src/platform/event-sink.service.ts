import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { VenueEventBus } from "../events/venue-events";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
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
  private readonly relayMode = inspectPersistenceFlags(process.env).durableRelay;
  constructor(
    private readonly bus: VenueEventBus,
    private readonly webhooks: WebhooksService,
  ) {}

  onModuleInit(): void {
    if (this.relayMode === "legacy") {
      this.bus.on((e) => {
        void this.webhooks.dispatch(e.event, e.payload).catch((error) => {
          this.log.warn(`legacy webhook relay failed after durable event commit: ${(error as Error).message}`);
        });
      });
      this.log.warn("legacy in-process webhook relay enabled; durable outbox is recorded but not dispatched by its worker");
      return;
    }
    this.log.log(`in-process webhook relay disabled; durable worker owns ${this.relayMode} fanout`);
  }
}
