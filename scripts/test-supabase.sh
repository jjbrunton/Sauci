#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v deno >/dev/null 2>&1 || {
  echo "Deno is required for Supabase function tests: https://docs.deno.com/runtime/getting_started/installation/" >&2
  exit 1
}

if ! (cd "$ROOT" && npx supabase status --workdir apps >/dev/null 2>&1); then
  echo "Local Supabase is not running. Start it with scripts/dev-local.sh up." >&2
  exit 1
fi

cd "$ROOT/apps/supabase/tests"
"$ROOT/scripts/with-local-supabase-env.sh" tests deno task test
