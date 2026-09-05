# syntax=docker/dockerfile:1.7
#
# Ticketloom production image — Next.js HTTP, BullMQ worker, Socket.IO server.
# Use different CMD / compose `command:` per service.

FROM node:22.14-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders only — never used at runtime. Skip strict prod validation.
# Next.js page-data collection imports Prisma; DATABASE_URL must be present.
ENV SKIP_ENV_VALIDATION=true
ENV AUTH_SECRET=docker-build-placeholder-secret-32chars
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
ENV REDIS_URL=redis://127.0.0.1:6379
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV AUTH_URL=http://localhost:3000
RUN npx prisma generate && npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 ticketloom \
  && useradd --system --uid 1001 --gid ticketloom ticketloom

# Copy built app + full install, then drop devDependencies while keeping
# prisma CLI + tsx for migrate / worker / socket entrypoints.
COPY --from=builder --chown=ticketloom:ticketloom /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=ticketloom:ticketloom /app/node_modules ./node_modules
COPY --from=builder --chown=ticketloom:ticketloom /app/.next ./.next
COPY --from=builder --chown=ticketloom:ticketloom /app/public ./public
COPY --from=builder --chown=ticketloom:ticketloom /app/prisma ./prisma
COPY --from=builder --chown=ticketloom:ticketloom /app/prisma.config.ts ./
COPY --from=builder --chown=ticketloom:ticketloom /app/src ./src
COPY --from=builder --chown=ticketloom:ticketloom /app/tsconfig.json ./
COPY --from=builder --chown=ticketloom:ticketloom /app/next.config.ts ./
COPY --from=builder --chown=ticketloom:ticketloom /app/scripts ./scripts
COPY --chown=ticketloom:ticketloom docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && npm prune --omit=dev \
  && npm install prisma@7.10.0 --no-save --omit=dev --no-fund --no-audit \
  && npx prisma generate \
  && chown -R ticketloom:ticketloom /app

USER ticketloom

EXPOSE 3000 3001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
