import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { PlatformModule } from "../platform/platform.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { DeveloperPortalController } from "./developer-portal.controller";
import { DeveloperPortalService } from "./developer-portal.service";

@Module({ imports: [StoreModule, SecurityModule, InstitutionsModule, PlatformModule], controllers: [DeveloperPortalController], providers: [DeveloperPortalService] })
export class DeveloperPortalModule {}
