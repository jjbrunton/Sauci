-- Add intensity levels for content balance

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS max_intensity INTEGER DEFAULT 2
CHECK (max_intensity >= 1 AND max_intensity <= 5);

UPDATE profiles
SET max_intensity = CASE
  WHEN show_explicit_content IS TRUE THEN 5
  ELSE 2
END
WHERE max_intensity IS NULL;

ALTER TABLE question_packs
ADD COLUMN IF NOT EXISTS min_intensity INTEGER,
ADD COLUMN IF NOT EXISTS max_intensity INTEGER,
ADD COLUMN IF NOT EXISTS avg_intensity NUMERIC(3,2);

CREATE OR REPLACE FUNCTION update_question_pack_intensity_stats(target_pack_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  UPDATE question_packs qp
  SET min_intensity = stats.min_intensity,
      max_intensity = stats.max_intensity,
      avg_intensity = stats.avg_intensity
  FROM (
    SELECT pack_id,
           MIN(intensity) AS min_intensity,
           MAX(intensity) AS max_intensity,
           ROUND(AVG(intensity)::numeric, 2) AS avg_intensity
    FROM questions
    WHERE pack_id = target_pack_id
    GROUP BY pack_id
  ) stats
  WHERE qp.id = stats.pack_id;

  IF NOT FOUND THEN
    UPDATE question_packs
    SET min_intensity = NULL,
        max_intensity = NULL,
        avg_intensity = NULL
    WHERE id = target_pack_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION handle_question_intensity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_question_pack_intensity_stats(OLD.pack_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.pack_id IS DISTINCT FROM OLD.pack_id THEN
    PERFORM update_question_pack_intensity_stats(OLD.pack_id);
  END IF;

  PERFORM update_question_pack_intensity_stats(NEW.pack_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS question_pack_intensity_stats ON questions;

CREATE TRIGGER question_pack_intensity_stats
AFTER INSERT OR UPDATE OR DELETE ON questions
FOR EACH ROW EXECUTE FUNCTION handle_question_intensity_change();

UPDATE question_packs qp
SET min_intensity = stats.min_intensity,
    max_intensity = stats.max_intensity,
    avg_intensity = stats.avg_intensity
FROM (
  SELECT pack_id,
         MIN(intensity) AS min_intensity,
         MAX(intensity) AS max_intensity,
         ROUND(AVG(intensity)::numeric, 2) AS avg_intensity
  FROM questions
  GROUP BY pack_id
) stats
WHERE qp.id = stats.pack_id;
