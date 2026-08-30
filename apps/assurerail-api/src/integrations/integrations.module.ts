import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { ConnectorRequestAuthService } from "./connector-request-auth.service";
import { ConnectorSecretVaultService } from "./connector-secret-vault.service";
import { ConnectorSubjectMappingController } from "./connector-subject-mapping.controller";
import { ConnectorSubjectMappingService } from "./connector-subject-mapping.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [ConnectorSubjectMappingController],
  providers: [ConnectorSecretVaultService, ConnectorRequestAuthService, ConnectorSubjectMappingService],
  exports: [ConnectorSecretVaultService, ConnectorRequestAuthService, ConnectorSubjectMappingService],
})
export class IntegrationsModule {}
