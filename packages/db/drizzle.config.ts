import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// Load monorepo root .env file if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// Default fallback matching docker-compose.yml and .env.example
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
