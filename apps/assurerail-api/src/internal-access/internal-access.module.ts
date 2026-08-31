import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { InternalAccessAdminController, InternalAccessSelfController } from "./internal-access.controllers";
import { InternalAccessService } from "./internal-access.service";

@Module({
  imports: [StoreModule, SecurityModule],
  controllers: [InternalAccessSelfController, InternalAccessAdminController],
  providers: [InternalAccessService],
  exports: [InternalAccessService],
})
export class InternalAccessModule {}
