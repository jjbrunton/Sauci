#!/usr/bin/env bash
set -euo pipefail

SESSION="sauci-dev"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/backend/compose.yaml"
COMPOSE_PROJECT="sauci-local"
POSTGRES_PORT="${SAUCI_POSTGRES_PORT:-54320}"
API_PORT="${SAUCI_API_PORT:-3003}"
LOCAL_DATABASE_URL="postgresql://sauci:sauci_local_only@127.0.0.1:${POSTGRES_PORT}/sauci"
LOCAL_API_URL="http://127.0.0.1:${API_PORT}"
MOBILE_API_URL="${SAUCI_MOBILE_API_URL:-$LOCAL_API_URL}"
AUTH_URL="${SUPABASE_AUTH_URL:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
AUTH_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
LOCAL_ADMIN_SERVICE_USER_ID="${ADMIN_API_SERVICE_USER_ID:-00000000-0000-4000-8000-000000000002}"
LOCAL_ADMIN_SERVICE_TOKEN="${ADMIN_API_SERVICE_TOKEN:-local-sauci-admin-service-token-123456789}"
LOCAL_MCP_API_KEY="${SAUCI_MCP_API_KEY:-local-sauci-mcp-only}"

SERVERS=(
  "api|env PORT=$API_PORT DATABASE_URL=$LOCAL_DATABASE_URL SUPABASE_AUTH_URL=$AUTH_URL ADMIN_API_SERVICE_USER_ID=$LOCAL_ADMIN_SERVICE_USER_ID ADMIN_API_SERVICE_TOKEN=$LOCAL_ADMIN_SERVICE_TOKEN MEDIA_ROOT=$ROOT/.local/media MEDIA_SIGNING_SECRET=local-media-signing-secret-change-me-123456 MEDIA_PUBLIC_BASE_URL=http://127.0.0.1:$API_PORT npm run dev -w @sauci/api"
  "worker|env DATABASE_URL=$LOCAL_DATABASE_URL CLASSIFIER_ENABLED=false MEDIA_ROOT=$ROOT/.local/media MEDIA_SIGNING_SECRET=local-media-signing-secret-change-me-123456 MEDIA_PUBLIC_BASE_URL=http://127.0.0.1:$API_PORT npm run dev:worker -w @sauci/api"
  "web|env NEXT_PUBLIC_API_URL=$LOCAL_API_URL npm run dev -w @sauci/web -- --port 3000"
  "admin|env VITE_API_URL=$LOCAL_API_URL npm run dev -w @sauci/admin -- --host 127.0.0.1 --port 3001"
  "mcp|env PORT=3002 SAUCI_ADMIN_API_URL=$LOCAL_API_URL SAUCI_ADMIN_API_TOKEN=$LOCAL_ADMIN_SERVICE_TOKEN SAUCI_MCP_API_KEY=$LOCAL_MCP_API_KEY npm run dev -w sauci-mcp-server"
  "mobile|env EXPO_PUBLIC_API_URL=$MOBILE_API_URL EXPO_PUBLIC_SUPABASE_URL=$AUTH_URL EXPO_PUBLIC_SUPABASE_ANON_KEY=$AUTH_ANON_KEY npm run dev -w @sauci/mobile -- --port 8081 --localhost"
)

PORTS=(
  "postgres:$POSTGRES_PORT"
  "api:$API_PORT"
  "web:3000"
  "admin:3001"
  "mcp:3002"
  "metro:8081"
)

c_reset=$'\033[0m'; c_dim=$'\033[2m'; c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_red=$'\033[31m'; c_cyn=$'\033[36m'
info() { printf "${c_cyn}▸ %s${c_reset}\n" "$*"; }
ok() { printf "${c_grn}✓ %s${c_reset}\n" "$*"; }
warn() { printf "${c_ylw}! %s${c_reset}\n" "$*"; }
die() { printf "${c_red}✗ %s${c_reset}\n" "$*" >&2; exit 1; }
port_up() { lsof -ti :"$1" -sTCP:LISTEN >/dev/null 2>&1; }

compose() {
  docker compose --project-name "$COMPOSE_PROJECT" --file "$COMPOSE_FILE" "$@"
}

preflight() {
  command -v tmux >/dev/null 2>&1 || die "tmux not found. Install: brew install tmux"
  command -v npm >/dev/null 2>&1 || die "npm not found. Install Node $(cat "$ROOT/.nvmrc")."
  command -v docker >/dev/null 2>&1 || die "Docker-compatible CLI not found."
  docker info >/dev/null 2>&1 || die "Container runtime is not running."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
  [ -d "$ROOT/node_modules" ] || die "Dependencies missing. Run: npm ci"
  local node_major
  node_major="$(node -p 'process.versions.node.split(`.`)[0]')"
  [ "$node_major" = "20" ] || die "Node 20 is required. Activate .nvmrc before starting the stack."
}

assert_local_database() {
  case "$LOCAL_DATABASE_URL" in
    postgresql://*@127.0.0.1:"$POSTGRES_PORT"/sauci|postgresql://*@localhost:"$POSTGRES_PORT"/sauci) ;;
    *) die "Refusing database operation against non-local URL: $LOCAL_DATABASE_URL" ;;
  esac
  [ "$POSTGRES_PORT" = "54320" ] || die "Destructive reset requires the dedicated local PostgreSQL port 54320."
}

assert_local_auth() {
  case "$AUTH_URL" in
    http://127.0.0.1:*|http://localhost:*|http://\[::1\]:*) ;;
    *) die "Refusing local development against non-local Supabase Auth: $AUTH_URL" ;;
  esac
}

