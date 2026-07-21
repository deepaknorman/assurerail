import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { DvpController } from "./dvp.controller";
import { DvpService } from "./dvp.service";

@Module({
  imports: [StoreModule],
  controllers: [DvpController],
  providers: [DvpService],
  exports: [DvpService],
})
export class DvpModule {}
