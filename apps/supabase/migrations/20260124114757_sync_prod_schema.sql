-- Sync migration: Make idempotent for production
-- Extensions
create extension if not exists "hypopg" with schema "extensions";
create extension if not exists "index_advisor" with schema "extensions";

-- Drop policy if exists (will be recreated at the end)
drop policy if exists "Anyone can view questions in visible packs" on "public"."questions";

-- Drop and recreate constraint (idempotent)
alter table "public"."question_packs" drop constraint if exists "question_packs_category_id_fkey";

-- Note: pack_question_stats view is NOT recreated here.
-- The original migration (20260111100000_add_inverse_of_to_questions.sql) creates it correctly.
-- Recreating it causes persistent diff noise due to pg_dump formatting differences.

-- Create tables if not exists
create table if not exists "public"."pack_topics" (
    "pack_id" uuid not null,
    "topic_id" uuid not null
);

alter table "public"."pack_topics" enable row level security;

create table if not exists "public"."topics" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "icon" text,
    "sort_order" integer default 0,
    "created_at" timestamp with time zone default now()
);

alter table "public"."topics" enable row level security;

-- Add columns if not exists
alter table "public"."admin_users" add column if not exists "permissions" jsonb default '[]'::jsonb;
alter table "public"."admin_users" disable row level security;

alter table "public"."ai_config" add column if not exists "cherry_pick_ensure_intensity_distribution" boolean default true;
alter table "public"."ai_config" add column if not exists "council_selection_mode" text default 'whole_set'::text;
alter table "public"."ai_config" add column if not exists "heuristic_keyword_triggers" text;
alter table "public"."ai_config" add column if not exists "heuristic_min_text_length" integer not null default 12;
alter table "public"."ai_config" add column if not exists "heuristic_record_reason" boolean not null default false;
alter table "public"."ai_config" add column if not exists "heuristic_skip_if_no_alnum" boolean not null default true;
alter table "public"."ai_config" add column if not exists "heuristic_skip_media_without_text" boolean not null default false;
alter table "public"."ai_config" add column if not exists "heuristic_use_default_keywords" boolean not null default true;
alter table "public"."ai_config" add column if not exists "heuristic_use_default_whitelist" boolean not null default true;
alter table "public"."ai_config" add column if not exists "heuristic_whitelist" text;
alter table "public"."ai_config" add column if not exists "heuristic_whitelist_max_length" integer not null default 30;
alter table "public"."ai_config" add column if not exists "heuristics_enabled" boolean not null default false;

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_pack_topics_pack_id ON public.pack_topics USING btree (pack_id);
CREATE UNIQUE INDEX IF NOT EXISTS pack_topics_pkey ON public.pack_topics USING btree (pack_id, topic_id);
CREATE UNIQUE INDEX IF NOT EXISTS topics_name_key ON public.topics USING btree (name);
CREATE UNIQUE INDEX IF NOT EXISTS topics_pkey ON public.topics USING btree (id);

-- Add constraints if not exists (check existence first)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pack_topics_pkey') THEN
        ALTER TABLE "public"."pack_topics" ADD CONSTRAINT "pack_topics_pkey" PRIMARY KEY USING INDEX "pack_topics_pkey";
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topics_pkey') THEN
        ALTER TABLE "public"."topics" ADD CONSTRAINT "topics_pkey" PRIMARY KEY USING INDEX "topics_pkey";
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_config_council_selection_mode_check') THEN
        ALTER TABLE "public"."ai_config" ADD CONSTRAINT "ai_config_council_selection_mode_check"
        CHECK ((council_selection_mode = ANY (ARRAY['whole_set'::text, 'cherry_pick'::text])));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pack_topics_pack_id_fkey') THEN
        ALTER TABLE "public"."pack_topics" ADD CONSTRAINT "pack_topics_pack_id_fkey"
        FOREIGN KEY (pack_id) REFERENCES public.question_packs(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pack_topics_topic_id_fkey') THEN
        ALTER TABLE "public"."pack_topics" ADD CONSTRAINT "pack_topics_topic_id_fkey"
        FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topics_name_key') THEN
        ALTER TABLE "public"."topics" ADD CONSTRAINT "topics_name_key" UNIQUE USING INDEX "topics_name_key";
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'question_packs_category_id_fkey') THEN
        ALTER TABLE "public"."question_packs" ADD CONSTRAINT "question_packs_category_id_fkey"
        FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;
    END IF;
