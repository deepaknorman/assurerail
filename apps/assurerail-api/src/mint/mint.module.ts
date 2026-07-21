import { Module } from "@nestjs/common";
import { TapeModule } from "../tape/tape.module";
import { StoreModule } from "../store/store.module";
import { MintController } from "./mint.controller";
import { MintService } from "./mint.service";

@Module({
  imports: [TapeModule, StoreModule],
  controllers: [MintController],
  providers: [MintService],
  exports: [MintService],
})
export class MintModule {}
