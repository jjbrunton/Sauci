import { describe, expect, it, vi } from 'vitest';
import { OUTBOX_STATE_SQL, PostgresOperationsRepository } from '../src/domains/operations/repository.js';

describe('operations outbox observation', () => {
  it('uses a transaction-scoped statement timeout and always releases on query failure', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === OUTBOX_STATE_SQL) throw new Error('statement timeout');
      return { rows: [], rowCount: 0 };
    });
    const release = vi.fn();
    const pool = { connect: vi.fn(async () => ({ query, release })) };
    const repository = new PostgresOperationsRepository(pool as never);
    await expect(repository.outboxState()).rejects.toThrow('statement timeout');
    expect(query).toHaveBeenNthCalledWith(1, 'begin');
    expect(query).toHaveBeenNthCalledWith(2, "set local statement_timeout = '250ms'");
    expect(query).toHaveBeenNthCalledWith(3, OUTBOX_STATE_SQL);
    expect(query).toHaveBeenCalledWith('rollback');
    expect(release).toHaveBeenCalledOnce();
  });

  it('evicts the client when rollback itself fails while preserving the original error', async () => {
    const original = new Error('statement timeout'); const rollback = new Error('rollback failed');
    const query = vi.fn(async (sql: string) => { if (sql === OUTBOX_STATE_SQL) throw original; if (sql === 'rollback') throw rollback; return { rows: [], rowCount: 0 }; });
    const release = vi.fn(); const repository = new PostgresOperationsRepository({ connect: vi.fn(async () => ({ query, release })) } as never);
    await expect(repository.outboxState()).rejects.toBe(original);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(rollback);
  });
});
