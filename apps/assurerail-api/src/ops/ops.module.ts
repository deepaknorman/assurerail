import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { IntegrityEngineService } from "./integrity-engine.service";
import { OpsService } from "./ops.service";
import { OpsClockService } from "./ops-clock.service";
import { OpsController } from "./ops.controller";

// Agentic ops — Crawl phase. Deterministic IntegrityEngine + liveness sentinel + a scheduled sweep
// (OpsClock, leader-elected) writing deduped OpsFindings. DB mode only. The Claude-backed OpsTriage +
// maker-checker (Walk/Run phases) are deliberate follow-ups; this is the read-only foundation.
@Module({
  imports: [StoreModule],
  providers: [IntegrityEngineService, OpsService, OpsClockService],
  controllers: [OpsController],
})
export class OpsModule {}
