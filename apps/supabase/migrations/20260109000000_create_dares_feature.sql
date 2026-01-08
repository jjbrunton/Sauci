-- Dares Feature Migration
-- Creates dare_packs, dares, sent_dares, dare_messages tables
-- with RLS policies, triggers, and stats functions

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================
CREATE TYPE dare_status AS ENUM (
  'pending',    -- Sent, waiting for recipient to accept/decline
  'active',     -- Recipient accepted, timer started (if applicable)
  'completed',  -- Sender marked as complete
  'expired',    -- Time ran out (only if had deadline)
  'declined',   -- Recipient declined
  'cancelled'   -- Sender cancelled before completion
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Dare packs table (mirrors question_packs structure)
CREATE TABLE dare_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_explicit BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  min_intensity INTEGER,
  max_intensity INTEGER,
  avg_intensity NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dare_packs IS 'Collections of dares organized by theme or intensity level';
COMMENT ON COLUMN dare_packs.min_intensity IS 'Auto-calculated minimum intensity from dares in this pack';
COMMENT ON COLUMN dare_packs.max_intensity IS 'Auto-calculated maximum intensity from dares in this pack';
COMMENT ON COLUMN dare_packs.avg_intensity IS 'Auto-calculated average intensity from dares in this pack';

-- Create indexes for dare_packs
CREATE INDEX idx_dare_packs_sort_order ON dare_packs(sort_order);
CREATE INDEX idx_dare_packs_visibility ON dare_packs(is_public, is_premium);
CREATE INDEX idx_dare_packs_category ON dare_packs(category_id);

-- Dares table (individual dare content)
CREATE TABLE dares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES dare_packs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  intensity INTEGER NOT NULL DEFAULT 1 CHECK (intensity >= 1 AND intensity <= 5),
  suggested_duration_hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dares IS 'Individual dares within dare packs';
COMMENT ON COLUMN dares.intensity IS 'Difficulty/spiciness level from 1 (mild) to 5 (intense)';
COMMENT ON COLUMN dares.suggested_duration_hours IS 'Suggested time to complete the dare in hours (null = no suggestion)';

-- Create indexes for dares
CREATE INDEX idx_dares_pack_id ON dares(pack_id);
CREATE INDEX idx_dares_intensity ON dares(intensity);

-- Sent dares table (tracks dare instances between partners)
CREATE TABLE sent_dares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  dare_id UUID REFERENCES dares(id) ON DELETE SET NULL,
  custom_dare_text TEXT,
  custom_dare_intensity INTEGER CHECK (custom_dare_intensity IS NULL OR (custom_dare_intensity >= 1 AND custom_dare_intensity <= 5)),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status dare_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sender_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dare_or_custom CHECK (dare_id IS NOT NULL OR custom_dare_text IS NOT NULL)
);

COMMENT ON TABLE sent_dares IS 'Dare instances sent between partners in a couple';
COMMENT ON COLUMN sent_dares.dare_id IS 'Reference to the dare from a pack (null for custom dares)';
COMMENT ON COLUMN sent_dares.custom_dare_text IS 'Text for custom dares created by premium users';
COMMENT ON COLUMN sent_dares.custom_dare_intensity IS 'Intensity for custom dares (1-5)';
COMMENT ON COLUMN sent_dares.expires_at IS 'Deadline for completing the dare (null = no time limit)';
COMMENT ON COLUMN sent_dares.sender_notes IS 'Optional message from sender when sending the dare';

-- Create indexes for sent_dares
CREATE INDEX idx_sent_dares_couple_id ON sent_dares(couple_id);
CREATE INDEX idx_sent_dares_sender_id ON sent_dares(sender_id);
CREATE INDEX idx_sent_dares_recipient_id ON sent_dares(recipient_id);
CREATE INDEX idx_sent_dares_status ON sent_dares(status);
CREATE INDEX idx_sent_dares_expires_at ON sent_dares(expires_at) WHERE expires_at IS NOT NULL AND status = 'active';

