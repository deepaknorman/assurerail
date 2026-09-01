import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { PtcReplayController } from "./ptc-replay.controllers";
import { PtcReplayService } from "./ptc-replay.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [PtcReplayController],
  providers: [PtcReplayService],
  exports: [PtcReplayService],
})
export class PtcReplayModule {}
