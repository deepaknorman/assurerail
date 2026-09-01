import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { OperationalReadinessModule } from "../operational-readiness/operational-readiness.module";
import { PlatformModule } from "../platform/platform.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { TokenConnectorService } from "./token-connector.service";
import { TokenConnectorWorker } from "./token-connector.worker";
import { TokenConnectorController, TokenRepresentationController } from "./token-representation.controllers";
import { TokenRepresentationService } from "./token-representation.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule, IntegrationsModule, PlatformModule, OperationalReadinessModule],
  controllers: [TokenRepresentationController, TokenConnectorController],
  providers: [TokenRepresentationService, TokenConnectorService, TokenConnectorWorker],
  exports: [TokenRepresentationService, TokenConnectorService],
})
export class TokenRepresentationModule {}
