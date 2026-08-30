import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { MediaKind } from './types.js';

const allowed: Record<MediaKind, ReadonlySet<string>> = {
  avatar: new Set(['image/jpeg', 'image/png', 'image/webp']),
  response: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/x-caf']),
  chat: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']),
  feedback: new Set(['image/jpeg', 'image/png', 'image/webp']),
  dare_proof: new Set(['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/x-caf']),
};
const limits: Record<MediaKind, number> = { avatar: 10*1024*1024, response: 25*1024*1024, chat: 50*1024*1024, feedback: 10*1024*1024, dare_proof: 25*1024*1024 };
const extensions: Record<string, string> = { 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','video/mp4':'.mp4','video/quicktime':'.mov','video/webm':'.webm','audio/mp4':'.m4a','audio/m4a':'.m4a','audio/x-m4a':'.m4a','audio/mpeg':'.mp3','audio/wav':'.wav','audio/webm':'.webm','audio/aac':'.aac','audio/x-caf':'.caf' };

export class FilesystemMediaStorage {
  constructor(readonly root: string, private readonly signingSecret: string, private readonly publicBaseUrl: string) {}
  validate(kind: MediaKind, mime: string, length: number | null) {
    if (!allowed[kind].has(mime)) throw new Error('unsupported_media_type');
    if (length !== null && (length < 1 || length > limits[kind])) throw new Error('upload_too_large');
  }
  private path(key: string) {
    if (key.includes('..') || key.includes('\\') || key.startsWith('/')) throw new Error('invalid_storage_key');
    const root = resolve(this.root); const candidate = resolve(root, key);
    if (!candidate.startsWith(`${root}${sep}`)) throw new Error('invalid_storage_key');
    return candidate;
  }
  async put(kind: MediaKind, mime: string, bytes: Uint8Array): Promise<{ key: string; size: number }> {
    this.validate(kind, mime, bytes.byteLength);
    if (!matchesMagic(mime, bytes)) throw new Error('media_signature_mismatch');
    const date = new Date().toISOString().slice(0,10); const id = randomUUID();
    const key = `${kind}/${date}/${id}${extensions[mime]}`; const target = this.path(key); const temp = this.path(`tmp/${id}.upload`);
    await mkdir(resolve(this.root, 'tmp'), { recursive: true }); await mkdir(resolve(this.root, kind, date), { recursive: true });
    await writeFile(temp, bytes, { flag: 'wx' }); await rename(temp, target);
    return { key, size: bytes.byteLength };
  }
  async remove(key: string) {
    try { await unlink(this.path(key)); }
    catch (cause) { if (!(typeof cause==='object'&&cause!==null&&'code' in cause&&cause.code==='ENOENT')) throw cause; }
  }
  async read(key: string) { return readFile(this.path(key)); }
  signedUrl(id: string, ttlSeconds=3600) {
    const expires = Math.floor(Date.now()/1000)+ttlSeconds; const signature = this.sign(id, expires);
    return { url: `${this.publicBaseUrl}/media/${id}/content?expires=${expires}&signature=${signature}`, expires_at: new Date(expires*1000).toISOString() };
  }
  verify(id: string, expires: number, signature: string) {
    if (!Number.isSafeInteger(expires) || expires < Math.floor(Date.now()/1000)) return false;
    const expected = Buffer.from(this.sign(id, expires)); const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  private sign(id: string, expires: number) { return createHmac('sha256', this.signingSecret).update(`${id}.${expires}`).digest('base64url'); }
}

function matchesMagic(mime: string, bytes: Uint8Array) {
  const b=Buffer.from(bytes); if (mime==='image/jpeg') return b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if (mime==='image/png') return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime==='image/gif') return b.subarray(0,4).toString()==='GIF8';
  if (mime==='image/webp'||mime==='video/webm'||mime==='audio/webm') return mime==='image/webp' ? b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP' : b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if (mime.startsWith('video/')||mime.includes('mp4')||mime.includes('m4a')) return b.subarray(4,8).toString()==='ftyp';
  if (mime==='audio/mpeg') return (b[0]===0x49&&b[1]===0x44&&b[2]===0x33)||(b[0]===0xff&&(b[1]&0xe0)===0xe0);
  if (mime==='audio/wav') return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WAVE';
  if (mime==='audio/aac') return b[0]===0xff&&(b[1]&0xf6)===0xf0;
  if (mime==='audio/x-caf') return b.subarray(0,4).toString()==='caff';
  return false;
}
