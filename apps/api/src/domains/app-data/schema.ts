import { bigint, index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from '../../db/schema.js';
import { couples } from '../couples/schema.js';

export const liveDrawSessions = pgTable('live_draw_sessions', {
  coupleId: uuid('couple_id').primaryKey().references(() => couples.id, { onDelete: 'cascade' }),
  strokes: jsonb('strokes').notNull().default([]),
  revision: bigint('revision', { mode: 'number' }).notNull().default(1),
  updatedBy: uuid('updated_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('live_draw_sessions_updated_at_idx').on(table.updatedAt)]);
