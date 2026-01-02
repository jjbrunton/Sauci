-- Track user opt-ins for upcoming/coming-soon features

CREATE TABLE feature_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_name)
);

CREATE INDEX idx_feature_interests_user_id ON feature_interests(user_id);
CREATE INDEX idx_feature_interests_feature_name ON feature_interests(feature_name);

ALTER TABLE feature_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interests"
  ON feature_interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can express interest in features"
  ON feature_interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their interest"
  ON feature_interests FOR DELETE
  USING (auth.uid() = user_id);

