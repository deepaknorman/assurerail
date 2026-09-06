import "reflect-metadata";
import "dotenv/config"; // load the venue's .env before any module reads process.env (e.g. StoreModule → DATABASE_URL)
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { config } from "./config";
import { audit } from "./common/audit";
import { assertRuntimeEnvironment } from "./runtime/runtime-profile";

async function bootstrap() {
  const log = new Logger("Bootstrap");
  const runtime = assertRuntimeEnvironment(process.env);
  const usingDb = !!process.env.DATABASE_URL;
  const startupProbe = process.env.ASSURERAIL_STARTUP_PROBE === "true";

  // Fail closed where persistence is required (opt-in, so the DEMO box still runs in-memory). Set
  // REQUIRE_DB=true anywhere a real database MUST back the venue (e.g. once the box DB is provisioned).
  if (!usingDb && process.env.REQUIRE_DB === "true") {
    throw new Error("DATABASE_URL is required (REQUIRE_DB=true) — refusing to start on the ephemeral in-memory store");
  }
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });

  // Behind Caddy — one proxy hop, so per-IP throttling can't be spoofed via X-Forwarded-For.
  const httpAdapter = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  httpAdapter.set?.("trust proxy", 1);

  // helmet — this is a JSON API (no HTML), so keep a tight default and drop CSP/COEP that only matter
  // for served documents.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Reject unknown/extra fields and coerce DTOs at the Rail boundary.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // CORS — allowlist the venue web origin(s) via ASSURERAIL_WEB_ORIGINS (comma-separated). No wildcard
  // by default; a reflect-any mode exists only behind an explicit opt-in (never for production).
  const origins = (process.env.ASSURERAIL_WEB_ORIGINS ?? (runtime.operatingMode === "DEMO" ? "http://localhost:3007" : ""))
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (process.env.ASSURERAIL_CORS_ANY === "true") {
    app.enableCors({ origin: true, credentials: true });
    log.warn("CORS is OPEN (ASSURERAIL_CORS_ANY=true) — allowed only in explicit DEMO mode");
  } else {
    app.enableCors({ origin: origins.length ? origins : false, credentials: true });
  }

  // Local/release startup probe: assemble the real module graph, routes, guards and lifecycle hooks
  // without opening a network listener. This makes fail-closed startup executable in restricted build
  // environments; it is not a deployed health check or production evidence.
  if (startupProbe) await app.init();
  else await app.listen(config.port);

  // Store backing is never silent: a persistent-expected deploy that fell back to in-memory is loud.
  if (usingDb) log.log("AssureRail store: persistent Postgres");
  else log.warn("AssureRail store: IN-MEMORY — data is EPHEMERAL (set DATABASE_URL for persistence)");
  log.log(
    `AssureRail operating mode: ${runtime.operatingMode} (demo endpoints ${runtime.demoEndpointsEnabled ? "enabled" : "disabled"})`,
  );
  audit(startupProbe ? "venue.startup_probe.validated" : "venue.started", {
    port: config.port,
    operatingMode: runtime.operatingMode,
    demoEndpointsEnabled: runtime.demoEndpointsEnabled,
    tapeSource: config.tapeSource,
    htsAdapter: config.htsAdapter,
    store: usingDb ? "postgres" : "in-memory",
    corsOrigins: process.env.ASSURERAIL_CORS_ANY === "true" ? "any" : origins.length,
  });
  if (startupProbe) await app.close();
}
void bootstrap();
