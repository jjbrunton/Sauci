import { MediaJanitor } from '../domains/media/janitor.js';
import { PostgresMediaRepository } from '../domains/media/repository.js';
import { FilesystemMediaStorage } from '../domains/media/storage.js';
import { DiscordProvider, ExpoPushProvider, MessageClassifier, OperationsRunner, PostgresOperationsRepository } from '../domains/operations/index.js';
import { loadWorkerConfig } from './config.js';
import { createDatabasePool } from '../db/pool.js';
import { flushTelemetry, recordPool, recordSync } from '../telemetry.js';
import { WorkerLifecycle } from './lifecycle.js';

const config=loadWorkerConfig(); const pool=createDatabasePool(config.databaseUrl,config.databasePool,'worker'); const operations=new PostgresOperationsRepository(pool); const mediaRepository=new PostgresMediaRepository(pool);
const mediaStorage=new FilesystemMediaStorage(config.mediaRoot,config.mediaSigningSecret,config.mediaPublicBaseUrl);
const runner=new OperationsRunner(operations,new ExpoPushProvider(),new DiscordProvider(config.discordWebhookUrl),new MessageClassifier(operations,
  {enabled:config.classifierEnabled,apiKey:config.openRouterApiKey,model:config.classifierModel,prompt:config.classifierPrompt,adminPrivateKeyJwk:config.adminPrivateKeyJwk,mediaRoot:config.mediaRoot}),
  new MediaJanitor(mediaRepository,mediaStorage));
const lifecycle=new WorkerLifecycle({pollIntervalMs:config.pollIntervalMs,closePool:()=>pool.end(),onTickFailure:cause=>console.error('Operations worker tick failed',cause),runTick:async()=>{const startedAt=performance.now();try{const result=await runner.runOnce(new Date(),config.batchSize);recordSync('worker','ok',startedAt);recordPool('worker',pool);flushTelemetry();if(result.claimed||result.failed)console.log('Operations worker tick',result);}catch(cause){recordSync('worker','error',startedAt);recordPool('worker',pool);flushTelemetry();throw cause;}}});
function shutdown(signal:string){console.log(`Received ${signal}; stopping operations worker`);return lifecycle.shutdown();}
process.on('SIGINT',()=>void shutdown('SIGINT').then(code=>process.exit(code))); process.on('SIGTERM',()=>void shutdown('SIGTERM').then(code=>process.exit(code)));
console.log('Sauci operations worker started');lifecycle.start();
