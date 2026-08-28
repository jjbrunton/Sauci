-- Add reversible catalogue review metadata without changing customer visibility.
--
-- IMPORTANT: Current mobile/API queries intentionally do not filter content_status.
-- This migration only prepares and audits the catalogue for a later, separately
-- verified enforcement release.

CREATE TYPE public.content_review_status AS ENUM (
  'unreviewed',
  'allowed',
  'archived'
);

CREATE TYPE public.content_entity_type AS ENUM (
  'categories',
  'question_packs',
  'questions',
  'dare_packs',
  'dares'
);

ALTER TABLE public.categories
  ADD COLUMN content_status public.content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN content_review_reason TEXT,
  ADD COLUMN content_reviewed_at TIMESTAMPTZ,
  ADD COLUMN content_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.question_packs
  ADD COLUMN content_status public.content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN content_review_reason TEXT,
  ADD COLUMN content_reviewed_at TIMESTAMPTZ,
  ADD COLUMN content_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.questions
  ADD COLUMN content_status public.content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN content_review_reason TEXT,
  ADD COLUMN content_reviewed_at TIMESTAMPTZ,
  ADD COLUMN content_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.dare_packs
  ADD COLUMN content_status public.content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN content_review_reason TEXT,
  ADD COLUMN content_reviewed_at TIMESTAMPTZ,
  ADD COLUMN content_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.dares
  ADD COLUMN content_status public.content_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN content_review_reason TEXT,
  ADD COLUMN content_reviewed_at TIMESTAMPTZ,
  ADD COLUMN content_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.categories.content_status IS
  'Editorial review metadata only. Customer visibility does not yet filter this column.';
COMMENT ON COLUMN public.question_packs.content_status IS
  'Editorial review metadata only. Customer visibility does not yet filter this column.';
COMMENT ON COLUMN public.questions.content_status IS
  'Editorial review metadata only. Customer visibility does not yet filter this column.';
COMMENT ON COLUMN public.dare_packs.content_status IS
  'Editorial review metadata only. Customer visibility does not yet filter this column.';
COMMENT ON COLUMN public.dares.content_status IS
  'Editorial review metadata only. Customer visibility does not yet filter this column.';

CREATE INDEX categories_content_status_idx
  ON public.categories (content_status, sort_order);
CREATE INDEX question_packs_content_status_idx
  ON public.question_packs (content_status, is_public, category_id, sort_order);
CREATE INDEX questions_content_status_idx
  ON public.questions (content_status, pack_id, intensity)
  WHERE deleted_at IS NULL;
CREATE INDEX dare_packs_content_status_idx
  ON public.dare_packs (content_status, is_public, category_id, sort_order);
CREATE INDEX dares_content_status_idx
  ON public.dares (content_status, pack_id, intensity);

CREATE TABLE public.content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.content_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  previous_status public.content_review_status NOT NULL,
  new_status public.content_review_status NOT NULL,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_reviews IS
  'Append-only audit history for reversible catalogue review decisions.';

CREATE INDEX content_reviews_entity_idx
  ON public.content_reviews (entity_type, entity_id, created_at DESC);
CREATE INDEX content_reviews_created_at_idx
  ON public.content_reviews (created_at DESC);

ALTER TABLE public.content_reviews ENABLE ROW LEVEL SECURITY;

-- Supabase grants broad privileges to API roles through default privileges.
-- Remove them before restoring the one intended authenticated capability.
REVOKE ALL PRIVILEGES ON TABLE public.content_reviews FROM anon, authenticated;

CREATE POLICY "Super admins can view content review history"
  ON public.content_reviews
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

