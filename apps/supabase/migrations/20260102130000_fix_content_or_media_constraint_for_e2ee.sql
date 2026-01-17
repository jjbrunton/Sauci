-- Update the content_or_media constraint to allow E2EE messages
-- E2EE messages have encrypted_content instead of content

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS content_or_media;
ALTER TABLE public.messages ADD CONSTRAINT content_or_media CHECK (
    -- v1 (plaintext): must have content or media_path
    (version = 1 AND (content IS NOT NULL OR media_path IS NOT NULL))
    OR
    -- v2 (E2EE): must have encrypted_content or media_path
    (version = 2 AND (encrypted_content IS NOT NULL OR media_path IS NOT NULL))
    OR
    -- Legacy messages without version: require content or media_path
    (version IS NULL AND (content IS NOT NULL OR media_path IS NOT NULL))
);
