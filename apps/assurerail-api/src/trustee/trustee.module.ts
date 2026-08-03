import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { TrusteeService } from "./trustee.service";

// VenueEventBus is @Global; AuditService comes from StoreModule.
@Module({
  imports: [StoreModule],
  providers: [TrusteeService],
  exports: [TrusteeService],
})
export class TrusteeModule {}
