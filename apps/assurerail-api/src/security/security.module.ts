import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { MfaService } from "./mfa.service";
import { WebAuthnService } from "./webauthn.service";
import { MfaController, WebAuthnController } from "./security.controllers";

// Account security — passkey (WebAuthn) enrolment/management + MFA (TOTP). DB mode only (needs the
// venue Postgres for credentials/enrolments). Registered alongside AuthModule.
@Module({
  imports: [StoreModule],
  providers: [MfaService, WebAuthnService],
  controllers: [MfaController, WebAuthnController],
})
export class SecurityModule {}
