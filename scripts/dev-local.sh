#!/usr/bin/env bash
set -euo pipefail

SESSION="sauci-dev"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/backend/compose.yaml"
COMPOSE_PROJECT="sauci-local"
DESCENDANT_SHUTDOWN_ATTEMPTS=30
DESCENDANT_SHUTDOWN_DELAY_SECONDS=0.1

load_env_local() {
  local env_file="$ROOT/.env.local" line line_number=0 key value seen_keys=' '
  local safe_value_pattern='^[A-Za-z0-9._:/?&=+%@,#-]+$'
  [ -f "$env_file" ] || return 0

  # This is deliberately a data parser, not `source`: .env.local is ignored
  # developer input and must never execute in the launcher's shell.
  while IFS= read -r line || [ -n "$line" ]; do
    line_number=$((line_number + 1))
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ ! "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]]; then
      printf '✗ %s:%s must be KEY=VALUE with no quoting or shell syntax.\n' "$env_file" "$line_number" >&2
      exit 1
    fi
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    case " $key " in
      " SAUCI_POSTGRES_PORT "|" SAUCI_API_PORT "|" SAUCI_WEB_PORT "|" SAUCI_ADMIN_PORT "|\
      " SAUCI_MCP_PORT "|" SAUCI_METRO_PORT "|" SAUCI_MOBILE_API_URL "|\
      " SUPABASE_AUTH_URL "|" EXPO_PUBLIC_SUPABASE_URL "|" EXPO_PUBLIC_SUPABASE_ANON_KEY "|\
      " ADMIN_API_SERVICE_USER_ID "|" ADMIN_API_SERVICE_TOKEN "|" SAUCI_MCP_API_KEY ") ;;
      *)
        printf '✗ %s:%s contains unsupported launcher key %s.\n' "$env_file" "$line_number" "$key" >&2
        exit 1
        ;;
    esac
    case "$seen_keys" in
      *" $key "*)
        printf '✗ %s:%s duplicates launcher key %s.\n' "$env_file" "$line_number" "$key" >&2
        exit 1
        ;;
    esac
    if [[ -z "$value" || ! "$value" =~ $safe_value_pattern ]]; then
      printf '✗ %s:%s contains an unsafe or empty value.\n' "$env_file" "$line_number" >&2
      exit 1
    fi
    # Explicit caller exports are authoritative over ignored local defaults.
    printenv "$key" >/dev/null 2>&1 || export "$key=$value"
    seen_keys+="$key "
  done <"$env_file"
}

load_nvm() {
  command -v nvm >/dev/null 2>&1 && return

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}" brew_nvm_prefix
  local -a candidates=("$nvm_dir/nvm.sh")
  if command -v brew >/dev/null 2>&1; then
    brew_nvm_prefix="$(brew --prefix nvm 2>/dev/null || true)"
    [ -n "$brew_nvm_prefix" ] && candidates+=("$brew_nvm_prefix/nvm.sh")
  fi

  local candidate
  for candidate in "${candidates[@]}"; do
    if [ -s "$candidate" ]; then
      # shellcheck disable=SC1090
      . "$candidate"
      command -v nvm >/dev/null 2>&1 && return
    fi
  done
  return 1
}

activate_required_node() {
  local required_node current_node
  required_node="$(tr -d '[:space:]' <"$ROOT/.nvmrc")"
  [ -n "$required_node" ] || die ".nvmrc must specify a Node version."

  if command -v node >/dev/null 2>&1; then
    current_node="$(node -p 'process.versions.node')"
    [ "$current_node" = "$required_node" ] && return
  fi

  load_nvm || die "Node $required_node is required. Install Homebrew nvm, then run: nvm install $required_node"
  nvm use --silent "$required_node" >/dev/null 2>&1 || die "Node $required_node is required. Install it once with: nvm install $required_node"
  current_node="$(node -p 'process.versions.node')"
  [ "$current_node" = "$required_node" ] || die "Node $required_node is required; nvm selected $current_node instead."
}

