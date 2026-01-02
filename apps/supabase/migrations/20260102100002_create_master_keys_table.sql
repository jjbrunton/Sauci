-- Create master_keys table for admin E2EE access
-- This migration creates the table to store admin RSA public keys for moderation

CREATE TABLE IF NOT EXISTS master_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name TEXT UNIQUE NOT NULL,
    public_key_jwk JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    rotated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Add table comment
COMMENT ON TABLE master_keys IS 
  'Stores admin RSA public keys for E2EE moderation access. Private key stored securely in environment variables.';

-- Enable RLS
ALTER TABLE master_keys ENABLE ROW LEVEL SECURITY;

-- Super admins can view master keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can view master keys' AND tablename = 'master_keys'
  ) THEN
    CREATE POLICY "Super admins can view master keys"
      ON master_keys FOR SELECT
      TO authenticated
      USING (is_super_admin(auth.uid()));
  END IF;
END $$;

-- Super admins can insert master keys  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can insert master keys' AND tablename = 'master_keys'
  ) THEN
    CREATE POLICY "Super admins can insert master keys"
      ON master_keys FOR INSERT
      TO authenticated
      WITH CHECK (is_super_admin(auth.uid()));
  END IF;
END $$;

-- Super admins can update master keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Super admins can update master keys' AND tablename = 'master_keys'
  ) THEN
    CREATE POLICY "Super admins can update master keys"
      ON master_keys FOR UPDATE
      TO authenticated
      USING (is_super_admin(auth.uid()));
  END IF;
END $$;

-- Allow all authenticated users to read active master key public keys (needed for encryption)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active master key public keys' AND tablename = 'master_keys'
  ) THEN
    CREATE POLICY "Anyone can read active master key public keys"
      ON master_keys FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END $$;
