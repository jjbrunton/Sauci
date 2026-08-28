import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import { MediaError, type MediaRepository } from '../src/domains/media/repository.js';
import { registerMediaRoutes } from '../src/domains/media/routes.js';
import type { FilesystemMediaStorage } from '../src/domains/media/storage.js';

const identity: AuthIdentity={id:'11111111-1111-4111-8111-111111111111',email:'u@example.com',name:null,avatarUrl:null};
function app(repository: Partial<MediaRepository>, storage: Partial<FilesystemMediaStorage>) {
  const api=new Hono<{Variables:{identity:AuthIdentity}}>(); api.use('*',async(c,next)=>{c.set('identity',identity);await next();});
  registerMediaRoutes(api,repository as MediaRepository,storage as FilesystemMediaStorage); return api;
}
describe('media routes',()=>{
  it('requires a supported content type before reading the body',async()=>{
    const api=app({}, {validate:vi.fn(()=>{throw new Error('unsupported_media_type');})});
    const response=await api.request('/v1/media/avatar',{method:'POST',headers:{'content-type':'text/html'},body:'bad'});
    expect(response.status).toBe(415);
  });
  it('does not issue a URL when repository authorization fails',async()=>{
    const signedUrl=vi.fn(); const api=app({accessible:vi.fn(async()=>{throw new MediaError('media_not_found','Media not found',404);})},{signedUrl});
    const response=await api.request('/v1/media/22222222-2222-4222-8222-222222222222/url');
    expect(response.status).toBe(404); expect(signedUrl).not.toHaveBeenCalled();
  });
  it('rejects unsigned content reads',async()=>{
    const api=app({}, {verify:vi.fn(()=>false)});
    const response=await api.request('/media/22222222-2222-4222-8222-222222222222/content?expires=1&signature=no');
    expect(response.status).toBe(403);
  });
});