# Read the ignored developer configuration before computing launch settings.
# Explicit environment variables take precedence over .env.local values.
load_env_local

POSTGRES_PORT="${SAUCI_POSTGRES_PORT:-54320}"
API_PORT="${SAUCI_API_PORT:-3003}"
WEB_PORT="${SAUCI_WEB_PORT:-3000}"
ADMIN_PORT="${SAUCI_ADMIN_PORT:-3001}"
MCP_PORT="${SAUCI_MCP_PORT:-3002}"
METRO_PORT="${SAUCI_METRO_PORT:-8081}"
LOCAL_DATABASE_URL="postgresql://sauci:sauci_local_only@127.0.0.1:${POSTGRES_PORT}/sauci"
LOCAL_API_URL="http://127.0.0.1:${API_PORT}"
MOBILE_API_URL="${SAUCI_MOBILE_API_URL:-$LOCAL_API_URL}"
AUTH_URL="${SUPABASE_AUTH_URL:-${EXPO_PUBLIC_SUPABASE_URL:-}}"
AUTH_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
LOCAL_ADMIN_SERVICE_USER_ID="${ADMIN_API_SERVICE_USER_ID:-00000000-0000-4000-8000-000000000002}"
LOCAL_ADMIN_SERVICE_TOKEN="${ADMIN_API_SERVICE_TOKEN:-local-sauci-admin-service-token-123456789}"
LOCAL_MCP_API_KEY="${SAUCI_MCP_API_KEY:-local-sauci-mcp-only}"

SERVERS=(
  "api|PORT=$API_PORT DATABASE_URL=$LOCAL_DATABASE_URL MEDIA_ROOT=$ROOT/.local/media MEDIA_SIGNING_SECRET=local-media-signing-secret-change-me-123456 MEDIA_PUBLIC_BASE_URL=http://127.0.0.1:$API_PORT npm run dev -w @sauci/api"
  "worker|DATABASE_URL=$LOCAL_DATABASE_URL CLASSIFIER_ENABLED=false MEDIA_ROOT=$ROOT/.local/media MEDIA_SIGNING_SECRET=local-media-signing-secret-change-me-123456 MEDIA_PUBLIC_BASE_URL=http://127.0.0.1:$API_PORT npm run dev:worker -w @sauci/api"
  "web|env NEXT_PUBLIC_API_URL=$LOCAL_API_URL npm run dev -w @sauci/web -- --port $WEB_PORT"
  "admin|env VITE_API_URL=$LOCAL_API_URL npm run dev -w @sauci/admin -- --host 127.0.0.1 --port $ADMIN_PORT"
  "mcp|env PORT=$MCP_PORT npm run dev -w sauci-mcp-server"
  "mobile|npm run dev -w @sauci/mobile -- --port $METRO_PORT --localhost"
)

PORTS=(
  "postgres:$POSTGRES_PORT"
  "api:$API_PORT"
  "web:$WEB_PORT"
  "admin:$ADMIN_PORT"
  "mcp:$MCP_PORT"
  "metro:$METRO_PORT"
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
  activate_required_node
  if ! node - "$POSTGRES_PORT" "$API_PORT" "$WEB_PORT" "$ADMIN_PORT" "$MCP_PORT" "$METRO_PORT" <<'NODE'
const ports = process.argv.slice(2);
const valid = ports.every((port) => /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535);
if (!valid || new Set(ports.map(Number)).size !== ports.length) process.exitCode = 1;
NODE
  then
    die "Configured ports must be unique integers from 1 to 65535."
  fi
  command -v tmux >/dev/null 2>&1 || die "tmux not found. Install: brew install tmux"
  command -v npm >/dev/null 2>&1 || die "npm not found after activating Node $(cat "$ROOT/.nvmrc")."
  command -v docker >/dev/null 2>&1 || die "Docker-compatible CLI not found."
  docker info >/dev/null 2>&1 || die "Container runtime is not running."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
  [ -d "$ROOT/node_modules" ] || die "Dependencies missing. Run: npm ci"
}

