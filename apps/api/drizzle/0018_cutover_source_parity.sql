-- Preserve the reviewed production catalogue and its append-only decision history
-- when importing from the legacy Supabase data plane.

DO $$
BEGIN
  IF to_regtype('content_entity_type') IS NULL THEN
    CREATE TYPE content_entity_type AS ENUM (
      'categories', 'question_packs', 'questions', 'dare_packs', 'dares'
    );
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS content_status content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS content_review_reason text,
  ADD COLUMN IF NOT EXISTS content_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE question_packs
  ADD COLUMN IF NOT EXISTS content_status content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS content_review_reason text,
  ADD COLUMN IF NOT EXISTS content_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS content_status content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS content_review_reason text,
  ADD COLUMN IF NOT EXISTS content_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS categories_content_status_idx
  ON categories (content_status, is_public, sort_order);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS question_packs_content_status_idx
  ON question_packs (content_status, is_public, sort_order);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS questions_content_status_idx
  ON questions (pack_id, content_status, intensity);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS content_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type content_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  previous_status content_review_status NOT NULL,
  new_status content_review_status NOT NULL,
  reason text NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS content_reviews_entity_idx
  ON content_reviews (entity_type, entity_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS content_reviews_created_at_idx
  ON content_reviews (created_at DESC);
--> statement-breakpoint
-- The standalone audit model separates the acting profile from the admin row.
-- Retain legacy descriptive fields rather than dropping production history.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS changed_fields text[],
  ADD COLUMN IF NOT EXISTS admin_role text,
  ADD COLUMN IF NOT EXISTS admin_username text;
--> statement-breakpoint
-- A small number of legacy Supabase objects have neither an owner nor a live
-- database reference. Preserve their bytes and metadata without making them
-- addressable through the authenticated media API or assigning false ownership.
CREATE TABLE IF NOT EXISTS legacy_media_quarantine (
  id uuid PRIMARY KEY,
  original_storage_key text NOT NULL UNIQUE,
  bucket_id text NOT NULL,
  object_name text NOT NULL,
  source_owner_id uuid,
  metadata jsonb,
  mime_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  reason text NOT NULL,
  source_created_at timestamptz NOT NULL,
  source_updated_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now()
);
