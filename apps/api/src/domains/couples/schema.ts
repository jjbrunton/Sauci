import { text, timestamp, uuid, pgTable } from 'drizzle-orm/pg-core';

/**
 * Domain-owned schema fragment. The root API schema can re-export this table
 * when the couples vertical is registered with the application.
 */
export const couples = pgTable('couples', {
  id: uuid('id').primaryKey(),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CoupleRow = typeof couples.$inferSelect;