assert_local_database() {
  case "$LOCAL_DATABASE_URL" in
    postgresql://*@127.0.0.1:"$POSTGRES_PORT"/sauci|postgresql://*@localhost:"$POSTGRES_PORT"/sauci) ;;
    *) die "Refusing database operation against non-local URL: $LOCAL_DATABASE_URL" ;;
  esac
  [ "$POSTGRES_PORT" = "54320" ] || die "Destructive reset requires the dedicated local PostgreSQL port 54320."
}

assert_allowed_auth() {
  local verdict
  verdict="$(node - "$AUTH_URL" <<'NODE'
const raw = process.argv[2];
try {
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('shape');
  const isCanonicalRoot = raw === url.origin || raw === `${url.origin}/`;
  const isLoopback = isCanonicalRoot && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const isNonProduction = isCanonicalRoot && url.protocol === 'https:' && url.origin === 'https://itbzhrvlgvdmzbnhzhyx.supabase.co';
  if (isLoopback || isNonProduction) process.stdout.write('allowed');
  else if (url.hostname === 'ckjcrkjpmhqhiucifukx.supabase.co') process.stdout.write('production');
  else process.stdout.write('unapproved');
} catch {
  process.stdout.write('invalid');
}
NODE
)"
  case "$verdict" in
    allowed) ;;
    production) die "Refusing local development against the production Supabase Auth project." ;;
    invalid) die "SUPABASE_AUTH_URL must be a valid root Auth URL without credentials, a path, query, or fragment." ;;
    *) die "Refusing local development against an unapproved Supabase Auth URL." ;;
  esac
}

prepare_session() {
  BOOTSTRAP_CREATED=false
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux new-session -d -s "$SESSION" -n _bootstrap -c "$ROOT" 'sleep 300'
    BOOTSTRAP_CREATED=true
  elif ! tmux list-windows -t "$SESSION" -F '#{window_name}' | grep -qx '_bootstrap'; then
    tmux new-window -d -t "$SESSION" -n _bootstrap -c "$ROOT" 'sleep 300'
    BOOTSTRAP_CREATED=true
  fi
}

restart_managed_windows() {
  local name failed=false
  for name in api worker web admin mcp mobile; do
    stop_managed_window "$name" || failed=true
  done
  [ "$failed" = false ]
}

is_numeric_pid() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

pane_pid_for_window() {
  local name="$1" pane_pid
  pane_pid="$(tmux display-message -p -t "$SESSION:$name" '#{pane_pid}' 2>/dev/null || true)"
  is_numeric_pid "$pane_pid" && printf '%s\n' "$pane_pid"
}

process_start_time() {
  local pid="$1" start_time
  is_numeric_pid "$pid" || return 1
  start_time="$(ps -p "$pid" -o lstart= 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -n "$start_time" ] && printf '%s\n' "$start_time"
}

has_pane_ancestry() {
  local pid="$1" pane_pid="$2" parent_pid hops=0
  is_numeric_pid "$pid" && is_numeric_pid "$pane_pid" || return 1
  while [ "$hops" -lt 64 ]; do
    parent_pid="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d '[:space:]')"
    is_numeric_pid "$parent_pid" || return 1
    [ "$parent_pid" = "$pane_pid" ] && return 0
    [ "$parent_pid" -gt 1 ] || return 1
    pid="$parent_pid"
    hops=$((hops + 1))
  done
  return 1
}

