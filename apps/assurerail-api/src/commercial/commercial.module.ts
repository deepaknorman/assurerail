import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { CommercialController } from "./commercial.controllers";
import { CommercialService } from "./commercial.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [CommercialController],
  providers: [CommercialService],
  exports: [CommercialService],
})
export class CommercialModule {}
