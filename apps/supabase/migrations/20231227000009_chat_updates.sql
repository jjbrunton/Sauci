-- Add read_at column
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Allow users to update read_at for messages where they are NOT the sender
CREATE POLICY "Users can mark messages as read"
    ON public.messages
    FOR UPDATE
    USING (
        auth.uid() != user_id AND
        EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.id = messages.match_id
            AND m.couple_id IN (
                SELECT couple_id FROM public.profiles
                WHERE id = auth.uid()
            )
        )
    )
    WITH CHECK (
        auth.uid() != user_id
    );
