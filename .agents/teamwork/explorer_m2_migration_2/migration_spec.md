# Drizzle Migration & Tooling Infrastructure Specification

**Document:** `migration_spec.md`  
**Subagent:** Explorer 2 (`explorer_m2_migration_2`)  
**Domain:** Milestone 2 — Database Schema with Drizzle ORM (Migration, Tooling & Infrastructure)  
**Target Package:** `packages/db` (`@rumahkita/db`)  
**Date:** 2026-10-27  

---

## 1. Executive Summary & Tooling Architecture

The database migration and tooling infrastructure for **RumahKita** manages the schema evolution of 18 PostgreSQL tables across 8 domains (`auth`, `household`, `finance`, `inventory`, `purchase`, `debt`, `notification`, `audit`).

### Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                 Schema Definitions (TypeScript)             │
 │  packages/db/src/schema/{auth,finance,inventory,...}.ts     │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │           Drizzle Kit CLI (v0.26.2)                         │
 │           packages/db/drizzle.config.ts                     │
 ├──────────────────────────────┬──────────────────────────────┤
 │ `pnpm --filter db db:generate│ `pnpm --filter db db:push`   │
 └──────────────┬───────────────┴──────────────┬───────────────┘
                │ Generates SQL                │ Direct Schema Push (Dev)
                ▼                              │
 ┌──────────────────────────────┐              │
 │  SQL Migrations & Journal    │              │
 │  packages/db/drizzle/        │              │
 │  - 0000_initial_schema.sql   │              │
 │  - meta/_journal.json        │              │
 └──────────────┬───────────────┘              │
                │                              │
                ▼                              ▼
 ┌─────────────────────────────────────────────────────────────┐
 │               Migration Execution Layer                     │
 │  Option A: `pnpm --filter db db:migrate` (Programmatic)     │
 │            `packages/db/src/migrate.ts`                     │
 │  Option B: `pnpm --filter db db:migrate:kit` (CLI)          │
 │            `drizzle-kit migrate`                            │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Applies DDL / Tracks `__drizzle_migrations`
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │       PostgreSQL 16 Alpine (Docker Compose Container)       │
 │       `localhost:5432` / DB: `rumahkita`                    │
 └─────────────────────────────────────────────────────────────┘
```

---

## 2. Drizzle Configuration (`packages/db/drizzle.config.ts`)

### 2.1 File Location & Blueprint
The configuration file must be placed at the root of `packages/db/drizzle.config.ts`.

```typescript
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// 1. Load monorepo root .env file if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// 2. Default fallback matching docker-compose.yml and .env.example
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: connectionString,
  },
  verbose: true,
  strict: true,
});
```

### 2.2 Configuration Properties Rationalization
- **`dialect: 'postgresql'`**: Required top-level dialect in Drizzle Kit `v0.26+`. Specifies PostgreSQL AST parsing, DDL generators, and catalog introspection.
- **`schema: './src/schema/index.ts'`**: Points directly to the barrel file that re-exports all 8 domain schema files (`auth.ts`, `household.ts`, `finance.ts`, `inventory.ts`, `purchase.ts`, `debt.ts`, `notification.ts`, `audit.ts`). This guarantees deterministic topological ordering and avoids wildcard scanning collisions.
- **`out: './drizzle'`**: Standard Drizzle migration output directory. Holds versioned SQL files (`0000_*.sql`) and `meta/_journal.json`.
- **`dbCredentials.url`**: Single unified connection string supporting credentials, port, database, and SSL mode query parameters (e.g. `?sslmode=require`).
- **`verbose: true`**: Prints exact SQL statements executed during migrations and schema push for auditability and debugging.
- **`strict: true`**: Enforces interactive confirmation prompts during `db:push` or destructive schema actions to avoid accidental data loss.

---

## 3. Database Driver & Dependency Analysis

### 3.1 Driver Evaluation: `postgres` (`postgres-js`) vs `pg` (`node-postgres`)

