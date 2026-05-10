#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

docker compose -f docker-compose.prod.yml exec -T db pg_dump -U "${POSTGRES_USER:-farmexa_user}" "${POSTGRES_DB:-farmexa_db}" > "$BACKUP_DIR/farmexa-$TIMESTAMP.sql"
tar -czf "$BACKUP_DIR/farmexa-uploads-$TIMESTAMP.tar.gz" uploads 2>/dev/null || true
echo "Backup written to $BACKUP_DIR"
