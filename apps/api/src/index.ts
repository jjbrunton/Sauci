import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createAuthVerifier } from './auth.js';
import { loadConfig } from './config.js';
import { createDatabasePool } from './db/pool.js';
import { recordPool } from './telemetry.js';
import { PostgresRepository } from './db/repository.js';
import { PostgresAppDataRepository } from './domains/app-data/repository.js';
import { AdminRequestAuth } from './domains/admin/auth.js';
import { SupabaseAdminAuthDirectory } from './domains/admin/auth-directory.js';
import { PostgresAdminRepository } from './domains/admin/repository.js';
import { BillingService, PostgresBillingRepository } from './domains/billing/index.js';
import {
  AccountOperationsService,
  ExpoPartnerNotifier,
  HttpRevenueCatClient,
  PostgresAccountOperationsRepository,
  SupabaseAuthAdminClient,
} from './domains/account-operations/index.js';
import { PostgresAnswersRepository } from './domains/answers/repository.js';
import { PostgresChatRepository } from './domains/chat/repository.js';
import { PostgresDaresRepository } from './domains/dares/repository.js';
import { PostgresQuizRepository } from './domains/quiz/repository.js';
import { PostgresCoupleRepository } from './domains/couples/repository.js';
import { CoupleService } from './domains/couples/service.js';
import { PostgresPacksRepository } from './domains/packs/repository.js';
import { PostgresProfileSettingsRepository } from './domains/profile-settings/repository.js';
import { FilesystemMediaStorage, PostgresMediaRepository } from './domains/media/index.js';

const config = loadConfig();
const authVerifier = createAuthVerifier(config);
// One deliberately bounded pool for the whole process. Repositories used to open
// a default-sized pool each, so a single API instance could hold twelve times the
// connections a self-hosted PostgreSQL was sized for.
const pool = createDatabasePool(config.databaseUrl, config.databasePool, 'api');
const repository = new PostgresRepository(pool);
const coupleRepository = new PostgresCoupleRepository(pool);
const packsRepository = new PostgresPacksRepository(pool);
const answersRepository = new PostgresAnswersRepository(pool);
const chatRepository = new PostgresChatRepository(pool);
const daresRepository = new PostgresDaresRepository(pool);
const quizRepository = new PostgresQuizRepository(pool);
const profileSettingsRepository = new PostgresProfileSettingsRepository(pool);
const accountOperationsRepository = new PostgresAccountOperationsRepository(pool);
const accountOperationsService = new AccountOperationsService(
  accountOperationsRepository,
  new SupabaseAuthAdminClient(config.authIssuer, config.supabaseAuthServiceRoleKey),
  new HttpRevenueCatClient(config.revenueCatApiKey, config.revenueCatEntitlementId),
  new ExpoPartnerNotifier(),
);
const mediaRepository = new PostgresMediaRepository(pool);
const mediaStorage = new FilesystemMediaStorage(
  config.mediaRoot,
  config.mediaSigningSecret,
  config.mediaPublicBaseUrl,
);
const appDataRepository = new PostgresAppDataRepository(pool);
const billingRepository = new PostgresBillingRepository(pool);
const billingService = new BillingService(billingRepository, config.revenueCatWebhookSecret);
const adminRepository = new PostgresAdminRepository(pool, {
  adminPrivateKeyJwk: config.adminPrivateKeyJwk,
  mediaRoot: config.mediaRoot,
  authDirectory: new SupabaseAdminAuthDirectory(config.authIssuer, config.supabaseAuthServiceRoleKey),
});
const app = createApp({
  auth: authVerifier,
  repository,
  corsAllowedOrigins: config.corsAllowedOrigins,
  coupleService: new CoupleService(coupleRepository),
  packsRepository,
  answersRepository,
  chatRepository,
  daresRepository,
  quizRepository,
  profileSettingsRepository,
  accountOperationsService,
  mediaRepository,
  mediaStorage,
  appDataRepository,
  billingService,
  adminRepository,
  adminAuth: new AdminRequestAuth(
    authVerifier,
    config.adminApiServiceToken,
    config.adminApiServiceUserId,
  ),
});

// Sample pool state on the telemetry cadence rather than once per request.
const poolTelemetryTimer = setInterval(() => recordPool('api', pool), 60_000);
poolTelemetryTimer.unref();

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Sauci API listening on http://127.0.0.1:${info.port}`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(poolTelemetryTimer);
  console.log(`Received ${signal}; shutting down`);
  const forcedExit = setTimeout(() => {
    console.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  server.close(async () => {
    try {
      // Repositories share the process pool and no longer own a connection each,
      // so ending the pool once is the whole of the database shutdown.
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('Failed to close database connections', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
