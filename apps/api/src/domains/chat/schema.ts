import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { profiles } from '../../db/schema.js';

// `matches` is owned by the matches vertical (0003). Keeping the FK in SQL
// avoids importing another domain's schema fragment here.
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  content: text('content'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  mediaPath: text('media_path'),
  mediaType: text('media_type'),
  mediaExpiresAt: timestamp('media_expires_at', { withTimezone: true }),
  mediaExpired: boolean('media_expired').notNull().default(false),
  mediaViewedAt: timestamp('media_viewed_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  encryptedContent: text('encrypted_content'),
  encryptionIv: text('encryption_iv'),
  keysMetadata: jsonb('keys_metadata'),
  moderationStatus: text('moderation_status'),
  flagReason: text('flag_reason'),
  category: text('category'),
}, (table) => [index('messages_match_created_idx').on(table.matchId, table.createdAt)]);

export const messageDeletions = pgTable('message_deletions', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.messageId, table.userId] })]);

export const messageReports = pgTable('message_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  reporterId: uuid('reporter_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('message_reports_message_reporter_idx').on(table.messageId, table.reporterId)]);

export const chatTypingStates = pgTable('chat_typing_states', {
  matchId: uuid('match_id').notNull(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.matchId, table.userId] }), index('chat_typing_expires_idx').on(table.expiresAt)]);

