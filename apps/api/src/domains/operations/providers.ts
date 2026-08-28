import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { OperationsRepository } from './repository.js';
import type { OperationItem } from './types.js';

type Fetch = typeof globalThis.fetch;

export class ExpoPushProvider {
  constructor(private readonly request:Fetch=globalThis.fetch) {}
  async send(item:OperationItem):Promise<void> {
    if (!item.pushToken) return;
    const title=typeof item.payload.title==='string'?item.payload.title:null;
    const body=typeof item.payload.body==='string'?item.payload.body:null;
    if (!title||!body) throw new Error('invalid_expo_payload');
    const data=typeof item.payload.data==='object'&&item.payload.data?item.payload.data:{};
    const response=await this.request('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
      body:JSON.stringify({to:item.pushToken,title,body,sound:'default',data:{...data,notification_id:item.id}}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok) throw new Error(`expo_http_${response.status}`);
    const result=await response.json().catch(()=>null) as {data?:{status?:string;message?:string}}|null;
    if(result?.data?.status==='error') throw new Error(`expo_ticket_${result.data.message??'error'}`);
  }
}

export class DiscordProvider {
  constructor(private readonly webhookUrl:string|undefined,private readonly request:Fetch=globalThis.fetch) {}
  async send(item:OperationItem):Promise<void> {
    if(!this.webhookUrl) return;
    const event=typeof item.payload.event==='string'?item.payload.event:'operation';
    const response=await this.request(this.webhookUrl,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({username:'Sauci Notifications',content:event.replaceAll('_',' '),embeds:[{title:event.replaceAll('_',' '),description:formatPayload(item.payload),timestamp:new Date().toISOString()}]}),
      signal:AbortSignal.timeout(10_000)});
    if(!response.ok) throw new Error(`discord_http_${response.status}`);
  }
}
function formatPayload(payload:Record<string,unknown>):string {
  return Object.entries(payload).filter(([key])=>key!=='event').map(([key,value])=>`${key}: ${String(value??'')}`).join('\n').slice(0,1800);
}

const whitelist=new Set(['ok','okay','yes','no','maybe','thanks','thank you','lol','lmao','good night','goodnight','good morning','love you']);
const keywords=['suicide','kill myself','self harm','kill you','hurt you','rape','stab','shoot'];

export class MessageClassifier {
  constructor(private readonly repository:OperationsRepository,private readonly options:{enabled:boolean;apiKey?:string;model:string;prompt:string;adminPrivateKeyJwk?:string;mediaRoot:string},private readonly request:Fetch=globalThis.fetch) {}
  async classify(item:OperationItem):Promise<void> {
    const saved=await this.repository.classifierConfig();
    if(!(saved?.enabled ?? this.options.enabled)) return;
    const messageId=typeof item.payload.message_id==='string'?item.payload.message_id:null;
    if(!messageId) throw new Error('missing_message_id');
    const message=await this.repository.message(messageId); if(!message) return;
    let text=message.content??''; let aesKey:CryptoKey|null=null;
    const getKey=async()=>{
      if(aesKey)return aesKey;
      const wrapped=message.keysMetadata?.admin_wrapped_key;
      if(!wrapped||!this.options.adminPrivateKeyJwk) throw new Error('admin_decryption_key_unavailable');
      const privateKey=await crypto.subtle.importKey('jwk',JSON.parse(this.options.adminPrivateKeyJwk) as JsonWebKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['decrypt']);
      const raw=await crypto.subtle.decrypt({name:'RSA-OAEP'},privateKey,Buffer.from(wrapped,'base64'));
      aesKey=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']); return aesKey;
    };
    if(message.version===2&&message.encryptedContent) {
      if(!message.encryptionIv)throw new Error('missing_encryption_iv'); const key=await getKey();
      const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(message.encryptionIv,'base64')},key,Buffer.from(message.encryptedContent,'base64'));
      text=new TextDecoder().decode(plain);
    }
    let media:string|null=null;
    if(message.mediaStorageKey&&message.mediaMimeType?.startsWith('image/')) {
      const root=resolve(this.options.mediaRoot);const path=resolve(root,message.mediaStorageKey);
      if(!path.startsWith(`${root}${sep}`))throw new Error('invalid_media_path'); let bytes=await readFile(path);
      if(message.version===2){if(!message.encryptionIv)throw new Error('missing_encryption_iv');const key=await getKey();bytes=Buffer.from(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(message.encryptionIv,'base64')},key,bytes));}
      media=`data:${message.mediaMimeType};base64,${bytes.toString('base64')}`;
    }
    const normalized=text.trim().toLowerCase();
    const customWhitelist=(saved?.heuristicWhitelist??'').split(/[\n,]/).map(value=>value.trim().toLowerCase()).filter(Boolean);
    const customKeywords=(saved?.heuristicKeywordTriggers??'').split(/[\n,]/).map(value=>value.trim().toLowerCase()).filter(Boolean);
    const allowed=new Set([...(saved?.heuristicUseDefaultWhitelist===false?[]:whitelist),...customWhitelist]);
    const triggers=[...(saved?.heuristicUseDefaultKeywords===false?[]:keywords),...customKeywords];
    const minLength=saved?.heuristicMinTextLength??12;
    const whitelistMax=saved?.heuristicWhitelistMaxLength??30;
    const noAlphaNumeric=!/[a-z0-9]/i.test(normalized);
    const heuristicSafe=!media&&(
      (allowed.has(normalized)&&normalized.length<=whitelistMax)||
      (saved?.heuristicSkipIfNoAlnum!==false&&noAlphaNumeric)||
      (!triggers.some(k=>normalized.includes(k))&&normalized.length<minLength)
    )||(Boolean(media)&&!normalized&&saved?.heuristicSkipMediaWithoutText===true);
    if((saved?.heuristicsEnabled??true)&&heuristicSafe) {
      await this.repository.classify(messageId,'safe',null,'Neutral'); return;
    }
    const apiKey=saved?.apiKey??this.options.apiKey;
    if(!apiKey)throw new Error('openrouter_api_key_unavailable');
    const content:Array<Record<string,unknown>>=[];if(text.trim())content.push({type:'text',text});if(media)content.push({type:'image_url',image_url:{url:media}});
    if(!content.length){await this.repository.classify(messageId,'safe','No content','Neutral');return;}
    const response=await this.request('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','http-referer':'https://sauci.app','x-title':'Sauci'},
      body:JSON.stringify({model:saved?.model??this.options.model,temperature:saved?.temperature??undefined,messages:[{role:'system',content:saved?.prompt??this.options.prompt},{role:'user',content}],response_format:{type:'json_object'}}),signal:AbortSignal.timeout(30_000)});
    if(!response.ok)throw new Error(`openrouter_http_${response.status}`);
    const result=await response.json() as {choices?:Array<{message?:{content?:string}}>};const raw=result.choices?.[0]?.message?.content;if(!raw)throw new Error('empty_classifier_response');
    let parsed:{status?:string;reason?:string;category?:string};try{parsed=JSON.parse(raw) as typeof parsed;}catch{parsed={status:raw.toLowerCase().includes('flagged')?'flagged':'safe',reason:'Classifier returned invalid JSON'};}
    await this.repository.classify(messageId,parsed.status==='flagged'?'flagged':'safe',parsed.reason??null,parsed.category??'Neutral');
  }
}
