# AssureRail venue API (apps/assurerail-api) — NestJS + Prisma (named client @prisma/assurerail-client).
#
# BUILD CONTEXT = repo root (the app is an npm workspace that depends on @code/shared). Build with:
#   docker build -f apps/assurerail-api/Dockerfile -t assurerail-api .
# or via docker-compose.assurerail.yml (which sets context: .).
#
# Strategy: `turbo prune` carves out ONLY this app + its workspace deps (@code/shared) into a minimal
# sub-monorepo, so the image never pulls AssureLocker/plaza/hardhat deps. Multi-stage keeps the runtime
# lean. Prisma's engine is generated INSIDE the linux image so the binary target matches (openssl 3).

# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
# openssl is required by the Prisma query engine (debian-openssl-3.0.x); ca-certificates for TLS egress.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# ── prune ──────────────────────────────────────────────────────────────────────────────────────
# Produce out/json (manifests + pruned lockfile) and out/full (source) for just @code/assurerail-api.
FROM base AS pruner
RUN npm install -g turbo@2.3.0
COPY . .
RUN turbo prune @code/assurerail-api --docker

# ── install + build ────────────────────────────────────────────────────────────────────────────
FROM base AS installer
# 1) manifests first → dependency layer is cached across source-only changes.
COPY --from=pruner /repo/out/json/ ./
RUN npm ci
# 2) source, then build @code/shared (tsc) and the api (prisma generate + tsc).
COPY --from=pruner /repo/out/full/ ./
RUN npm run build -w @code/shared \
    && npm run build -w @code/assurerail-api

# ── runtime ────────────────────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
# Root node_modules carries hoisted deps + the generated @prisma/assurerail-client (+ its engine) and
# the @code/shared workspace symlink target (we copy packages/shared/dist so that symlink resolves).
# (Dev deps are kept so `prisma migrate deploy` can run at container start — see the compose command.
# Pruning them to a prod-only tree is a follow-up image-size optimisation.)
COPY --from=installer /repo/node_modules ./node_modules
COPY --from=installer /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=installer /repo/packages/shared/dist ./packages/shared/dist
# The WHOLE app dir — critically its NESTED node_modules. npm does not hoist every dep to root: many
# (@nestjs/schedule, express, multer, cors…) are nested under apps/assurerail-api/node_modules, and the
# root copy alone would miss them (→ MODULE_NOT_FOUND at runtime). This also brings dist + prisma +
# package.json in one layer.
COPY --from=installer /repo/apps/assurerail-api ./apps/assurerail-api

WORKDIR /repo/apps/assurerail-api
# Drop privileges — the base `node` image ships a non-root `node` user.
USER node
EXPOSE 3006
# Default command runs the server; compose overrides to `prisma migrate deploy && node dist/main.js`
# so the schema is applied before boot.
CMD ["node", "dist/main.js"]
