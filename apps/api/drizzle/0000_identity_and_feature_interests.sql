CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" text,
  "email" text,
  "avatar_url" text,
  "push_token" text,
  "is_premium" boolean DEFAULT false NOT NULL,
  "couple_id" uuid,
  "gender" text,
  "show_explicit_content" boolean DEFAULT true NOT NULL,
  "max_intensity" integer DEFAULT 5 NOT NULL,
  "public_key_jwk" jsonb,
  "hide_nsfw" boolean DEFAULT false NOT NULL,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "onboarding_version" integer DEFAULT 0 NOT NULL,
  "auth_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "profiles_gender_check" CHECK ("gender" IS NULL OR "gender" IN ('male', 'female', 'non-binary', 'prefer-not-to-say')),
  CONSTRAINT "profiles_max_intensity_check" CHECK ("max_intensity" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX "profiles_couple_id_idx" ON "profiles" USING btree ("couple_id");
--> statement-breakpoint
CREATE TABLE "feature_interests" (
  "user_id" uuid NOT NULL,
  "feature" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feature_interests_user_id_feature_pk" PRIMARY KEY("user_id", "feature")
);
--> statement-breakpoint
ALTER TABLE "feature_interests" ADD CONSTRAINT "feature_interests_user_id_profiles_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "feature_interests_feature_idx" ON "feature_interests" USING btree ("feature");
