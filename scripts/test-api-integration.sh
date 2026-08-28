#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://sauci:sauci_local_only@127.0.0.1:54320/sauci}"

case "$DATABASE_URL" in
  postgresql://*@127.0.0.1:*/*|postgresql://*@localhost:*/*|postgresql://*@\[::1\]:*/*) ;;
  *)
    echo "Refusing API integration tests against non-local DATABASE_URL" >&2
    exit 1
    ;;
esac

cd "$ROOT"
env DATABASE_URL="$DATABASE_URL" npm run test:integration -w @sauci/api
