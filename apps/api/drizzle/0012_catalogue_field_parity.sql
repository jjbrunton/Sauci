ALTER TABLE "topics"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "icon" text,
  ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "required_props" text[];
