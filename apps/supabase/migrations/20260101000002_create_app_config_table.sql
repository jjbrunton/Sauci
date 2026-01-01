-- App Configuration table for mobile app settings
-- Stores app behavior settings configurable by super admins

CREATE TABLE IF NOT EXISTS app_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Answer Spam Prevention
    -- Maximum questions a user can answer ahead of their partner (0 = disabled)
    answer_gap_threshold integer DEFAULT 10,

    -- Metadata
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- Only allow one row in this table (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS app_config_singleton ON app_config ((true));

-- Insert default config row
INSERT INTO app_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for mobile app)
CREATE POLICY "Authenticated users can read app_config"
    ON app_config FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only super admins can update
CREATE POLICY "Super admins can update app_config"
    ON app_config FOR UPDATE
    USING (is_super_admin());

-- Create trigger to auto-update timestamp (reuses existing function)
CREATE TRIGGER app_config_updated_at
    BEFORE UPDATE ON app_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Add comment for documentation
COMMENT ON TABLE app_config IS 'Singleton table storing mobile app configuration. Readable by all authenticated users, writable by super admins only.';
COMMENT ON COLUMN app_config.answer_gap_threshold IS 'Maximum number of questions a user can answer ahead of their partner. Set to 0 to disable answer spam prevention.';

-- ============================================================================
-- RPC FUNCTION: get_answer_gap_status
-- Returns the number of questions user has answered that partner hasn't,
-- the configured threshold, and whether the user is blocked.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_answer_gap_status()
RETURNS TABLE(
    unanswered_by_partner integer,
    threshold integer,
    is_blocked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_couple_id UUID;
    v_partner_id UUID;
    v_gap_count integer;
    v_threshold integer;
BEGIN
    v_user_id := auth.uid();

    -- Get user's couple_id
    SELECT p.couple_id INTO v_couple_id
    FROM profiles p
    WHERE p.id = v_user_id;

    -- No couple = no blocking needed
    IF v_couple_id IS NULL THEN
        RETURN QUERY SELECT 0, 0, false;
        RETURN;
    END IF;

    -- Get partner's ID
    SELECT p.id INTO v_partner_id
    FROM profiles p
    WHERE p.couple_id = v_couple_id AND p.id != v_user_id
    LIMIT 1;

    -- No partner = no blocking needed
    IF v_partner_id IS NULL THEN
        RETURN QUERY SELECT 0, 0, false;
        RETURN;
    END IF;

    -- Get threshold from app_config
    SELECT COALESCE(ac.answer_gap_threshold, 10) INTO v_threshold
    FROM app_config ac
    LIMIT 1;

    -- If threshold is 0, feature is disabled
    IF v_threshold = 0 THEN
        RETURN QUERY SELECT 0, 0, false;
        RETURN;
    END IF;

    -- Count questions in ENABLED packs where:
    -- - Current user HAS responded
    -- - Partner has NOT responded
    WITH enabled_packs AS (
        -- Get packs that the couple has explicitly enabled
        SELECT cp.pack_id
        FROM couple_packs cp
        WHERE cp.couple_id = v_couple_id AND cp.enabled = true
    )
    SELECT COUNT(*)::integer INTO v_gap_count
    FROM responses r
    INNER JOIN questions q ON q.id = r.question_id
    WHERE r.user_id = v_user_id
    AND r.couple_id = v_couple_id
    AND (
        -- Only count if couple has enabled packs AND question is in one of them
        -- If no packs enabled, don't block (couple hasn't set up yet)
        EXISTS (SELECT 1 FROM enabled_packs)
        AND q.pack_id IN (SELECT pack_id FROM enabled_packs)
    )
    AND NOT EXISTS (
        SELECT 1 FROM responses pr
        WHERE pr.question_id = r.question_id
        AND pr.user_id = v_partner_id
    );

    RETURN QUERY SELECT v_gap_count, v_threshold, (v_gap_count >= v_threshold);
END;
$$;

COMMENT ON FUNCTION get_answer_gap_status() IS 'Returns answer gap status for the current user. Used by mobile app to prevent answer spam.';
