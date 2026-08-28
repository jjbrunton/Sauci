import type { MediaRepository } from './repository.js';
import type { FilesystemMediaStorage } from './storage.js';

export class MediaJanitor {
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly repository: MediaRepository, private readonly storage: FilesystemMediaStorage) {}
  async runOnce(limit=100): Promise<number> {
    const keys=await this.repository.queuedDeletions(limit); let removed=0;
    for(const key of keys) {
      try { await this.storage.remove(key); await this.repository.acknowledgeDeletion(key); removed++; }
      catch(cause) { console.error('Media cleanup failed', { storageKey:key, cause }); }
    }
    return removed;
  }
  start(intervalMs=60_000) {
    if(this.timer) return; void this.runOnce();
    this.timer=setInterval(()=>void this.runOnce(),intervalMs); this.timer.unref();
  }
  stop() { if(this.timer) clearInterval(this.timer); this.timer=null; }
}
