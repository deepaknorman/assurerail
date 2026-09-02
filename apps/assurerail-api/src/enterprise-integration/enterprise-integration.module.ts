import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import {
  EnterpriseCaseIntegrationController,
  EnterpriseIntegrationController,
} from "./enterprise-integration.controller";
import { EnterpriseIntegrationService } from "./enterprise-integration.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [
    EnterpriseIntegrationController,
    EnterpriseCaseIntegrationController,
  ],
  providers: [EnterpriseIntegrationService],
  exports: [EnterpriseIntegrationService],
})
export class EnterpriseIntegrationModule {}
