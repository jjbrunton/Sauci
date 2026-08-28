import { describe, expect, it, vi } from 'vitest';
import type { OperationsRepository } from '../src/domains/operations/repository.js';
import { ExpoPushProvider, MessageClassifier } from '../src/domains/operations/providers.js';
import { OperationsRunner } from '../src/domains/operations/runner.js';
import type { OperationItem } from '../src/domains/operations/types.js';
import { loadWorkerConfig } from '../src/workers/config.js';

const summary={releasedPacks:0,streakMilestones:0,digests:0,packChanges:0,weeklySummaries:0,unpairedReminders:0,catchupReminders:0};
function repository(items:OperationItem[]):OperationsRepository {
  return {produce:vi.fn(async()=>summary),claim:vi.fn(async()=>items),complete:vi.fn(async()=>undefined),fail:vi.fn(async()=>undefined),
    message:vi.fn(async()=>null),classifierConfig:vi.fn(async()=>null),classify:vi.fn(async()=>undefined),close:vi.fn(async()=>undefined)};
}

describe('OperationsRunner',()=>{
  it('completes successful work and schedules bounded retry for provider failures',async()=>{
    const items:OperationItem[]=[
      {id:'1',kind:'expo',dedupeKey:'one',recipientId:'u',pushToken:'token',payload:{title:'T',body:'B'},attempts:1},
      {id:'2',kind:'discord',dedupeKey:'two',recipientId:null,pushToken:null,payload:{event:'new_user'},attempts:1},
    ];
    const repo=repository(items);const expo={send:vi.fn(async()=>undefined)};const discord={send:vi.fn(async()=>{throw new Error('offline')})};
    const classifier={classify:vi.fn(async()=>undefined)};const media={runOnce:vi.fn(async()=>2)};
    const runner=new OperationsRunner(repo,expo as never,discord as never,classifier as never,media as never);
    await expect(runner.runOnce(new Date(),2)).resolves.toMatchObject({claimed:2,completed:1,failed:1});
    expect(repo.complete).toHaveBeenCalledWith('1');expect(repo.fail).toHaveBeenCalledWith('2','offline');expect(media.runOnce).toHaveBeenCalledWith(100);
  });

  it('treats Expo ticket-level errors as failures and sends a stable notification id',async()=>{
    const request=vi.fn<typeof fetch>(async()=>Response.json({data:{status:'error',message:'DeviceNotRegistered'}}));
    const provider=new ExpoPushProvider(request);const item:OperationItem={id:'notification-id',kind:'expo',dedupeKey:'k',recipientId:'u',pushToken:'ExponentPushToken[x]',payload:{title:'Title',body:'Body',data:{type:'message'}},attempts:1};
    await expect(provider.send(item)).rejects.toThrow('expo_ticket_DeviceNotRegistered');
    expect(JSON.parse(String(vi.mocked(request).mock.calls[0]?.[1]?.body))).toMatchObject({data:{type:'message',notification_id:'notification-id'}});
  });

  it('classifies plaintext through a mocked provider and persists only normalized outcomes',async()=>{
    const repo=repository([]);vi.mocked(repo.message).mockResolvedValueOnce({id:'m1',version:1,content:'I may kill myself',encryptedContent:null,encryptionIv:null,keysMetadata:null,mediaPath:null,mediaType:null,mediaStorageKey:null,mediaMimeType:null});
    vi.mocked(repo.classifierConfig).mockResolvedValueOnce({enabled:true,apiKey:'saved-key',model:'saved-model',temperature:0.2,prompt:'saved prompt',heuristicsEnabled:false,
      heuristicMinTextLength:12,heuristicWhitelistMaxLength:30,heuristicSkipIfNoAlnum:true,heuristicSkipMediaWithoutText:false,
      heuristicUseDefaultWhitelist:true,heuristicUseDefaultKeywords:true,heuristicWhitelist:null,heuristicKeywordTriggers:null});
    const request=vi.fn<typeof fetch>(async()=>Response.json({choices:[{message:{content:JSON.stringify({status:'flagged',reason:'self harm',category:'Safety'})}}]}));
    const classifier=new MessageClassifier(repo,{enabled:true,apiKey:'test-key',model:'test-model',prompt:'test prompt',mediaRoot:'/tmp'},request);
    await classifier.classify({id:'job',kind:'classify',dedupeKey:'classify:m1',recipientId:null,pushToken:null,payload:{message_id:'m1'},attempts:1});
    expect(request).toHaveBeenCalledWith('https://openrouter.ai/api/v1/chat/completions',expect.objectContaining({method:'POST'}));
    const requestBody=JSON.parse(String(vi.mocked(request).mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({model:'saved-model',temperature:0.2});
    expect(requestBody.messages[0]).toMatchObject({role:'system',content:'saved prompt'});
    expect(repo.classify).toHaveBeenCalledWith('m1','flagged','self harm','Safety');
  });
});

describe('worker configuration',()=>{
  it('fails closed in production when classification has no provider key',()=>{
    expect(()=>loadWorkerConfig({
      NODE_ENV:'production',
      DATABASE_URL:'postgresql://sauci:test@localhost:5432/sauci',
      CLASSIFIER_ENABLED:'true',
    })).toThrow('OPENROUTER_API_KEY is required when classification is enabled');
  });

  it('accepts an explicitly disabled classifier and treats empty optional secrets as absent',()=>{
    expect(loadWorkerConfig({
      NODE_ENV:'production',
      DATABASE_URL:'postgresql://sauci:test@localhost:5432/sauci',
      CLASSIFIER_ENABLED:'false',
      OPENROUTER_API_KEY:'',
      ADMIN_PRIVATE_KEY_JWK:'',
      DISCORD_WEBHOOK_URL:'',
    })).toMatchObject({
      classifierEnabled:false,
      openRouterApiKey:undefined,
      adminPrivateKeyJwk:undefined,
      discordWebhookUrl:undefined,
    });
  });
});
