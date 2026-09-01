import { Module } from "@nestjs/common";
import { InternalAccessModule } from "../internal-access/internal-access.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { VenueConductController } from "./venue-conduct.controllers";
import { VenueConductService } from "./venue-conduct.service";

@Module({
  imports: [StoreModule, SecurityModule, InternalAccessModule],
  controllers: [VenueConductController],
  providers: [VenueConductService],
  exports: [VenueConductService],
})
export class VenueConductModule {}
