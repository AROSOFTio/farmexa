#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore.sh path/to/farmexa.sql"
  exit 1
fi

docker compose -f docker-compose.prod.yml exec -T db psql -U "${POSTGRES_USER:-farmexa_user}" "${POSTGRES_DB:-farmexa_db}" < "$1"
echo "Restore completed"
