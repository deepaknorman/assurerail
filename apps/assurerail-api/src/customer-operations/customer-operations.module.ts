import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { InternalAccessModule } from "../internal-access/internal-access.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { CustomerOperationsInternalController, CustomerOperationsParticipantController } from "./customer-operations.controllers";
import { CustomerOperationsService } from "./customer-operations.service";

import { EngagementBillingService } from "./engagement-billing.service";
import { EngagementBillingParticipantController, EngagementBillingInternalController } from "./engagement-billing.controllers";
import { AssessmentEngagementService } from "./assessment-engagement.service";
import { AssessmentEngagementController, AssessmentEngagementInternalController } from "./assessment-engagement.controllers";
import { EngagementCheckoutService } from "./engagement-checkout.service";
import { EngagementCheckoutController, EngagementPaymentWebhookController, EngagementPaymentWorker } from "./engagement-checkout.controllers";
import { EvidenceModule } from "../evidence/evidence.module";
import { AssessmentProcessingService } from "./assessment-processing.service";
import { AssessmentProcessingController, AssessmentProcessingInternalController, AssessmentProcessingWorker } from "./assessment-processing.controllers";

@Module({ imports: [StoreModule, SecurityModule, InstitutionsModule, InternalAccessModule, EvidenceModule], controllers: [AssessmentProcessingController, AssessmentProcessingInternalController, EngagementCheckoutController, EngagementPaymentWebhookController, AssessmentEngagementController, AssessmentEngagementInternalController, EngagementBillingParticipantController, EngagementBillingInternalController, CustomerOperationsParticipantController, CustomerOperationsInternalController], providers: [AssessmentProcessingService, AssessmentProcessingWorker, EngagementCheckoutService, EngagementPaymentWorker, AssessmentEngagementService, EngagementBillingService, CustomerOperationsService], exports: [AssessmentEngagementService] })
export class CustomerOperationsModule {}
