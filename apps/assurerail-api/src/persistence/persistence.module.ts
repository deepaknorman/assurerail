import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { PersistenceFoundationService } from "./persistence-foundation.service";

@Module({
  imports: [StoreModule],
  providers: [PersistenceFoundationService],
  exports: [PersistenceFoundationService],
})
export class PersistenceModule {}
