# ==============================================================================
# Stage 1 – Dependencies
# ==============================================================================
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json      packages/eslint-config/
COPY packages/contracts/package.json          packages/contracts/
COPY packages/ui/package.json                 packages/ui/
COPY apps/web/package.json                    apps/web/

RUN pnpm install --frozen-lockfile

# ==============================================================================
# Stage 2 – Builder
# ==============================================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY --from=deps /app/packages/typescript-config/node_modules packages/typescript-config/node_modules
COPY --from=deps /app/packages/eslint-config/node_modules     packages/eslint-config/node_modules
COPY --from=deps /app/packages/contracts/node_modules         packages/contracts/node_modules
COPY --from=deps /app/packages/ui/node_modules                packages/ui/node_modules
COPY --from=deps /app/apps/web/node_modules                   apps/web/node_modules

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/typescript-config packages/typescript-config
COPY packages/eslint-config      packages/eslint-config
COPY packages/contracts          packages/contracts
COPY packages/ui                 packages/ui
COPY apps/web                    apps/web

# Build-time env vars (Next.js NEXT_PUBLIC_* baked at build time)
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build contracts → ui → web
RUN pnpm --filter @rumahkita/contracts build && \
    pnpm --filter @rumahkita/ui build && \
    pnpm --filter @rumahkita/web build

# ==============================================================================
# Stage 3 – Runner
# Uses Next.js standalone output for minimal image size
# ==============================================================================
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public       ./public
COPY --from=builder /app/apps/web/.next/static ./.next/static

# Next.js standalone output (requires output: 'standalone' in next.config.js)
# If standalone is not enabled, fall back to full .next + node_modules
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/packages/contracts/dist /app_packages/contracts/dist
COPY --from=builder /app/packages/ui/dist        /app_packages/ui/dist

USER nextjs

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "-p", "3000"]
