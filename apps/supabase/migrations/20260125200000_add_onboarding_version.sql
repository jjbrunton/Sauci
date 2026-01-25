-- Add onboarding_version column to track which version of onboarding users completed
-- This allows forcing users through re-onboarding when new data is required

ALTER TABLE profiles
ADD COLUMN onboarding_version INTEGER DEFAULT 0;

-- Set existing users who completed onboarding to version 1
-- New users will default to 0 and need to complete the current version
UPDATE profiles
SET onboarding_version = 1
WHERE onboarding_completed = true;

-- Add comment for documentation
COMMENT ON COLUMN profiles.onboarding_version IS 'Version of onboarding flow completed. 0 = never completed, 1+ = completed that version. Used to force re-onboarding when new data is required.';
