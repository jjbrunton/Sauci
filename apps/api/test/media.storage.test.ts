import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FilesystemMediaStorage } from '../src/domains/media/storage.js';

const roots: string[] = [];
async function storage() {
  const root = await mkdtemp(join(tmpdir(), 'sauci-media-test-')); roots.push(root);
  return new FilesystemMediaStorage(root, 'a-secure-test-secret-with-at-least-32-characters', 'https://api.test');
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe('FilesystemMediaStorage', () => {
  it('stores magic-byte validated content under a server-generated path', async () => {
    const subject=await storage(); const png=Uint8Array.from([137,80,78,71,13,10,26,10,1]);
    const saved=await subject.put('avatar','image/png',png);
    expect(saved.key).toMatch(/^avatar\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.png$/);
    expect(await subject.read(saved.key)).toEqual(Buffer.from(png));
  });
  it('rejects mismatched content and oversized declared uploads', async () => {
    const subject=await storage();
    await expect(subject.put('avatar','image/png',Uint8Array.from([1,2,3,4]))).rejects.toThrow('media_signature_mismatch');
    expect(() => subject.validate('avatar','image/png',11*1024*1024)).toThrow('upload_too_large');
    expect(() => subject.validate('avatar','text/html',10)).toThrow('unsupported_media_type');
  });
  it('issues expiring tamper-resistant capability URLs', async () => {
    const subject=await storage(); const id='b99173de-07ee-43d2-970e-27c8075f4433';
    const signed=subject.signedUrl(id,60); const url=new URL(signed.url);
    const expires=Number(url.searchParams.get('expires')); const signature=url.searchParams.get('signature')!;
    expect(subject.verify(id,expires,signature)).toBe(true);
    expect(subject.verify('c99173de-07ee-43d2-970e-27c8075f4433',expires,signature)).toBe(false);
  });
});
