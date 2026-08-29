import type { Pool, PoolClient } from 'pg';

/** Fixed, privacy-safe JSON log vocabulary. Do not add free-form fields. */
export type TelemetryProcess = 'api' | 'worker' | 'load-fixture';
type Outcome = 'ok' | 'error';
type StatusClass = '2xx' | '3xx' | '4xx' | '5xx';

export type TelemetryRecord =
  | { event: 'request'; process: 'api'; method: string; route: string; status_class: StatusClass; count: number; duration_ms: number }
  | { event: 'query'; process: TelemetryProcess; operation: 'pool_query'; outcome: Outcome; count: number; duration_ms: number }
  | { event: 'pool'; process: TelemetryProcess; total: number; idle: number; waiting: number }
  | { event: 'sync'; process: 'api' | 'worker'; outcome: Outcome; count: number; duration_ms: number }
  | { event: 'outbox'; process: 'worker'; due_after: number; oldest_due_age_seconds: number; claimed: number; completed: number; failed: number; count: number }
  | { event: 'load'; process: 'load-fixture'; operation: 'sync' | 'chat'; count: number; p50_ms: number; p95_ms: number; p99_ms: number };

type TelemetrySink = (record: TelemetryRecord) => void;
let sink: TelemetrySink = (record) => console.log(JSON.stringify(record));
let pending = new Map<string, TelemetryRecord>();

function aggregate(record: Extract<TelemetryRecord, { event: 'request' | 'query' | 'sync' }>): void {
  const key = record.event === 'request' ? `${record.event}:${record.method}:${record.route}:${record.status_class}` : `${record.event}:${record.process}:${record.outcome}`;
  const prior = pending.get(key) as typeof record | undefined;
  if (!prior) { pending.set(key, { ...record }); return; }
  prior.count += record.count;
  prior.duration_ms += record.duration_ms;
}

/** Emits bounded aggregates each minute; workers also flush after a tick. */
export function flushTelemetry(): void { for (const record of pending.values()) sink(record); pending = new Map(); }
const flushTimer = setInterval(flushTelemetry, 60_000);
flushTimer.unref();

export function emitTelemetry(record: Exclude<TelemetryRecord, { event: 'request' | 'query' | 'sync' }>): void { sink(record); }
export function recordRequest(method: string, route: string, status: number, startedAt: number): void {
  const statusClass: StatusClass = status >= 500 ? '5xx' : status >= 400 ? '4xx' : status >= 300 ? '3xx' : '2xx';
  aggregate({ event: 'request', process: 'api', method, route, status_class: statusClass, duration_ms: durationMs(startedAt), count: 1 });
}
export function recordSync(process: 'api' | 'worker', outcome: Outcome, startedAt: number): void { aggregate({ event: 'sync', process, outcome, duration_ms: durationMs(startedAt), count: 1 }); }
/** Test-only hook; production code always uses the JSON console sink. */
export function setTelemetrySinkForTests(next: TelemetrySink): () => void { const previous = sink; sink = next; return () => { sink = previous; pending = new Map(); }; }
export function durationMs(startedAt: number): number { return Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100); }
export function recordPool(process: TelemetryProcess, pool: Pool): void { emitTelemetry({ event: 'pool', process, total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }); }

export function instrumentPool(process: TelemetryProcess, pool: Pool): Pool {
  const clients = new WeakSet<PoolClient>();
  const instrumentQuery = <T extends { query: Pool['query'] }>(target: T): T => {
    const query = target.query.bind(target) as (...args: unknown[]) => unknown;
    target.query = ((...args: unknown[]) => {
      const startedAt = performance.now();
      const finish = (outcome: Outcome) => aggregate({ event: 'query', process, operation: 'pool_query', outcome, duration_ms: durationMs(startedAt), count: 1 });
      try { const result = query(...args); if (result && typeof (result as Promise<unknown>).then === 'function') return (result as Promise<unknown>).then((value) => { finish('ok'); return value; }, (error) => { finish('error'); throw error; }); finish('ok'); return result; }
      catch (error) { finish('error'); throw error; }
    }) as Pool['query'];
    return target;
  };
  instrumentQuery(pool);
  const connect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;
  pool.connect = ((...args: unknown[]) => {
    const result = connect(...args);
    if (result && typeof (result as Promise<PoolClient>).then === 'function') return (result as Promise<PoolClient>).then((client) => { if (!clients.has(client)) { clients.add(client); instrumentQuery(client); } return client; });
    return result;
  }) as Pool['connect'];
  return pool;
}
