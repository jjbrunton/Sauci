-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT,
    media_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT content_or_media CHECK (content IS NOT NULL OR media_path IS NOT NULL)
);

-- RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their matches"
    ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.id = messages.match_id
            AND m.couple_id IN (
                SELECT couple_id FROM public.profiles
                WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can insert messages in their matches"
    ON public.messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.id = messages.match_id
            AND m.couple_id IN (
                SELECT couple_id FROM public.profiles
                WHERE id = auth.uid()
            )
        )
    );

-- Storage bucket for chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload chat media"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'chat-media' AND
        auth.role() = 'authenticated'
    );
    
CREATE POLICY "Users can view chat media"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'chat-media');

-- Realtime
alter publication supabase_realtime add table messages;
