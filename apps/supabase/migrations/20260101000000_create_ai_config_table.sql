-- AI Configuration table for admin portal
-- Stores AI settings that can be configured by super admins

CREATE TABLE IF NOT EXISTS ai_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- API Configuration
    openrouter_api_key text,

    -- Model Configuration
    default_model text DEFAULT 'openai/gpt-4o-mini',
    model_generate text,
    model_fix text,
    model_polish text,

    -- Council Configuration
    council_enabled boolean DEFAULT false,
    council_generator_model text DEFAULT 'anthropic/claude-3.5-sonnet',
    council_reviewer_model text DEFAULT 'google/gemini-pro-1.5',

    -- Metadata
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);
-- Only allow one row in this table (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS ai_config_singleton ON ai_config ((true));
-- Insert default config row
INSERT INTO ai_config (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
-- Enable RLS
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
-- Only super admins can read/write (checked via admin_users table)
CREATE POLICY "Super admins can read ai_config"
    ON ai_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
        )
    );
CREATE POLICY "Super admins can update ai_config"
    ON ai_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.user_id = auth.uid()
            AND admin_users.role = 'super_admin'
        )
    );
-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS ai_config_updated_at ON ai_config;
CREATE TRIGGER ai_config_updated_at
    BEFORE UPDATE ON ai_config
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_config_timestamp();
-- Add comment for documentation
COMMENT ON TABLE ai_config IS 'Singleton table storing AI configuration for admin portal. Only super admins can access.';
