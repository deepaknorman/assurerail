import { Module } from "@nestjs/common";
import { TapeController } from "./tape.controller";
import { TapeService } from "./tape.service";

@Module({
  controllers: [TapeController],
  providers: [TapeService],
  exports: [TapeService],
})
export class TapeModule {}
