#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/userik/gotd"
cd "$APP_DIR"

echo "=========================================="
echo "Starting deployment of GOTD..."
echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=========================================="

echo "==> 1. Updating repository from origin/main..."
git fetch origin main
git checkout main
git reset --hard origin/main

echo "==> 2. Building and starting Docker containers..."
docker compose up -d --build --remove-orphans

echo "==> 3. Verifying container health..."
ATTEMPTS=0
MAX_ATTEMPTS=30
CONTAINER_NAME="gotd-app-1"

until [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; do
  HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || echo "not-found")
  if [ "$HEALTH" = "healthy" ]; then
    echo "==> Container $CONTAINER_NAME is $HEALTH!"
    break
  fi
  echo "Waiting for container health (status: $HEALTH, attempt $((ATTEMPTS+1))/$MAX_ATTEMPTS)..."
  ATTEMPTS=$((ATTEMPTS+1))
  sleep 2
done

if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
  echo "ERROR: Deployment healthcheck timed out!"
  docker compose logs --tail=50
  exit 1
fi

echo "==> 4. Checking /api/health endpoint..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/api/health || echo "000")
if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "WARNING: /api/health returned HTTP $HTTP_STATUS"
else
  echo "==> Health endpoint returned HTTP 200 OK"
fi

echo "==> 5. Cleaning up old unused Docker images..."
docker image prune -f

echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="
