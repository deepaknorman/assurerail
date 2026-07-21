import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { BreakGlassController } from "./breakglass.controller";
import { BreakGlassService } from "./breakglass.service";

@Module({
  imports: [StoreModule],
  controllers: [BreakGlassController],
  providers: [BreakGlassService],
})
export class BreakGlassModule {}
