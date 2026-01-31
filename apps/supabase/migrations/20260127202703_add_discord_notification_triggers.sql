-- Helper function: sends a Discord notification via the send-discord-notification edge function
CREATE OR REPLACE FUNCTION public.notify_discord_event(p_event text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-discord-notification',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'event', p_event,
            'payload', p_payload
        )
    );
END;
$$;

-- Trigger function: new user signup
CREATE OR REPLACE FUNCTION public.notify_new_user_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.notify_discord_event(
        'new_user',
        jsonb_build_object(
            'user_id', NEW.id,
            'name', NEW.name,
            'email', NEW.email,
            'created_at', NEW.created_at
        )
    );

    RETURN NEW;
END;
$$;

-- Trigger function: couple paired (fires when second partner joins)
CREATE OR REPLACE FUNCTION public.notify_couple_paired_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_count integer;
    v_profiles jsonb;
BEGIN
    IF NEW.couple_id IS NULL OR OLD.couple_id IS NOT DISTINCT FROM NEW.couple_id THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO v_member_count
    FROM public.profiles
    WHERE couple_id = NEW.couple_id;

    IF v_member_count = 2 THEN
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'email', p.email
            )
            ORDER BY p.created_at
        )
        INTO v_profiles
        FROM public.profiles p
        WHERE p.couple_id = NEW.couple_id;

        PERFORM public.notify_discord_event(
            'couple_paired',
            jsonb_build_object(
                'couple_id', NEW.couple_id,
                'profiles', COALESCE(v_profiles, '[]'::jsonb),
                'paired_at', now()
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger function: feedback submitted
CREATE OR REPLACE FUNCTION public.notify_feedback_submitted_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user jsonb;
BEGIN
    SELECT jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', p.email
    )
    INTO v_user
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    PERFORM public.notify_discord_event(
        'feedback_submitted',
        jsonb_build_object(
            'feedback_id', NEW.id,
            'user_id', NEW.user_id,
            'type', NEW.type,
            'title', NEW.title,
            'description', NEW.description,
            'status', NEW.status,
            'screenshot_url', NEW.screenshot_url,
            'question_id', NEW.question_id,
            'created_at', NEW.created_at,
            'user', v_user
        )
    );

    RETURN NEW;
END;
$$;

-- Create triggers (drop first to be idempotent)
DROP TRIGGER IF EXISTS on_profile_created_discord ON public.profiles;
CREATE TRIGGER on_profile_created_discord
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_user_discord();

DROP TRIGGER IF EXISTS on_profile_couple_paired_discord ON public.profiles;
CREATE TRIGGER on_profile_couple_paired_discord
    AFTER UPDATE OF couple_id ON public.profiles
    FOR EACH ROW
    WHEN (OLD.couple_id IS DISTINCT FROM NEW.couple_id AND NEW.couple_id IS NOT NULL)
    EXECUTE FUNCTION public.notify_couple_paired_discord();

DROP TRIGGER IF EXISTS on_feedback_submitted_discord ON public.feedback;
CREATE TRIGGER on_feedback_submitted_discord
    AFTER INSERT ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_feedback_submitted_discord();
