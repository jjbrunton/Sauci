import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AuthIdentity } from '../src/auth.js';
import type { AnswersRepository } from '../src/domains/answers/repository.js';
import { registerAnswerRoutes } from '../src/domains/answers/routes.js';
import { AnswersError, calculateMatchType } from '../src/domains/answers/types.js';

const identity: AuthIdentity={id:'11111111-1111-4111-8111-111111111111',email:null,name:null,avatarUrl:null};
const questionId='22222222-2222-4222-8222-222222222222';
function repo():AnswersRepository{return {
  recommended:vi.fn(async()=>[]),pending:vi.fn(async()=>[]),answerGap:vi.fn(async()=>({unanswered_by_partner:0,threshold:10,is_blocked:false})),
  dailyLimit:vi.fn(async()=>({responses_today:0,limit_value:0,remaining:0,reset_at:null,is_blocked:false})),
  submit:vi.fn(async()=>({response:{} as never,match:null})),update:vi.fn(async()=>({success:true})),responses:vi.fn(async()=>({responses:[],totalCount:0})),matches:vi.fn(async()=>({matches:[],totalCount:0})),markSeen:vi.fn(async()=>undefined),archive:vi.fn(async()=>undefined),streak:vi.fn(async()=>null),close:vi.fn(async()=>undefined)};}
function app(r:AnswersRepository){const app=new Hono<{Variables:{identity:AuthIdentity}}>();app.use('/v1/*',async(c,n)=>{c.set('identity',identity);await n();});registerAnswerRoutes(app,r);return app;}

describe('answer routes',()=>{
  it('takes ownership only from the bearer identity',async()=>{const r=repo();const a=app(r);await a.request('/v1/responses',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question_id:questionId,answer:'yes',user_id:'attacker'})});expect(r.submit).not.toHaveBeenCalled();const ok=await a.request('/v1/responses',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question_id:questionId,answer:'yes'})});expect(ok.status).toBe(200);expect(r.submit).toHaveBeenCalledWith(identity.id,{questionId,answer:'yes',responseData:undefined});});
  it('maps confirmation and domain failures',async()=>{const r=repo();vi.mocked(r.update).mockResolvedValueOnce({success:false,requires_confirmation:true,message_count:2});const a=app(r);expect(await (await a.request(`/v1/responses/${questionId}`,{method:'PATCH',headers:{'content-type':'application/json'},body:'{"new_answer":"no"}'})).json()).toMatchObject({requires_confirmation:true,message_count:2});vi.mocked(r.submit).mockRejectedValueOnce(new AnswersError('daily_limit',429,'Daily response limit reached'));expect((await a.request('/v1/responses',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question_id:questionId,answer:'yes'})})).status).toBe(429);});
  it('scopes match mutations to identity',async()=>{const r=repo();const a=app(r);await a.request('/v1/matches/seen',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({ids:[questionId]})});expect(r.markSeen).toHaveBeenCalledWith(identity.id,[questionId]);await a.request(`/v1/matches/${questionId}/archive`,{method:'PUT',headers:{'content-type':'application/json'},body:'{"archived":true}'});expect(r.archive).toHaveBeenCalledWith(identity.id,questionId,true);});
});

describe('match semantics',()=>{
  const q=(question_type:'swipe'|'text_answer'|'audio'|'photo'|'who_likely')=>({id:questionId,question_type});
  it('preserves swipe combinations',()=>{expect(calculateMatchType(q('swipe'),'yes','yes')).toBe('yes_yes');expect(calculateMatchType(q('swipe'),'yes','maybe')).toBe('yes_maybe');expect(calculateMatchType(q('swipe'),'maybe','maybe')).toBe('maybe_maybe');expect(calculateMatchType(q('swipe'),'no','yes')).toBeNull();});
  it('matches non-swipe positive answers and always matches who-likely',()=>{expect(calculateMatchType(q('text_answer'),'yes','maybe')).toBe('both_answered');expect(calculateMatchType(q('photo'),'no','yes')).toBeNull();expect(calculateMatchType(q('who_likely'),'no','no')).toBe('both_answered');});
});
