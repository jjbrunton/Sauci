import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { profiles } from '../../db/schema.js';
import { couples } from '../couples/schema.js';

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublic: boolean('is_public').notNull().default(true),
  contentStatus: text('content_status').notNull().default('unreviewed'),
  contentReviewReason: text('content_review_reason'),
  contentReviewedAt: timestamp('content_reviewed_at', { withTimezone: true }),
  contentReviewedBy: uuid('content_reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const questionPacks = pgTable('question_packs', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  isPremium: boolean('is_premium').notNull().default(false),
  isPublic: boolean('is_public').notNull().default(true),
  isExplicit: boolean('is_explicit').notNull().default(false),
  minIntensity: integer('min_intensity'),
  maxIntensity: integer('max_intensity'),
  avgIntensity: numeric('avg_intensity', { precision: 3, scale: 2, mode: 'number' }),
  sortOrder: integer('sort_order').notNull().default(0),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  contentStatus: text('content_status').notNull().default('unreviewed'),
  contentReviewReason: text('content_review_reason'),
  contentReviewedAt: timestamp('content_reviewed_at', { withTimezone: true }),
  contentReviewedBy: uuid('content_reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  scheduledReleaseAt: timestamp('scheduled_release_at', { withTimezone: true }),
  releaseNotified: boolean('release_notified').notNull().default(false),
}, (table) => [index('question_packs_category_id_idx').on(table.categoryId)]);

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey(),
  packId: uuid('pack_id').notNull().references(() => questionPacks.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  partnerText: text('partner_text'),
  intensity: integer('intensity').notNull().default(1),
  allowedCoupleGenders: text('allowed_couple_genders').array(),
  targetUserGenders: text('target_user_genders').array(),
  requiredProps: text('required_props').array(),
  questionType: text('question_type').notNull().default('swipe'),
  config: jsonb('config').notNull().default({}),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  inverseOf: uuid('inverse_of'),
  contentStatus: text('content_status').notNull().default('unreviewed'),
  contentReviewReason: text('content_review_reason'),
  contentReviewedAt: timestamp('content_reviewed_at', { withTimezone: true }),
  contentReviewedBy: uuid('content_reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('questions_pack_id_idx').on(table.packId)]);

export const responses = pgTable('responses', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  // Nullable: an unpaired user's answer is banked as a sealed answer with no couple
  // yet. It is claimed into the couple at pairing time; see the answers repository.
  coupleId: uuid('couple_id').references(() => couples.id, { onDelete: 'cascade' }),
  answer: text('answer').notNull(),
  responseData: jsonb('response_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('responses_user_question_idx').on(table.userId, table.questionId),
  index('responses_user_id_idx').on(table.userId),
]);

export const couplePacks = pgTable('couple_packs', {
  coupleId: uuid('couple_id').notNull().references(() => couples.id, { onDelete: 'cascade' }),
  packId: uuid('pack_id').notNull().references(() => questionPacks.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.coupleId, table.packId] })]);

export const contentReviews = pgTable('content_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  previousStatus: text('previous_status').notNull(),
  newStatus: text('new_status').notNull(),
  reason: text('reason').notNull(),
  changedBy: uuid('changed_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('content_reviews_entity_idx').on(table.entityType, table.entityId, table.createdAt),
  index('content_reviews_created_at_idx').on(table.createdAt),
]);
