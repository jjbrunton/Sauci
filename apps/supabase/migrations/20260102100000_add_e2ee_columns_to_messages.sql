-- Add E2EE support to messages table
-- This migration adds columns for end-to-end encryption of chat messages

-- Version indicator: 1 = plaintext (legacy), 2 = E2EE
ALTER TABLE messages ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
-- Encrypted message content (base64 encoded ciphertext)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_content TEXT;
-- Initialization vector for AES-GCM (base64 encoded, 12 bytes)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encryption_iv TEXT;
-- Triple-wrapped encryption keys and metadata
ALTER TABLE messages ADD COLUMN IF NOT EXISTS keys_metadata JSONB;
-- Add comment for documentation
COMMENT ON COLUMN messages.version IS 
  'Encryption version: 1 = plaintext (legacy), 2 = E2EE with triple-wrapped keys';
-- Constraint: v2 messages must have encryption fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'e2ee_fields_required'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT e2ee_fields_required 
      CHECK (version = 1 OR (version = 2 AND encryption_iv IS NOT NULL AND keys_metadata IS NOT NULL));
  END IF;
END $$;
