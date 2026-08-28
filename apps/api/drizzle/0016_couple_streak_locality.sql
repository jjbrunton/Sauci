-- Streaks are counted in the couple's shared local day, not the server's calendar day.
-- The zone is the first reported timezone in member id order (the same ordering that
-- decides user1/user2), falling back to UTC when neither partner has reported one.
COMMENT ON COLUMN "couple_streaks"."last_active_date" IS 'Couple-local date on which either partner last answered. The answered-today flags are read as false once this is not the couple-local today.';--> statement-breakpoint
COMMENT ON COLUMN "couple_streaks"."last_completed_date" IS 'Couple-local date on which both partners last answered. The streak is alive while this is the couple-local today or yesterday.';--> statement-breakpoint

-- Prunes the evening at-risk scan to couples that actually have a streak to lose.
CREATE INDEX IF NOT EXISTS "couple_streaks_live_idx" ON "couple_streaks" ("last_completed_date") WHERE "current_streak" > 0;--> statement-breakpoint

-- The legacy data plane maintained streaks from a trigger that read auth.uid(). The API
-- owns that write now and runs it in the same transaction as the response, so drop the
-- trigger defensively in case a cutover ever carries these objects across.
DROP TRIGGER IF EXISTS "on_response_update_streak" ON "responses";--> statement-breakpoint
DROP FUNCTION IF EXISTS "update_couple_streak"();--> statement-breakpoint
DROP FUNCTION IF EXISTS "reset_daily_streak_flags"();
