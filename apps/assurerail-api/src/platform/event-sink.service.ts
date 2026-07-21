import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "../store/prisma.service";
import { VenueEventBus } from "../events/venue-events";
import { WebhooksService } from "./webhooks.service";

// Billable venue actions → a BillingEvent row (metered). Everything else is still logged to EventLog.
const BILLABLE: Record<string, string> = { "note.minted": "mint", "dvp.settled": "dvp", "note.closed": "close" };

// The one subscriber to the VenueEventBus (DB mode only). Every lifecycle event is:
//  1. appended to EventLog (the ops/support timeline),
//  2. metered into BillingEvent when billable,
//  3. fanned out to partner webhooks.
// Fully decoupled from the emitters (mint/dvp/close) — they never block on persistence or egress.
@Injectable()
export class EventSinkService implements OnModuleInit {
  private readonly log = new Logger("EventSink");
  constructor(
    private readonly db: PrismaService,
    private readonly bus: VenueEventBus,
    private readonly webhooks: WebhooksService,
  ) {}

  onModuleInit(): void {
    this.bus.on((e) => {
      void this.handle(e.event, e.payload);
    });
    this.log.log("subscribed to the venue event bus");
  }

  private async handle(event: string, payload: Record<string, unknown>): Promise<void> {
    await this.db.eventLog.create({ data: { id: `evt_${randomUUID()}`, event, payload: payload as Prisma.InputJsonValue } }).catch((e) => this.log.warn(`eventlog persist failed: ${e}`));

    const billType = BILLABLE[event];
    if (billType) {
      const units = payload.mintableMinor ?? payload.units ?? payload.burnedUnits;
      await this.db.billingEvent
        .create({ data: { id: `bill_${randomUUID()}`, type: billType, noteId: payload.noteId ? String(payload.noteId) : null, unitsMinor: units != null ? String(units) : null, actor: "system:tokenco" } })
        .catch((e) => this.log.warn(`billing meter failed: ${e}`));
    }

    void this.webhooks.dispatch(event, payload);
  }
}
