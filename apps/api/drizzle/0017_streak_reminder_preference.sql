-- A shared streak only changes behaviour if somebody is told it is still open, so the
-- evening at-risk nudge gets its own opt-out rather than riding on milestone celebrations.
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "streak_reminders_enabled" boolean NOT NULL DEFAULT true;
