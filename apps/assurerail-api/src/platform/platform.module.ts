import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { WebhooksService } from "./webhooks.service";
import { EventSinkService } from "./event-sink.service";
import { OutboxRelayService } from "./outbox-relay.service";
import { WebhookEgressService } from "./webhook-egress.service";
import { WebhookSecretVaultService } from "./webhook-secret-vault.service";
import { BillingService } from "./billing.service";
import { DocumentsService } from "./documents.service";
import { IngressService } from "./ingress.service";
import { DocumentsController, IngressController, BillingController, WebhooksController, SupportController } from "./platform.controllers";
import { ActivityController } from "./activity.controller";

// Platform module (DB mode only — every service needs the venue Postgres). Wires the event sink
// (the single VenueEventBus subscriber → EventLog + billing meter + webhook egress) plus the
// deal-room documents, data-feed ingress, usage billing, partner webhooks, and the ops/support views.
@Module({
  imports: [StoreModule, PersistenceModule],
  controllers: [DocumentsController, IngressController, BillingController, WebhooksController, SupportController, ActivityController],
  providers: [
    WebhooksService,
    WebhookEgressService,
    WebhookSecretVaultService,
    EventSinkService,
    OutboxRelayService,
    BillingService,
    DocumentsService,
    IngressService,
  ],
  exports: [IngressService, WebhookEgressService],
})
export class PlatformModule {}