capture_descendants() {
  local parent_pid="$1" child_pid
  is_numeric_pid "$parent_pid" || return 0
  while IFS= read -r child_pid; do
    is_numeric_pid "$child_pid" || continue
    capture_descendants "$child_pid"
    local start_time
    start_time="$(process_start_time "$child_pid" || true)"
    [ -n "$start_time" ] || continue
    MANAGED_DESCENDANT_PIDS+=("$child_pid")
    MANAGED_DESCENDANT_STARTS+=("$start_time")
    record_captured_identity "$child_pid" "$start_time"
  done < <(pgrep -P "$parent_pid" 2>/dev/null || true)
}

record_captured_identity() {
  local pid="$1" start_time="$2" index
  for index in "${!CAPTURED_DESCENDANT_PIDS[@]}"; do
    [ "${CAPTURED_DESCENDANT_PIDS[$index]}" = "$pid" ] &&
      [ "${CAPTURED_DESCENDANT_STARTS[$index]}" = "$start_time" ] && return 0
  done
  CAPTURED_DESCENDANT_PIDS+=("$pid")
  CAPTURED_DESCENDANT_STARTS+=("$start_time")
}

captured_identity_remains() {
  local index pid start_time
  for index in "${!CAPTURED_DESCENDANT_PIDS[@]}"; do
    pid="${CAPTURED_DESCENDANT_PIDS[$index]}"
    start_time="${CAPTURED_DESCENDANT_STARTS[$index]}"
    is_numeric_pid "$pid" || continue
    [ "$(process_start_time "$pid" || true)" = "$start_time" ] && return 0
  done
  return 1
}

signal_verified_descendants() {
  local name="$1" expected_pane_pid="$2" index pid start_time current_pane_pid
  for index in "${!MANAGED_DESCENDANT_PIDS[@]}"; do
    pid="${MANAGED_DESCENDANT_PIDS[$index]}"
    start_time="${MANAGED_DESCENDANT_STARTS[$index]}"
    is_numeric_pid "$pid" || continue
    current_pane_pid="$(pane_pid_for_window "$name" || true)"
    [ "$current_pane_pid" = "$expected_pane_pid" ] || continue
    [ "$(process_start_time "$pid" || true)" = "$start_time" ] || continue
    has_pane_ancestry "$pid" "$expected_pane_pid" || continue
    kill -TERM "$pid" 2>/dev/null || true
  done
}

descendants_remain() {
  local pane_pid="$1" child_pid
  is_numeric_pid "$pane_pid" || return 1
  child_pid="$(pgrep -P "$pane_pid" 2>/dev/null | head -1 || true)"
  [ -n "$child_pid" ]
}

stop_managed_window() {
  local name="$1" pane_pid attempt=1
  case "$name" in api|worker|web|admin|mcp|mobile) ;; *) die "unknown managed window '$name'" ;; esac
  tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$name" || return 0

  CAPTURED_DESCENDANT_PIDS=("")
  CAPTURED_DESCENDANT_STARTS=("")
  while [ "$attempt" -le "$DESCENDANT_SHUTDOWN_ATTEMPTS" ]; do
    pane_pid="$(pane_pid_for_window "$name" || true)"
    if ! is_numeric_pid "$pane_pid"; then
      captured_identity_remains && return 1
      return 0
    fi
    if ! descendants_remain "$pane_pid"; then
      captured_identity_remains && {
        warn "window '$name' has a captured descendant outside its pane lineage; leaving it running"
        return 1
      }
      tmux kill-window -t "$SESSION:$name" 2>/dev/null || true
      return 0
    fi

    # Bash 3.2 plus nounset requires non-empty sentinels for these arrays.
    MANAGED_DESCENDANT_PIDS=("")
    MANAGED_DESCENDANT_STARTS=("")
    capture_descendants "$pane_pid"
    signal_verified_descendants "$name" "$pane_pid"
    sleep "$DESCENDANT_SHUTDOWN_DELAY_SECONDS"
    attempt=$((attempt + 1))
  done
  pane_pid="$(pane_pid_for_window "$name" || true)"
  if captured_identity_remains; then
    warn "window '$name' still has captured descendants; leaving it running"
    return 1
  fi
  if is_numeric_pid "$pane_pid" && descendants_remain "$pane_pid"; then
    warn "window '$name' still has managed descendants; leaving it running"
    return 1
  fi
  tmux kill-window -t "$SESSION:$name" 2>/dev/null || true
}

