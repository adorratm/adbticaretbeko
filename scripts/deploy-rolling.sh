#!/usr/bin/env bash
# Tek host Docker Compose için sırayla (rolling) güncelleme.
# Tam blue-green / K8s değildir; servisleri tek tek yeniden oluşturup health bekler.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/deployments/docker-compose/docker-compose.prod.yml}"
PROJECT="${COMPOSE_PROJECT_NAME:-adbticaret}"

dc() {
  docker compose -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
}

SERVICES=(
  gateway
  storefront
  admin
  realtime
  auth
  catalog
  order
  payment
)

echo "==> Building images"
dc build "${SERVICES[@]}"

for svc in "${SERVICES[@]}"; do
  echo "==> Rolling $svc"
  dc up -d --no-deps --force-recreate "$svc"
  # Health varsa bekle (yoksa kısa sleep)
  for i in $(seq 1 30); do
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${PROJECT}-${svc}-1" 2>/dev/null || true)"
    if [[ "$status" == "healthy" || "$status" == "none" ]]; then
      if [[ "$status" == "none" ]]; then
        sleep 3
      fi
      echo "    $svc ready ($status)"
      break
    fi
    if [[ "$i" -eq 30 ]]; then
      echo "    WARN: $svc health timeout (status=$status)"
    fi
    sleep 2
  done
done

echo "==> Done. Check: curl -fsS http://127.0.0.1/healthz"
