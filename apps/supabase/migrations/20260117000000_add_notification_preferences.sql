-- Add notification preferences table
-- Allows users to opt out of specific notification types (opt-out model, all enabled by default)

CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    -- Core notifications (matching + messaging)
    matches_enabled BOOLEAN DEFAULT true,
    messages_enabled BOOLEAN DEFAULT true,
    -- Re-engagement notifications
    partner_activity_enabled BOOLEAN DEFAULT true,
    pack_changes_enabled BOOLEAN DEFAULT true,
    new_packs_enabled BOOLEAN DEFAULT true,
    streak_milestones_enabled BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only manage their own preferences
CREATE POLICY "Users can view their own notification preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Super admins can view all preferences
CREATE POLICY "Super admins can view all notification preferences"
    ON notification_preferences FOR SELECT
    USING (is_super_admin());

-- Updated_at trigger
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to get notification preferences with defaults
-- Returns preferences if they exist, or creates a default row
CREATE OR REPLACE FUNCTION get_or_create_notification_preferences(p_user_id UUID)
RETURNS notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_prefs notification_preferences;
BEGIN
    -- Try to get existing preferences
    SELECT * INTO v_prefs
    FROM notification_preferences
    WHERE user_id = p_user_id;

    -- If not found, create default preferences
    IF NOT FOUND THEN
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING * INTO v_prefs;
    END IF;

    RETURN v_prefs;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_or_create_notification_preferences(UUID) TO authenticated;
