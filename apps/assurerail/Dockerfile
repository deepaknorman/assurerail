# AssureRail venue web (apps/assurerail) — Next 16 (standalone output).
#
# BUILD CONTEXT = repo root. Build with:
#   docker build -f apps/assurerail/Dockerfile -t assurerail-web .
# or via docker-compose.assurerail.yml.
#
# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time, so they arrive as --build-arg (see the
# compose `build.args`). next.config.js sets output:"standalone" + turbopack.root=repo root, so the
# standalone server lands at apps/assurerail/server.js with a self-contained node_modules.

# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /repo

# ── prune ──────────────────────────────────────────────────────────────────────────────────────
FROM base AS pruner
RUN npm install -g turbo@2.3.0
COPY . .
RUN turbo prune @code/assurerail --docker

# ── install + build ────────────────────────────────────────────────────────────────────────────
FROM base AS installer
COPY --from=pruner /repo/out/json/ ./
RUN npm ci
COPY --from=pruner /repo/out/full/ ./

# Public client config — inlined by `next build`. Structural identifiers default to the venue's known
# public config; the two high-entropy values (Firebase apiKey `AIzaSy…` and the reCAPTCHA site key) have
# NO default and must be passed as build args — both are public-by-design but gitleaks flags their shape,
# so they are never hardcoded in a tracked file. Without them the build still succeeds (auth/captcha
# disabled — see the Firebase guard in src/lib/firebase.ts); a functional deploy passes real values.
ARG NEXT_PUBLIC_ASSURERAIL_VENUE_URL="http://localhost:3006"
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="assurerail.firebaseapp.com"
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID="assurerail"
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="assurerail.firebasestorage.app"
ARG NEXT_PUBLIC_FIREBASE_SENDER_ID="668261348718"
ARG NEXT_PUBLIC_FIREBASE_APP_ID="1:668261348718:web:4b9ff814c009c6a83dfd7f"
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY=""
ARG NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1="off"
ARG NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1="off"
ARG NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1="off"
ARG NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1="off"
ENV NEXT_PUBLIC_ASSURERAIL_VENUE_URL=$NEXT_PUBLIC_ASSURERAIL_VENUE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_SENDER_ID=$NEXT_PUBLIC_FIREBASE_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY \
    NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=$NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1 \
    NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1=$NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1 \
    NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1=$NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1 \
    NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1=$NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1 \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @code/assurerail

# ── runtime ────────────────────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3007 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# Standalone bundle (monorepo layout): server.js + node_modules under apps/assurerail/, static + public
# copied alongside (Next does not include them in standalone).
COPY --from=installer /repo/apps/assurerail/.next/standalone ./
COPY --from=installer /repo/apps/assurerail/.next/static ./apps/assurerail/.next/static
COPY --from=installer /repo/apps/assurerail/public ./apps/assurerail/public
USER node
EXPOSE 3007
CMD ["node", "apps/assurerail/server.js"]
