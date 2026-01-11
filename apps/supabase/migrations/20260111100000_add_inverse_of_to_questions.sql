-- Add inverse_of column to questions table
-- This allows tracking when questions are inverses of each other
-- (e.g., "Do you want to give X?" and "Do you want to receive X?")
-- The "primary" question has inverse_of = NULL
-- The "secondary" (inverse) question points to its primary

-- Add the column
ALTER TABLE questions
ADD COLUMN inverse_of UUID REFERENCES questions(id) ON DELETE SET NULL;

-- Add a comment to document the column
COMMENT ON COLUMN questions.inverse_of IS 'References the primary question that this question is an inverse of. Used to track question pairs (e.g., give/receive). Primary questions have inverse_of = NULL, secondary questions point to their primary.';

-- Create an index for efficient lookups
CREATE INDEX idx_questions_inverse_of ON questions(inverse_of) WHERE inverse_of IS NOT NULL;

-- Create a function to get unique question count for a pack
-- Unique count = questions that are NOT inverses of another question (i.e., inverse_of IS NULL)
CREATE OR REPLACE FUNCTION get_pack_unique_question_count(pack_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM questions
  WHERE pack_id = pack_uuid
    AND inverse_of IS NULL
    AND deleted_at IS NULL;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_pack_unique_question_count(UUID) TO authenticated;

-- Create a view to get pack stats including both total and unique counts
CREATE OR REPLACE VIEW pack_question_stats AS
SELECT
  pack_id,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_questions,
  COUNT(*) FILTER (WHERE inverse_of IS NULL AND deleted_at IS NULL) AS unique_questions,
  COUNT(*) FILTER (WHERE inverse_of IS NOT NULL AND deleted_at IS NULL) AS inverse_questions
FROM questions
GROUP BY pack_id;

-- Grant select on the view
GRANT SELECT ON pack_question_stats TO authenticated;
