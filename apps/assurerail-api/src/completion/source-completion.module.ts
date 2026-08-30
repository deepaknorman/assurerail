import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { PlatformModule } from "../platform/platform.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { SourceCompletionController, SourceCompletionInternalController } from "./source-completion.controllers";
import { SourceCompletionService } from "./source-completion.service";
import { SourceCompletionWorker } from "./source-completion.worker";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule, IntegrationsModule, PlatformModule],
  controllers: [SourceCompletionController, SourceCompletionInternalController],
  providers: [SourceCompletionService, SourceCompletionWorker],
  exports: [SourceCompletionService],
})
export class SourceCompletionModule {}
