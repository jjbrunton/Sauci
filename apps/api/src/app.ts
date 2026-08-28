import type { ApiErrorResponse, MeResponse } from '@sauci/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { bearerToken, type AuthIdentity, type AuthVerifier } from './auth.js';
import type { ApiRepository } from './db/repository.js';
import type { AppDataRepository } from './domains/app-data/repository.js';
import { registerAppDataRoutes } from './domains/app-data/routes.js';
import type { BillingService } from './domains/billing/service.js';
import { registerBillingRoutes } from './domains/billing/routes.js';
import type { AccountOperationsService } from './domains/account-operations/service.js';
import { registerAccountOperationRoutes } from './domains/account-operations/routes.js';
import type { AnswersRepository } from './domains/answers/repository.js';
import { registerAnswerRoutes } from './domains/answers/routes.js';
import type { ChatRepository } from './domains/chat/repository.js';
import { registerChatRoutes } from './domains/chat/routes.js';
import { registerCoupleRoutes } from './domains/couples/routes.js';
import type { CoupleService } from './domains/couples/service.js';
import type { PacksRepository } from './domains/packs/repository.js';
import { registerPackRoutes } from './domains/packs/routes.js';
import type { ProfileSettingsRepository } from './domains/profile-settings/repository.js';
import { registerProfileSettingsRoutes } from './domains/profile-settings/routes.js';
import type { MediaRepository } from './domains/media/repository.js';
import { registerMediaRoutes } from './domains/media/routes.js';
import type { FilesystemMediaStorage } from './domains/media/storage.js';
import type { AdminRequestAuth } from './domains/admin/auth.js';
import type { AdminRepository } from './domains/admin/repository.js';
import { registerAdminRoutes } from './domains/admin/routes.js';

type Variables = { identity: AuthIdentity };

export interface AppDependencies {
  auth: AuthVerifier;
  repository: ApiRepository;
  coupleService?: CoupleService;
  packsRepository?: PacksRepository;
  answersRepository?: AnswersRepository;
  chatRepository?: ChatRepository;
  profileSettingsRepository?: ProfileSettingsRepository;
  accountOperationsService?: AccountOperationsService;
  mediaRepository?: MediaRepository;
  mediaStorage?: FilesystemMediaStorage;
  appDataRepository?: AppDataRepository;
  billingService?: BillingService;
  adminRepository?: AdminRepository;
  adminAuth?: AdminRequestAuth;
}

const featureSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

export function createApp(deps: AppDependencies): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.get('/health/live', (c) => c.json({ status: 'ok' }));
  app.get('/health/ready', async (c) => {
    try {
      await deps.repository.ready();
      return c.json({ status: 'ready' });
    } catch {
      return c.json(error('not_ready', 'Database is unavailable'), 503);
    }
  });

  app.use('/v1/*', async (c, next) => {
    // Admin routes accept either a hosted user token or the separately scoped
    // MCP service credential and therefore own their authentication middleware.
    if (c.req.path.startsWith('/v1/admin/')) {
      await next();
      return;
    }
    const token = bearerToken(c.req.header('authorization'));
    if (!token) return c.json(error('unauthorized', 'A bearer token is required'), 401);
    try {
      c.set('identity', await deps.auth.verify(token));
    } catch {
      return c.json(error('unauthorized', 'The bearer token is invalid'), 401);
    }
    await next();
  });

  app.get('/v1/me', async (c) => {
    const profile = await deps.repository.upsertProfile(c.get('identity'));
    return c.json<MeResponse>({ profile });
  });

  app.get('/v1/me/feature-interests/:feature', async (c) => {
    const parsed = featureSchema.safeParse(c.req.param('feature'));
    if (!parsed.success) return c.json(error('invalid_feature', 'Feature must be a lowercase slug'), 400);
    return c.json(await deps.repository.getFeatureInterest(c.get('identity').id, parsed.data));
  });

  app.put('/v1/me/feature-interests/:feature', async (c) => {
    const parsed = featureSchema.safeParse(c.req.param('feature'));
    if (!parsed.success) return c.json(error('invalid_feature', 'Feature must be a lowercase slug'), 400);
    await deps.repository.upsertProfile(c.get('identity'));
    return c.json(await deps.repository.putFeatureInterest(c.get('identity').id, parsed.data));
  });

  app.delete('/v1/me/feature-interests/:feature', async (c) => {
    const parsed = featureSchema.safeParse(c.req.param('feature'));
    if (!parsed.success) return c.json(error('invalid_feature', 'Feature must be a lowercase slug'), 400);
    return c.json(await deps.repository.deleteFeatureInterest(c.get('identity').id, parsed.data));
  });

  if (deps.coupleService) registerCoupleRoutes(app, deps.coupleService);
  if (deps.packsRepository) registerPackRoutes(app, deps.packsRepository);
  if (deps.answersRepository) registerAnswerRoutes(app, deps.answersRepository);
  if (deps.chatRepository) registerChatRoutes(app, deps.chatRepository);
  if (deps.profileSettingsRepository) registerProfileSettingsRoutes(app, deps.profileSettingsRepository);
  if (deps.accountOperationsService) registerAccountOperationRoutes(app, deps.accountOperationsService);
  if (deps.mediaRepository && deps.mediaStorage) registerMediaRoutes(app, deps.mediaRepository, deps.mediaStorage);
  if (deps.appDataRepository) registerAppDataRoutes(app, deps.appDataRepository);
  if (deps.billingService) registerBillingRoutes(app, deps.billingService);
  if (deps.adminRepository && deps.adminAuth) {
    registerAdminRoutes(app, deps.adminRepository, deps.adminAuth, deps.mediaStorage);
  }

  app.notFound((c) => c.json(error('not_found', 'Route not found'), 404));
  app.onError((cause, c) => {
    console.error(cause);
    return c.json(error('internal_error', 'An unexpected error occurred'), 500);
  });

  return app;
}
