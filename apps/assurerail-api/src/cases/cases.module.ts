import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { CasesController } from "./cases.controllers";
import { CasesService } from "./cases.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
