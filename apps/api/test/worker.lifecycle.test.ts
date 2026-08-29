import { describe, expect, it, vi } from 'vitest';
import { WorkerLifecycle } from '../src/workers/lifecycle.js';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((next) => { resolve = next; }); return { promise, resolve }; }

describe('WorkerLifecycle', () => {
  it('reuses one shutdown promise, awaits the active tick, and closes once', async () => {
    const tick = deferred<void>(); const closePool = vi.fn(async () => undefined);
    const lifecycle = new WorkerLifecycle({ pollIntervalMs: 60_000, runTick: () => tick.promise, closePool, onTickFailure: vi.fn(), graceMs: 50 });
    lifecycle.start(); const first = lifecycle.shutdown(); const second = lifecycle.shutdown();
    expect(second).toBe(first); expect(closePool).not.toHaveBeenCalled();
    tick.resolve(); await expect(first).resolves.toBe(0); expect(closePool).toHaveBeenCalledTimes(1);
  });

  it('returns nonzero when an active tick exceeds the one total deadline', async () => {
    vi.useFakeTimers();
    const lifecycle = new WorkerLifecycle({ pollIntervalMs: 60_000, runTick: () => new Promise<void>(() => undefined), closePool: vi.fn(async () => undefined), onTickFailure: vi.fn(), graceMs: 10 });
    lifecycle.start(); const shutdown = lifecycle.shutdown(); await vi.advanceTimersByTimeAsync(10);
    await expect(shutdown).resolves.toBe(1); vi.useRealTimers();
  });

  it('returns nonzero and closes once when pool shutdown rejects or hangs', async () => {
    const rejected = new WorkerLifecycle({ pollIntervalMs: 60_000, runTick: async () => undefined, closePool: vi.fn(async () => { throw new Error('close failed'); }), onTickFailure: vi.fn(), graceMs: 50 });
    rejected.start(); await expect(rejected.shutdown()).resolves.toBe(1);
    vi.useFakeTimers(); const closePool = vi.fn(() => new Promise<void>(() => undefined));
    const hung = new WorkerLifecycle({ pollIntervalMs: 60_000, runTick: async () => undefined, closePool, onTickFailure: vi.fn(), graceMs: 10 });
    hung.start(); const shutdown = hung.shutdown(); await vi.advanceTimersByTimeAsync(10);
    await expect(shutdown).resolves.toBe(1); expect(closePool).toHaveBeenCalledTimes(1); vi.useRealTimers();
  });
});