ensure_infra() {
  info "Starting standalone PostgreSQL"
  compose up --detach --wait postgres
  ok "PostgreSQL is healthy on 127.0.0.1:$POSTGRES_PORT"
}

api_workspace_exists() {
  [ -f "$ROOT/apps/api/package.json" ]
}

run_api_script() {
  local script="$1"
  api_workspace_exists || die "apps/api is not present yet; cannot run db:$script"
  (cd "$ROOT" && env DATABASE_URL="$LOCAL_DATABASE_URL" npm run "db:$script" -w @sauci/api)
}

start_window() {
  local name="$1" cmd="$2"
  if tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$name"; then
    warn "window '$name' already exists"
    return
  fi
  if [ "$name" = "api" ] && ! api_workspace_exists; then
    warn "apps/api is not present yet; skipping API window"
    return
  fi
  tmux new-window -t "$SESSION" -n "$name" -c "$ROOT"
  tmux send-keys -t "$SESSION:$name" "$cmd" C-m
}

port_check() {
  printf "  Port status (${c_dim}· = stopped or starting${c_reset}):\n"
  local entry name port
  for entry in "${PORTS[@]}"; do
    name="${entry%%:*}"; port="${entry##*:}"
    if port_up "$port"; then printf "    ${c_grn}●${c_reset} %-14s :%s\n" "$name" "$port"
    else printf "    ${c_dim}·${c_reset} %-14s :%s\n" "$name" "$port"; fi
  done
  if compose ps --status running postgres >/dev/null 2>&1; then
    compose ps postgres --format '    container {{.Name}}: {{.Status}}'
  fi
}

cmd_up() {
  preflight
  [ -n "$AUTH_URL" ] || die "SUPABASE_AUTH_URL (or EXPO_PUBLIC_SUPABASE_URL) is required for hosted Auth verification."
  assert_local_auth
  ensure_infra
  run_api_script migrate
  run_api_script seed
  tmux has-session -t "$SESSION" 2>/dev/null || tmux new-session -d -s "$SESSION" -n _bootstrap -c "$ROOT"
  local service
  for service in "${SERVERS[@]}"; do start_window "${service%%|*}" "${service#*|}"; done
  tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
  ok "Stack starting in tmux session '$SESSION'"
  port_check
  printf "\n  API:   %s/health/live\n  Web:   http://127.0.0.1:3000\n  Admin: http://127.0.0.1:3001\n  MCP:   http://127.0.0.1:3002/health\n" "$LOCAL_API_URL"
}

cmd_status() {
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    info "tmux '$SESSION' windows"
    tmux list-windows -t "$SESSION" -F '    #{window_index}: #{window_name}'
  else
    warn "session '$SESSION' not running"
  fi
  port_check
}

cmd_logs() {
  local service="${1:?usage: logs <service>}"
  if [ "$service" = "postgres" ]; then
    compose logs --tail 400 postgres
    return
  fi
  tmux has-session -t "$SESSION" 2>/dev/null || die "session not running"
  tmux capture-pane -p -S -400 -t "$SESSION:$service"
}

cmd_restart() {
  local name="${1:?usage: restart <service>}" service
  if [ "$name" = "postgres" ]; then
    compose restart postgres
    ok "restarted postgres"
    return
  fi
  tmux has-session -t "$SESSION" 2>/dev/null || die "session not running"
  tmux kill-window -t "$SESSION:$name" 2>/dev/null || true
  for service in "${SERVERS[@]}"; do
    if [ "${service%%|*}" = "$name" ]; then
      start_window "$name" "${service#*|}"
      ok "restarted $name"
      return
    fi
  done
  die "unknown service '$name'"
}

cmd_down() {
  tmux kill-session -t "$SESSION" 2>/dev/null && ok "application services stopped" || warn "no session '$SESSION'"
  if [ "${1:-}" = "--all" ]; then
    compose down
    ok "standalone backend infrastructure stopped (data retained)"
  fi
}

cmd_reset() {
  preflight
  assert_local_database
  warn "Resetting the dedicated local PostgreSQL volume"
  compose down --volumes --remove-orphans
  ensure_infra
  run_api_script migrate
  run_api_script seed
  ok "Local PostgreSQL reset, migrations applied, and configured fixtures created"
}

cmd_seed() {
  preflight
  assert_local_database
  ensure_infra
  run_api_script migrate
  run_api_script seed
  ok "Local migrations applied and configured fixtures created"
}

cmd_native() {
  local platform="$1"
  preflight
  [ -n "$AUTH_URL" ] || die "SUPABASE_AUTH_URL (or EXPO_PUBLIC_SUPABASE_URL) is required."
  [ -n "$AUTH_ANON_KEY" ] || die "EXPO_PUBLIC_SUPABASE_ANON_KEY is required for the mobile Auth client."
  assert_local_auth
  ensure_infra
  (cd "$ROOT" && env EXPO_PUBLIC_API_URL="$MOBILE_API_URL" \
    EXPO_PUBLIC_SUPABASE_URL="$AUTH_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$AUTH_ANON_KEY" \
    npm run "$platform" -w @sauci/mobile)
}

case "${1:-up}" in
  up) cmd_up ;;
  down) cmd_down "${2:-}" ;;
  status) cmd_status ;;
  logs) cmd_logs "${2:-}" ;;
  restart) cmd_restart "${2:-}" ;;
  attach) tmux attach -t "$SESSION" ;;
  reset) cmd_reset ;;
  seed) cmd_seed ;;
  ios|android) cmd_native "$1" ;;
  help|-h|--help)
    echo "usage: scripts/dev-local.sh up|down [--all]|status|logs <service>|restart <service>|attach|reset|seed|ios|android"
    ;;
  *) die "unknown command '$1'" ;;
esac
