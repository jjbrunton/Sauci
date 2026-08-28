import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createAuthVerifier } from './auth.js';
import { loadConfig } from './config.js';
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
import { PostgresCoupleRepository } from './domains/couples/repository.js';
import { CoupleService } from './domains/couples/service.js';
import { PostgresPacksRepository } from './domains/packs/repository.js';
import { PostgresProfileSettingsRepository } from './domains/profile-settings/repository.js';
import { FilesystemMediaStorage, PostgresMediaRepository } from './domains/media/index.js';

const config = loadConfig();
const authVerifier = createAuthVerifier(config);
const repository = new PostgresRepository(config.databaseUrl);
const coupleRepository = new PostgresCoupleRepository(config.databaseUrl);
const packsRepository = new PostgresPacksRepository(config.databaseUrl);
const answersRepository = new PostgresAnswersRepository(config.databaseUrl);
const chatRepository = new PostgresChatRepository(config.databaseUrl);
const daresRepository = new PostgresDaresRepository(config.databaseUrl);
const profileSettingsRepository = new PostgresProfileSettingsRepository(config.databaseUrl);
const accountOperationsRepository = new PostgresAccountOperationsRepository(config.databaseUrl);
const accountOperationsService = new AccountOperationsService(
  accountOperationsRepository,
  new SupabaseAuthAdminClient(config.authIssuer, config.supabaseAuthServiceRoleKey),
  new HttpRevenueCatClient(config.revenueCatApiKey, config.revenueCatEntitlementId),
  new ExpoPartnerNotifier(),
);
const mediaRepository = new PostgresMediaRepository(config.databaseUrl);
const mediaStorage = new FilesystemMediaStorage(
  config.mediaRoot,
  config.mediaSigningSecret,
  config.mediaPublicBaseUrl,
);
const appDataRepository = new PostgresAppDataRepository(config.databaseUrl);
const billingRepository = new PostgresBillingRepository(config.databaseUrl);
const billingService = new BillingService(billingRepository, config.revenueCatWebhookSecret);
const adminRepository = new PostgresAdminRepository(config.databaseUrl, {
  adminPrivateKeyJwk: config.adminPrivateKeyJwk,
  mediaRoot: config.mediaRoot,
  authDirectory: new SupabaseAdminAuthDirectory(config.authIssuer, config.supabaseAuthServiceRoleKey),
});
const app = createApp({
  auth: authVerifier,
  repository,
  coupleService: new CoupleService(coupleRepository),
  packsRepository,
  answersRepository,
  chatRepository,
  daresRepository,
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

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Sauci API listening on http://127.0.0.1:${info.port}`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down`);
  const forcedExit = setTimeout(() => {
    console.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  server.close(async () => {
    try {
      await Promise.all([
        repository.close(),
        coupleRepository.close(),
        packsRepository.close(),
        answersRepository.close(),
        chatRepository.close(),
        daresRepository.close(),
        profileSettingsRepository.close(),
        accountOperationsRepository.close(),
        mediaRepository.close(),
        appDataRepository.close(),
        billingRepository.close(),
        adminRepository.close(),
      ]);
      process.exit(0);
    } catch (error) {
      console.error('Failed to close database connections', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
