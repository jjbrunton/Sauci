CREATE TABLE IF NOT EXISTS media_objects (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  couple_id uuid REFERENCES couples(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('avatar', 'response', 'chat', 'feedback')),
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS media_objects_owner_idx ON media_objects(owner_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS media_objects_couple_idx ON media_objects(couple_id) WHERE couple_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS media_deletion_queue (
  storage_key text PRIMARY KEY,
  queued_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION queue_media_blob_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO media_deletion_queue(storage_key) VALUES(OLD.storage_key) ON CONFLICT DO NOTHING;
  RETURN OLD;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS media_objects_queue_blob_deletion ON media_objects;
CREATE TRIGGER media_objects_queue_blob_deletion BEFORE DELETE ON media_objects
FOR EACH ROW EXECUTE FUNCTION queue_media_blob_deletion();
--> statement-breakpoint
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS screenshot_media_id uuid REFERENCES media_objects(id) ON DELETE SET NULL;
