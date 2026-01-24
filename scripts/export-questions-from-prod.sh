#!/bin/bash
# Export questions from production and generate SQL for non-prod
# Usage: ./scripts/export-questions-from-prod.sh > apps/supabase/seed-questions.sql

# Production database connection string
# Get this from Supabase Dashboard > Settings > Database > Connection string
PROD_DB_URL="${PROD_DATABASE_URL:-}"

if [ -z "$PROD_DB_URL" ]; then
  echo "Error: PROD_DATABASE_URL environment variable is not set" >&2
  echo "Get it from: Supabase Dashboard > Settings > Database > Connection string (URI)" >&2
  exit 1
fi

echo "-- Questions exported from production"
echo "-- Generated on $(date)"
echo ""
echo "BEGIN;"
echo ""

# Export questions as SQL INSERT statements
psql "$PROD_DB_URL" -t -A -c "
SELECT 'INSERT INTO questions (id, pack_id, text, intensity, partner_text, allowed_couple_genders, target_user_genders, required_props, deleted_at, inverse_of, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(pack_id) || ', ' ||
  quote_literal(text) || ', ' ||
  COALESCE(intensity::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(partner_text), 'NULL') || ', ' ||
  COALESCE(quote_literal(allowed_couple_genders::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(target_user_genders::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(required_props::text), 'NULL') || ', ' ||
  COALESCE(quote_literal(deleted_at::text), 'NULL') || ', ' ||
  'NULL, ' ||  -- inverse_of set to NULL initially
  quote_literal(created_at::text) ||
  ') ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, intensity = EXCLUDED.intensity, partner_text = EXCLUDED.partner_text, allowed_couple_genders = EXCLUDED.allowed_couple_genders, target_user_genders = EXCLUDED.target_user_genders, required_props = EXCLUDED.required_props;'
FROM questions
ORDER BY pack_id, intensity;
"

echo ""
echo "-- Update inverse_of references"

# Export inverse_of updates
psql "$PROD_DB_URL" -t -A -c "
SELECT 'UPDATE questions SET inverse_of = ' || quote_literal(inverse_of) || ' WHERE id = ' || quote_literal(id) || ';'
FROM questions
WHERE inverse_of IS NOT NULL;
"

echo ""
echo "-- Insert pack_topics"

# Export pack_topics
psql "$PROD_DB_URL" -t -A -c "
SELECT 'INSERT INTO pack_topics (pack_id, topic_id) VALUES (' ||
  quote_literal(pack_id) || ', ' ||
  quote_literal(topic_id) ||
  ') ON CONFLICT DO NOTHING;'
FROM pack_topics;
"

echo ""
echo "COMMIT;"
echo ""
echo "-- Done"