| Evaluation Criteria | `postgres` (`postgres.js`) | `pg` (`node-postgres`) | Recommendation / Status |
|---------------------|----------------------------|------------------------|--------------------------|
| **Current Codebase State** | **Already integrated** in `packages/db/src/index.ts` and `apps/worker/package.json`. | Not currently present in `package.json` or imports. | **Retain `postgres`** |
| **Performance** | Highest throughput, zero-copy parsing, optimized buffer allocation. | Slower parsing; relies on legacy EventEmitter architecture. | **`postgres` wins** |
| **TypeScript Ergonomics** | Native TypeScript typings bundled with library. No `@types` required. | Requires `@types/pg` devDependency; typings often lag behind. | **`postgres` wins** |
| **Drizzle ORM Support** | First-class driver: `drizzle-orm/postgres-js` and `drizzle-orm/postgres-js/migrator`. | Supported via `drizzle-orm/node-postgres` and `drizzle-orm/node-postgres/migrator`. | Both supported |
| **Native C++ Addons** | None. Pure JS/TS implementation. | Often requires optional native bindings (`pg-native`). | **`postgres` wins** |
| **Drizzle Kit Compatibility** | 100% compatible. Drizzle Kit connects directly via `dialect: 'postgresql'`. | 100% compatible. | Both compatible |

### 3.2 Decision
**Standardize on `postgres` (`postgres-js` `^3.4.4`).**  
Do not add `pg` and `@types/pg` because doing so introduces redundant dependencies and conflicts with existing code in `packages/db/src/index.ts` and `apps/worker`.

*(Note: In the event that a third-party module strictly demands `node-postgres`, the worker can switch by installing `pg: "^8.13.0"` and `@types/pg: "^8.11.10"` and updating `packages/db/src/index.ts` to `import { drizzle } from 'drizzle-orm/node-postgres'` and `import { Pool } from 'pg'`. For MVP, `postgres` is already verified and superior).*

### 3.3 Required Additions to `packages/db/package.json`
To make `drizzle.config.ts`, `migrate.ts`, and `seed.ts` runnable via standard workspace commands, the following `devDependencies` must be added:
1. **`dotenv` (`^16.4.5`)**: Already in monorepo lockfile (`apps/worker`). Loads monorepo root `.env`.
2. **`tsx` (`^4.19.1`)**: Already in monorepo lockfile (`apps/worker`). Executes TypeScript migration scripts without prior compilation.

---

## 4. Migration Runner Implementation (`packages/db/src/migrate.ts`)

A programmatic migration runner provides critical safeguards that CLI-only execution lacks:
1. **Explicit Connection Teardown**: Ensures `migrationClient.end()` is invoked so node processes exit cleanly (POSIX code `0`).
2. **DDL Connection Serialization**: Uses `max: 1` connection to eliminate lock contention during concurrent DDL schema execution.
3. **Environment Path Resolution**: Automatically discovers monorepo root `.env` or falls back to Docker Compose defaults.
4. **Programmatic Reusability**: Exports `runMigrations(connectionString?)` for integration tests or container entrypoint scripts.

### 4.1 Programmatic Runner Blueprint
Create `packages/db/src/migrate.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';

// Load monorepo root .env if DATABASE_URL is not already set in environment
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

export interface MigrationOptions {
  connectionString?: string;
  migrationsFolder?: string;
}

/**
 * Executes all pending Drizzle SQL migrations against the target database.
 */
export async function runMigrations(options: MigrationOptions = {}) {
  const connectionString =
    options.connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita';

  const sanitizedUrl = connectionString.replace(/:[^:@]+@/, ':****@');
  console.log('🔄 Running Drizzle database migrations...');
  console.log(`📡 Target database: ${sanitizedUrl}`);

  // Migration connections MUST use max: 1 to ensure DDL serialization
  const migrationClient = postgres(connectionString, {
    max: 1,
    onnotice: () => {}, // Suppress non-critical PostgreSQL notices
  });

  const db = drizzle(migrationClient);

  try {
    const migrationsFolder =
      options.migrationsFolder || path.resolve(__dirname, '../drizzle');

    console.log(`📂 Applying migrations from: ${migrationsFolder}`);

    const startTime = Date.now();
    await migrate(db, { migrationsFolder });
    const elapsed = Date.now() - startTime;

    console.log(`✅ Migrations completed successfully in ${elapsed}ms!`);
  } catch (error) {
    console.error('❌ Migration execution failed:');
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      if ('code' in error) {
        console.error(`   PostgreSQL Code: ${(error as { code: string }).code}`);
      }
    } else {
      console.error(error);
    }
    throw error;
  } finally {
    await migrationClient.end();
  }
}

// Auto-run if executed directly via CLI: `tsx src/migrate.ts`
if (require.main === module || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      console.error('Migration halted due to errors.');
      process.exit(1);
    });
}
```

---

## 5. `packages/db/package.json` Specification

### 5.1 Updated Package Configuration Blueprint

