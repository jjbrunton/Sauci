#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="$repo_root/infra/backend/compose.production.yaml"
project_name="sauci-deploy-verify-$$"

# Deliberately fixed disposable values: this check must never consume deployment
# secrets or connect to an externally configured database.
export POSTGRES_PASSWORD='sauci-container-test-only'
export DATABASE_URL='postgresql://sauci:sauci-container-test-only@postgres:5432/sauci'
export SUPABASE_AUTH_URL='https://example.supabase.co'
export SUPABASE_AUTH_AUDIENCE='authenticated'
export SUPABASE_AUTH_SERVICE_ROLE_KEY='container-test-auth-admin-only'
export ADMIN_API_SERVICE_TOKEN='container-test-admin-service-token-123456789'
export ADMIN_API_SERVICE_USER_ID='00000000-0000-4000-8000-000000000002'
export REVENUECAT_API_KEY='container-test-revenuecat-only'
export REVENUECAT_WEBHOOK_SECRET='container-test-webhook-only'
export MEDIA_SIGNING_SECRET='sauci-media-container-test-only-secret'
export MEDIA_PUBLIC_BASE_URL='https://api.sauci.test'
export CLASSIFIER_ENABLED='false'

cleanup() {
  docker compose -p "$project_name" -f "$compose_file" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -p "$project_name" -f "$compose_file" config >/dev/null
docker compose -p "$project_name" -f "$compose_file" up -d --build --wait postgres migrate api
# The worker deliberately has no HTTP healthcheck. Start it separately so
# Compose versions that reject `--wait` for healthcheck-disabled services do not
# turn that intentional contract into a false failure.
docker compose -p "$project_name" -f "$compose_file" up -d worker
test "$(docker compose -p "$project_name" -f "$compose_file" ps --status running -q worker | wc -l | tr -d ' ')" = "1"
worker_id="$(docker compose -p "$project_name" -f "$compose_file" ps -q worker)"
worker_restarts_before="$(docker inspect --format '{{.RestartCount}}' "$worker_id")"
sleep 3
test "$(docker inspect --format '{{.State.Running}}' "$worker_id")" = "true"
test "$(docker inspect --format '{{.RestartCount}}' "$worker_id")" = "$worker_restarts_before"

docker compose -p "$project_name" -f "$compose_file" exec -T api node -e \
  "Promise.all(['/health/live','/health/ready','/v1/me'].map(async p=>[p,(await fetch('http://127.0.0.1:3003'+p)).status])).then(results=>{const expected=[200,200,401];if(results.some((result,index)=>result[1]!==expected[index])){console.error(results);process.exit(1)};console.log(results)})"

docker compose -p "$project_name" -f "$compose_file" run --rm migrate
docker compose -p "$project_name" -f "$compose_file" exec -T api sh -c 'test "$(id -u)" != 0'
docker compose -p "$project_name" -f "$compose_file" exec -T worker sh -c 'test "$(id -u)" != 0'
docker compose -p "$project_name" -f "$compose_file" exec -T api sh -c 'touch /data/media/write-check && rm /data/media/write-check'

if docker compose -p "$project_name" -f "$compose_file" exec -T api sh -c 'touch /app/should-not-write'; then
  echo 'API filesystem unexpectedly allowed writes' >&2
  exit 1
fi

docker compose -p "$project_name" -f "$compose_file" stop api
docker compose -p "$project_name" -f "$compose_file" logs --no-color api | grep -q 'Received SIGTERM; shutting down'
docker compose -p "$project_name" -f "$compose_file" stop worker
docker compose -p "$project_name" -f "$compose_file" logs --no-color worker | grep -q 'stopping operations worker'

echo 'Production container verification passed'
