-- Couples quiz: a shareable "how well do you know each other?" loop. Each partner
-- answers every question twice, once about themselves and once guessing their
-- partner, and the session only scores once both partners have a complete set.
CREATE TABLE IF NOT EXISTS "quiz_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "prompt_self" text NOT NULL UNIQUE,
  "prompt_guess" text NOT NULL,
  "options" text[] NOT NULL CHECK (array_length("options", 1) BETWEEN 2 AND 4),
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "couple_id" uuid NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'completed')),
  "question_ids" uuid[] NOT NULL,
  "score_percent" integer,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_sessions_one_active_per_couple_idx"
  ON "quiz_sessions" ("couple_id") WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_sessions_couple_id_created_at_idx"
  ON "quiz_sessions" ("couple_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_answers" (
  "session_id" uuid NOT NULL REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "self_index" integer NOT NULL CHECK ("self_index" >= 0),
  "guess_index" integer NOT NULL CHECK ("guess_index" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("session_id", "user_id", "question_id")
);
--> statement-breakpoint
INSERT INTO "quiz_questions" ("prompt_self", "prompt_guess", "options", "sort_order") VALUES
  ('What is your idea of a perfect date night?', 'What is your partner''s idea of a perfect date night?',
   ARRAY['Cosy night in', 'Fancy dinner out', 'Live music or a show', 'Something active or outdoorsy'], 10),
  ('What comfort food do you crave the most?', 'What comfort food does your partner crave the most?',
   ARRAY['Pizza', 'Ice cream', 'A home-cooked classic', 'Salty snacks'], 20),
  ('How do you most like to receive love?', 'How does your partner most like to receive love?',
   ARRAY['Words of affirmation', 'Quality time', 'Physical touch', 'Thoughtful gifts'], 30),
  ('What is your biggest pet peeve at home?', 'What is your partner''s biggest pet peeve at home?',
   ARRAY['Dishes left in the sink', 'Clothes on the floor', 'Being interrupted', 'Loud noises while resting'], 40),
  ('If you could go anywhere on a dream holiday, where would it be?', 'If your partner could go anywhere on a dream holiday, where would it be?',
   ARRAY['A beach escape', 'A big city adventure', 'A mountain retreat', 'A road trip somewhere new'], 50),
  ('What movie genre do you reach for most?', 'What movie genre does your partner reach for most?',
   ARRAY['Comedy', 'Romance', 'Action or thriller', 'Documentary'], 60),
  ('Are you more of a morning person or a night person?', 'Is your partner more of a morning person or a night person?',
   ARRAY['Morning person', 'Night person', 'A bit of both', 'Neither, honestly'], 70),
  ('What hidden talent are you secretly proud of?', 'What hidden talent is your partner secretly proud of?',
   ARRAY['Cooking or baking', 'Singing or dancing', 'A sport or game', 'Art or a craft'], 80),
  ('What helps you relieve stress the most?', 'What helps your partner relieve stress the most?',
   ARRAY['A quiet walk', 'Talking it out', 'Exercise', 'Watching something and switching off'], 90),
  ('If you splurged on one thing, what would it be?', 'If your partner splurged on one thing, what would it be?',
   ARRAY['New clothes', 'A gadget', 'A trip', 'A nice meal out'], 100),
  ('What is your go-to karaoke song vibe?', 'What is your partner''s go-to karaoke song vibe?',
   ARRAY['A power ballad', 'An upbeat pop anthem', 'An old classic', 'I would never do karaoke'], 110),
  ('If you had one superpower, which would you pick?', 'If your partner had one superpower, which would they pick?',
   ARRAY['Flight', 'Invisibility', 'Reading minds', 'Time travel'], 120)
ON CONFLICT ("prompt_self") DO NOTHING;
