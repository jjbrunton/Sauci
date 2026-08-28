CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "content" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz,
  "delivered_at" timestamptz,
  "deleted_at" timestamptz,
  "media_path" text,
  "media_type" text CHECK ("media_type" IS NULL OR "media_type" IN ('image', 'video')),
  "media_expires_at" timestamptz,
  "media_expired" boolean NOT NULL DEFAULT false,
  "media_viewed_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1,
  "encrypted_content" text,
  "encryption_iv" text,
  "keys_metadata" jsonb,
  "moderation_status" text,
  "flag_reason" text,
  "category" text,
  CONSTRAINT "messages_content_or_media" CHECK (
    "content" IS NOT NULL OR "media_path" IS NOT NULL OR "encrypted_content" IS NOT NULL
  )
);
--> statement-breakpoint
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "media_path" text,
  ADD COLUMN IF NOT EXISTS "media_type" text,
  ADD COLUMN IF NOT EXISTS "media_expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "media_expired" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "media_viewed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "encrypted_content" text,
  ADD COLUMN IF NOT EXISTS "encryption_iv" text,
  ADD COLUMN IF NOT EXISTS "keys_metadata" jsonb,
  ADD COLUMN IF NOT EXISTS "moderation_status" text,
  ADD COLUMN IF NOT EXISTS "flag_reason" text,
  ADD COLUMN IF NOT EXISTS "category" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_media_type_check"
    CHECK ("media_type" IS NULL OR "media_type" IN ('image', 'video'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_content_or_media"
    CHECK ("content" IS NOT NULL OR "media_path" IS NOT NULL OR "encrypted_content" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_match_created_idx" ON "messages" ("match_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_unread_idx" ON "messages" ("match_id", "user_id") WHERE "read_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_deletions" (
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "deleted_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("message_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "reporter_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "reason" text NOT NULL CHECK ("reason" IN ('harassment', 'spam', 'inappropriate_content', 'other')),
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'reviewed', 'dismissed')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("message_id", "reporter_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_reports_status_idx" ON "message_reports" ("status", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_typing_states" (
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  PRIMARY KEY ("match_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_typing_expires_idx" ON "chat_typing_states" ("expires_at");
