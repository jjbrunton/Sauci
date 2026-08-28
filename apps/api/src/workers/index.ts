import { MediaJanitor } from '../domains/media/janitor.js';
import { PostgresMediaRepository } from '../domains/media/repository.js';
import { FilesystemMediaStorage } from '../domains/media/storage.js';
import { DiscordProvider, ExpoPushProvider, MessageClassifier, OperationsRunner, PostgresOperationsRepository } from '../domains/operations/index.js';
import { loadWorkerConfig } from './config.js';

const config=loadWorkerConfig(); const operations=new PostgresOperationsRepository(config.databaseUrl); const mediaRepository=new PostgresMediaRepository(config.databaseUrl);
const mediaStorage=new FilesystemMediaStorage(config.mediaRoot,config.mediaSigningSecret,config.mediaPublicBaseUrl);
const runner=new OperationsRunner(operations,new ExpoPushProvider(),new DiscordProvider(config.discordWebhookUrl),new MessageClassifier(operations,
  {enabled:config.classifierEnabled,apiKey:config.openRouterApiKey,model:config.classifierModel,prompt:config.classifierPrompt,adminPrivateKeyJwk:config.adminPrivateKeyJwk,mediaRoot:config.mediaRoot}),
  new MediaJanitor(mediaRepository,mediaStorage));
let stopped=false;let timer:NodeJS.Timeout|undefined;
async function tick(){if(stopped)return;try{const result=await runner.runOnce(new Date(),config.batchSize);if(result.claimed||result.failed)console.log('Operations worker tick',result);}catch(cause){console.error('Operations worker tick failed',cause);}finally{if(!stopped){timer=setTimeout(()=>void tick(),config.pollIntervalMs);timer.unref();}}}
async function shutdown(signal:string){if(stopped)return;stopped=true;if(timer)clearTimeout(timer);console.log(`Received ${signal}; stopping operations worker`);await Promise.all([operations.close(),mediaRepository.close()]);}
process.on('SIGINT',()=>void shutdown('SIGINT').then(()=>process.exit(0))); process.on('SIGTERM',()=>void shutdown('SIGTERM').then(()=>process.exit(0)));
console.log('Sauci operations worker started');void tick();

