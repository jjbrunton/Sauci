import { randomUUID } from 'node:crypto';
import { Pool, type QueryResultRow } from 'pg';
import { closeResolvedPool, resolvePool, type DatabaseConnection } from '../../db/pool.js';
import type {
  FeedbackSubmission,
  NotificationPreferenceKey,
  NotificationPreferences,
  ProfileUpdate,
} from './types.js';

interface PreferencesRow extends QueryResultRow {
  user_id: string;
  matches_enabled: boolean;
  messages_enabled: boolean;
  partner_activity_enabled: boolean;
  nudges_enabled: boolean;
  pack_changes_enabled: boolean;
  new_packs_enabled: boolean;
  streak_milestones_enabled: boolean;
  streak_reminders_enabled: boolean;
  weekly_summary_enabled: boolean;
  unpaired_reminders_enabled: boolean;
  catchup_reminders_enabled: boolean;
  dares_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export class ProfileSettingsError extends Error {
  constructor(readonly code: 'profile_not_found') {
    super(code === 'profile_not_found' ? 'Profile not found. Please complete signup first.' : code);
  }
}

export interface ProfileSettingsRepository {
  updateProfile(userId: string, update: ProfileUpdate): Promise<void>;
  updateLastActive(userId: string): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
  updateNotificationPreference(userId: string, key: NotificationPreferenceKey, value: boolean): Promise<NotificationPreferences>;
  submitFeedback(userId: string, submission: FeedbackSubmission): Promise<{ id: string; created_at: string }>;
  close(): Promise<void>;
}

const profileColumns: Record<keyof ProfileUpdate, string> = {
  name: 'name',
  gender: 'gender',
  usage_reason: 'usage_reason',
  max_intensity: 'max_intensity',
  show_explicit_content: 'show_explicit_content',
  hide_nsfw: 'hide_nsfw',
  onboarding_completed: 'onboarding_completed',
  onboarding_version: 'onboarding_version',
  public_key_jwk: 'public_key_jwk',
  push_token: 'push_token',
  timezone: 'timezone',
};

function toPreferences(row: PreferencesRow): NotificationPreferences {
  return {
    user_id: row.user_id,
    matches_enabled: row.matches_enabled,
    messages_enabled: row.messages_enabled,
    partner_activity_enabled: row.partner_activity_enabled,
    nudges_enabled: row.nudges_enabled,
    pack_changes_enabled: row.pack_changes_enabled,
    new_packs_enabled: row.new_packs_enabled,
    streak_milestones_enabled: row.streak_milestones_enabled,
    streak_reminders_enabled: row.streak_reminders_enabled,
    weekly_summary_enabled: row.weekly_summary_enabled,
    unpaired_reminders_enabled: row.unpaired_reminders_enabled,
    catchup_reminders_enabled: row.catchup_reminders_enabled,
    dares_enabled: row.dares_enabled,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function assertChanged(rowCount: number | null): void {
  if (rowCount === 0) throw new ProfileSettingsError('profile_not_found');
}

export class PostgresProfileSettingsRepository implements ProfileSettingsRepository {
  private readonly pool: Pool;
  private readonly ownsPool: boolean;

  constructor(connection: DatabaseConnection) {
    const resolved = resolvePool(connection);
    this.pool = resolved.pool;
    this.ownsPool = resolved.owned;
  }

  async updateProfile(userId: string, update: ProfileUpdate): Promise<void> {
    const entries = Object.entries(update) as [keyof ProfileUpdate, ProfileUpdate[keyof ProfileUpdate]][];
    if (entries.length === 0) return;
    const assignments = entries.map(([key], index) => `${profileColumns[key]} = $${index + 2}`);
    const values = entries.map(([, value]) => value);
    const result = await this.pool.query(
      `update profiles set ${assignments.join(', ')}, updated_at = now() where id = $1`,
      [userId, ...values],
    );
    assertChanged(result.rowCount);
  }

  async updateLastActive(userId: string): Promise<void> {
    const result = await this.pool.query(
      'update profiles set last_active_at = now(), updated_at = now() where id = $1',
      [userId],
    );
    assertChanged(result.rowCount);
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const result = await this.pool.query<PreferencesRow>(
      `insert into notification_preferences (user_id) values ($1)
       on conflict (user_id) do update set user_id = excluded.user_id
       returning *`,
      [userId],
    );
    return toPreferences(result.rows[0]!);
  }

  async updateNotificationPreference(
    userId: string,
    key: NotificationPreferenceKey,
    value: boolean,
  ): Promise<NotificationPreferences> {
    await this.getNotificationPreferences(userId);
    const result = await this.pool.query<PreferencesRow>(
      `update notification_preferences set ${key} = $2, updated_at = now() where user_id = $1 returning *`,
      [userId, value],
    );
    return toPreferences(result.rows[0]!);
  }

  async submitFeedback(
    userId: string,
    submission: FeedbackSubmission,
  ): Promise<{ id: string; created_at: string }> {
    const id = randomUUID();
    const result = await this.pool.query<{ id: string; created_at: Date }>(
      `insert into feedback (id, user_id, type, title, description, question_id, device_info, screenshot_media_id)
       select $1, $2, $3, $4, $5, $6, $7, mo.id from (select $8::uuid id) requested
       left join media_objects mo on mo.id=requested.id and mo.owner_id=$2 and mo.kind='feedback' and mo.deleted_at is null
       where requested.id is null or mo.id is not null returning id, created_at`,
      [id, userId, submission.type, submission.title, submission.description,
        submission.question_id ?? null, submission.device_info ?? {}, submission.screenshot_media_id ?? null],
    );
    if (!result.rows[0]) throw new Error('Feedback screenshot is not accessible');
    return { id: result.rows[0]!.id, created_at: result.rows[0]!.created_at.toISOString() };
  }

  async close(): Promise<void> {
    await closeResolvedPool(this.pool, this.ownsPool);
  }
}
