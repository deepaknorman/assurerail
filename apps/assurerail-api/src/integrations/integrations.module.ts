import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { ConnectorRequestAuthService } from "./connector-request-auth.service";
import { ConnectorSecretVaultService } from "./connector-secret-vault.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  providers: [ConnectorSecretVaultService, ConnectorRequestAuthService],
  exports: [ConnectorSecretVaultService, ConnectorRequestAuthService],
})
export class IntegrationsModule {}
