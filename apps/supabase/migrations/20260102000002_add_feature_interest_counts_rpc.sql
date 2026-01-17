-- Expose per-feature opt-in counts for admins

CREATE OR REPLACE FUNCTION public.get_feature_interest_counts()
RETURNS TABLE (
  feature_name TEXT,
  opt_in_count BIGINT,
  opt_in_count_last_7_days BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT has_permission('view_users') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    fi.feature_name,
    COUNT(*)::BIGINT AS opt_in_count,
    COUNT(*) FILTER (WHERE fi.created_at >= now() - interval '7 days')::BIGINT AS opt_in_count_last_7_days
  FROM public.feature_interests fi
  GROUP BY fi.feature_name
  ORDER BY opt_in_count DESC, fi.feature_name ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_feature_interest_counts() TO authenticated;