window_environment() {
  local name="$1"
  # Bash 3.2 with nounset treats an empty array expansion as unbound. Keep a
  # sentinel and skip it when building tmux's optional -e arguments.
  WINDOW_ENV=("")
  WINDOW_FORWARD=''
  case "$name" in
    api)
      WINDOW_ENV=(
        "SUPABASE_AUTH_URL=$AUTH_URL"
        "ADMIN_API_SERVICE_USER_ID=$LOCAL_ADMIN_SERVICE_USER_ID"
        "ADMIN_API_SERVICE_TOKEN=$LOCAL_ADMIN_SERVICE_TOKEN"
      )
      WINDOW_FORWARD='SUPABASE_AUTH_URL="$SUPABASE_AUTH_URL" ADMIN_API_SERVICE_USER_ID="$ADMIN_API_SERVICE_USER_ID" ADMIN_API_SERVICE_TOKEN="$ADMIN_API_SERVICE_TOKEN"'
      ;;
    mcp)
      WINDOW_ENV=(
        "SAUCI_ADMIN_API_URL=$LOCAL_API_URL"
        "SAUCI_ADMIN_API_TOKEN=$LOCAL_ADMIN_SERVICE_TOKEN"
        "SAUCI_MCP_API_KEY=$LOCAL_MCP_API_KEY"
      )
      WINDOW_FORWARD='SAUCI_ADMIN_API_URL="$SAUCI_ADMIN_API_URL" SAUCI_ADMIN_API_TOKEN="$SAUCI_ADMIN_API_TOKEN" SAUCI_MCP_API_KEY="$SAUCI_MCP_API_KEY"'
      ;;
    mobile)
      WINDOW_ENV=(
        "EXPO_PUBLIC_API_URL=$MOBILE_API_URL"
        "EXPO_PUBLIC_SUPABASE_URL=$AUTH_URL"
        "EXPO_PUBLIC_SUPABASE_ANON_KEY=$AUTH_ANON_KEY"
      )
      WINDOW_FORWARD='EXPO_PUBLIC_API_URL="$EXPO_PUBLIC_API_URL" EXPO_PUBLIC_SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY"'
      ;;
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
  (cd "$ROOT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" \
    DATABASE_URL="$LOCAL_DATABASE_URL" npm run "db:$script" -w @sauci/api)
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
  window_environment "$name"
  local entry escaped_path escaped_home escaped_tmpdir
  printf -v escaped_path '%q' "$PATH"
  printf -v escaped_home '%q' "$HOME"
  printf -v escaped_tmpdir '%q' "${TMPDIR:-/tmp}"
  set -- tmux new-window -d -t "$SESSION" -n "$name" -c "$ROOT"
  for entry in "${WINDOW_ENV[@]}"; do
    [ -n "$entry" ] && set -- "$@" -e "$entry"
  done
  set -- "$@" "env -i PATH=$escaped_path HOME=$escaped_home TMPDIR=$escaped_tmpdir $WINDOW_FORWARD $cmd"
  "$@"
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

report_port_owner() {
  local port="$1" pid command cwd raw_command
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    raw_command="$(ps -p "$pid" -o command= 2>/dev/null)"
    command="$(printf '%s' "$raw_command" | LC_ALL=C tr -d '[:cntrl:]')"
    command="${command#"${command%%[![:space:]]*}"}"
    command="${command%%[[:space:]]*}"
    [ -n "$command" ] && command="$(basename "$command")"
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    cwd="$(printf '%s' "$cwd" | LC_ALL=C tr -d '[:cntrl:]')"
    printf '    PID %s\n      command: %s\n      cwd: %s\n' "$pid" "${command:-unknown}" "${cwd:-unknown}" >&2
  done < <(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u)
}

