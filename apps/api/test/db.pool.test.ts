import { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_POOL_MAX,
  closeResolvedPool,
  createDatabasePool,
  resolvePool,
} from '../src/db/pool.js';

const url = 'postgres://user:pass@127.0.0.1:5432/sauci_test';

afterEach(() => vi.restoreAllMocks());

describe('database pool', () => {
  it('bounds the shared pool and only forwards timeouts that were configured', () => {
    // A process-wide pool is the whole point of the change: an unbounded default
    // multiplied by one pool per repository is what the self-hosted database had
    // to absorb before.
    const bounded = createDatabasePool(url, { max: 4, idleTimeoutMillis: 1_000, connectionTimeoutMillis: 2_000 });
    expect(bounded.options.max).toBe(4);
    expect(bounded.options.idleTimeoutMillis).toBe(1_000);
    expect(bounded.options.connectionTimeoutMillis).toBe(2_000);

    const defaults = createDatabasePool(url);
    expect(defaults.options.max).toBe(DEFAULT_POOL_MAX);

    return Promise.all([bounded.end(), defaults.end()]);
  });

  it('owns a pool it built from a URL and never ends one it was handed', async () => {
    // Repositories in the API process share one pool, so closing any single
    // repository must not take the connections out from under the others. Tests
    // still construct from a URL and must be able to close what they created.
    const owned = resolvePool(url);
    expect(owned.owned).toBe(true);
    const ownedEnd = vi.spyOn(owned.pool, 'end');
    await closeResolvedPool(owned.pool, owned.owned);
    expect(ownedEnd).toHaveBeenCalledTimes(1);

    const shared = new Pool({ connectionString: url });
    const borrowed = resolvePool(shared);
    expect(borrowed.owned).toBe(false);
    expect(borrowed.pool).toBe(shared);
    const sharedEnd = vi.spyOn(shared, 'end');
    await closeResolvedPool(borrowed.pool, borrowed.owned);
    expect(sharedEnd).not.toHaveBeenCalled();
    await shared.end();
  });
});
