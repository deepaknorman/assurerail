import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { RoomSourceAdapterService } from "./room-source-adapters";
import { RoomsController } from "./rooms.controllers";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomSourceAdapterService],
  exports: [RoomsService],
})
export class RoomsModule {}
