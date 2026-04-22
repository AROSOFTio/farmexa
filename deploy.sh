#!/usr/bin/env bash
# ==============================================================================
# PERP / Farmexa — Production Deployment Script
# Repo:    https://github.com/AROSOFTio/farmexa.git
# Deploy:  /var/www/wwwroot/farmexa.arosoft.io
# Port:    4002 (internal nginx → reverse-proxied by host Nginx)
# ==============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
APP_NAME="farmexa"
DEPLOY_DIR="/var/www/wwwroot/farmexa.arosoft.io"
REPO_URL="https://github.com/AROSOFTio/farmexa.git"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="/var/log/${APP_NAME}-deploy.log"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()     { echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}[✔] $*${NC}" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[!] $*${NC}" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[✘] $*${NC}" | tee -a "$LOG_FILE"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
log "Starting ${APP_NAME} deployment — branch: ${BRANCH}"

command -v docker   >/dev/null 2>&1 || error "Docker not found. Install Docker first."
command -v git      >/dev/null 2>&1 || error "Git not found."

# Ensure Docker Compose v2 (plugin) or v1 (standalone)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  error "Docker Compose not found."
fi

# ── Clone or update repository ────────────────────────────────────────────────
if [ -d "$DEPLOY_DIR/.git" ]; then
  log "Pulling latest code from ${BRANCH}…"
  cd "$DEPLOY_DIR"
  git fetch --all --prune
  git checkout "$BRANCH"
  git reset --hard "origin/${BRANCH}"
  success "Repository updated."
else
  log "Cloning repository to ${DEPLOY_DIR}…"
  mkdir -p "$DEPLOY_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
  success "Repository cloned."
fi

cd "$DEPLOY_DIR"

# ── Environment file ──────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    warn ".env not found — copying from .env.example. EDIT IT before continuing."
    cp .env.example .env
    warn ">>> Open ${DEPLOY_DIR}/.env and set real secrets, then re-run this script."
    exit 1
  else
    error ".env file missing and no .env.example found."
  fi
fi
success ".env file present."

# ── Pull images / build ───────────────────────────────────────────────────────
log "Building Docker images…"
$DC -f "$COMPOSE_FILE" build --no-cache --parallel
success "Images built."

# ── Stop existing containers gracefully ──────────────────────────────────────
log "Stopping running containers…"
$DC -f "$COMPOSE_FILE" down --remove-orphans || true
success "Containers stopped."

# ── Run database migrations ───────────────────────────────────────────────────
log "Running Alembic migrations…"
$DC -f "$COMPOSE_FILE" run --rm backend alembic upgrade head
success "Migrations complete."

# ── Start all services ────────────────────────────────────────────────────────
log "Starting all services…"
$DC -f "$COMPOSE_FILE" up -d
success "Services started."

# ── Health check ──────────────────────────────────────────────────────────────
log "Waiting for backend health check…"
RETRIES=0
MAX_RETRIES=18   # 18 × 5s = 90s max
until curl -sf "http://localhost:4002/health" >/dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
    error "Backend did not become healthy within 90s. Check: docker compose -f ${COMPOSE_FILE} logs"
  fi
  echo -n "."
  sleep 5
done
echo ""
success "Backend healthy at http://localhost:4002"

# ── Show running containers ───────────────────────────────────────────────────
log "Running containers:"
$DC -f "$COMPOSE_FILE" ps

success "================================================================"
success " ${APP_NAME} deployed successfully!"
success " Internal URL : http://localhost:4002"
success " Public URL   : https://farmexa.arosoft.io"
success " API Docs     : https://farmexa.arosoft.io/docs"
success " Admin Login  : Set in .env → SEED_ADMIN_EMAIL"
success "================================================================"
