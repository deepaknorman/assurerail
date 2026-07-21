import { Module } from "@nestjs/common";
import { TapeModule } from "./tape/tape.module";
import { MintModule } from "./mint/mint.module";
import { SurveillanceModule } from "./surveillance/surveillance.module";
import { DvpModule } from "./dvp/dvp.module";
import { BreakGlassModule } from "./breakglass/breakglass.module";
import { DemoModule } from "./demo/demo.module";
import { AuthModule } from "./auth/auth.module";

// AssureRail venue root module. Tape (2a) → Mint (2b) → Surveillance (2c) → DvP + BreakGlass (T4);
// DemoModule (T5) chains the whole loop. AuthModule (P2) is registered ONLY in DB mode (auth needs
// VenueUser persistence); with no DATABASE_URL the venue runs open in the ephemeral DEMO.
// NOTE: rate limiting is enforced at the Caddy reverse proxy (a proxied venue); an app-level
// @nestjs/throttler layer is a deferred parity follow-up (Reflector DI clash in this workspace).
const authModules = process.env.DATABASE_URL ? [AuthModule] : [];

@Module({
  imports: [TapeModule, MintModule, SurveillanceModule, DvpModule, BreakGlassModule, DemoModule, ...authModules],
})
export class AppModule {}
