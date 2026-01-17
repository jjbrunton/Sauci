-- Add council_generators array field for multiple generator support
-- This allows users to configure multiple generators with different models
-- The reviewer will pick the best generation from all generators

-- Add the new column (migrate existing single generator model to array format)
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS council_generators jsonb;
-- Set default value based on existing council_generator_model or default
UPDATE ai_config
SET council_generators = jsonb_build_array(
    jsonb_build_object('model', COALESCE(council_generator_model, 'anthropic/claude-3.5-sonnet'))
)
WHERE council_generators IS NULL;
-- Set the default for new rows
ALTER TABLE ai_config
ALTER COLUMN council_generators SET DEFAULT '[{"model": "anthropic/claude-3.5-sonnet"}]'::jsonb;
-- Add comment for documentation
COMMENT ON COLUMN ai_config.council_generators IS 'Array of generator configurations. Each object has a "model" field. Default is one generator with Claude 3.5 Sonnet.';
