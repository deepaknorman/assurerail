# AssureRail API — standalone-repository build.
# Build context must be the repository root.

# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS installer
COPY package.json package-lock.json ./
COPY apps/assurerail-api/package.json ./apps/assurerail-api/package.json
COPY apps/assurerail/package.json ./apps/assurerail/package.json
RUN npm ci
COPY apps/assurerail-api ./apps/assurerail-api
RUN npm run build --workspace=@assurerail/api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /repo/node_modules ./node_modules
COPY --from=installer /repo/apps/assurerail-api ./apps/assurerail-api
WORKDIR /repo/apps/assurerail-api
USER node
EXPOSE 3006
CMD ["node", "dist/main.js"]
