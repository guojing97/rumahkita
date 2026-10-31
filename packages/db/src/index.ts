import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export * from './schema/index';
export { schema };

export interface DatabaseConfig {
  connectionString?: string;
  maxConnections?: number;
}

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

export type DbClient = ReturnType<typeof createDatabaseClient>['db'];
