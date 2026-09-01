import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { TokenRepresentationController } from "./token-representation.controllers";
import { TokenRepresentationService } from "./token-representation.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [TokenRepresentationController],
  providers: [TokenRepresentationService],
  exports: [TokenRepresentationService],
})
export class TokenRepresentationModule {}
