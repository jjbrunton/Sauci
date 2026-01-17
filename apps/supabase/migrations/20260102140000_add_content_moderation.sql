-- Add moderation columns to messages table
ALTER TABLE messages
ADD COLUMN moderation_status text DEFAULT 'unmoderated' CHECK (moderation_status IN ('unmoderated', 'safe', 'flagged')),
ADD COLUMN flag_reason text;
-- Add classifier configuration to ai_config table
ALTER TABLE ai_config
ADD COLUMN classifier_enabled boolean DEFAULT true,
ADD COLUMN classifier_model text DEFAULT 'openai/gpt-4o',
ADD COLUMN classifier_prompt text DEFAULT 'You are a content moderator for a couples app. Your task is to analyze the following message (text and/or image) and determine if it contains ILLEGAL or DANGEROUS content.

Sexual content (nudity, sexual acts, intimate conversations) is ALLOWED and should be marked as SAFE.

You must FLAG content ONLY if it falls into these categories:
1. Child Sexual Abuse Material (CSAM) or any depiction of minors in a sexual context.
2. Non-consensual sexual content (revenge porn, rape, assault).
3. Promotion of self-harm or suicide.
4. Human trafficking, terrorism, or extreme violence/gore.
5. Illegal drugs or weapons trafficking.

If the content is safe (including consensual adult sexual content), respond with {"status": "safe"}.
If the content is illegal/dangerous, respond with {"status": "flagged", "reason": "Brief explanation"}.

Response must be valid JSON.';
-- Function to trigger classification
CREATE OR REPLACE FUNCTION trigger_classify_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_classifier_enabled boolean;
BEGIN
    -- Check if classifier is enabled
    SELECT classifier_enabled INTO v_classifier_enabled
    FROM public.ai_config
    LIMIT 1;

    -- If enabled (or null which defaults to true conceptually, but let's be strict), trigger function
    IF v_classifier_enabled IS TRUE THEN
        PERFORM net.http_post(
            url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/classify-message',
            headers := jsonb_build_object(
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'message_id', NEW.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$;
-- Create trigger on messages table
CREATE TRIGGER on_message_created_classify
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_classify_message();
-- Add comments
COMMENT ON COLUMN messages.moderation_status IS 'Content moderation status: unmoderated, safe, or flagged.';
COMMENT ON COLUMN messages.flag_reason IS 'Reason for flagging the content (if status is flagged).';
