import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  pushToken: text('push_token'),
  isPremium: boolean('is_premium').notNull().default(false),
  coupleId: uuid('couple_id'),
  gender: text('gender').$type<'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null>(),
  showExplicitContent: boolean('show_explicit_content').notNull().default(true),
  maxIntensity: integer('max_intensity').notNull().default(5),
  publicKeyJwk: jsonb('public_key_jwk').$type<Record<string, unknown> | null>(),
  hideNsfw: boolean('hide_nsfw').notNull().default(false),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  onboardingVersion: integer('onboarding_version').notNull().default(0),
  authSyncedAt: timestamp('auth_synced_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('profiles_couple_id_idx').on(table.coupleId)]);

export const featureInterests = pgTable('feature_interests', {
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.feature] }),
  index('feature_interests_feature_idx').on(table.feature),
]);

export type ProfileRow = typeof profiles.$inferSelect;
