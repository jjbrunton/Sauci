ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "allowed_couple_genders" text[],
  ADD COLUMN IF NOT EXISTS "target_user_genders" text[],
  ADD COLUMN IF NOT EXISTS "question_type" text NOT NULL DEFAULT 'swipe',
  ADD COLUMN IF NOT EXISTS "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_type_check"
    CHECK ("question_type" IN ('swipe', 'text_answer', 'audio', 'photo', 'who_likely'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "answer_gap_threshold" integer NOT NULL DEFAULT 10 CHECK ("answer_gap_threshold" >= 0),
  "daily_response_limit" integer NOT NULL DEFAULT 0 CHECK ("daily_response_limit" >= 0),
  "couple_intensity_gate_enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_config_singleton_idx" ON "app_config" ((true));
--> statement-breakpoint
INSERT INTO "app_config" ("id") VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "couple_id" uuid NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "question_id" uuid NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "match_type" text NOT NULL CHECK ("match_type" IN ('yes_yes', 'yes_maybe', 'maybe_maybe', 'both_answered')),
  "is_new" boolean NOT NULL DEFAULT true,
  "response_summary" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("couple_id", "question_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_couple_created_idx" ON "matches" ("couple_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "content" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_archives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "archived_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("match_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_archives_user_idx" ON "match_archives" ("user_id", "match_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "couple_streaks" (
  "couple_id" uuid PRIMARY KEY REFERENCES "couples"("id") ON DELETE CASCADE,
  "current_streak" integer NOT NULL DEFAULT 0,
  "longest_streak" integer NOT NULL DEFAULT 0,
  "last_active_date" date,
  "last_completed_date" date,
  "user1_answered_today" boolean NOT NULL DEFAULT false,
  "user2_answered_today" boolean NOT NULL DEFAULT false,
  "streak_celebrated_at" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "responses_couple_question_idx" ON "responses" ("couple_id", "question_id");
