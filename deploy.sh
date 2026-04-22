#!/usr/bin/env bash
# ==============================================================================
# PERP / Farmexa - Production Deployment Script
# Repo:    https://github.com/AROSOFTio/farmexa.git
# Deploy:  /www/wwwroot/farmexa.arosoft.io
# Port:    4002 (internal nginx -> reverse-proxied by host Nginx)
# ==============================================================================
set -euo pipefail

# -- Config --------------------------------------------------------------------
APP_NAME="farmexa"
DEPLOY_DIR="/www/wwwroot/farmexa.arosoft.io"
REPO_URL="https://github.com/AROSOFTio/farmexa.git"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="/var/log/${APP_NAME}-deploy.log"
DEPLOY_OWNER="${DEPLOY_OWNER:-root}"
DEPLOY_GROUP="${DEPLOY_GROUP:-root}"

# -- Colors --------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()     { echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}[OK] $*${NC}" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[!] $*${NC}" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[X] $*${NC}" | tee -a "$LOG_FILE"; exit 1; }

ensure_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    error "Run this script with sudo or as root so it can manage ${DEPLOY_DIR}, ${LOG_FILE}, and Docker."
  fi
}

prepare_paths() {
  install -d -m 755 "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"
  chmod 640 "$LOG_FILE"

  install -d -m 775 "$DEPLOY_DIR"
  chown "${DEPLOY_OWNER}:${DEPLOY_GROUP}" "$DEPLOY_DIR"
}

apply_permissions() {
  chown -R "${DEPLOY_OWNER}:${DEPLOY_GROUP}" "$DEPLOY_DIR"
  chmod -R u+rwX,g+rX "$DEPLOY_DIR"

  if [ -f "$DEPLOY_DIR/deploy.sh" ]; then
    chmod 755 "$DEPLOY_DIR/deploy.sh"
  fi
}

wait_for_container_health() {
  local container_name="$1"
  local retries="${2:-30}"
  local delay="${3:-5}"
  local attempt=0
  local status=""

  log "Waiting for container health: ${container_name}"
  until [ "$attempt" -ge "$retries" ]; do
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_name" 2>/dev/null || true)"

    if [ "$status" = "healthy" ]; then
      success "${container_name} is healthy."
      return 0
    fi

    if [ "$status" = "unhealthy" ]; then
      error "${container_name} is unhealthy. Check: $DC -f ${COMPOSE_FILE} logs ${container_name#farmexa_}"
    fi

    attempt=$((attempt + 1))
    echo -n "."
    sleep "$delay"
  done
  echo ""
  error "${container_name} did not become healthy in time. Last status: ${status:-unknown}"
}

# -- Pre-flight checks ----------------------------------------------------------
ensure_root
prepare_paths

log "Starting ${APP_NAME} deployment - branch: ${BRANCH}"

command -v docker >/dev/null 2>&1 || error "Docker not found. Install Docker first."
command -v git >/dev/null 2>&1 || error "Git not found."
command -v curl >/dev/null 2>&1 || error "curl not found."

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  error "Docker Compose not found."
fi

# -- Clone or update repository -------------------------------------------------
if [ -d "$DEPLOY_DIR/.git" ]; then
  log "Pulling latest code from ${BRANCH}..."
  cd "$DEPLOY_DIR"
  git fetch --all --prune
  git checkout "$BRANCH"
  git reset --hard "origin/${BRANCH}"
  success "Repository updated."
else
  log "Cloning repository to ${DEPLOY_DIR}..."
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
  success "Repository cloned."
fi

cd "$DEPLOY_DIR"
apply_permissions

# -- Environment file -----------------------------------------------------------
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    warn ".env not found - copying from .env.example. Edit it before continuing."
    cp .env.example .env
    warn "Open ${DEPLOY_DIR}/.env and set real secrets, then rerun this script."
    exit 1
  else
    error ".env file missing and no .env.example found."
  fi
fi
success ".env file present."

# -- Build images ---------------------------------------------------------------
log "Building Docker images..."
$DC -f "$COMPOSE_FILE" build --no-cache --parallel
success "Images built."

# -- Stop existing containers ---------------------------------------------------
log "Stopping running containers..."
$DC -f "$COMPOSE_FILE" down --remove-orphans || true
success "Containers stopped."

# -- Run database migrations ----------------------------------------------------
log "Running Alembic migrations..."
$DC -f "$COMPOSE_FILE" run --rm backend alembic upgrade head
success "Migrations complete."

# -- Start all services ---------------------------------------------------------
log "Starting all services..."
$DC -f "$COMPOSE_FILE" up -d
success "Services started."

# -- Health check ---------------------------------------------------------------
wait_for_container_health "farmexa_backend" 24 5
wait_for_container_health "farmexa_frontend" 18 3

log "Waiting for API health check through nginx..."
RETRIES=0
MAX_RETRIES=18
until curl -sf "http://localhost:4002/api/v1/openapi.json" >/dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
    error "API did not become reachable through nginx within 90s. Check: $DC -f ${COMPOSE_FILE} logs"
  fi
  echo -n "."
  sleep 5
done
echo ""
success "API healthy at http://localhost:4002/api/v1/openapi.json"

# -- Show running containers ----------------------------------------------------
log "Running containers:"
$DC -f "$COMPOSE_FILE" ps

success "================================================================"
success " ${APP_NAME} deployed successfully!"
success " Internal URL : http://localhost:4002"
success " Public URL   : https://farmexa.arosoft.io"
success " API Docs     : https://farmexa.arosoft.io/docs"
success " Admin Login  : Set in .env -> SEED_ADMIN_EMAIL"
success "================================================================"
