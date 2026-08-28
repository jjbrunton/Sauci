-- A production schema sync replaced the signup trigger function without
-- copying auth.users.email. Redemption by email and admin user lookup both
-- depend on profiles.email being populated.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    created_at,
    updated_at,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW(),
    false
  );
  RETURN NEW;
END;
$function$;

UPDATE public.profiles AS profile
SET email = auth_user.email,
    updated_at = NOW()
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND profile.email IS NULL
  AND auth_user.email IS NOT NULL;
