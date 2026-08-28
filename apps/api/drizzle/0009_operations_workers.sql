ALTER TABLE question_packs
  ADD COLUMN IF NOT EXISTS scheduled_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_notified boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_unpaired_reminder_at timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS pending_match_notifications (
  couple_id uuid PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  active_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_count integer NOT NULL DEFAULT 0,
  response_count integer NOT NULL DEFAULT 1,
  latest_match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  notify_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pending_match_notifications_due_idx ON pending_match_notifications(notify_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS pending_pack_notifications (
  couple_id uuid PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  changed_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notify_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pending_pack_notifications_due_idx ON pending_pack_notifications(notify_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS catchup_reminder_tracking (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  pending_since timestamptz,
  last_reminder_sent_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0 CHECK (reminder_count >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS operations_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('expo', 'discord', 'classify')),
  dedupe_key text NOT NULL UNIQUE,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS operations_outbox_due_idx
  ON operations_outbox(available_at, created_at) WHERE sent_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION queue_response_digest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('sauci.suppress_operations',true)='on' THEN RETURN NEW; END IF;
  INSERT INTO pending_match_notifications(couple_id, active_user_id, notify_at)
  VALUES(NEW.couple_id, NEW.user_id, now() + interval '5 minutes')
  ON CONFLICT(couple_id) DO UPDATE SET
    active_user_id=excluded.active_user_id,
    response_count=pending_match_notifications.response_count+1,
    notify_at=excluded.notify_at,
    updated_at=now();
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operations_response_digest ON responses;
CREATE TRIGGER operations_response_digest AFTER INSERT ON responses
FOR EACH ROW EXECUTE FUNCTION queue_response_digest();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION count_digest_match() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('sauci.suppress_operations',true)='on' THEN RETURN NEW; END IF;
  UPDATE pending_match_notifications SET match_count=match_count+1,
    latest_match_id=NEW.id, updated_at=now() WHERE couple_id=NEW.couple_id;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operations_match_digest ON matches;
CREATE TRIGGER operations_match_digest AFTER INSERT ON matches
FOR EACH ROW EXECUTE FUNCTION count_digest_match();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION queue_message_operations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_couple_id uuid; v_recipient record;
BEGIN
  IF current_setting('sauci.suppress_operations',true)='on' THEN RETURN NEW; END IF;
  SELECT couple_id INTO v_couple_id FROM matches WHERE id=NEW.match_id;
  FOR v_recipient IN
    SELECT p.id FROM profiles p
    LEFT JOIN notification_preferences np ON np.user_id=p.id
    WHERE p.couple_id=v_couple_id AND p.id<>NEW.user_id
      AND COALESCE(np.messages_enabled,true)=true
  LOOP
    INSERT INTO operations_outbox(kind,dedupe_key,recipient_id,payload)
    VALUES('expo','message:'||NEW.id||':'||v_recipient.id,v_recipient.id,
      jsonb_build_object('title','New message','body','Your partner sent you a message',
        'data',jsonb_build_object('type','message','match_id',NEW.match_id,'message_id',NEW.id)))
    ON CONFLICT(dedupe_key) DO NOTHING;
  END LOOP;
  INSERT INTO operations_outbox(kind,dedupe_key,payload)
  VALUES('classify','classify:'||NEW.id,jsonb_build_object('message_id',NEW.id))
  ON CONFLICT(dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operations_message_created ON messages;
CREATE TRIGGER operations_message_created AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION queue_message_operations();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION queue_pack_change(p_couple_id uuid, p_user_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_user_id AND couple_id=p_couple_id) THEN
    RAISE EXCEPTION 'user is not a member of couple';
  END IF;
  INSERT INTO pending_pack_notifications(couple_id,changed_by_user_id,notify_at)
  VALUES(p_couple_id,p_user_id,now()+interval '30 minutes')
  ON CONFLICT(couple_id) DO UPDATE SET changed_by_user_id=excluded.changed_by_user_id,
    notify_at=excluded.notify_at,updated_at=now();
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION queue_discord_operations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('sauci.suppress_operations',true)='on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='profiles' AND NEW.onboarding_completed=true
     AND (TG_OP='INSERT' OR OLD.onboarding_completed=false) THEN
    INSERT INTO operations_outbox(kind,dedupe_key,payload)
    VALUES('discord','discord:new_user:'||NEW.id,
      jsonb_build_object('event','new_user','user_id',NEW.id,'name',NEW.name,'email',NEW.email,'created_at',NEW.created_at))
    ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
  IF TG_TABLE_NAME='profiles' AND NEW.couple_id IS NOT NULL
     AND (TG_OP='INSERT' OR OLD.couple_id IS DISTINCT FROM NEW.couple_id)
     AND EXISTS(SELECT 1 FROM profiles partner WHERE partner.couple_id=NEW.couple_id AND partner.id<>NEW.id) THEN
    INSERT INTO operations_outbox(kind,dedupe_key,payload)
    VALUES('discord','discord:couple_paired:'||NEW.couple_id,
      jsonb_build_object('event','couple_paired','couple_id',NEW.couple_id,'paired_at',now()))
    ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operations_profile_discord ON profiles;
CREATE TRIGGER operations_profile_discord AFTER INSERT OR UPDATE OF onboarding_completed,couple_id ON profiles
FOR EACH ROW EXECUTE FUNCTION queue_discord_operations();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION queue_feedback_discord() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('sauci.suppress_operations',true)='on' THEN RETURN NEW; END IF;
  INSERT INTO operations_outbox(kind,dedupe_key,payload)
  VALUES('discord','discord:feedback:'||NEW.id,
    jsonb_build_object('event','feedback_submitted','feedback_id',NEW.id,'user_id',NEW.user_id,
      'type',NEW.type,'status',NEW.status,'title',NEW.title,'description',NEW.description,
      'question_id',NEW.question_id,'created_at',NEW.created_at))
  ON CONFLICT(dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operations_feedback_discord ON feedback;
CREATE TRIGGER operations_feedback_discord AFTER INSERT ON feedback
FOR EACH ROW EXECUTE FUNCTION queue_feedback_discord();
