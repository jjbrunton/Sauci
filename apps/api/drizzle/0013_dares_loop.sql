-- Dares loop: catalogue review parity, durable dare instances, and outbox notifications.
--
-- Three concerns land together because the send path depends on all of them:
--   1. `content_status` parity with the legacy catalogue so unreviewed dares stay hidden.
--   2. Text snapshots on `sent_dares` so catalogue edits never rewrite a couple's history.
--   3. Outbox rows for every status transition, which is the whole retention argument.

-- `to_regtype` resolves through the active search_path, so this creates the type in
-- the current schema rather than skipping because an unrelated schema already has it.
DO $$
BEGIN
  IF to_regtype('content_review_status') IS NULL THEN
    CREATE TYPE content_review_status AS ENUM ('unreviewed', 'allowed', 'archived');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE dare_packs
  ADD COLUMN IF NOT EXISTS content_status content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS content_review_reason text,
  ADD COLUMN IF NOT EXISTS content_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE dares
  ADD COLUMN IF NOT EXISTS content_status content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS content_review_reason text,
  ADD COLUMN IF NOT EXISTS content_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
--> statement-breakpoint
COMMENT ON COLUMN dare_packs.content_status IS
  'Store-safety review state. Only `allowed` packs are exposed to the mobile catalogue.';
--> statement-breakpoint
COMMENT ON COLUMN dares.content_status IS
  'Store-safety review state. Only `allowed` dares are sendable.';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dare_packs_content_status_idx
  ON dare_packs (content_status, is_public, sort_order);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dares_content_status_idx
  ON dares (pack_id, content_status, intensity);
--> statement-breakpoint

-- `sent_dares.dare_id` is ON DELETE SET NULL, but `sent_dares_dare_or_custom_check`
-- requires one of the two source columns to survive. Deleting a dare that had ever
-- been sent therefore aborted with a check violation. Snapshotting the text at send
-- time removes the dependency entirely and keeps history stable across content edits.
ALTER TABLE sent_dares
  ADD COLUMN IF NOT EXISTS dare_text_snapshot text,
  ADD COLUMN IF NOT EXISTS dare_intensity_snapshot integer,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
UPDATE sent_dares sd
SET dare_text_snapshot = COALESCE(sd.custom_dare_text, d.text),
    dare_intensity_snapshot = COALESCE(sd.custom_dare_intensity, d.intensity)
FROM dares d
WHERE d.id = sd.dare_id AND sd.dare_text_snapshot IS NULL;
--> statement-breakpoint
UPDATE sent_dares
SET dare_text_snapshot = custom_dare_text,
    dare_intensity_snapshot = COALESCE(custom_dare_intensity, 1)
WHERE dare_text_snapshot IS NULL AND custom_dare_text IS NOT NULL;
--> statement-breakpoint
ALTER TABLE sent_dares
  ALTER COLUMN dare_text_snapshot SET NOT NULL,
  ALTER COLUMN dare_intensity_snapshot SET NOT NULL;
