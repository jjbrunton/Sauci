-- Table to track user interest in upcoming features
CREATE TABLE feature_interests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure a user can only express interest in a feature once
    UNIQUE(user_id, feature_name)
);
-- Index for querying by feature
CREATE INDEX idx_feature_interests_feature_name ON feature_interests(feature_name);
-- Index for querying by user
CREATE INDEX idx_feature_interests_user_id ON feature_interests(user_id);
-- Enable RLS
ALTER TABLE feature_interests ENABLE ROW LEVEL SECURITY;
-- Users can insert their own interest
CREATE POLICY "Users can express interest in features"
ON feature_interests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
-- Users can view their own interests
CREATE POLICY "Users can view their own interests"
ON feature_interests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
-- Users can delete their own interests
CREATE POLICY "Users can remove their interest"
ON feature_interests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
-- Grant service role full access for admin queries
GRANT ALL ON feature_interests TO service_role;
