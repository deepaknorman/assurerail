import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [StoreModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
