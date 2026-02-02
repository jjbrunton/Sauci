-- Change Discord new_user notification from profile creation to onboarding completion
-- This way we only get notified about users who actually complete onboarding

-- Update the trigger function to include onboarding data
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
            'gender', NEW.gender,
            'usage_reason', NEW.usage_reason,
            'created_at', NEW.created_at
        )
    );

    RETURN NEW;
END;
$$;

-- Drop the old INSERT trigger and create an UPDATE trigger on onboarding_completed
DROP TRIGGER IF EXISTS on_profile_created_discord ON public.profiles;

CREATE TRIGGER on_onboarding_completed_discord
    AFTER UPDATE OF onboarding_completed ON public.profiles
    FOR EACH ROW
    WHEN (OLD.onboarding_completed IS DISTINCT FROM NEW.onboarding_completed AND NEW.onboarding_completed = true)
    EXECUTE FUNCTION public.notify_new_user_discord();
