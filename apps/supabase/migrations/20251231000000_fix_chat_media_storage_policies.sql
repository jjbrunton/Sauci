-- Fix storage policies that incorrectly reference p.name instead of storage.objects.name
-- Bug: Using unqualified "name" in a subquery with profiles table causes Postgres to resolve
--      it to profiles.name instead of storage.objects.name
-- Fix: Explicitly qualify as storage.objects.name to reference the storage object's file path

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can upload chat media to their matches" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat media in their matches" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat media" ON storage.objects;
-- Recreate with explicit table qualification to avoid column name ambiguity
CREATE POLICY "Users can upload chat media to their matches"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN profiles p ON p.couple_id = m.couple_id
      WHERE (storage.foldername(storage.objects.name))[1] = m.id::text
      AND p.id = auth.uid()
    )
  );
CREATE POLICY "Users can view chat media in their matches"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN profiles p ON p.couple_id = m.couple_id
      WHERE (storage.foldername(storage.objects.name))[1] = m.id::text
      AND p.id = auth.uid()
    )
  );
CREATE POLICY "Users can delete their own chat media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM matches m
      JOIN profiles p ON p.couple_id = m.couple_id
      WHERE (storage.foldername(storage.objects.name))[1] = m.id::text
      AND p.id = auth.uid()
    )
  );
