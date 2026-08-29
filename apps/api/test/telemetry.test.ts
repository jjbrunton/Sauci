import { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabasePool } from '../src/db/pool.js';
import { flushTelemetry, recordPool, setTelemetrySinkForTests, type TelemetryRecord } from '../src/telemetry.js';

const url = 'postgres://user:pass@127.0.0.1:5432/sauci_test';

describe('privacy-safe telemetry', () => {
  let restore: () => void = () => {};
  afterEach(() => { restore(); vi.restoreAllMocks(); });

  it('records query duration without SQL or bound values', async () => {
    const records: TelemetryRecord[] = [];
    restore = setTelemetrySinkForTests((record) => records.push(record));
    vi.spyOn(Pool.prototype, 'query').mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    const pool = createDatabasePool(url, {}, 'api');
    await pool.query('select secret from profiles where id=$1', ['private-user-id']);
    flushTelemetry();
    const serialized = JSON.stringify(records);
    expect(records).toContainEqual(expect.objectContaining({ event: 'query', process: 'api', operation: 'pool_query', outcome: 'ok', count: 1 }));
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('private-user-id');
    await pool.end();
  });

  it('emits only numeric pool state', async () => {
    const records: TelemetryRecord[] = [];
    restore = setTelemetrySinkForTests((record) => records.push(record));
    const pool = new Pool({ connectionString: url });
    recordPool('worker', pool);
    expect(records).toEqual([{ event: 'pool', process: 'worker', total: 0, idle: 0, waiting: 0 }]);
    await pool.end();
  });

  it('also instruments transaction-client queries', async () => {
    const records: TelemetryRecord[] = [];
    restore = setTelemetrySinkForTests((record) => records.push(record));
    const client = { query: vi.fn(async () => ({ rows: [], rowCount: 0 })), release: vi.fn() };
    vi.spyOn(Pool.prototype, 'connect').mockResolvedValueOnce(client as never);
    const pool = createDatabasePool(url, {}, 'worker');
    const borrowed = await pool.connect();
    await borrowed.query('select message_body from messages where id=$1', ['private-message-id']);
    flushTelemetry();
    const serialized = JSON.stringify(records);
    expect(records).toContainEqual(expect.objectContaining({ event: 'query', process: 'worker', outcome: 'ok', count: 1 }));
    expect(serialized).not.toContain('message_body');
    expect(serialized).not.toContain('private-message-id');
    await pool.end();
  });
});