END $$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_profiles_with_auth_info()
 RETURNS TABLE(id uuid, name text, email text, avatar_url text, is_premium boolean, couple_id uuid, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, email_confirmed_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT 
        p.id,
        COALESCE(p.name, au.raw_user_meta_data->>'name') as name,
        COALESCE(p.email, au.email) as email,
        p.avatar_url,
        p.is_premium,
        p.couple_id,
        p.created_at,
        au.last_sign_in_at,
        au.email_confirmed_at
    FROM profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    ORDER BY p.created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_media_files(user_id uuid)
 RETURNS TABLE(id uuid, name text, bucket_id text, created_at timestamp with time zone, metadata jsonb)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT 
    id,
    name,
    bucket_id,
    created_at,
    metadata
  FROM storage.objects
  WHERE bucket_id = 'chat-media'
    AND owner = user_id
  ORDER BY created_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_storage_usage()
 RETURNS TABLE(owner uuid, total_bytes bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT 
    owner,
    SUM((metadata->>'size')::bigint) as total_bytes
  FROM storage.objects
  WHERE bucket_id = 'chat-media'
    AND owner IS NOT NULL
  GROUP BY owner;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_videos()
 RETURNS TABLE(deleted_count integer, deleted_paths text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    expired_paths text[];
    count int;
BEGIN
    SELECT array_agg(media_path)
    INTO expired_paths
    FROM messages
    WHERE media_type = 'video'
      AND media_expires_at IS NOT NULL
      AND media_expires_at < NOW()
      AND media_expired = false
      AND media_path IS NOT NULL;

    WITH updated AS (
        UPDATE messages
        SET media_expired = true, media_path = NULL
        WHERE media_type = 'video'
          AND media_expires_at IS NOT NULL
          AND media_expires_at < NOW()
          AND media_expired = false
          AND media_path IS NOT NULL
        RETURNING 1
    )
    SELECT count(*) INTO count FROM updated;

    RETURN QUERY SELECT count, COALESCE(expired_paths, ARRAY[]::text[]);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pack_unique_question_count(pack_uuid uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM questions
  WHERE pack_id = pack_uuid
    AND inverse_of IS NULL
    AND deleted_at IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, created_at, updated_at, onboarding_completed)
  VALUES (NEW.id, NOW(), NOW(), false);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    PERFORM net.http_post(
        url := 'https://ckjcrkjpmhqhiucifukx.supabase.co/functions/v1/send-message-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'match_id', NEW.match_id,
            'sender_id', NEW.user_id
        )
    );

    RETURN NEW;
END;
$function$
;

-- pack_question_stats view creation removed - see comment at top of file


grant delete on table "public"."pack_topics" to "anon";

grant insert on table "public"."pack_topics" to "anon";

grant references on table "public"."pack_topics" to "anon";

grant select on table "public"."pack_topics" to "anon";

grant trigger on table "public"."pack_topics" to "anon";

grant truncate on table "public"."pack_topics" to "anon";

grant update on table "public"."pack_topics" to "anon";

grant delete on table "public"."pack_topics" to "authenticated";

grant insert on table "public"."pack_topics" to "authenticated";

grant references on table "public"."pack_topics" to "authenticated";

grant select on table "public"."pack_topics" to "authenticated";

grant trigger on table "public"."pack_topics" to "authenticated";

grant truncate on table "public"."pack_topics" to "authenticated";

grant update on table "public"."pack_topics" to "authenticated";

grant delete on table "public"."pack_topics" to "service_role";

grant insert on table "public"."pack_topics" to "service_role";

grant references on table "public"."pack_topics" to "service_role";

grant select on table "public"."pack_topics" to "service_role";

grant trigger on table "public"."pack_topics" to "service_role";

grant truncate on table "public"."pack_topics" to "service_role";

grant update on table "public"."pack_topics" to "service_role";

grant delete on table "public"."topics" to "anon";

grant insert on table "public"."topics" to "anon";

grant references on table "public"."topics" to "anon";

grant select on table "public"."topics" to "anon";

grant trigger on table "public"."topics" to "anon";

grant truncate on table "public"."topics" to "anon";

grant update on table "public"."topics" to "anon";

grant delete on table "public"."topics" to "authenticated";

grant insert on table "public"."topics" to "authenticated";

grant references on table "public"."topics" to "authenticated";

grant select on table "public"."topics" to "authenticated";

grant trigger on table "public"."topics" to "authenticated";

grant truncate on table "public"."topics" to "authenticated";

grant update on table "public"."topics" to "authenticated";

grant delete on table "public"."topics" to "service_role";

grant insert on table "public"."topics" to "service_role";

grant references on table "public"."topics" to "service_role";

grant select on table "public"."topics" to "service_role";

grant trigger on table "public"."topics" to "service_role";

grant truncate on table "public"."topics" to "service_role";

grant update on table "public"."topics" to "service_role";


-- Policies: drop if exists then create
drop policy if exists "Admins can view couple pack settings" on "public"."couple_packs";
create policy "Admins can view couple pack settings"
  on "public"."couple_packs"
  as permissive
  for select
  to public
using ((public.is_super_admin() OR public.has_permission('view_users'::text)));

drop policy if exists "Admins can delete pack_topics" on "public"."pack_topics";
create policy "Admins can delete pack_topics"
  on "public"."pack_topics"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));

