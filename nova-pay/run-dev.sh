#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="${ROOT_DIR}/docker/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo 'docker is required but not installed.' >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo 'docker compose (v2) is required but not available.' >&2
  exit 1
fi

echo 'Building and starting NovaPay stack (detached)...'
echo '(The migrate service runs TypeORM migrations before the app starts.)'
docker compose -f "${COMPOSE_FILE}" up -d --build

echo ''
echo 'Waiting for HTTP (GET / on PORT 3002)...'
READY=0
for _ in $(seq 1 90); do
  if curl -sf 'http://127.0.0.1:3002/' >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "${READY}" -ne 1 ]; then
  echo 'App did not become ready in time. Logs:' >&2
  docker compose -f "${COMPOSE_FILE}" logs --tail 80 app >&2
  exit 1
fi

echo ''
echo 'NovaPay development stack is up.'
echo ''
echo '  API:              http://127.0.0.1:3002/'
echo '  Swagger:          http://127.0.0.1:3002/api'
echo '  RabbitMQ UI:      http://127.0.0.1:15672/  (guest / guest)'
echo ''
echo '  Postgres:         127.0.0.1:5432  db=fintech  user=fintech'
echo '  Redis (host):     127.0.0.1:6380 → container 6379'
echo '  AMQP:             127.0.0.1:5672'
echo ''
echo "Follow logs:  docker compose -f docker/docker-compose.yml logs -f app"
echo "Stop stack:    docker compose -f docker/docker-compose.yml down"
echo ''
