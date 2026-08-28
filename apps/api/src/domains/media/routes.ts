import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { MediaError, type MediaRepository } from './repository.js';
import { FilesystemMediaStorage } from './storage.js';
import { mediaKinds } from './types.js';

type App = Hono<{ Variables: { identity: AuthIdentity } }>;
const uuid=z.string().uuid(); const kind=z.enum(mediaKinds);
const err=(code:string,message:string):ApiErrorResponse=>({error:{code,message}});
export function registerMediaRoutes(app: App, repository: MediaRepository, storage: FilesystemMediaStorage) {
  app.use('/v1/media/*', bodyLimit({maxSize:50*1024*1024,onError:c=>c.json(err('upload_too_large','Upload exceeds the size limit'),413)}));
  app.post('/v1/media/:kind', async c => {
    const parsedKind=kind.safeParse(c.req.param('kind')); if(!parsedKind.success) return c.json(err('invalid_media_kind','Unsupported media kind'),400);
    const mime=(c.req.header('content-type')??'').split(';')[0]!.trim().toLowerCase();
    const lengthHeader=c.req.header('content-length'); const length=lengthHeader ? Number(lengthHeader) : null;
    try { storage.validate(parsedKind.data,mime,length); } catch(e) { const code=e instanceof Error?e.message:'invalid_upload'; return c.json(err(code,code==='upload_too_large'?'Upload exceeds the size limit':'Unsupported or invalid media'),code==='upload_too_large'?413:415); }
    const questionId=c.req.query('questionId'); const matchId=c.req.query('matchId');
    if(questionId&&!uuid.safeParse(questionId).success) return c.json(err('invalid_question_id','A valid question ID is required'),400);
    if(matchId&&!uuid.safeParse(matchId).success) return c.json(err('invalid_match_id','A valid match ID is required'),400);
    const bytes=new Uint8Array(await c.req.arrayBuffer());
    let stored: {key:string;size:number};
    try { stored=await storage.put(parsedKind.data,mime,bytes); } catch(e) { const code=e instanceof Error?e.message:'invalid_upload'; return c.json(err(code,code==='upload_too_large'?'Upload exceeds the size limit':'File contents do not match the declared media type'),code==='upload_too_large'?413:415); }
    try {
      const result=await repository.create(c.get('identity').id,parsedKind.data,stored.key,mime,stored.size,{questionId,matchId});
      return c.json({...result, reference:`media:${result.media.id}`},201);
    } catch(e) { await storage.remove(stored.key); if(e instanceof MediaError) return c.json(err(e.code,e.message),e.status); throw e; }
  });
  app.get('/v1/media/:mediaId/url', async c => {
    const parsed=uuid.safeParse(c.req.param('mediaId')); if(!parsed.success) return c.json(err('invalid_media_id','A valid media ID is required'),400);
    try { await repository.accessible(c.get('identity').id,parsed.data); return c.json(storage.signedUrl(parsed.data)); }
    catch(e) { if(e instanceof MediaError) return c.json(err(e.code,e.message),e.status); throw e; }
  });
  app.get('/media/:mediaId/content', async c => {
    const parsed=uuid.safeParse(c.req.param('mediaId')); const expires=Number(c.req.query('expires')); const signature=c.req.query('signature')??'';
    if(!parsed.success||!storage.verify(parsed.data,expires,signature)) return c.json(err('invalid_media_signature','Media URL is invalid or expired'),403);
    const media=await repository.byId(parsed.data); if(!media) return c.json(err('media_not_found','Media not found'),404);
    const bytes=await storage.read(media.storage_key).catch(()=>null); if(!bytes) return c.json(err('media_not_found','Media not found'),404);
    return new Response(bytes,{headers:{'Content-Type':media.mime_type,'Content-Length':String(bytes.byteLength),'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
  });
}
