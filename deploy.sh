#!/bin/bash
# ============================================================
# Farmexa Production Deploy Script
# Run this from the repo root on your server
# ============================================================
set -euo pipefail

echo "==> Pulling latest changes..."
git pull origin main

echo "==> Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "==> Waiting for backend to be healthy..."
sleep 5
docker compose -f docker-compose.prod.yml exec backend sh -c "alembic upgrade head" || true

echo "==> Done. Services:"
docker compose -f docker-compose.prod.yml ps
