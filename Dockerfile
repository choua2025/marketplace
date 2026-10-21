# syntax=docker/dockerfile:1

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Values here only need to satisfy env.ts's Zod schema at build time (Next
# inlines NEXT_PUBLIC_* vars at build, but this app has none) -- the real
# runtime values are injected via `docker run -e` / compose, never baked in.
ENV NODE_ENV=production
ENV APP_URL=http://localhost:3000
ENV DATABASE_APP_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
ENV BETTER_AUTH_SECRET=placeholder-build-time-secret
ENV BETTER_AUTH_URL=http://localhost:3000
ENV S3_ENDPOINT=http://localhost:9000
ENV S3_REGION=garage
ENV S3_ACCESS_KEY_ID=placeholder
ENV S3_SECRET_ACCESS_KEY=placeholder
ENV S3_BUCKET=changdee
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