drop policy if exists "Admins can insert pack_topics" on "public"."pack_topics";
create policy "Admins can insert pack_topics"
  on "public"."pack_topics"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));

drop policy if exists "Admins can update pack_topics" on "public"."pack_topics";
create policy "Admins can update pack_topics"
  on "public"."pack_topics"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));

drop policy if exists "Pack topics are viewable by authenticated users" on "public"."pack_topics";
create policy "Pack topics are viewable by authenticated users"
  on "public"."pack_topics"
  as permissive
  for select
  to authenticated
using (true);

drop policy if exists "Admins can delete topics" on "public"."topics";
create policy "Admins can delete topics"
  on "public"."topics"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));

drop policy if exists "Admins can insert topics" on "public"."topics";
create policy "Admins can insert topics"
  on "public"."topics"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));

drop policy if exists "Admins can update topics" on "public"."topics";
create policy "Admins can update topics"
  on "public"."topics"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.admin_users
  WHERE (admin_users.user_id = auth.uid()))));

drop policy if exists "Topics are viewable by authenticated users" on "public"."topics";
create policy "Topics are viewable by authenticated users"
  on "public"."topics"
  as permissive
  for select
  to authenticated
using (true);

-- This policy was dropped at the start, recreate it
create policy "Anyone can view questions in visible packs"
  on "public"."questions"
  as permissive
  for select
  to public
using (((deleted_at IS NULL) AND (pack_id IN ( SELECT question_packs.id
   FROM public.question_packs
  WHERE (((question_packs.is_public = true) OR ((question_packs.is_premium = true) AND (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.is_premium = true)))))) AND ((question_packs.category_id IS NULL) OR (EXISTS ( SELECT 1
           FROM public.categories c
          WHERE ((c.id = question_packs.category_id) AND (c.is_public = true))))))))));

-- Storage policies: drop if exists then create
drop policy if exists "Anyone can view avatars" on "storage"."objects";
create policy "Anyone can view avatars"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));

drop policy if exists "Users can delete own avatar" on "storage"."objects";
create policy "Users can delete own avatar"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

drop policy if exists "Users can update own avatar" on "storage"."objects";
create policy "Users can update own avatar"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

drop policy if exists "Users can upload own avatar" on "storage"."objects";
create policy "Users can upload own avatar"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



