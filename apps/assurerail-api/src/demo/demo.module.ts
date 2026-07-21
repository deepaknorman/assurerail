import { Module } from "@nestjs/common";
import { MintModule } from "../mint/mint.module";
import { SurveillanceModule } from "../surveillance/surveillance.module";
import { DvpModule } from "../dvp/dvp.module";
import { StoreModule } from "../store/store.module";
import { DemoController } from "./demo.controller";
import { DemoService } from "./demo.service";
import { SeedService } from "./seed.service";

@Module({
  imports: [MintModule, SurveillanceModule, DvpModule, StoreModule],
  controllers: [DemoController],
  providers: [DemoService, SeedService],
})
export class DemoModule {}
