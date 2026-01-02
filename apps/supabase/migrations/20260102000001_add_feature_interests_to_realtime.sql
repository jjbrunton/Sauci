-- Enable realtime updates for feature interest opt-ins

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'feature_interests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE feature_interests;
  END IF;
END $$;
