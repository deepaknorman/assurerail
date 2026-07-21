import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { CloseController } from "./close.controller";
import { CloseService } from "./close.service";

@Module({
  imports: [StoreModule],
  controllers: [CloseController],
  providers: [CloseService],
  exports: [CloseService],
})
export class CloseModule {}
