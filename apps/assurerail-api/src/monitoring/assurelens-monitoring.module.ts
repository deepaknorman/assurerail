import { Module } from "@nestjs/common";
import { EvidenceModule } from "../evidence/evidence.module";
import { AssureLensMonitoringController } from "./assurelens-monitoring.controller";
import { AssureLensMonitoringService } from "./assurelens-monitoring.service";

@Module({
  imports: [EvidenceModule],
  controllers: [AssureLensMonitoringController],
  providers: [AssureLensMonitoringService],
  exports: [AssureLensMonitoringService],
})
export class AssureLensMonitoringModule {}
