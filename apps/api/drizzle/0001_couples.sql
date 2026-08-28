CREATE TABLE IF NOT EXISTS "couples" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "couples_invite_code_unique" UNIQUE("invite_code"),
	CONSTRAINT "couples_invite_code_format" CHECK ("invite_code" ~ '^[A-Z0-9]{8}$')
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_couple_id_couples_id_fk"
 FOREIGN KEY ("couple_id") REFERENCES "couples"("id") ON DELETE SET NULL;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
