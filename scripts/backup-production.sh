#!/usr/bin/env bash

set -euo pipefail

root_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
compose_file="$root_dir/docker-compose.production.yml"
env_file="$root_dir/.env.production"
backup_dir="$root_dir/backups/$(date +%Y-%m-%d_%H-%M-%S)"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file" >&2
  exit 1
fi

set -a
source "$env_file"
set +a

mkdir -p "$backup_dir"

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_dump --username="$POSTGRES_USER" --format=custom "$POSTGRES_DB" \
  >"$backup_dir/postgres.dump"

docker run --rm \
  --network "${COMPOSE_PROJECT_NAME:-telegraph-clone}_default" \
  --env-file "$env_file" \
  -v "$backup_dir:/backup" \
  minio/mc:latest \
  /bin/sh -c 'mc alias set storage "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY" && mc mirror "storage/$S3_BUCKET" /backup/minio'

echo "Backup created in $backup_dir"
