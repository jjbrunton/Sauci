-- Add hide_nsfw column to profiles table
-- When true, packs marked as is_explicit will be hidden from the user
-- Independent of max_intensity setting

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS hide_nsfw BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles.hide_nsfw IS
  'When true, packs marked as is_explicit will be hidden. Independent of max_intensity.';
