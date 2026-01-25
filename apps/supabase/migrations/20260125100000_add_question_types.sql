-- Migration: Add Question Types Support
-- This migration adds support for different question types beyond the original swipe mechanic.
-- New types include: text_answer, audio, photo, and who_likely

-- 1. Create question_type enum
CREATE TYPE question_type AS ENUM ('swipe', 'text_answer', 'audio', 'photo', 'who_likely');

-- 2. Add columns to questions table
-- question_type: The type of question (defaults to 'swipe' for backwards compatibility)
-- config: JSONB field for type-specific configuration (e.g., max_length for text, duration for audio)
ALTER TABLE questions
  ADD COLUMN question_type question_type NOT NULL DEFAULT 'swipe',
  ADD COLUMN config JSONB DEFAULT '{}';

-- 3. Add response_data to responses table
-- This stores type-specific response data (e.g., text answer, audio URL, photo URL, selection)
-- For swipe questions, this remains NULL (the answer column is used)
ALTER TABLE responses
  ADD COLUMN response_data JSONB DEFAULT NULL;

-- 4. Extend match_type enum with 'both_answered' for non-swipe question types
-- Using DO block because ADD VALUE IF NOT EXISTS doesn't work in transaction blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'both_answered'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'match_type')
  ) THEN
    ALTER TYPE match_type ADD VALUE 'both_answered';
  END IF;
END
$$;

-- 5. Add response_summary to matches table
-- This stores a summary of both partners' responses for display purposes
-- For swipe matches, this can remain NULL
-- For other types, it contains both responses for easy retrieval
ALTER TABLE matches
  ADD COLUMN response_summary JSONB DEFAULT NULL;

-- 6. Create storage bucket for response media (audio, photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('response-media', 'response-media', false)
ON CONFLICT (id) DO NOTHING;

-- 7. RLS policies for response-media bucket

-- Policy: Users can upload to their own folder (user_id/*)
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'response-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own uploads
CREATE POLICY "Users can update own uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'response-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'response-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own uploads
CREATE POLICY "Users can delete own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'response-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read from their couple's folder (their own + partner's uploads)
-- This allows partners to see each other's media in matches
CREATE POLICY "Users can read couple media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'response-media'
  AND (
    -- User can read their own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- User can read their partner's folder (same couple)
    (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM profiles p
      WHERE p.couple_id = (
        SELECT couple_id FROM profiles WHERE id = auth.uid()
      )
      AND p.couple_id IS NOT NULL
    )
  )
);

-- Add comments for documentation
COMMENT ON COLUMN questions.question_type IS 'The type of question: swipe (yes/no/maybe), text_answer, audio, photo, or who_likely';
COMMENT ON COLUMN questions.config IS 'Type-specific configuration as JSONB. Examples: {"max_length": 500} for text, {"max_duration_seconds": 60} for audio';
COMMENT ON COLUMN responses.response_data IS 'Type-specific response data as JSONB. Examples: {"text": "..."} for text_answer, {"url": "..."} for audio/photo, {"selection": "partner1"} for who_likely';
COMMENT ON COLUMN matches.response_summary IS 'Summary of both partners responses for display. Contains both response_data values keyed by user_id';
