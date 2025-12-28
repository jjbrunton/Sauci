-- Create feedback type enum
CREATE TYPE public.feedback_type AS ENUM ('bug', 'feature_request', 'general');

-- Create feedback status enum (for future admin use)
CREATE TYPE public.feedback_status AS ENUM ('new', 'reviewed', 'in_progress', 'resolved', 'closed');

-- Create feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Feedback content
  type public.feedback_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,

  -- Device info (JSONB for flexibility)
  device_info JSONB NOT NULL DEFAULT '{}',

  -- Admin/tracking fields
  status public.feedback_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX idx_feedback_type ON public.feedback(type);
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at DESC);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can insert their own feedback
CREATE POLICY "Users can create feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own feedback (only if still 'new' status)
CREATE POLICY "Users can update own pending feedback"
  ON public.feedback FOR UPDATE
  USING (auth.uid() = user_id AND status = 'new');

-- Create storage bucket for feedback screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for feedback screenshots
CREATE POLICY "Users can upload feedback screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own feedback screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
