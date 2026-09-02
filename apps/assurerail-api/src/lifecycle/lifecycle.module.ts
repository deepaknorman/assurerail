import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { LifecycleController } from "./lifecycle.controller";
import { LifecycleService } from "./lifecycle.service";

@Module({ imports: [StoreModule, SecurityModule, InstitutionsModule], controllers: [LifecycleController], providers: [LifecycleService] })
export class LifecycleModule {}
