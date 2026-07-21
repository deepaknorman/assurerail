import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { SurveillanceController } from "./surveillance.controller";
import { SurveillanceService } from "./surveillance.service";

@Module({
  imports: [StoreModule],
  controllers: [SurveillanceController],
  providers: [SurveillanceService],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
