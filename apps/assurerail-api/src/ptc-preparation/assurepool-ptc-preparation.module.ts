import { Module } from "@nestjs/common";
import { EvidenceModule } from "../evidence/evidence.module";
import { AssurePoolPtcPreparationController } from "./assurepool-ptc-preparation.controller";
import { AssurePoolPtcPreparationService } from "./assurepool-ptc-preparation.service";

@Module({
  imports: [EvidenceModule],
  controllers: [AssurePoolPtcPreparationController],
  providers: [AssurePoolPtcPreparationService],
  exports: [AssurePoolPtcPreparationService],
})
export class AssurePoolPtcPreparationModule {}
