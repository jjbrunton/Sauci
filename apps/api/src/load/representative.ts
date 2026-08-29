import { createDatabasePool } from '../db/pool.js';
import { PostgresOperationsRepository } from '../domains/operations/repository.js';
import { emitTelemetry, recordPool } from '../telemetry.js';
import { requireLocalApi, requireLoopback } from './loopback.js';

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return Math.round((sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0) * 100) / 100;
}
async function read(url: URL, headers: HeadersInit): Promise<number> {
  const startedAt = performance.now();
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`representative API read failed with ${response.status}`);
  return performance.now() - startedAt;
}

async function main(): Promise<void> {
  const expectedPort = Number(process.env.SAUCI_LOAD_API_PORT ?? '3003');
  const apiUrl = requireLocalApi(process.env.SAUCI_LOAD_API_URL ?? `http://127.0.0.1:${expectedPort}`, expectedPort);
  const databaseUrl = process.env.DATABASE_URL;
  const authorization = process.env.SAUCI_LOAD_AUTHORIZATION;
  const matchId = process.env.SAUCI_LOAD_MATCH_ID;
  const expectedUserId = process.env.SAUCI_LOAD_USER_ID;
  if (!databaseUrl || !authorization || !matchId || !expectedUserId) throw new Error('DATABASE_URL, SAUCI_LOAD_AUTHORIZATION, SAUCI_LOAD_MATCH_ID, and SAUCI_LOAD_USER_ID are required');
  requireLoopback(databaseUrl, 'DATABASE_URL');
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(matchId) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(expectedUserId)) throw new Error('SAUCI_LOAD_MATCH_ID and SAUCI_LOAD_USER_ID must be UUIDs');

  const health = await fetch(new URL('/health/live', apiUrl));
  if (!health.ok || (await health.json() as { status?: string }).status !== 'ok') throw new Error('local Sauci API health preflight failed');
  const headers = { authorization };
  const me = await fetch(new URL('/v1/me', apiUrl), { headers });
  const profile = me.ok ? await me.json() as { profile?: { id?: string } } : undefined;
  if (profile?.profile?.id !== expectedUserId) throw new Error('local fixture identity preflight failed');

  const sync = await Promise.all(Array.from({ length: 5 }, () => read(new URL('/v1/me/sync', apiUrl), headers)));
  const chat = await Promise.all(Array.from({ length: 5 }, () => read(new URL(`/v1/matches/${matchId}/messages?typing=true`, apiUrl), headers)));
  for (const [operation, samples] of [['sync', sync], ['chat', chat]] as const) emitTelemetry({ event: 'load', process: 'load-fixture', operation, count: samples.length, p50_ms: percentile(samples, .5), p95_ms: percentile(samples, .95), p99_ms: percentile(samples, .99) });

  const pool = createDatabasePool(databaseUrl, { max: 1 }, 'load-fixture');
  try { await new PostgresOperationsRepository(pool).outboxState(); recordPool('load-fixture', pool); }
  finally { await pool.end(); }
}
void main();
