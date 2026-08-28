import { describe, expect, it, vi } from 'vitest';
import { MediaJanitor } from '../src/domains/media/janitor.js';
import type { MediaRepository } from '../src/domains/media/repository.js';
import type { FilesystemMediaStorage } from '../src/domains/media/storage.js';

describe('MediaJanitor',()=>{
  it('acknowledges only blobs that were removed or already absent',async()=>{
    const repository={queuedDeletions:vi.fn(async()=>['old/a.jpg','old/b.jpg']),acknowledgeDeletion:vi.fn()} as unknown as MediaRepository;
    const storage={remove:vi.fn(async(key:string)=>{if(key.endsWith('b.jpg')) throw new Error('disk unavailable');})} as unknown as FilesystemMediaStorage;
    expect(await new MediaJanitor(repository,storage).runOnce()).toBe(1);
    expect(repository.acknowledgeDeletion).toHaveBeenCalledWith('old/a.jpg');
    expect(repository.acknowledgeDeletion).not.toHaveBeenCalledWith('old/b.jpg');
  });
});
