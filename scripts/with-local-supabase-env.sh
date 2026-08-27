#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${1:?usage: with-local-supabase-env.sh <web|admin|mobile|mcp|tests> <command...>}"
shift
[ "$#" -gt 0 ] || { echo "command is required" >&2; exit 2; }

STATUS_ENV="$(cd "$ROOT" && npx supabase status --workdir apps -o env 2>/dev/null)" || {
  echo "Local Supabase is not running. Run scripts/dev-local.sh up." >&2
  exit 1
}
eval "$STATUS_ENV"

case "${API_URL:-}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Refusing non-local Supabase URL: ${API_URL:-unset}" >&2; exit 1 ;;
esac

case "$PROFILE" in
  web)
    exec env NEXT_PUBLIC_SUPABASE_URL="$API_URL" "$@"
    ;;
  admin)
    exec env VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_ANON_KEY="$ANON_KEY" "$@"
    ;;
  mobile)
    exec env EXPO_PUBLIC_SUPABASE_URL="$API_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" "$@"
    ;;
  mcp)
    exec env PORT=3002 SUPABASE_URL="$API_URL" \
      SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
      SAUCI_MCP_API_KEY="local-sauci-mcp-only" "$@"
    ;;
  tests)
    exec env SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" \
      SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" "$@"
    ;;
  *) echo "unknown profile: $PROFILE" >&2; exit 2 ;;
esac
