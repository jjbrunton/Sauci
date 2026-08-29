#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'claude_delegate: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
usage:
  claude_delegate.sh check
  claude_delegate.sh run <prompt-file> [result-json]
  claude_delegate.sh resume <session-id> <prompt-file> [result-json]
EOF
  exit 2
}

command -v claude >/dev/null 2>&1 || die "claude CLI is not installed or not on PATH"

if [[ "${1:-}" == "check" ]]; then
  claude --version
  auth_status="$(claude auth status 2>/dev/null)" || die "unable to read Claude authentication status"
  [[ "$auth_status" == *'"loggedIn": true'* ]] || die "Claude CLI is not authenticated"
  printf 'authentication: logged in\n'
  exit 0
fi

mode="${1:-}"
case "$mode" in
  run)
    [[ $# -ge 2 && $# -le 3 ]] || usage
    prompt_file="$2"
    result_file="${3:-}"
    resume_id=""
    ;;
  resume)
    [[ $# -ge 3 && $# -le 4 ]] || usage
    resume_id="$2"
    prompt_file="$3"
    result_file="${4:-}"
    [[ "$resume_id" =~ ^[0-9a-fA-F-]{36}$ ]] || die "session id must be a UUID"
    ;;
  *) usage ;;
esac

[[ -f "$prompt_file" ]] || die "prompt file does not exist: $prompt_file"
[[ -r "$prompt_file" ]] || die "prompt file is not readable: $prompt_file"

prompt="ROLE: EXECUTOR — do the work yourself; do not spawn subagents. Stay within the work order's authorization and scope. At the end, report changed files or findings, commands and checks run with results, and any blockers. WORK ORDER: $(<"$prompt_file")"

effort="${CLAUDE_DELEGATE_EFFORT:-medium}"
permission_mode="${CLAUDE_DELEGATE_PERMISSION_MODE:-auto}"
case "$effort" in low|medium|high|xhigh|max) ;; *) die "invalid effort: $effort" ;; esac
case "$permission_mode" in acceptEdits|auto|manual|dontAsk|plan|bypassPermissions) ;;
  *) die "invalid permission mode: $permission_mode" ;;
esac

model="${CLAUDE_DELEGATE_MODEL:-sonnet}"
args=(--print --output-format json --model "$model" --effort "$effort" --permission-mode "$permission_mode" --setting-sources project,local --strict-mcp-config --no-chrome)
[[ -n "${CLAUDE_DELEGATE_MAX_BUDGET_USD:-}" ]] && args+=(--max-budget-usd "$CLAUDE_DELEGATE_MAX_BUDGET_USD")
[[ -n "$resume_id" ]] && args+=(--resume "$resume_id")

if [[ -n "$result_file" ]]; then
  result_dir="$(dirname "$result_file")"
  [[ -d "$result_dir" ]] || die "result directory does not exist: $result_dir"
  claude "${args[@]}" "$prompt" | tee "$result_file"
else
  claude "${args[@]}" "$prompt"
fi
