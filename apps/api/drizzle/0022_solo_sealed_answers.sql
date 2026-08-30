-- Unpaired users previously hit a waiting room with no way to answer questions,
-- because responses.couple_id was NOT NULL. This migration relaxes that column so
-- a solo user can bank "sealed" answers before they have a couple. The foreign key
-- and ON DELETE CASCADE are unchanged for non-null values: once a couple is deleted,
-- the responses that belonged to it are still removed with it. Sealed answers keep
-- couple_id NULL until claimed by the application at pairing time, so couple deletion
-- has no effect on them; they are not tied to any couple's lifecycle until claimed.
ALTER TABLE "responses" ALTER COLUMN "couple_id" DROP NOT NULL;
--> statement-breakpoint
-- A sealed answer (couple_id IS NULL) has no couple to digest a match notification
-- for yet; the partner digest only makes sense once claim-on-pair assigns the
-- response to a couple, at which point the claim path computes matches directly.
CREATE OR REPLACE FUNCTION queue_response_digest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('sauci.suppress_operations',true)='on' THEN RETURN NEW; END IF;
  IF NEW.couple_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO pending_match_notifications(couple_id, active_user_id, notify_at)
  VALUES(NEW.couple_id, NEW.user_id, now() + interval '5 minutes')
  ON CONFLICT(couple_id) DO UPDATE SET
    active_user_id=excluded.active_user_id,
    response_count=pending_match_notifications.response_count+1,
    notify_at=excluded.notify_at,
    updated_at=now();
  RETURN NEW;
END $$;
