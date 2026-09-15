import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { InternalAccessModule } from "../internal-access/internal-access.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { CustomerOperationsInternalController, CustomerOperationsParticipantController } from "./customer-operations.controllers";
import { CustomerOperationsService } from "./customer-operations.service";

import { EngagementBillingService } from "./engagement-billing.service";
import { EngagementBillingParticipantController, EngagementBillingInternalController } from "./engagement-billing.controllers";

@Module({ imports: [StoreModule, SecurityModule, InstitutionsModule, InternalAccessModule], controllers: [EngagementBillingParticipantController, EngagementBillingInternalController, CustomerOperationsParticipantController, CustomerOperationsInternalController], providers: [EngagementBillingService, CustomerOperationsService] })
export class CustomerOperationsModule {}
