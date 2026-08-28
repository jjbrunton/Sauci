import { boolean, check, index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from '../../db/schema.js';

// `couples`, `categories`, and the review-status enum are owned by other verticals.
// Their FKs stay in SQL so this fragment does not import across domain boundaries.
export const darePacks = pgTable('dare_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  isPremium: boolean('is_premium').notNull().default(false),
  isPublic: boolean('is_public').notNull().default(true),
  isExplicit: boolean('is_explicit').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  categoryId: uuid('category_id'),
  minIntensity: integer('min_intensity'),
  maxIntensity: integer('max_intensity'),
  avgIntensity: numeric('avg_intensity', { precision: 3, scale: 2 }),
  contentStatus: text('content_status').notNull().default('unreviewed'),
  contentReviewReason: text('content_review_reason'),
  contentReviewedAt: timestamp('content_reviewed_at', { withTimezone: true }),
  contentReviewedBy: uuid('content_reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('dare_packs_content_status_idx').on(table.contentStatus, table.isPublic, table.sortOrder)]);

export const dares = pgTable('dares', {
  id: uuid('id').primaryKey().defaultRandom(),
  packId: uuid('pack_id').notNull().references(() => darePacks.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  intensity: integer('intensity').notNull().default(1),
  suggestedDurationHours: integer('suggested_duration_hours'),
  contentStatus: text('content_status').notNull().default('unreviewed'),
  contentReviewReason: text('content_review_reason'),
  contentReviewedAt: timestamp('content_reviewed_at', { withTimezone: true }),
  contentReviewedBy: uuid('content_reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('dares_pack_idx').on(table.packId),
  index('dares_content_status_idx').on(table.packId, table.contentStatus, table.intensity),
]);

// `dare_text_snapshot` deliberately duplicates the catalogue text: a couple's
// history must survive the dare being edited, archived, or deleted.
export const sentDares = pgTable('sent_dares', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id').notNull(),
  dareId: uuid('dare_id').references(() => dares.id, { onDelete: 'set null' }),
  customDareText: text('custom_dare_text'),
  customDareIntensity: integer('custom_dare_intensity'),
  dareTextSnapshot: text('dare_text_snapshot').notNull(),
  dareIntensitySnapshot: integer('dare_intensity_snapshot').notNull(),
  senderId: uuid('sender_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  senderNotes: text('sender_notes'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sent_dares_couple_idx').on(table.coupleId),
  index('sent_dares_recipient_status_idx').on(table.recipientId, table.status),
  index('sent_dares_sender_sent_at_idx').on(table.senderId, table.sentAt),
  check('sent_dares_participants_distinct_check', sql`${table.senderId} <> ${table.recipientId}`),
  check('sent_dares_status_check', sql`${table.status} in ('pending','active','submitted','completed','expired','declined','cancelled')`),
]);

export const dareMessages = pgTable('dare_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sentDareId: uuid('sent_dare_id').notNull().references(() => sentDares.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('dare_messages_sent_dare_created_idx').on(table.sentDareId, table.createdAt)]);
