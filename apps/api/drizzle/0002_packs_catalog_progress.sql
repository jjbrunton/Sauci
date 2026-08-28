CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "color" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_public" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_packs" (
  "id" uuid PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "is_premium" boolean NOT NULL DEFAULT false,
  "is_public" boolean NOT NULL DEFAULT true,
  "is_explicit" boolean NOT NULL DEFAULT false,
  "min_intensity" integer,
  "max_intensity" integer,
  "avg_intensity" integer,
  "sort_order" integer NOT NULL DEFAULT 0,
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_packs_category_id_idx" ON "question_packs" ("category_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
  "id" uuid PRIMARY KEY,
  "pack_id" uuid NOT NULL REFERENCES "question_packs"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "partner_text" text,
  "intensity" integer NOT NULL DEFAULT 1 CHECK ("intensity" BETWEEN 1 AND 5),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_pack_id_idx" ON "questions" ("pack_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "responses" (
  "id" uuid PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "question_id" uuid NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "couple_id" uuid NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "answer" text NOT NULL CHECK ("answer" IN ('yes', 'no', 'maybe')),
  "response_data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("user_id", "question_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "responses_user_id_idx" ON "responses" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "couple_packs" (
  "couple_id" uuid NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "pack_id" uuid NOT NULL REFERENCES "question_packs"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("couple_id", "pack_id")
);
