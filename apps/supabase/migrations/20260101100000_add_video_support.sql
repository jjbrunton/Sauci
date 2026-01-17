-- Add video support to chat messages with 30-day retention policy
-- Videos expire 30 days after being viewed by the recipient

-- Add media type to distinguish images from videos
ALTER TABLE messages ADD COLUMN media_type TEXT CHECK (media_type IN ('image', 'video'));
-- Track when media expires (set when video is viewed: media_viewed_at + 30 days)
ALTER TABLE messages ADD COLUMN media_expires_at TIMESTAMPTZ;
-- Track if media was deleted due to expiration
ALTER TABLE messages ADD COLUMN media_expired BOOLEAN DEFAULT false;
-- Backfill existing media as images
UPDATE messages SET media_type = 'image' WHERE media_path IS NOT NULL;
-- Enable pg_cron extension for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
-- Create cleanup function that handles both DB updates and storage deletion tracking
CREATE OR REPLACE FUNCTION cleanup_expired_videos()
RETURNS TABLE(deleted_count int, deleted_paths text[]) AS $$
DECLARE
    expired_paths text[];
    count int;
BEGIN
    -- Get paths of expired videos
    SELECT array_agg(media_path)
    INTO expired_paths
    FROM messages
    WHERE media_type = 'video'
      AND media_expires_at IS NOT NULL
      AND media_expires_at < NOW()
      AND media_expired = false
      AND media_path IS NOT NULL;

    -- Mark as expired and clear media_path
    WITH updated AS (
        UPDATE messages
        SET media_expired = true, media_path = NULL
        WHERE media_type = 'video'
          AND media_expires_at IS NOT NULL
          AND media_expires_at < NOW()
          AND media_expired = false
          AND media_path IS NOT NULL
        RETURNING 1
    )
    SELECT count(*) INTO count FROM updated;

    RETURN QUERY SELECT count, COALESCE(expired_paths, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Schedule daily cleanup at 3 AM UTC
-- The database function marks videos as expired, edge function handles storage deletion
SELECT cron.schedule(
    'cleanup-expired-videos',
    '0 3 * * *',
    'SELECT * FROM cleanup_expired_videos()'
);
