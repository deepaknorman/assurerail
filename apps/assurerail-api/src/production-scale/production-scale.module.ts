import { Module } from "@nestjs/common";
import { InternalAccessModule } from "../internal-access/internal-access.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { ProductionScaleController } from "./production-scale.controller";
import { ProductionScaleService } from "./production-scale.service";

@Module({
  imports: [StoreModule, SecurityModule, InternalAccessModule],
  controllers: [ProductionScaleController],
  providers: [ProductionScaleService],
  exports: [ProductionScaleService],
})
export class ProductionScaleModule {}
