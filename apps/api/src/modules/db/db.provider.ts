import { Provider } from '@nestjs/common';
import { createDatabaseClient, DbClient } from '@rumahkita/db';
import { DB_CLIENT, QUERY_CLIENT, DB_CONNECTION } from '../../common/constants/tokens.js';

export const databaseProviders: Provider[] = [
  {
    provide: DB_CONNECTION,
    useFactory: () => {
      const client = createDatabaseClient({
        connectionString: process.env.DATABASE_URL,
        maxConnections: Number(process.env.DB_POOL_MAX || 15),
      });
      return client;
    },
  },
  {
    provide: DB_CLIENT,
    useFactory: (conn: ReturnType<typeof createDatabaseClient>): DbClient => conn.db,
    inject: [DB_CONNECTION],
  },
  {
    provide: QUERY_CLIENT,
    useFactory: (conn: ReturnType<typeof createDatabaseClient>) => conn.queryClient,
    inject: [DB_CONNECTION],
  },
];
