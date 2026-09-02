import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { SecondaryTransferController, SecondaryTransferRegistryController } from "./secondary-transfer.controllers";
import { SecondaryTransferService } from "./secondary-transfer.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [SecondaryTransferRegistryController, SecondaryTransferController],
  providers: [SecondaryTransferService],
  exports: [SecondaryTransferService],
})
export class SecondaryTransferModule {}
