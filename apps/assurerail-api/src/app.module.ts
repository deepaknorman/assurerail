import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { TapeModule } from "./tape/tape.module";
import { MintModule } from "./mint/mint.module";
import { SurveillanceModule } from "./surveillance/surveillance.module";
import { DvpModule } from "./dvp/dvp.module";
import { BreakGlassModule } from "./breakglass/breakglass.module";
import { CloseModule } from "./closure/close.module";
import { AmortiseModule } from "./amortise/amortise.module";
import { DemoModule } from "./demo/demo.module";
import { ReportsModule } from "./reports/reports.module";
import { EventsModule } from "./events/venue-events";
import { MetricsModule } from "./platform/metrics.module";
import { shouldMountDemoEndpoints } from "./runtime/runtime-profile";
import { inspectPersistenceFlags } from "./persistence/feature-flags";

// AssureRail venue root module. Tape (2a) → Mint (2b) → Surveillance (2c) → DvP + BreakGlass (T4) →
// Closure (burn). DemoModule chains the whole loop, but is mounted only when the explicit operating
// profile is DEMO and ARAIL_DEMO_ENDPOINTS_ENABLED resolves true. Reports/Metrics/Events run in both.
// AuthModule + AdminModule + PlatformModule are registered ONLY in DB mode (they need venue Postgres);
// with no DATABASE_URL the venue runs open in the ephemeral DEMO. EventsModule is @Global (the bus is
// always available so mint/dvp/close can emit); the persistent sink lives in PlatformModule (DB only).
// NOTE: rate limiting is enforced at the Caddy reverse proxy (a proxied venue).
// Keep the DB-only imports genuinely lazy. Importing Admin/Platform eagerly also loads the generated
// Prisma client, whose dependency chain may load a local .env before this condition is evaluated. That
// made a credential-free DEMO accidentally look DB-configured and then fail dependency assembly.
const dbModules = process.env.DATABASE_URL ? [
  require("./auth/auth.module").AuthModule,
  require("./admin/admin.module").AdminModule,
  require("./platform/platform.module").PlatformModule,
  require("./security/security.module").SecurityModule,
  require("./ops/ops.module").OpsModule,
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    ? [require("./institutions/institutions.module").InstitutionsModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    ? [require("./evidence/evidence.module").EvidenceModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    && inspectPersistenceFlags(process.env).transactionCase !== "off"
    ? [require("./cases/cases.module").CasesModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    && inspectPersistenceFlags(process.env).transactionCase !== "off"
    && inspectPersistenceFlags(process.env).roomReadSource !== "legacy"
    ? [require("./rooms/rooms.module").RoomsModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    && inspectPersistenceFlags(process.env).transactionCase !== "off"
    && inspectPersistenceFlags(process.env).completionAcknowledgement !== "off"
    ? [require("./completion/source-completion.module").SourceCompletionModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    && inspectPersistenceFlags(process.env).transactionCase !== "off"
    && inspectPersistenceFlags(process.env).externalActionSaga === "required"
    && inspectPersistenceFlags(process.env).daReplay === "allow_list"
    ? [require("./da-replay/da-replay.module").DaReplayModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    && inspectPersistenceFlags(process.env).transactionCase !== "off"
    && inspectPersistenceFlags(process.env).externalActionSaga === "required"
    && inspectPersistenceFlags(process.env).ptcReplay === "allow_list"
    ? [require("./ptc-replay/ptc-replay.module").PtcReplayModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    && inspectPersistenceFlags(process.env).transactionCase !== "off"
    && inspectPersistenceFlags(process.env).externalActionSaga === "required"
    && inspectPersistenceFlags(process.env).tokenisedDa !== "off"
    ? [require("./token-representation/token-representation.module").TokenRepresentationModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission !== "off"
    && inspectPersistenceFlags(process.env).neutralIngress !== "off"
    && inspectPersistenceFlags(process.env).transactionCase !== "off"
    && inspectPersistenceFlags(process.env).primaryCommercial === "shadow"
    ? [require("./commercial/commercial.module").CommercialModule]
    : []),
  ...(inspectPersistenceFlags(process.env).participantAdmission === "shadow"
    && inspectPersistenceFlags(process.env).neutralIngress === "shadow"
    && inspectPersistenceFlags(process.env).transactionCase === "shadow"
    && inspectPersistenceFlags(process.env).externalActionSaga === "required"
    && inspectPersistenceFlags(process.env).conventionalSecondary === "shadow"
    ? [require("./secondary-transfer/secondary-transfer.module").SecondaryTransferModule]
    : []),
  ...(inspectPersistenceFlags(process.env).internalRbac !== "off"
    ? [require("./internal-access/internal-access.module").InternalAccessModule]
    : []),
  ...(inspectPersistenceFlags(process.env).internalRbac !== "off"
    ? [require("./operational-readiness/operational-readiness.module").OperationalReadinessModule]
    : []),
] : [];
const demoModules = shouldMountDemoEndpoints(process.env) ? [DemoModule] : [];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TapeModule,
    MintModule,
    SurveillanceModule,
    DvpModule,
    BreakGlassModule,
    CloseModule,
    AmortiseModule,
    ...demoModules,
    ReportsModule,
    EventsModule,
    MetricsModule,
    ...dbModules,
  ],
})
export class AppModule {}