```json
{
  "name": "@rumahkita/db",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "drizzle"
  ],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/migrate.ts",
    "db:migrate:kit": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:drop": "drizzle-kit drop",
    "db:check": "drizzle-kit check",
    "db:seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.35.3",
    "postgres": "^3.4.4"
  },
  "devDependencies": {
    "@rumahkita/typescript-config": "workspace:*",
    "@types/node": "^22.7.5",
    "dotenv": "^16.4.5",
    "drizzle-kit": "^0.26.2",
    "rimraf": "^6.0.1",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2"
  }
}
```

### 5.2 Key Script Explanations
| Script Command | Invocation Method | Function & Expected Outcome |
|---|---|---|
| `db:generate` | `pnpm --filter db db:generate` | Inspects `src/schema/index.ts`, compares against snapshot in `drizzle/meta`, and generates new SQL file (e.g. `0000_initial_schema.sql`). |
| `db:migrate` | `pnpm --filter db db:migrate` | Executes `src/migrate.ts` via `tsx`, applying pending migrations from `drizzle/` with detailed logging and graceful connection teardown. |
| `db:migrate:kit` | `pnpm --filter db db:migrate:kit` | Alternative runner using Drizzle Kit CLI directly (`drizzle-kit migrate`). |
| `db:push` | `pnpm --filter db db:push` | Directly synchronizes PostgreSQL database schema with TypeScript schema definitions without generating migration files. |
| `db:studio` | `pnpm --filter db db:studio` | Launches Drizzle Studio web GUI on local port for database inspection. |
| `db:drop` | `pnpm --filter db db:drop` | Deletes unapplied migration file and syncs `meta/_journal.json`. |
| `db:seed` | `pnpm --filter db db:seed` | Populates database with households, users (Argon2id passwords), categories, items, and debts via `src/seed.ts`. |

---

## 6. Schema Barrel & Client Factory (`packages/db/src/index.ts`)

`packages/db/src/index.ts` must be updated to export:
1. All domain tables and enums from `src/schema/`
2. Relational client factory supporting `db.query.*`
3. Inference helpers (`InferSelectModel`, `InferInsertModel`)
4. Migration programmatic runner

### 6.1 Updated `packages/db/src/index.ts` Blueprint

```typescript
/**
 * @rumahkita/db - Drizzle ORM Database Schema, Connection Pool & Migrator
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface DatabaseConfig {
  connectionString?: string;
  maxConnections?: number;
}

/**
 * Creates a Drizzle client instance initialized with the complete schema.
 */
export function createDatabaseClient(config: DatabaseConfig = {}) {
  const connectionString =
    config.connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita';

  const queryClient = postgres(connectionString, {
    max: config.maxConnections || 10,
  });

  const db = drizzle(queryClient, { schema });

  return {
    db,
    queryClient,
  };
}

/**
 * Convenience helper matching plan.md factory signature
 */
export const createDb = (url?: string) =>
  createDatabaseClient({ connectionString: url });

export type DbClient = ReturnType<typeof createDatabaseClient>['db'];

// Re-export all schema tables, relations, and enums
export * from './schema';
export { schema };

// Re-export migration runner
export { runMigrations } from './migrate';

// Re-export Drizzle ORM type inference utilities
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
```

---

## 7. Turborepo Integration (`turbo.json` & Root `package.json`)

### 7.1 `turbo.json` Update
Add the database tasks to `tasks` in `turbo.json`. All database tasks must specify `"cache": false` because they interact with external persistent storage.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local",
    "tsconfig.json"
  ],
  "globalEnv": [
    "NODE_ENV",
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false,
      "dependsOn": ["^build"]
    },
    "db:push": {
      "cache": false
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["^build"]
    },
    "db:studio": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### 7.2 Root `package.json` Pass-Through Scripts
Add database shortcuts to root `package.json` scripts:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "db:generate": "turbo run db:generate",
    "db:migrate": "turbo run db:migrate",
    "db:push": "turbo run db:push",
    "db:seed": "turbo run db:seed",
    "db:studio": "turbo run db:studio"
  }
}
```

---

## 8. Docker Compose Integration & Environment Negotiation

### 8.1 Docker Compose Alignment
`docker-compose.yml` configures PostgreSQL 16 Alpine:
- **Port:** `5432:5432`
- **User:** `rumahkita` (override via `POSTGRES_USER`)
- **Password:** `rumahkita_dev_password` (override via `POSTGRES_PASSWORD`)
- **Database:** `rumahkita` (override via `POSTGRES_DB`)
- **Volume:** `pgdata` (`rumahkita_pgdata`)
- **Healthcheck:** `pg_isready -U ${POSTGRES_USER:-rumahkita} -d ${POSTGRES_DB:-rumahkita}` (every 5s)

### 8.2 Environment Negotiation Matrix

| Context | Host | Port | `DATABASE_URL` Format | SSL Mode |
|---|---|---|---|---|
| **Host Terminal (Local Dev)** | `localhost` | `5432` | `postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita` | Disabled |
| **Docker Internal Network** | `postgres` | `5432` | `postgresql://rumahkita:rumahkita_dev_password@postgres:5432/rumahkita` | Disabled |
| **CI Runner (GitHub Actions)** | `localhost` | `5432` | `postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita` | Disabled |
| **Managed DB (Supabase/Neon/RDS)** | `ep-*.region.aws.neon.tech` | `5432` | `postgresql://[user]:[pass]@[host]:5432/[db]?sslmode=require` | Required (`sslmode=require`) |

