import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { WebhooksService } from "./webhooks.service";
import { EventSinkService } from "./event-sink.service";
import { BillingService } from "./billing.service";
import { DocumentsService } from "./documents.service";
import { IngressService } from "./ingress.service";
import { DocumentsController, IngressController, BillingController, WebhooksController, SupportController } from "./platform.controllers";

// Platform module (DB mode only — every service needs the venue Postgres). Wires the event sink
// (the single VenueEventBus subscriber → EventLog + billing meter + webhook egress) plus the
// deal-room documents, data-feed ingress, usage billing, partner webhooks, and the ops/support views.
@Module({
  imports: [StoreModule],
  controllers: [DocumentsController, IngressController, BillingController, WebhooksController, SupportController],
  providers: [WebhooksService, EventSinkService, BillingService, DocumentsService, IngressService],
  exports: [IngressService],
})
export class PlatformModule {}
