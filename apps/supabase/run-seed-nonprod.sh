#!/bin/bash
# Run content seed against non-production database
#
# Usage: ./run-seed-nonprod.sh
#
# You'll be prompted for the database password.
# Get it from: Supabase Dashboard > Settings > Database > Database password

set -e

# Non-production database details
HOST="aws-0-eu-west-1.pooler.supabase.com"
PORT="6543"
USER="postgres.itbzhrvlgvdmzbnhzhyx"
DB="postgres"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="$SCRIPT_DIR/content-seed.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo "Error: Seed file not found at $SEED_FILE"
  exit 1
fi

echo "=== Running content seed against Sauci Non-Production ==="
echo "Host: $HOST"
echo "Database: $DB"
echo ""
echo "This will REPLACE all content (categories, topics, question_packs, questions, dare_packs, dares, pack_topics)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Running seed file (2782 lines)..."
echo ""

psql "postgresql://$USER@$HOST:$PORT/$DB?sslmode=require" -f "$SEED_FILE"

echo ""
echo "=== Done! ==="
