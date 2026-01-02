-- Migration: Sanitize public keys in profiles table
-- Description: Replaces base64 url unsafe characters (+, /) with safe ones (-, _) and removes padding (=) in 'n' and 'e' fields of public_key_jwk

DO $$
DECLARE
    r RECORD;
    new_n TEXT;
    new_e TEXT;
    original_n TEXT;
    original_e TEXT;
BEGIN
    FOR r IN SELECT id, public_key_jwk FROM profiles WHERE public_key_jwk IS NOT NULL LOOP
        original_n := r.public_key_jwk->>'n';
        original_e := r.public_key_jwk->>'e';
        
        IF original_n IS NOT NULL AND original_e IS NOT NULL THEN
            -- Sanitize 'n'
            new_n := REPLACE(original_n, '+', '-');
            new_n := REPLACE(new_n, '/', '_');
            new_n := REPLACE(new_n, '=', '');

            -- Sanitize 'e'
            new_e := REPLACE(original_e, '+', '-');
            new_e := REPLACE(new_e, '/', '_');
            new_e := REPLACE(new_e, '=', '');

            -- Update if changed
            IF new_n <> original_n OR new_e <> original_e THEN
                UPDATE profiles
                SET public_key_jwk = jsonb_set(
                    jsonb_set(public_key_jwk, '{n}', to_jsonb(new_n)),
                    '{e}',
                    to_jsonb(new_e)
                )
                WHERE id = r.id;
            END IF;
        END IF;
    END LOOP;
END $$;
