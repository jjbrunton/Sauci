-- Enforce maximum 2 members per couple at the database level
-- This prevents race conditions and direct API manipulation from allowing
-- more than 2 people to join a single couple relationship

CREATE OR REPLACE FUNCTION check_couple_size()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when couple_id is being set (not when clearing it)
  IF NEW.couple_id IS NOT NULL THEN
    -- Count existing members excluding the current user
    IF (SELECT COUNT(*) FROM profiles WHERE couple_id = NEW.couple_id AND id != NEW.id) >= 2 THEN
      RAISE EXCEPTION 'A couple can only have 2 members';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires before insert or update of couple_id column
CREATE TRIGGER enforce_couple_size
BEFORE INSERT OR UPDATE OF couple_id ON profiles
FOR EACH ROW EXECUTE FUNCTION check_couple_size();
