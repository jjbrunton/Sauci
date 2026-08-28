import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresProfileSettingsRepository } from '../src/domains/profile-settings/repository.js';

const databaseUrl = process.env.DATABASE_URL;
const localDatabase = databaseUrl ? ['127.0.0.1', 'localhost', '::1'].includes(new URL(databaseUrl).hostname) : false;
if (databaseUrl && !localDatabase) throw new Error('Profile settings integration tests only permit a localhost DATABASE_URL');

describe.skipIf(!databaseUrl || !localDatabase)('PostgresProfileSettingsRepository', () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const schema = `profile_settings_test_${randomUUID().replaceAll('-', '')}`;
  const userId = '11111111-1111-4111-8111-111111111111';
  let pool: Pool;
  let repository: PostgresProfileSettingsRepository;

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
    pool = new Pool({ connectionString: isolatedUrl.toString() });
    repository = new PostgresProfileSettingsRepository(isolatedUrl.toString());
    for (const migrationName of [
      '0000_identity_and_feature_interests.sql',
      '0001_couples.sql',
      '0002_packs_catalog_progress.sql',
      '0003_answers_matches.sql',
      '0004_chat.sql',
      '0005_profile_settings.sql',
      '0006_media_storage.sql',
    ]) {
      const migration = await readFile(new URL(`../drizzle/${migrationName}`, import.meta.url), 'utf8');
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) await pool.query(statement);
      }
    }
    await pool.query('insert into profiles (id, name) values ($1, $2)', [userId, 'Alice']);
  });

  afterAll(async () => {
    await repository.close();
    await pool.end();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  it('persists profile, activity, public key, push token, and onboarding state', async () => {
    await repository.updateProfile(userId, {
      name: 'Alicia', gender: 'female', usage_reason: 'deeper_connection', hide_nsfw: true,
      max_intensity: 2, show_explicit_content: false, onboarding_completed: true,
      onboarding_version: 1, public_key_jwk: { kty: 'RSA' }, push_token: 'ExponentPushToken[test]',
    });
    await repository.updateLastActive(userId);
    const row = (await pool.query('select * from profiles where id = $1', [userId])).rows[0];
    expect(row).toMatchObject({
      name: 'Alicia', gender: 'female', usage_reason: 'deeper_connection', hide_nsfw: true,
      max_intensity: 2, show_explicit_content: false, onboarding_completed: true,
      onboarding_version: 1, public_key_jwk: { kty: 'RSA' }, push_token: 'ExponentPushToken[test]',
    });
    expect(row.last_active_at).toBeInstanceOf(Date);
  });

  it('creates default preferences, updates one key, and leaves the others enabled', async () => {
    const initial = await repository.getNotificationPreferences(userId);
    expect(initial.messages_enabled).toBe(true);
    const updated = await repository.updateNotificationPreference(userId, 'messages_enabled', false);
    expect(updated.messages_enabled).toBe(false);
    expect(updated.matches_enabled).toBe(true);
  });

  it('stores text feedback owned by the authenticated user', async () => {
    const submitted = await repository.submitFeedback(userId, {
      type: 'general', title: 'Hello', description: 'Useful feedback', device_info: { os: 'ios' },
    });
    const row = (await pool.query('select * from feedback where id = $1', [submitted.id])).rows[0];
    expect(row).toMatchObject({ user_id: userId, type: 'general', title: 'Hello' });
    const mediaColumn = await pool.query(
      `select column_name from information_schema.columns
        where table_schema = current_schema() and table_name = 'feedback' and column_name = 'screenshot_url'`,
    );
    expect(mediaColumn.rowCount).toBe(0);
  });
});
