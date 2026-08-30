# AssureRail — Containerisation Runbook

**[July 2026]** How the AssureRail venue (`apps/assurerail-api` + `apps/assurerail`) is packaged as
containers, and how to run the full stack (its own Postgres) locally or on a box.

The venue is deliberately **ring-fenced from AssureLocker** — its own database, its own ports, its own
deploy. The container stack preserves that: a dedicated `postgres:16` volume, no shared network with the
AssureLocker stack, DEMO adapters by default (**no external *integration* credentials** — Hedera / Setu /
GSTN etc. all stubbed).

Authentication follows the explicit operating mode, not `NODE_ENV`. Every non-demo mode refuses to
boot without `FIREBASE_ADMIN_CONFIG` and the venue database; `DEMO` may run with the in-memory store
and unconfigured Firebase. Two ways to run the current demo:

- **Optimised demo box** (default): `NODE_ENV=production` plus
  `ASSURERAIL_OPERATING_MODE=DEMO`. This is the current Hetzner demonstration path and is not
  production evidence.
- **Credential-free local spin-up**: use the supplied compose defaults. It declares `DEMO`, needs no
  external credentials, and exercises the demo stack (migrate + seed + demo endpoints).

---

## Files

| File | Role |
|---|---|
| `apps/assurerail-api/Dockerfile` | NestJS API image. `turbo prune` → `npm ci` → `prisma generate` + `tsc`. Runtime = `node dist/main.js`. |
| `apps/assurerail/Dockerfile` | Next 16 web image (standalone output). `turbo prune` → `npm ci` → `next build`. Runtime = `node apps/assurerail/server.js`. |
| `docker-compose.assurerail.yml` | The stack: `assurerail-db` (Postgres 16) + `assurerail-api` + `assurerail-web`. |
| `.dockerignore` (repo root) | Trims the build context (no `node_modules`/`.next`/`dist`/`.git`/secrets). |

Both Dockerfiles take the **repo root as the build context** because the apps are npm workspaces (the API
depends on `@code/shared`). `turbo prune <pkg> --docker` carves out only the target app + its workspace
dependencies into a minimal sub-monorepo, so the image never pulls the AssureLocker / plaza / hardhat
dependency trees.

---

## Run the whole stack

```bash
docker compose -f docker-compose.assurerail.yml up --build
```

Host ports:

| Service | Host | In-container |
|---|---|---|
| Web | http://localhost:3007 | 3007 |
| API | http://localhost:3006 | 3006 |
| Postgres | localhost:**5442** | 5432 |

Postgres is published on **5442** (not 5432) so it never clashes with the AssureLocker dev Postgres.

On first `up`, the API container runs `prisma migrate deploy` (applies `apps/assurerail-api/prisma/migrations`)
**before** the server boots, then `SEED_ON_BOOT=true` seeds the demo pools/notes. Watch for:

- `GET /healthz` → `200` (liveness — process is up)
- `GET /readyz` → `200` (readiness — DB reachable)

The API healthcheck in compose polls `/healthz`; `docker compose ps` shows `healthy` once it passes.

### Build just one image

```bash
docker build -f apps/assurerail-api/Dockerfile -t assurerail-api .
docker build -f apps/assurerail/Dockerfile     -t assurerail-web .
```

---

## Configuration & secrets

Nothing secret is baked into an image. Two supply channels:

1. **Root `.env`** — `docker compose` auto-loads it for `${VAR}` interpolation. Used for
   `ASSURERAIL_DB_PASSWORD`, the explicit `ASSURERAIL_OPERATING_MODE`, adapter flips
   (`HTS_ADAPTER=live` …), and the web build args.
2. **`apps/assurerail-api/.env.docker`** (optional, git-ignored) — API server secrets loaded via
   `env_file`: `FIREBASE_ADMIN_CONFIG`, `ASSURELOCKER_API_KEY`, `DIGIKYC_STATUS_SERVICE_SECRET`,
   `CODE_ISSUER_PQ_SECRET_KEY`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, etc. The file is **optional** — the
   stack runs without it (everything stays DEMO / disabled).

