# ==============================================================================
# Stage 1 – Dependencies
# Install ALL dependencies (including dev) needed to build the monorepo
# ==============================================================================
FROM node:20-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Copy package.json files for all workspace members
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json      packages/eslint-config/
COPY packages/contracts/package.json          packages/contracts/
COPY packages/ui/package.json                 packages/ui/
COPY packages/db/package.json                 packages/db/
COPY apps/api/package.json                    apps/api/

RUN pnpm install --frozen-lockfile

# ==============================================================================
# Stage 2 – Builder
# Compile packages/contracts, packages/db, and apps/api
# ==============================================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY --from=deps /app/packages/typescript-config/node_modules packages/typescript-config/node_modules
COPY --from=deps /app/packages/eslint-config/node_modules     packages/eslint-config/node_modules
COPY --from=deps /app/packages/contracts/node_modules         packages/contracts/node_modules
COPY --from=deps /app/packages/db/node_modules                packages/db/node_modules
COPY --from=deps /app/packages/ui/node_modules                packages/ui/node_modules
COPY --from=deps /app/apps/api/node_modules                   apps/api/node_modules

# Copy source
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/typescript-config packages/typescript-config
COPY packages/eslint-config      packages/eslint-config
COPY packages/contracts          packages/contracts
COPY packages/ui                 packages/ui
COPY packages/db                 packages/db
COPY apps/api                    apps/api

# Build dependencies first, then the API
RUN pnpm --filter @rumahkita/contracts build && \
    pnpm --filter @rumahkita/db build && \
    pnpm --filter @rumahkita/api build

# ==============================================================================
# Stage 3 – Runner (production image)
# Lean image with only compiled output and production node_modules
# ==============================================================================
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

ENV NODE_ENV=production

WORKDIR /app

# Copy workspace manifests for pruned install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json      packages/eslint-config/
COPY packages/contracts/package.json          packages/contracts/
COPY packages/ui/package.json                 packages/ui/
COPY packages/db/package.json                 packages/db/
COPY apps/api/package.json                    apps/api/

# Production-only install (no devDependencies)
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/packages/db/dist        packages/db/dist
COPY --from=builder /app/packages/db/drizzle     packages/db/drizzle
COPY --from=builder /app/apps/api/dist           apps/api/dist
COPY --from=builder /app/apps/api/nest-cli.json  apps/api/nest-cli.json

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/main.js"]