GRANT SELECT ON public.content_reviews TO authenticated;
GRANT ALL ON public.content_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_new_content_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Every new catalogue row enters the review queue. Callers cannot combine
  -- creation and approval or forge reviewer metadata in one INSERT.
  NEW.content_status := 'unreviewed';
  NEW.content_review_reason := NULL;
  NEW.content_reviewed_at := NULL;
  NEW.content_reviewed_by := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_content_review_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  visible_column TEXT;
  visible_content_changed BOOLEAN := FALSE;
  explicit_status_change BOOLEAN :=
    NEW.content_status IS DISTINCT FROM OLD.content_status;
  explicit_reason_change BOOLEAN :=
    NEW.content_review_reason IS DISTINCT FROM OLD.content_review_reason;
  explicit_reviewer_metadata_change BOOLEAN :=
    NEW.content_reviewed_at IS DISTINCT FROM OLD.content_reviewed_at
    OR NEW.content_reviewed_by IS DISTINCT FROM OLD.content_reviewed_by;
BEGIN
  FOREACH visible_column IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) -> visible_column) IS DISTINCT FROM
       (to_jsonb(OLD) -> visible_column) THEN
      visible_content_changed := TRUE;
      EXIT;
    END IF;
  END LOOP;

  -- An explicit status/reason update is a review decision, including a
  -- same-status re-review with a new reason. Reviewer identity and time are
  -- always derived here rather than trusted from client input.
  IF explicit_status_change OR explicit_reason_change THEN
    IF auth.role() = 'anon'
       OR (auth.uid() IS NOT NULL AND NOT public.is_super_admin()) THEN
      RAISE EXCEPTION 'Only super admins can make catalogue review decisions';
    END IF;

    IF explicit_status_change AND NOT explicit_reason_change THEN
      RAISE EXCEPTION 'A new content_review_reason is required when content_status changes';
    END IF;

    IF NULLIF(btrim(NEW.content_review_reason), '') IS NULL THEN
      RAISE EXCEPTION 'A non-blank content_review_reason is required when content_status changes';
    END IF;

    IF NEW.content_status = 'unreviewed' THEN
      NEW.content_reviewed_at := NULL;
      NEW.content_reviewed_by := NULL;
    ELSE
      NEW.content_reviewed_at := now();
      NEW.content_reviewed_by := auth.uid();
    END IF;
  -- A material content edit without an explicit review decision invalidates
  -- the prior decision. This path is available to ordinary content editors.
  ELSIF visible_content_changed THEN
    NEW.content_status := 'unreviewed';
    NEW.content_review_reason := 'Visible content changed; review required';
    NEW.content_reviewed_at := NULL;
    NEW.content_reviewed_by := NULL;
  ELSIF explicit_reviewer_metadata_change THEN
    -- Permit only the database-internal ON DELETE SET NULL action from the
    -- auth.users foreign key. JWT-backed anon/service calls have an auth role;
    -- direct client attempts therefore cannot use this exception.
    IF auth.uid() IS NULL
       AND auth.role() IS NULL
       AND NEW.content_reviewed_by IS NULL
       AND NEW.content_reviewed_at IS NOT DISTINCT FROM OLD.content_reviewed_at THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'content_reviewed_at and content_reviewed_by are database-managed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_content_review_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.content_status IS DISTINCT FROM OLD.content_status
     OR NEW.content_review_reason IS DISTINCT FROM OLD.content_review_reason THEN
    INSERT INTO public.content_reviews (
      entity_type,
      entity_id,
      previous_status,
      new_status,
      reason,
      changed_by
    ) VALUES (
      TG_TABLE_NAME::public.content_entity_type,
      NEW.id,
      OLD.content_status,
      NEW.content_status,
      NEW.content_review_reason,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- These functions are trigger-only. Revoking direct execution keeps their
-- SECURITY DEFINER privileges unavailable as a general authenticated API.
REVOKE ALL ON FUNCTION public.prepare_content_review_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_content_review_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_new_content_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_content_review_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_content_review_change() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_new_content_review() FROM anon, authenticated;

CREATE TRIGGER categories_prepare_new_content_review
  BEFORE INSERT ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_new_content_review();
CREATE TRIGGER question_packs_prepare_new_content_review
  BEFORE INSERT ON public.question_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_new_content_review();
CREATE TRIGGER questions_prepare_new_content_review
  BEFORE INSERT ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_new_content_review();
CREATE TRIGGER dare_packs_prepare_new_content_review
  BEFORE INSERT ON public.dare_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_new_content_review();
CREATE TRIGGER dares_prepare_new_content_review
  BEFORE INSERT ON public.dares
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_new_content_review();

CREATE TRIGGER categories_prepare_content_review
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_content_review_change(
    'name', 'description', 'icon', 'color'
  );
CREATE TRIGGER categories_audit_content_review
  AFTER UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_content_review_change();

CREATE TRIGGER question_packs_prepare_content_review
  BEFORE UPDATE ON public.question_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_content_review_change(
    'name', 'description', 'icon', 'category_id', 'is_explicit'
  );
CREATE TRIGGER question_packs_audit_content_review
  AFTER UPDATE ON public.question_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_content_review_change();

CREATE TRIGGER questions_prepare_content_review
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_content_review_change(
    'text',
    'partner_text',
    'pack_id',
    'intensity',
    'question_type',
    'config',
    'required_props',
    'allowed_couple_genders',
    'target_user_genders',
    'inverse_of',
    'deleted_at'
  );
CREATE TRIGGER questions_audit_content_review
  AFTER UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_content_review_change();

CREATE TRIGGER dare_packs_prepare_content_review
  BEFORE UPDATE ON public.dare_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_content_review_change(
    'name', 'description', 'icon', 'category_id', 'is_explicit'
  );
CREATE TRIGGER dare_packs_audit_content_review
  AFTER UPDATE ON public.dare_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_content_review_change();

CREATE TRIGGER dares_prepare_content_review
  BEFORE UPDATE ON public.dares
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_content_review_change(
    'text',
    'pack_id',
    'intensity',
    'suggested_duration_hours'
  );
CREATE TRIGGER dares_audit_content_review
  AFTER UPDATE ON public.dares
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_content_review_change();

-- Stage the conservative archive set by immutable production IDs. This does not
-- change is_public, deleted_at, RLS, RPC selection, or current application output.
WITH archive_packs(id) AS (
  VALUES
    ('9049a67a-a103-4ea3-8405-87dcaefc57ab'::UUID),
    ('3c17764d-dd11-4103-8a4f-ce6561fd2a1a'::UUID),
    ('f0a2e7e5-554c-49c4-aa15-42d83b016349'::UUID),
    ('d2000000-0000-0000-0000-000000000003'::UUID),
    ('40838dee-0af4-43c7-9d6c-6228d09f91bc'::UUID),
    ('d2000000-0000-0000-0000-000000000002'::UUID),
    ('44295bd5-fda3-4ed6-8aa6-d5c7e811348e'::UUID),
    ('c7244576-f40d-4cdf-804a-788d2b9c1fce'::UUID),
    ('7eabdfae-e70d-4be8-9b10-b43fee955312'::UUID),
    ('374e10a6-6ae9-45c6-bee4-b8be0e617b79'::UUID),
    ('dd143c55-c0a4-4884-a704-1d4d1325cbc2'::UUID),
    ('035c47a6-858c-46fb-8ee3-84889399dca0'::UUID),
    ('8bf628d0-2a83-4a12-a66b-39b0d6ff1e86'::UUID),
    ('42331f68-60f5-4768-af26-b42c4e96c867'::UUID),
    ('379d6a44-60a3-4ec9-98cc-eda46547cb23'::UUID),
    ('e5aefe29-1ada-4fe5-a4ee-25342917f02c'::UUID),
    ('bed94ed6-c065-4ff9-9d7f-02de6cade971'::UUID),
    ('eb3cbe67-23d8-4c0e-9c6f-dc1583609a26'::UUID),
    ('d18f6d4a-4a32-4687-8938-2a53a7d82739'::UUID),
    ('b2df6b3b-4bb5-4baa-a29c-a3955187511c'::UUID),
    ('d73e9818-4faa-4276-9a93-7c60cff9cdb1'::UUID),
    ('7951e8c4-c7d4-4460-a3f5-495ccf5ca0cb'::UUID),
    ('f0f597b1-889c-4537-beeb-d0f459bb7907'::UUID),
    ('46288aa4-271c-44cf-bfe2-d25662d3f9f8'::UUID),
    ('d2000000-0000-0000-0000-000000000001'::UUID),
    ('07f0da41-8ef7-4a48-8ec9-cef2dabaee73'::UUID),
    ('42c00d6c-ab1f-42ce-afb0-00839064263b'::UUID),
    ('8a1e8650-a192-4f2e-86b0-0ec7bf6fb61c'::UUID),
    ('d5d1b8d2-a868-4150-86bc-da3f8e3e8b00'::UUID),
    ('19e4ddbd-a4aa-4b26-80bb-53b7187f0eba'::UUID)
)
UPDATE public.question_packs qp
SET
  content_status = 'archived',
  content_review_reason = 'Conservative archive candidate following the 2026-02-03 store rejection',
  content_reviewed_at = now(),
  content_reviewed_by = NULL
FROM archive_packs ap
WHERE qp.id = ap.id;

WITH archive_packs(id) AS (
  VALUES
    ('9049a67a-a103-4ea3-8405-87dcaefc57ab'::UUID),
    ('3c17764d-dd11-4103-8a4f-ce6561fd2a1a'::UUID),
    ('f0a2e7e5-554c-49c4-aa15-42d83b016349'::UUID),
    ('d2000000-0000-0000-0000-000000000003'::UUID),
    ('40838dee-0af4-43c7-9d6c-6228d09f91bc'::UUID),
    ('d2000000-0000-0000-0000-000000000002'::UUID),
    ('44295bd5-fda3-4ed6-8aa6-d5c7e811348e'::UUID),
    ('c7244576-f40d-4cdf-804a-788d2b9c1fce'::UUID),
    ('7eabdfae-e70d-4be8-9b10-b43fee955312'::UUID),
    ('374e10a6-6ae9-45c6-bee4-b8be0e617b79'::UUID),
    ('dd143c55-c0a4-4884-a704-1d4d1325cbc2'::UUID),
    ('035c47a6-858c-46fb-8ee3-84889399dca0'::UUID),
    ('8bf628d0-2a83-4a12-a66b-39b0d6ff1e86'::UUID),
    ('42331f68-60f5-4768-af26-b42c4e96c867'::UUID),
    ('379d6a44-60a3-4ec9-98cc-eda46547cb23'::UUID),
    ('e5aefe29-1ada-4fe5-a4ee-25342917f02c'::UUID),
    ('bed94ed6-c065-4ff9-9d7f-02de6cade971'::UUID),
    ('eb3cbe67-23d8-4c0e-9c6f-dc1583609a26'::UUID),
    ('d18f6d4a-4a32-4687-8938-2a53a7d82739'::UUID),
    ('b2df6b3b-4bb5-4baa-a29c-a3955187511c'::UUID),
    ('d73e9818-4faa-4276-9a93-7c60cff9cdb1'::UUID),
    ('7951e8c4-c7d4-4460-a3f5-495ccf5ca0cb'::UUID),
    ('f0f597b1-889c-4537-beeb-d0f459bb7907'::UUID),
    ('46288aa4-271c-44cf-bfe2-d25662d3f9f8'::UUID),
    ('d2000000-0000-0000-0000-000000000001'::UUID),
    ('07f0da41-8ef7-4a48-8ec9-cef2dabaee73'::UUID),
    ('42c00d6c-ab1f-42ce-afb0-00839064263b'::UUID),
    ('8a1e8650-a192-4f2e-86b0-0ec7bf6fb61c'::UUID),
    ('d5d1b8d2-a868-4150-86bc-da3f8e3e8b00'::UUID),
    ('19e4ddbd-a4aa-4b26-80bb-53b7187f0eba'::UUID)
)
UPDATE public.questions q
SET
  content_status = 'archived',
  content_review_reason = 'Archived with its pack pending rewrite',
  content_reviewed_at = now(),
  content_reviewed_by = NULL
FROM archive_packs ap
WHERE q.pack_id = ap.id;
