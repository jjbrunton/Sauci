ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "timezone" text;--> statement-breakpoint
COMMENT ON COLUMN "profiles"."timezone" IS 'IANA zone reported by the client. NULL falls back to UTC when bucketing the daily response limit.';
