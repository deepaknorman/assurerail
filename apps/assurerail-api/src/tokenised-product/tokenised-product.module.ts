import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { TokenisedProductController, TokenisedProductRegistryController } from "./tokenised-product.controllers";
import { TokenisedProductService } from "./tokenised-product.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [TokenisedProductRegistryController, TokenisedProductController],
  providers: [TokenisedProductService],
})
export class TokenisedProductModule {}
