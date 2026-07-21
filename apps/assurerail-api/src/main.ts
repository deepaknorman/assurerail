import "reflect-metadata";
import "dotenv/config"; // load the venue's .env before any module reads process.env (e.g. StoreModule → DATABASE_URL)
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { config } from "./config";
import { audit } from "./common/audit";

async function bootstrap() {
  const log = new Logger("Bootstrap");
  const usingDb = !!process.env.DATABASE_URL;
  const isProd = process.env.NODE_ENV === "production";

  // Fail closed where persistence is required (opt-in, so the DEMO box still runs in-memory). Set
  // REQUIRE_DB=true anywhere a real database MUST back the venue (e.g. once the box DB is provisioned).
  if (!usingDb && process.env.REQUIRE_DB === "true") {
    throw new Error("DATABASE_URL is required (REQUIRE_DB=true) — refusing to start on the ephemeral in-memory store");
  }
  // Production must have auth configured (AssureLocker parity — no open venue in prod).
  if (isProd && !process.env.FIREBASE_ADMIN_CONFIG) {
    throw new Error("FIREBASE_ADMIN_CONFIG is required in production — refusing to start an unauthenticated venue");
  }

  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });

  // Behind Caddy — one proxy hop, so per-IP throttling can't be spoofed via X-Forwarded-For.
  const httpAdapter = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  httpAdapter.set?.("trust proxy", 1);

  // helmet — this is a JSON API (no HTML), so keep a tight default and drop CSP/COEP that only matter
  // for served documents.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  // Reject unknown/extra fields and coerce DTOs (AssureLocker parity).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // CORS — allowlist the venue web origin(s) via ASSURERAIL_WEB_ORIGINS (comma-separated). No wildcard
  // by default; a reflect-any mode exists only behind an explicit opt-in (never for production).
  const origins = (process.env.ASSURERAIL_WEB_ORIGINS ?? (isProd ? "" : "http://localhost:3007,http://localhost:3001"))
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (process.env.ASSURERAIL_CORS_ANY === "true") {
    app.enableCors({ origin: true, credentials: true });
    log.warn("CORS is OPEN (ASSURERAIL_CORS_ANY=true) — do NOT use in production");
  } else {
    app.enableCors({ origin: origins.length ? origins : false, credentials: true });
  }

  await app.listen(config.port);

  // Store backing is never silent: a persistent-expected deploy that fell back to in-memory is loud.
  if (usingDb) log.log("AssureRail store: persistent Postgres");
  else log.warn("AssureRail store: IN-MEMORY — data is EPHEMERAL (set DATABASE_URL for persistence)");
  audit("venue.started", {
    port: config.port,
    tapeSource: config.tapeSource,
    htsAdapter: config.htsAdapter,
    store: usingDb ? "postgres" : "in-memory",
    corsOrigins: process.env.ASSURERAIL_CORS_ANY === "true" ? "any" : origins.length,
  });
}
void bootstrap();
