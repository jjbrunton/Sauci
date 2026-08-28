import type { ApiErrorResponse } from '@sauci/shared';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AuthIdentity } from '../../auth.js';
import { ProfileSettingsError, type ProfileSettingsRepository } from './repository.js';
import { notificationPreferenceKeys } from './types.js';

type ProfileSettingsApp = Hono<{ Variables: { identity: AuthIdentity } }>;

const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).nullable().optional(),
  usage_reason: z.enum(['improve_communication', 'spice_up_intimacy', 'deeper_connection', 'have_fun', 'strengthen_relationship']).nullable().optional(),
  max_intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  show_explicit_content: z.boolean().optional(),
  hide_nsfw: z.boolean().optional(),
  onboarding_completed: z.boolean().optional(),
  onboarding_version: z.number().int().min(0).optional(),
  public_key_jwk: z.record(z.unknown()).nullable().optional(),
  push_token: z.string().trim().min(1).max(512).nullable().optional(),
}).strict().refine((body) => Object.keys(body).length > 0, 'At least one profile field is required');

const preferenceSchema = z.object({
  key: z.enum(notificationPreferenceKeys),
  value: z.boolean(),
}).strict();

const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature_request', 'general', 'question']),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10_000),
  question_id: z.string().uuid().nullable().optional(),
  device_info: z.record(z.unknown()).optional(),
  screenshot_media_id: z.string().uuid().nullable().optional(),
}).strict();

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function parseJson(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  return c.req.json().catch(() => null);
}

async function handleProfileError<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (cause) {
    if (cause instanceof ProfileSettingsError) return null;
    throw cause;
  }
}

export function registerProfileSettingsRoutes(app: ProfileSettingsApp, repository: ProfileSettingsRepository): void {
  app.patch('/v1/me/profile', async (c) => {
    const parsed = profileUpdateSchema.safeParse(await parseJson(c));
    if (!parsed.success) return c.json(error('invalid_profile_update', 'Profile update contains invalid or unsupported fields'), 400);
    const result = await handleProfileError(() => repository.updateProfile(c.get('identity').id, parsed.data));
    return result === null
      ? c.json(error('profile_not_found', 'Profile not found. Please complete signup first.'), 404)
      : c.json({ updated: true });
  });

  app.post('/v1/me/activity', async (c) => {
    const result = await handleProfileError(() => repository.updateLastActive(c.get('identity').id));
    return result === null
      ? c.json(error('profile_not_found', 'Profile not found. Please complete signup first.'), 404)
      : c.body(null, 204);
  });

  app.get('/v1/me/notification-preferences', async (c) =>
    c.json(await repository.getNotificationPreferences(c.get('identity').id)));

  app.patch('/v1/me/notification-preferences', async (c) => {
    const parsed = preferenceSchema.safeParse(await parseJson(c));
    if (!parsed.success) return c.json(error('invalid_preference', 'A supported preference key and boolean value are required'), 400);
    return c.json(await repository.updateNotificationPreference(
      c.get('identity').id,
      parsed.data.key,
      parsed.data.value,
    ));
  });

  app.post('/v1/feedback', async (c) => {
    const parsed = feedbackSchema.safeParse(await parseJson(c));
    if (!parsed.success) return c.json(error('invalid_feedback', 'Valid feedback fields are required'), 400);
    return c.json(await repository.submitFeedback(c.get('identity').id, parsed.data), 201);
  });
}
