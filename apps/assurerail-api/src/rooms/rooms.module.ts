import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { RoomSourceAdapterService } from "./room-source-adapters";
import { ActiveRoomsService } from "./active-rooms.service";
import { LegacyRoomProxyController } from "./legacy-room-proxy.controller";
import { LegacyRoomProxyService } from "./legacy-room-proxy.service";
import { RoomAuthorityService } from "./room-authority.service";
import { RoomAuthorityController, RoomInvitationsController, RoomsController } from "./rooms.controllers";
import { RoomsService } from "./rooms.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule, IntegrationsModule, PersistenceModule],
  controllers: [RoomsController, RoomAuthorityController, RoomInvitationsController, LegacyRoomProxyController],
  providers: [RoomsService, ActiveRoomsService, RoomAuthorityService, RoomSourceAdapterService, LegacyRoomProxyService],
  exports: [RoomsService, ActiveRoomsService, RoomAuthorityService],
})
export class RoomsModule {}
