import { Module } from "@nestjs/common";
import { InstitutionsModule } from "../institutions/institutions.module";
import { SecurityModule } from "../security/security.module";
import { StoreModule } from "../store/store.module";
import { DaReplayController } from "./da-replay.controllers";
import { DaReplayService } from "./da-replay.service";

@Module({
  imports: [StoreModule, SecurityModule, InstitutionsModule],
  controllers: [DaReplayController],
  providers: [DaReplayService],
  exports: [DaReplayService],
})
export class DaReplayModule {}
