# ==============================================================================
# Stage 1 – Dependencies
# ==============================================================================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json      packages/eslint-config/
COPY packages/contracts/package.json          packages/contracts/
COPY packages/db/package.json                 packages/db/
COPY apps/worker/package.json                 apps/worker/

RUN pnpm install --frozen-lockfile

# ==============================================================================
# Stage 2 – Builder
# ==============================================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY --from=deps /app/packages/typescript-config/node_modules packages/typescript-config/node_modules
COPY --from=deps /app/packages/eslint-config/node_modules     packages/eslint-config/node_modules
COPY --from=deps /app/packages/contracts/node_modules         packages/contracts/node_modules
COPY --from=deps /app/packages/db/node_modules                packages/db/node_modules
COPY --from=deps /app/apps/worker/node_modules                apps/worker/node_modules

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/typescript-config packages/typescript-config
COPY packages/eslint-config      packages/eslint-config
COPY packages/contracts          packages/contracts
COPY packages/db                 packages/db
COPY apps/worker                 apps/worker

RUN pnpm --filter @rumahkita/contracts build && \
    pnpm --filter @rumahkita/db build && \
    pnpm --filter @rumahkita/worker build

# ==============================================================================
# Stage 3 – Runner
# ==============================================================================
FROM node:22-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Copy only production node_modules from deps (avoids re-resolving workspace:* packages)
COPY --from=deps /app/node_modules                                     ./node_modules
COPY --from=deps /app/packages/contracts/node_modules                  packages/contracts/node_modules
COPY --from=deps /app/packages/db/node_modules                         packages/db/node_modules
COPY --from=deps /app/apps/worker/node_modules                         apps/worker/node_modules

# Copy built artifacts
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/packages/db/dist        packages/db/dist
COPY --from=builder /app/apps/worker/dist        apps/worker/dist

# Copy package.json files (needed for Node module resolution)
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json         packages/db/
COPY apps/worker/package.json         apps/worker/

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
