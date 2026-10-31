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

const isDirectRun = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))
);

if (isDirectRun) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      console.error('Migration halted due to errors.');
      process.exit(1);
    });
}
