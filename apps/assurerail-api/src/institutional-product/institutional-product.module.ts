import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { StoreModule } from "../store/store.module";
import { InstitutionalProductController } from "./institutional-product.controller";
import { InstitutionalProductService } from "./institutional-product.service";

@Module({ imports: [StoreModule, InstitutionsModule], controllers: [InstitutionalProductController], providers: [InstitutionalProductService] })
export class InstitutionalProductModule {}
