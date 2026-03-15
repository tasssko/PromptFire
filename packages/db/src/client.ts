import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Postgres auth storage.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }

  if (!dbInstance) {
    dbInstance = drizzle(pool, { schema });
  }

  return dbInstance;
}

export async function closeDbPool(): Promise<void> {
  if (!pool) {
    return;
  }
  await pool.end();
  pool = null;
  dbInstance = null;
}
