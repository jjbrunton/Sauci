#!/usr/bin/env bash
set -euo pipefail

SESSION="sauci-dev"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SERVERS=(
  "functions|npx supabase functions serve --workdir apps"
  "web|scripts/with-local-supabase-env.sh web npm run dev -w @sauci/web -- --port 3000"
  "admin|scripts/with-local-supabase-env.sh admin npm run dev -w @sauci/admin -- --host 127.0.0.1 --port 3001"
  "mcp|scripts/with-local-supabase-env.sh mcp npm run dev -w sauci-mcp-server"
  "mobile|scripts/with-local-supabase-env.sh mobile npm run dev -w @sauci/mobile -- --port 8081 --localhost"
)

PORTS=(
  "supabase-api:54321"
  "postgres:54322"
  "studio:54323"
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

preflight() {
  command -v tmux >/dev/null 2>&1 || die "tmux not found. Install: brew install tmux"
  command -v npm >/dev/null 2>&1 || die "npm not found. Install Node $(cat "$ROOT/.nvmrc")."
  command -v docker >/dev/null 2>&1 || die "Docker-compatible CLI not found."
  docker info >/dev/null 2>&1 || die "Container runtime is not running."
  [ -d "$ROOT/node_modules" ] || die "Dependencies missing. Run: npm ci"
  local node_major
  node_major="$(node -p 'process.versions.node.split(`.`)[0]')"
  [ "$node_major" = "20" ] || die "Node 20 is required. Activate .nvmrc before starting the stack."
}

ensure_infra() {
  if (cd "$ROOT" && npx supabase status --workdir apps >/dev/null 2>&1); then
    ok "Local Supabase already running"
  else
    info "Starting local Supabase"
    (cd "$ROOT" && GOOGLE_CLIENT_ID=local APPLE_CLIENT_ID=local \
      GOOGLE_CLIENT_SECRET=local APPLE_CLIENT_SECRET=local \
      npx supabase start --workdir apps)
  fi
}

start_window() {
  local name="$1" cmd="$2"
  if tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$name"; then
    warn "window '$name' already exists"
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
}

cmd_up() {
  preflight
  ensure_infra
  tmux has-session -t "$SESSION" 2>/dev/null || tmux new-session -d -s "$SESSION" -n _bootstrap -c "$ROOT"
  local service
  for service in "${SERVERS[@]}"; do start_window "${service%%|*}" "${service#*|}"; done
  tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
  ok "Stack starting in tmux session '$SESSION'"
  port_check
  printf "\n  Web:   http://127.0.0.1:3000\n  Admin: http://127.0.0.1:3001\n  MCP:   http://127.0.0.1:3002/health\n  Studio:http://127.0.0.1:54323\n"
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
  tmux has-session -t "$SESSION" 2>/dev/null || die "session not running"
  tmux capture-pane -p -S -400 -t "$SESSION:${1:?usage: logs <service>}"
}

cmd_restart() {
  tmux has-session -t "$SESSION" 2>/dev/null || die "session not running"
  local name="${1:?usage: restart <service>}" service
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
    (cd "$ROOT" && npx supabase stop --workdir apps)
    ok "local Supabase stopped"
  fi
}

cmd_reset() {
  preflight
  ensure_infra
  (cd "$ROOT" && npx supabase db reset --workdir apps)
  (cd "$ROOT" && scripts/with-local-supabase-env.sh tests node scripts/seed-e2e.mjs)
  ok "Local database reset and deterministic fixtures created"
}

cmd_native() {
  local platform="$1"
  preflight
  ensure_infra
  (cd "$ROOT" && scripts/with-local-supabase-env.sh mobile npm run "$platform" -w @sauci/mobile)
}

case "${1:-up}" in
  up) cmd_up ;;
  down) cmd_down "${2:-}" ;;
  status) cmd_status ;;
  logs) cmd_logs "${2:-}" ;;
  restart) cmd_restart "${2:-}" ;;
  attach) tmux attach -t "$SESSION" ;;
  reset|seed) cmd_reset ;;
  ios|android) cmd_native "$1" ;;
  help|-h|--help)
    echo "usage: scripts/dev-local.sh up|down [--all]|status|logs <service>|restart <service>|attach|reset|ios|android"
    ;;
  *) die "unknown command '$1'" ;;
esac
