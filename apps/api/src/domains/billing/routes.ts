import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import type { BillingService } from './service.js';
import { BillingError } from './types.js';

const redemptionSchema = z.object({
  email: z.string().trim().min(1, 'Please enter your email address').max(320),
  code: z.string().trim().min(1, 'Please enter a redemption code').max(255),
}).strict();

type ApiApp = Hono<{ Variables: { identity: AuthIdentity } }>;

export function registerBillingRoutes(app: ApiApp, service: BillingService): void {
  app.use('/webhooks/revenuecat', bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: 'Webhook payload is too large' }, 413),
  }));
  app.post('/webhooks/revenuecat', async (c) => {
    try {
      service.assertWebhookAuthorization(c.req.header('authorization'));
      const rawBody: unknown = await c.req.json().catch(() => null);
      return c.json(await service.processWebhook(c.req.header('authorization'), rawBody));
    } catch (cause) {
      if (cause instanceof BillingError) return c.json({ error: cause.message }, cause.status);
      throw cause;
    }
  });

  app.use('/public/v1/redemptions', bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) => c.json({ success: false, error: 'Request is too large' }, 413),
  }));
  app.post('/public/v1/redemptions', async (c) => {
    try {
      const rawBody: unknown = await c.req.json().catch(() => null);
      const parsed = redemptionSchema.safeParse(rawBody);
      if (!parsed.success) {
        return c.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, 400);
      }
      const result = await service.redeem(parsed.data.email, parsed.data.code);
      return c.json(result, result.success ? 200 : 400);
    } catch (cause) {
      if (cause instanceof BillingError) return c.json({ success: false, error: cause.message }, cause.status);
      throw cause;
    }
  });
}
