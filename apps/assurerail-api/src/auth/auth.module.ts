import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { StoreModule } from "../store/store.module";
import { FirebaseAdminService } from "./firebase-admin.service";
import { RecaptchaService } from "./recaptcha.service";
import { DigiKycGateService } from "./digikyc-gate.service";
import { VenueUserService } from "./venue-user.service";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";
import { AuthController } from "./auth.controller";
import { IdentityBindingService } from "./identity-binding.service";

// Registered ONLY in DB mode (see AppModule) — auth requires VenueUser persistence. Wires the global
// AuthGuard (authenticate) + RolesGuard (authorize) so every route is secure-by-default; @Public() opts
// out. Imports StoreModule to share the single PrismaService connection.
@Module({
  imports: [StoreModule],
  controllers: [AuthController],
  providers: [
    FirebaseAdminService,
    RecaptchaService,
    DigiKycGateService,
    IdentityBindingService,
    VenueUserService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
