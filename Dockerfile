# syntax=docker/dockerfile:1

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# `pnpm install`'s postinstall runs `prisma generate`, which needs the
# schema present -- hence copying prisma/ here, ahead of the full `COPY . .`
# in the builder stage below. `generate` never connects to a database, but
# prisma.config.ts's env("DATABASE_URL") still throws if the var is unset
# at all -- this placeholder only needs to satisfy that, nothing reads it.
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
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
ENV CLOUDINARY_CLOUD_NAME=placeholder
ENV CLOUDINARY_API_KEY=placeholder
ENV CLOUDINARY_API_SECRET=placeholder
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
