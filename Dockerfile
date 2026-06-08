FROM node:20-alpine AS frontend_builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS production

LABEL maintainer="Farmexa Platform" \
    description="Farmexa ERP Coolify single-container deployment" \
    traefik.enable="true" \
    traefik.http.routers.farmexa-wildcard-http.entrypoints="http" \
    traefik.http.routers.farmexa-wildcard-http.rule="HostRegexp(`{subdomain:[a-zA-Z0-9-]+}.arosoftlabs.com`)" \
    traefik.http.routers.farmexa-wildcard-http.service="farmexa-wildcard" \
    traefik.http.routers.farmexa-wildcard.entrypoints="https" \
    traefik.http.routers.farmexa-wildcard.rule="HostRegexp(`{subdomain:[a-zA-Z0-9-]+}.arosoftlabs.com`)" \
    traefik.http.routers.farmexa-wildcard.tls="true" \
    traefik.http.routers.farmexa-wildcard.service="farmexa-wildcard" \
    traefik.http.services.farmexa-wildcard.loadbalancer.server.port="80"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/ ./
COPY --from=frontend_builder /frontend/dist /app/frontend_dist
COPY docker/start-coolify.sh /start-coolify.sh

RUN chmod +x /start-coolify.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1/health', timeout=5)"

CMD ["/start-coolify.sh"]
