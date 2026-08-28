import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import type { AnswersRepository } from './repository.js';
import { AnswersError } from './types.js';

type App = Hono<{Variables:{identity:AuthIdentity}}>;
const uuid=z.string().uuid(); const page=z.coerce.number().int().min(0).default(0); const limit=z.coerce.number().int().min(1).max(100).default(20);
const responseData=z.record(z.unknown()).nullable();
const submit=z.object({question_id:uuid,answer:z.enum(['yes','no','maybe']),response_data:responseData.optional()}).strict();
const update=z.object({new_answer:z.enum(['yes','no','maybe']),response_data:responseData.optional(),confirm_delete_match:z.boolean().optional().default(false)}).strict();
const err=(code:string,message:string,details?:Record<string,unknown>):ApiErrorResponse & {details?:Record<string,unknown>}=>({error:{code,message},...(details?{details}:{})});
async function run<T>(op:()=>Promise<T>){try{return {ok:true as const,value:await op()};}catch(e){if(e instanceof AnswersError)return {ok:false as const,status:e.status,body:err(e.code,e.message,e.details)};throw e;}}

export function registerAnswerRoutes(app:App,repo:AnswersRepository):void{
  app.get('/v1/questions/recommended',async c=>{const packId=c.req.query('packId');if(packId&&!uuid.safeParse(packId).success)return c.json(err('invalid_pack_id','Pack ID must be a UUID'),400);const r=await run(()=>repo.recommended(c.get('identity').id,packId));return r.ok?c.json({questions:r.value}):c.json(r.body,r.status);});
  app.get('/v1/questions/pending',async c=>{const direction=c.req.query('direction')==='mine'?'mine':'partner';const start=c.req.query('startQuestionId');if(start&&!uuid.safeParse(start).success)return c.json(err('invalid_question_id','startQuestionId must be a UUID'),400);const r=await run(()=>repo.pending(c.get('identity').id,direction,start));return r.ok?c.json({questions:r.value}):c.json(r.body,r.status);});
  app.get('/v1/me/answer-gap',async c=>c.json(await repo.answerGap(c.get('identity').id)));
  app.get('/v1/me/daily-limit',async c=>c.json(await repo.dailyLimit(c.get('identity').id)));
  app.post('/v1/responses',async c=>{const b=submit.safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json(err('invalid_request','question_id, answer, and valid response_data are required'),400);const r=await run(()=>repo.submit(c.get('identity').id,{questionId:b.data.question_id,answer:b.data.answer,responseData:b.data.response_data}));return r.ok?c.json(r.value):c.json(r.body,r.status);});
  app.patch('/v1/responses/:questionId',async c=>{const id=uuid.safeParse(c.req.param('questionId'));const b=update.safeParse(await c.req.json().catch(()=>null));if(!id.success||!b.success)return c.json(err('invalid_request','A valid question ID and answer are required'),400);const r=await run(()=>repo.update(c.get('identity').id,{questionId:id.data,answer:b.data.new_answer,responseData:b.data.response_data,confirmDeleteMatch:b.data.confirm_delete_match}));return r.ok?c.json(r.value):c.json(r.body,r.status);});
  app.get('/v1/me/responses',async c=>{const p=page.safeParse(c.req.query('page')),l=limit.safeParse(c.req.query('limit'));if(!p.success||!l.success)return c.json(err('invalid_pagination','page and limit are out of range'),400);return c.json(await repo.responses(c.get('identity').id,p.data,l.data));});
  app.get('/v1/matches',async c=>{const p=page.safeParse(c.req.query('page')),l=limit.safeParse(c.req.query('limit'));if(!p.success||!l.success)return c.json(err('invalid_pagination','page and limit are out of range'),400);return c.json(await repo.matches(c.get('identity').id,p.data,l.data,c.req.query('archived')==='true'));});
  app.patch('/v1/matches/seen',async c=>{const b=z.object({ids:z.array(uuid).min(1)}).safeParse(await c.req.json().catch(()=>null));if(!b.success)return c.json(err('invalid_request','ids must contain valid match IDs'),400);await repo.markSeen(c.get('identity').id,b.data.ids);return c.json({success:true});});
  app.put('/v1/matches/:matchId/archive',async c=>{const id=uuid.safeParse(c.req.param('matchId'));const b=z.object({archived:z.boolean()}).safeParse(await c.req.json().catch(()=>null));if(!id.success||!b.success)return c.json(err('invalid_request','A valid match ID and archived flag are required'),400);const r=await run(()=>repo.archive(c.get('identity').id,id.data,b.data.archived));return r.ok?c.json({success:true}):c.json(r.body,r.status);});
  app.get('/v1/me/streak',async c=>{const r=await run(()=>repo.streak(c.get('identity').id));return r.ok?c.json({streak:r.value}):c.json(r.body,r.status);});
}
