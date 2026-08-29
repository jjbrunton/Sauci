import { z } from 'zod';

const optionalString=z.preprocess(value=>value===''?undefined:value,z.string().min(1).optional());
const optionalUrl=z.preprocess(value=>value===''?undefined:value,z.string().url().optional());
const schema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'), DATABASE_URL:z.string().url(),
  DATABASE_POOL_MAX:z.coerce.number().int().min(1).max(200).default(4), DATABASE_POOL_IDLE_TIMEOUT_MS:z.coerce.number().int().min(0).max(3_600_000).default(30_000), DATABASE_POOL_CONNECTION_TIMEOUT_MS:z.coerce.number().int().min(0).max(60_000).default(10_000),
  WORKER_POLL_INTERVAL_MS:z.coerce.number().int().min(1000).max(300000).default(30000), WORKER_BATCH_SIZE:z.coerce.number().int().min(1).max(100).default(25),
  MEDIA_ROOT:z.string().min(1).default('/data/media'), MEDIA_SIGNING_SECRET:z.string().min(32).default('local-media-signing-secret-change-me-123456'),
  MEDIA_PUBLIC_BASE_URL:z.string().url().default('http://127.0.0.1:3003'), CLASSIFIER_ENABLED:z.enum(['true','false']).default('true').transform(v=>v==='true'),
  OPENROUTER_API_KEY:optionalString, CLASSIFIER_MODEL:z.string().min(1).default('openai/gpt-4o'), ADMIN_PRIVATE_KEY_JWK:optionalString,
  DISCORD_WEBHOOK_URL:optionalUrl,
});
const defaultPrompt='Classify couples-app content. Consensual adult sexual content is allowed. Flag only CSAM or sexual content involving minors, non-consensual sexual content, self-harm, trafficking, terrorism, extreme violence, or illegal weapons or drug trafficking. Return JSON with status safe or flagged and a brief reason.';
export function loadWorkerConfig(env:NodeJS.ProcessEnv=process.env) {
  const value=schema.parse(env);
  if(value.NODE_ENV==='production'&&value.CLASSIFIER_ENABLED&&!value.OPENROUTER_API_KEY)throw new Error('OPENROUTER_API_KEY is required when classification is enabled');
  if(value.ADMIN_PRIVATE_KEY_JWK){try{JSON.parse(value.ADMIN_PRIVATE_KEY_JWK);}catch{throw new Error('ADMIN_PRIVATE_KEY_JWK must be valid JSON');}}
  return {nodeEnv:value.NODE_ENV,databaseUrl:value.DATABASE_URL,databasePool:{max:value.DATABASE_POOL_MAX,idleTimeoutMillis:value.DATABASE_POOL_IDLE_TIMEOUT_MS,connectionTimeoutMillis:value.DATABASE_POOL_CONNECTION_TIMEOUT_MS},pollIntervalMs:value.WORKER_POLL_INTERVAL_MS,batchSize:value.WORKER_BATCH_SIZE,
    mediaRoot:value.MEDIA_ROOT,mediaSigningSecret:value.MEDIA_SIGNING_SECRET,mediaPublicBaseUrl:value.MEDIA_PUBLIC_BASE_URL,classifierEnabled:value.CLASSIFIER_ENABLED,
    openRouterApiKey:value.OPENROUTER_API_KEY,classifierModel:value.CLASSIFIER_MODEL,classifierPrompt:env.CLASSIFIER_PROMPT||defaultPrompt,
    adminPrivateKeyJwk:value.ADMIN_PRIVATE_KEY_JWK,discordWebhookUrl:value.DISCORD_WEBHOOK_URL};
}
