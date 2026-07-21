import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { AdminController } from "./admin.controller";
import { VenueUserService } from "../auth/venue-user.service";

// Registered only in DB mode (see AppModule) — needs VenueUser persistence + the global auth guards.
@Module({
  imports: [StoreModule],
  controllers: [AdminController],
  providers: [VenueUserService],
})
export class AdminModule {}
