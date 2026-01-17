-- Add E2EE public key to profiles table
-- This migration adds a column to store user's RSA public key for E2EE

-- RSA public key in JWK format (JSON Web Key)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_key_jwk JSONB;
-- Index for efficient lookups when encrypting for partner
CREATE INDEX IF NOT EXISTS idx_profiles_couple_id_public_key ON profiles(couple_id) 
  WHERE public_key_jwk IS NOT NULL;
COMMENT ON COLUMN profiles.public_key_jwk IS 
  'RSA-2048 public key in JWK format for E2EE. Private key stored on device only.';