### 8.3 Connection String Negotiation in Code
In `drizzle.config.ts`, `src/migrate.ts`, and `src/index.ts`, the negotiation sequence is:
1. `process.env.DATABASE_URL` (if set in shell or loaded from `.env`)
2. `config.connectionString` (if passed programmatically)
3. Hardcoded default: `'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita'`

This guarantees zero-configuration local booting: running `docker compose up -d` followed by `pnpm --filter db db:migrate` succeeds immediately even before a developer manually creates `.env`.

---

## 9. Worker Step-by-Step Execution Guide

When implementing Milestone 2, the implementation worker must execute the following steps in sequence:

### Step 1: Install Dependencies in `packages/db`
```bash
pnpm --filter @rumahkita/db add -D dotenv@^16.4.5 tsx@^4.19.1
```

### Step 2: Create `packages/db/drizzle.config.ts`
Write the file according to the blueprint in Section 2.1.

### Step 3: Create `packages/db/src/migrate.ts`
Write the programmatic runner according to the blueprint in Section 4.1.

### Step 4: Update `packages/db/package.json`
Update `scripts` and `files` according to Section 5.1.

### Step 5: Update `packages/db/src/index.ts`
Export schema tables, enums, client factory, `createDb`, inference types, and `runMigrations` according to Section 6.1.

### Step 6: Update `turbo.json` and Root `package.json`
Add `db:*` tasks to `turbo.json` and pass-through scripts to root `package.json` according to Section 7.

### Step 7: Generate Initial Migration
Once Explorer 1's schema files in `packages/db/src/schema/` are complete:
```bash
pnpm --filter db db:generate
```
Verify that `packages/db/drizzle/0000_*.sql` and `packages/db/drizzle/meta/_journal.json` are generated.

### Step 8: Start PostgreSQL Container
```bash
pnpm docker:up
```
Wait for healthy state:
```bash
docker compose exec postgres pg_isready -U rumahkita -d rumahkita
```

### Step 9: Apply Migrations
```bash
pnpm --filter db db:migrate
```
Verify output:
`✅ Migrations completed successfully in XXms!`

### Step 10: Run Database Seeder
Once Explorer 3's seeder script in `packages/db/src/seed.ts` is in place:
```bash
pnpm --filter db db:seed
```

---

## 10. Verification Matrix & Edge Cases

| Test Case / Verification | Trigger Command | Expected Behavior | Failure Remedy |
|---|---|---|---|
| **Syntax & Typecheck** | `pnpm --filter db typecheck` | Exits 0, no TypeScript compilation errors. | Ensure `@types/node` and `@types` are up to date. |
| **Package Build** | `pnpm --filter db build` | Compiles `src/` into `dist/` including `dist/index.js` and `dist/migrate.js`. | Verify `tsconfig.json` `rootDir` and `outDir`. |
| **SQL Generation** | `pnpm --filter db db:generate` | Creates `packages/db/drizzle/0000_*.sql` containing all 18 table definitions. | Check `drizzle.config.ts` schema path resolution. |
| **Migration on Fresh DB** | `pnpm --filter db db:migrate` | Connects, creates `__drizzle_migrations`, executes DDL, exits 0. | Ensure PostgreSQL container is running on port 5432. |
| **Idempotent Re-run** | `pnpm --filter db db:migrate` (second run) | Logs 0 pending migrations, exits 0 without error. | Verify `__drizzle_migrations` table records previous hashes. |
| **PostgreSQL Disconnected** | `pnpm --filter db db:migrate` (docker stopped) | Traps `ECONNREFUSED`, logs helpful message, exits 1. | Handled by `try/catch` block in `src/migrate.ts`. |
| **Turbo Pipeline Integration** | `pnpm db:migrate` from root | Turborepo executes `@rumahkita/db#db:migrate` without cache hit. | Verify `cache: false` in `turbo.json`. |