-- Dare messages table (chat for each dare)
CREATE TABLE dare_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_dare_id UUID NOT NULL REFERENCES sent_dares(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dare_messages IS 'Chat messages associated with each sent dare';

-- Create indexes for dare_messages
CREATE INDEX idx_dare_messages_sent_dare_id ON dare_messages(sent_dare_id);
CREATE INDEX idx_dare_messages_created_at ON dare_messages(sent_dare_id, created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger function to auto-calculate dare pack intensity stats
CREATE OR REPLACE FUNCTION update_dare_pack_intensity_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_pack_id UUID;
BEGIN
  -- Get the pack_id to update
  target_pack_id := COALESCE(NEW.pack_id, OLD.pack_id);
  
  -- Update the dare pack stats
  UPDATE dare_packs
  SET 
    min_intensity = (SELECT MIN(intensity) FROM dares WHERE pack_id = target_pack_id),
    max_intensity = (SELECT MAX(intensity) FROM dares WHERE pack_id = target_pack_id),
    avg_intensity = (SELECT ROUND(AVG(intensity)::numeric, 2) FROM dares WHERE pack_id = target_pack_id)
  WHERE id = target_pack_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on dares table
CREATE TRIGGER dare_intensity_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON dares
FOR EACH ROW EXECUTE FUNCTION update_dare_pack_intensity_stats();

-- ============================================================================
-- STATS FUNCTIONS
-- ============================================================================

-- Function to get dare stats for a specific user
CREATE OR REPLACE FUNCTION get_user_dare_stats(p_user_id UUID)
RETURNS TABLE (
  dares_sent_count BIGINT,
  dares_received_count BIGINT,
  dares_completed_as_sender BIGINT,
  dares_completed_as_recipient BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM sent_dares WHERE sender_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM sent_dares WHERE recipient_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM sent_dares WHERE sender_id = p_user_id AND status = 'completed')::BIGINT,
    (SELECT COUNT(*) FROM sent_dares WHERE recipient_id = p_user_id AND status = 'completed')::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get dare stats for a couple
CREATE OR REPLACE FUNCTION get_couple_dare_stats(p_couple_id UUID)
RETURNS TABLE (
  total_dares_sent BIGINT,
  total_dares_completed BIGINT,
  total_dares_active BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM sent_dares WHERE couple_id = p_couple_id)::BIGINT,
    (SELECT COUNT(*) FROM sent_dares WHERE couple_id = p_couple_id AND status = 'completed')::BIGINT,
    (SELECT COUNT(*) FROM sent_dares WHERE couple_id = p_couple_id AND status = 'active')::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE dare_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dares ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_dares ENABLE ROW LEVEL SECURITY;
ALTER TABLE dare_messages ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- dare_packs policies
-- -------------------------

-- Anyone can view public dare packs
CREATE POLICY "Public dare packs are viewable by everyone"
ON dare_packs FOR SELECT
USING (is_public = true);

-- Admins can view all dare packs
CREATE POLICY "Admins can view all dare packs"
ON dare_packs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Admins can insert dare packs
CREATE POLICY "Admins can insert dare packs"
ON dare_packs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Admins can update dare packs
CREATE POLICY "Admins can update dare packs"
ON dare_packs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Admins can delete dare packs
CREATE POLICY "Admins can delete dare packs"
ON dare_packs FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- -------------------------
-- dares policies
-- -------------------------

-- Users can view dares in accessible packs (public and free, or public and user is premium)
CREATE POLICY "Users can view dares in accessible packs"
ON dares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM dare_packs dp
    WHERE dp.id = dares.pack_id
    AND dp.is_public = true
    AND (
      dp.is_premium = false
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_premium = true)
    )
  )
);

-- Admins can view all dares
CREATE POLICY "Admins can view all dares"
ON dares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Admins can insert dares
CREATE POLICY "Admins can insert dares"
ON dares FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Admins can update dares
CREATE POLICY "Admins can update dares"
ON dares FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- Admins can delete dares
CREATE POLICY "Admins can delete dares"
ON dares FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- -------------------------
-- sent_dares policies
-- -------------------------

-- Users can view sent dares in their couple
CREATE POLICY "Users can view their couple's sent dares"
ON sent_dares FOR SELECT
USING (couple_id = get_auth_user_couple_id());

-- Users can insert sent dares (sender must be the authenticated user)
CREATE POLICY "Users can send dares to their partner"
ON sent_dares FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND couple_id = get_auth_user_couple_id()
);

-- Users can update sent dares in their couple
CREATE POLICY "Users can update their couple's sent dares"
ON sent_dares FOR UPDATE
USING (couple_id = get_auth_user_couple_id());

-- Admins can view all sent dares
CREATE POLICY "Admins can view all sent dares"
ON sent_dares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- -------------------------
-- dare_messages policies
-- -------------------------

-- Users can view messages for their couple's dares
CREATE POLICY "Users can view messages for their dares"
ON dare_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sent_dares sd
    WHERE sd.id = dare_messages.sent_dare_id
    AND sd.couple_id = get_auth_user_couple_id()
  )
);

-- Users can insert messages for their couple's dares
CREATE POLICY "Users can send messages for their dares"
ON dare_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM sent_dares sd
    WHERE sd.id = dare_messages.sent_dare_id
    AND sd.couple_id = get_auth_user_couple_id()
  )
);

-- Users can update messages in their dares (for read_at)
CREATE POLICY "Users can update message read status"
ON dare_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sent_dares sd
    WHERE sd.id = dare_messages.sent_dare_id
    AND sd.couple_id = get_auth_user_couple_id()
  )
);

-- Admins can view all dare messages
CREATE POLICY "Admins can view all dare messages"
ON dare_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- REALTIME
-- ============================================================================

-- Add tables to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE sent_dares;
ALTER PUBLICATION supabase_realtime ADD TABLE dare_messages;