assert_app_ports_available() {
  local entry name port occupied=false
  local -a app_ports=("api:$API_PORT" "web:$WEB_PORT" "admin:$ADMIN_PORT" "mcp:$MCP_PORT" "metro:$METRO_PORT")
  for entry in "${app_ports[@]}"; do
    name="${entry%%:*}"; port="${entry##*:}"
    if port_up "$port"; then
      printf '✗ Port %s for %s is already listening. Refusing to replace its owner.\n' "$port" "$name" >&2
      report_port_owner "$port"
      occupied=true
    fi
  done
  [ "$occupied" = false ] || return 1
}

cmd_up() {
  preflight
  [ -n "$AUTH_URL" ] || die "SUPABASE_AUTH_URL (or EXPO_PUBLIC_SUPABASE_URL) is required for hosted Auth verification."
  assert_allowed_auth
  prepare_session
  if ! restart_managed_windows; then
    [ "$BOOTSTRAP_CREATED" = true ] && tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
    die "Refusing to restart while a managed window still has descendants."
  fi
  if ! assert_app_ports_available; then
    [ "$BOOTSTRAP_CREATED" = true ] && tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
    die "Refusing to start while a configured application port is occupied."
  fi
  ensure_infra
  run_api_script migrate
  run_api_script seed
  local service
  for service in "${SERVERS[@]}"; do start_window "${service%%|*}" "${service#*|}"; done
  [ "$BOOTSTRAP_CREATED" = true ] && tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
  ok "Stack starting in tmux session '$SESSION'"
  port_check
  printf "\n  API:   %s/health/live\n  Web:   http://127.0.0.1:%s\n  Admin: http://127.0.0.1:%s\n  MCP:   http://127.0.0.1:%s/health\n" "$LOCAL_API_URL" "$WEB_PORT" "$ADMIN_PORT" "$MCP_PORT"
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
  local name="${1:?usage: restart <service>}" service="" candidate
  if [ "$name" = "postgres" ]; then
    compose restart postgres
    ok "restarted postgres"
    return
  fi
  for candidate in "${SERVERS[@]}"; do
    if [ "${candidate%%|*}" = "$name" ]; then
      service="$candidate"
      break
    fi
  done
  [ -n "$service" ] || die "unknown service '$name'"

  preflight
  case "$name" in
    api|mobile)
      [ -n "$AUTH_URL" ] || die "SUPABASE_AUTH_URL (or EXPO_PUBLIC_SUPABASE_URL) is required."
      assert_allowed_auth
      ;;
  esac
  [ "$name" != "mobile" ] || [ -n "$AUTH_ANON_KEY" ] || die "EXPO_PUBLIC_SUPABASE_ANON_KEY is required for the mobile Auth client."

  tmux has-session -t "$SESSION" 2>/dev/null || die "session not running"
  prepare_session
  if ! stop_managed_window "$name"; then
    [ "$BOOTSTRAP_CREATED" = true ] && tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
    die "Refusing to restart '$name' while its managed descendants remain."
  fi
  start_window "$name" "${service#*|}"
  [ "$BOOTSTRAP_CREATED" = true ] && tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
  ok "restarted $name"
}

cmd_down() {
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    prepare_session
    if ! restart_managed_windows; then
      [ "$BOOTSTRAP_CREATED" = true ] && tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
      die "Refusing to stop infrastructure while a managed window still has descendants."
    fi
    [ "$BOOTSTRAP_CREATED" = true ] && tmux kill-window -t "$SESSION:_bootstrap" 2>/dev/null || true
    ok "managed application services stopped"
  else
    warn "no session '$SESSION'"
  fi
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
  assert_allowed_auth
  ensure_infra
  (cd "$ROOT" && env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" \
    LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 EXPO_PUBLIC_API_URL="$MOBILE_API_URL" \
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
