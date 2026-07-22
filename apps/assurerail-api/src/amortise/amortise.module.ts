import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { AmortiseService } from "./amortise.service";
import { AmortiseController } from "./amortise.controller";

// Partial pro-rata amortisation (works in both DB and in-memory modes — StoreModule binds the repo +
// AuditService per mode; VenueEventBus is global). Registered alongside CloseModule.
@Module({
  imports: [StoreModule],
  providers: [AmortiseService],
  controllers: [AmortiseController],
})
export class AmortiseModule {}