`NODE_ENV` and the AssureRail operating mode are deliberately separate. The supplied compose stack
uses an optimised Node process with `ASSURERAIL_OPERATING_MODE=DEMO` and
`ARAIL_DEMO_ENDPOINTS_ENABLED=true`. An undeclared production container resolves to `PRODUCTION` and
will refuse to start without persistent storage, authentication and non-demo external adapters. Do
not set a live/production label merely to change performance settings. `DEMO` also refuses any live
adapter, while `REPLAY` and `SHADOW` refuse the live HTS, HCS and settlement adapters. `SANDBOX` is the
only pre-live mode that may deliberately exercise mutating provider test environments.

### Web is build-time, not run-time

`NEXT_PUBLIC_*` are **inlined by `next build`**, so they are passed as `--build-arg` (see the compose
`build.args`), not container env. Structural identifiers (auth domain, project id, sender id, app id,
venue URL) default inside the web Dockerfile; the two **high-entropy** values — the **Firebase `apiKey`**
and the **reCAPTCHA site key** — have no default (public-by-design but never hardcoded in a tracked file),
so set `NEXT_PUBLIC_FIREBASE_API_KEY` and `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` in the root `.env` (or
`--build-arg`) to enable auth/captcha. Changing any `NEXT_PUBLIC_*` requires a **rebuild** of the web
image, not just a restart.

### Adapters (all DEMO by default)

`TAPE_SOURCE`, `HTS_ADAPTER`, `HCS_ANCHOR`, `SETTLEMENT_ADAPTER`, `DIGIKYC_GATE` — flip to `live` only
in a compatible explicit mode and once the corresponding integration is provisioned. See
`apps/assurerail-api/.env.example`. A mode/configuration mismatch fails before Nest starts.

---

## Connection pool

`DATABASE_URL` in compose appends `?connection_limit=10&pool_timeout=10`. Prisma opens a pool per process;
cap it so concurrent API instances stay under Postgres `max_connections`. Behind PgBouncer (transaction
mode) set `connection_limit=1&pgbouncer=true`. See
`docs/design/AssureRail_Capacity_And_Load_Testing.md` §9.

---

## How the images are structured (why)

- **`turbo prune --docker`** produces `out/json` (manifests + a pruned lockfile — the cache-friendly
  dependency layer) and `out/full` (source). Copying manifests first means a source-only change does not
  bust the `npm ci` layer.
- **Prisma engine is generated inside the image** (linux, openssl 3) so the query-engine binary target
  matches the runtime. The named client lands in `node_modules/@prisma/assurerail-client` (per the
  schema's `output`), which the runtime stage copies.
- **`@code/shared`** resolves through the workspace symlink in `node_modules`; the runtime stage copies
  `packages/shared/dist` so that symlink points at real files.
- **Migrations run at container start** (compose `command`), convenient for a single-instance venue. For
  multi-replica, move `prisma migrate deploy` to a one-shot init job so replicas don't race.
- **Non-root**: both images drop to the base image's `node` user.

### Known follow-ups (image size / prod hardening)
- The API runtime currently keeps dev dependencies so `prisma migrate deploy` can run in-container.
  A prod-only `node_modules` (regenerating the Prisma client after `npm prune --omit=dev`) would shrink
  the image — deferred.
- Pin `turbo` via a build stage on the repo's exact version if reproducibility across `turbo` releases
  becomes a concern (currently `turbo@2.3.0`, matching the root devDependency).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| API exits immediately, `relation "..." does not exist` | Migrations didn't run — check the `command` ran `prisma migrate deploy`; confirm `DATABASE_URL` points at `assurerail-db`. |
| `Can't reach database server at assurerail-db:5432` | DB not healthy yet — compose waits on `service_healthy`, but a very slow first boot can still race; `docker compose restart assurerail-api`. |
| Web shows blank Firebase / auth errors | `NEXT_PUBLIC_FIREBASE_API_KEY` was empty at build — set it and **rebuild** the web image. |
| Prisma engine error `libssl` | Rare on non-Debian bases — these images are `node:22-bookworm-slim` with `openssl` installed, so the `debian-openssl-3.0.x` engine matches. |
| Port already in use (3006/3007/5442) | Another local process (dev servers, AssureLocker) — stop it or remap the host port in compose. |