--> statement-breakpoint
ALTER TABLE sent_dares DROP CONSTRAINT IF EXISTS sent_dares_dare_or_custom_check;
--> statement-breakpoint
ALTER TABLE sent_dares DROP CONSTRAINT IF EXISTS sent_dares_intensity_snapshot_check;
--> statement-breakpoint
ALTER TABLE sent_dares
  ADD CONSTRAINT sent_dares_intensity_snapshot_check
  CHECK (dare_intensity_snapshot BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE sent_dares DROP CONSTRAINT IF EXISTS sent_dares_participants_distinct_check;
--> statement-breakpoint
ALTER TABLE sent_dares
  ADD CONSTRAINT sent_dares_participants_distinct_check
  CHECK (sender_id <> recipient_id);
--> statement-breakpoint

-- `submitted` closes the loop the original design left open: the recipient performs
-- the dare, so the recipient reports it done and the sender confirms.
ALTER TABLE sent_dares DROP CONSTRAINT IF EXISTS sent_dares_status_check;
--> statement-breakpoint
ALTER TABLE sent_dares
  ADD CONSTRAINT sent_dares_status_check CHECK (
    status IN ('pending', 'active', 'submitted', 'completed', 'expired', 'declined', 'cancelled')
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_dares_recipient_status_idx ON sent_dares(recipient_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_dares_couple_status_idx ON sent_dares(couple_id, status, sent_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_dares_sender_sent_at_idx ON sent_dares(sender_id, sent_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sent_dares_expiry_idx
  ON sent_dares(expires_at) WHERE status IN ('pending', 'active', 'submitted');
--> statement-breakpoint
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS dares_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION touch_sent_dare() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS sent_dares_touch ON sent_dares;
--> statement-breakpoint
CREATE TRIGGER sent_dares_touch BEFORE UPDATE ON sent_dares
FOR EACH ROW EXECUTE FUNCTION touch_sent_dare();
--> statement-breakpoint

-- Push copy is deliberately generic. Store compliance forbids dare, question,
-- response, or message text in a notification preview.
CREATE OR REPLACE FUNCTION queue_dare_operations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_recipients uuid[];
  v_recipient uuid;
  v_title text;
  v_body text;
  v_event text;
BEGIN
  IF current_setting('sauci.suppress_operations', true) = 'on' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_event := 'sent';
    v_recipients := ARRAY[NEW.recipient_id];
    v_title := 'New dare';
    v_body := 'Your partner sent you a dare';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := NEW.status;
    CASE NEW.status
      WHEN 'active' THEN
        v_recipients := ARRAY[NEW.sender_id];
        v_title := 'Dare accepted';
        v_body := 'Your partner accepted your dare';
      WHEN 'declined' THEN
        v_recipients := ARRAY[NEW.sender_id];
        v_title := 'Dare declined';
        v_body := 'Your partner passed on your dare';
      WHEN 'submitted' THEN
        v_recipients := ARRAY[NEW.sender_id];
        v_title := 'Dare done';
        v_body := 'Your partner says they completed your dare';
      WHEN 'completed' THEN
        v_recipients := ARRAY[NEW.recipient_id];
        v_title := 'Dare complete';
        v_body := 'Your partner confirmed your dare';
      WHEN 'cancelled' THEN
        v_recipients := ARRAY[NEW.recipient_id];
        v_title := 'Dare cancelled';
        v_body := 'Your partner cancelled the dare';
      WHEN 'expired' THEN
        -- Both sides lose the dare, so both sides hear about it.
        v_recipients := ARRAY[NEW.sender_id, NEW.recipient_id];
        v_title := 'Dare expired';
        v_body := 'A dare ran out of time';
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  FOREACH v_recipient IN ARRAY v_recipients LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN notification_preferences np ON np.user_id = p.id
      WHERE p.id = v_recipient AND COALESCE(np.dares_enabled, true) = true
    );

    INSERT INTO operations_outbox(kind, dedupe_key, recipient_id, payload)
    VALUES (
      'expo',
      'dare:' || NEW.id || ':' || v_event || ':' || v_recipient,
      v_recipient,
      jsonb_build_object(
        'title', v_title,
        'body', v_body,
        'data', jsonb_build_object('type', 'dare', 'event', v_event, 'sent_dare_id', NEW.id)
      )
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operations_dare_changed ON sent_dares;
--> statement-breakpoint
CREATE TRIGGER operations_dare_changed AFTER INSERT OR UPDATE ON sent_dares
FOR EACH ROW EXECUTE FUNCTION queue_dare_operations();

--> statement-breakpoint
-- Mirror the review decision already enforced on the legacy catalogue
-- (20260828114256_enforce_allowed_catalogue): "Romantic Gestures" passed store-safety
-- review, the other seeded packs did not. Only rows still `unreviewed` are touched, so
-- this never overrides a later decision made in the admin portal.
UPDATE dare_packs
SET content_status = 'allowed',
    content_review_reason = 'Reviewed as non-sexual romantic gestures'
WHERE id = 'a1b2c3d4-1111-1111-1111-111111111111'::uuid AND content_status = 'unreviewed';
--> statement-breakpoint
UPDATE dare_packs
SET content_status = 'archived',
    content_review_reason = 'Pack contains suggestive, sexual, dominance, or fantasy dares'
WHERE id IN (
  'a1b2c3d4-2222-2222-2222-222222222222'::uuid,
  'a1b2c3d4-3333-3333-3333-333333333333'::uuid,
  'a1b2c3d4-4444-4444-4444-444444444444'::uuid
) AND content_status = 'unreviewed';
--> statement-breakpoint
UPDATE dares d
SET content_status = dp.content_status,
    content_review_reason = CASE
      WHEN dp.content_status = 'allowed' THEN 'Reviewed with Romantic Gestures pack'
      ELSE 'Archived with non-store-safe dare pack'
    END
FROM dare_packs dp
WHERE d.pack_id = dp.id AND d.content_status = 'unreviewed' AND dp.content_status <> 'unreviewed';
