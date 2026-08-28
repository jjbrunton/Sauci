import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for database migrations');
}

const migrationsFolder = resolve(process.env.MIGRATIONS_DIR ?? 'drizzle');
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const lockClient = await pool.connect();

try {
  // Serializes migration containers during rolling/retried deployments.
  await lockClient.query('select pg_advisory_lock($1)', [2_024_082_701]);
  await migrate(drizzle(pool), { migrationsFolder });
  console.log(`Database migrations completed from ${migrationsFolder}`);
} finally {
  await lockClient.query('select pg_advisory_unlock($1)', [2_024_082_701]).catch(() => undefined);
  lockClient.release();
  await pool.end();
}
