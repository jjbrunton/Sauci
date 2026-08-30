import { boolean, check, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { couples } from '../couples/schema.js';

/**
 * Couples quiz catalogue. `promptSelf` and `promptGuess` are two phrasings of the
 * same question so a session can ask each partner about themselves and about the
 * other without a second row.
 */
export const quizQuestions = pgTable('quiz_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  promptSelf: text('prompt_self').notNull().unique(),
  promptGuess: text('prompt_guess').notNull(),
  options: text('options').array().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('quiz_questions_options_length_check', sql`array_length(${table.options}, 1) between 2 and 4`),
]);

export const quizSessions = pgTable('quiz_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id').notNull().references(() => couples.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'),
  questionIds: uuid('question_ids').array().notNull(),
  scorePercent: integer('score_percent'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('quiz_sessions_couple_id_created_at_idx').on(table.coupleId, table.createdAt),
  uniqueIndex('quiz_sessions_one_active_per_couple_idx').on(table.coupleId).where(sql`${table.status} = 'active'`),
  check('quiz_sessions_status_check', sql`${table.status} in ('active','completed')`),
]);

export const quizAnswers = pgTable('quiz_answers', {
  sessionId: uuid('session_id').notNull().references(() => quizSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  questionId: uuid('question_id').notNull(),
  selfIndex: integer('self_index').notNull(),
  guessIndex: integer('guess_index').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.userId, table.questionId] }),
  check('quiz_answers_self_index_check', sql`${table.selfIndex} >= 0`),
  check('quiz_answers_guess_index_check', sql`${table.guessIndex} >= 0`),
]);

export type QuizQuestionRow = typeof quizQuestions.$inferSelect;
export type QuizSessionRow = typeof quizSessions.$inferSelect;
export type QuizAnswerRow = typeof quizAnswers.$inferSelect;
