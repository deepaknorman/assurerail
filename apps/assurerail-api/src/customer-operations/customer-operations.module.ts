import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { InternalAccessModule } from "../internal-access/internal-access.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { CustomerOperationsInternalController, CustomerOperationsParticipantController } from "./customer-operations.controllers";
import { CustomerOperationsService } from "./customer-operations.service";

@Module({ imports: [StoreModule, SecurityModule, InstitutionsModule, InternalAccessModule], controllers: [CustomerOperationsParticipantController, CustomerOperationsInternalController], providers: [CustomerOperationsService] })
export class CustomerOperationsModule {}
