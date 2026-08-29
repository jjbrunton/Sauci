export interface WorkerLifecycleDependencies {
  pollIntervalMs: number;
  runTick: () => Promise<void>;
  closePool: () => Promise<void>;
  onTickFailure: (cause: unknown) => void;
  graceMs?: number;
}

/** Owns worker tick scheduling and makes shutdown single-flight and bounded. */
export class WorkerLifecycle {
  private stopped = false;
  private timer: NodeJS.Timeout | undefined;
  private activeTick: Promise<void> | undefined;
  private shutdownPromise: Promise<number> | undefined;
  private readonly graceMs: number;

  constructor(private readonly deps: WorkerLifecycleDependencies) { this.graceMs = deps.graceMs ?? 25_000; }

  start(): void { if (!this.activeTick && !this.stopped) this.activeTick = this.tick(); }

  shutdown(): Promise<number> {
    if (!this.shutdownPromise) this.shutdownPromise = this.stop();
    return this.shutdownPromise;
  }

  private async tick(): Promise<void> {
    try { await this.deps.runTick(); }
    catch (cause) { this.deps.onTickFailure(cause); }
    finally {
      if (!this.stopped) this.timer = setTimeout(() => { this.activeTick = this.tick(); }, this.deps.pollIntervalMs);
    }
  }

  private async stop(): Promise<number> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    const work = (async () => {
      try { if (this.activeTick) await this.activeTick; await this.deps.closePool(); return 0; }
      catch { return 1; }
    })();
    let timeout: NodeJS.Timeout | undefined;
    const timedOut = new Promise<number>((resolve) => { timeout = setTimeout(() => resolve(1), this.graceMs); });
    const result = await Promise.race([work, timedOut]);
    if (timeout) clearTimeout(timeout);
    return result;
  }
}
