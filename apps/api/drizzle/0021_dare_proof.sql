-- Optional proof-of-completion for dares. The sender picks a requirement
-- ('none', 'photo', 'audio') at send time for both catalogue and custom dares;
-- the recipient attaches a media object when submitting.
ALTER TABLE sent_dares ADD COLUMN IF NOT EXISTS proof_type text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE sent_dares DROP CONSTRAINT IF EXISTS sent_dares_proof_type_check;
ALTER TABLE sent_dares ADD CONSTRAINT sent_dares_proof_type_check
  CHECK (proof_type IN ('none', 'photo', 'audio'));
--> statement-breakpoint
ALTER TABLE sent_dares ADD COLUMN IF NOT EXISTS proof_media_id uuid REFERENCES media_objects(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_dares_proof_media_idx ON sent_dares(proof_media_id) WHERE proof_media_id IS NOT NULL;
--> statement-breakpoint
ALTER TABLE media_objects DROP CONSTRAINT IF EXISTS media_objects_kind_check;
ALTER TABLE media_objects ADD CONSTRAINT media_objects_kind_check
  CHECK (kind IN ('avatar', 'response', 'chat', 'feedback', 'dare_proof'));
