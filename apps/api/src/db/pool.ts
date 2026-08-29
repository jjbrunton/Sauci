import { Pool } from 'pg';
import { instrumentPool, type TelemetryProcess } from '../telemetry.js';

/**
 * A repository is constructed either from a connection string, in which case it
 * owns the pool it creates and must end it, or from a pool the caller owns. The
 * API process takes the second path so every domain shares one bounded pool
 * instead of opening a default-sized pool per repository; tests keep taking the
 * first so each suite stays independently closable.
 */
export type DatabaseConnection = string | Pool;

export interface DatabasePoolOptions {
  /** Server-wide ceiling on concurrent PostgreSQL connections. */
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * `pg` defaults to ten connections per pool, which multiplied by one pool per
 * repository. One shared pool of the same size keeps the same headroom for a
 * single API process while bounding what a self-hosted PostgreSQL must accept.
 */
export const DEFAULT_POOL_MAX = 10;

export function createDatabasePool(databaseUrl: string, options: DatabasePoolOptions = {}, telemetryProcess?: TelemetryProcess): Pool {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: options.max ?? DEFAULT_POOL_MAX,
    ...(options.idleTimeoutMillis === undefined ? {} : { idleTimeoutMillis: options.idleTimeoutMillis }),
    ...(options.connectionTimeoutMillis === undefined ? {} : { connectionTimeoutMillis: options.connectionTimeoutMillis }),
  });
  return telemetryProcess ? instrumentPool(telemetryProcess, pool) : pool;
}

export interface ResolvedPool {
  pool: Pool;
  /** True when this repository created the pool and is responsible for ending it. */
  owned: boolean;
}

export function resolvePool(connection: DatabaseConnection): ResolvedPool {
  return typeof connection === 'string'
    ? { pool: new Pool({ connectionString: connection }), owned: true }
    : { pool: connection, owned: false };
}

/** Ends the pool only when this repository created it, so shared pools survive. */
export async function closeResolvedPool(pool: Pool, owned: boolean): Promise<void> {
  if (owned) await pool.end();
}
