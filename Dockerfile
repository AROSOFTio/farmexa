FROM node:20-alpine AS frontend_builder

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Cap Node heap so V8 GCs aggressively and stays within a constrained,
# heavily-loaded build host (raising it invites the kernel OOM-killer).
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN npm run build

FROM python:3.12-slim AS production

# Routing: keep the platform host exact, then add a low-priority wildcard for
# tenant workspaces (<slug>.arosoftlabs.com). The wildcard explicitly excludes
# reserved infrastructure/platform hosts so Farmexa does not claim those names.
LABEL maintainer="Farmexa Platform" \
    description="Farmexa ERP Coolify single-container deployment" \
    traefik.enable="true" \
    traefik.http.routers.farmexa-platform-http.entrypoints="http" \
    traefik.http.routers.farmexa-platform-http.rule="Host(`farm.arosoftlabs.com`)" \
    traefik.http.routers.farmexa-platform-http.priority="100" \
    traefik.http.routers.farmexa-platform-http.service="farmexa-platform" \
    traefik.http.routers.farmexa-platform.entrypoints="https" \
    traefik.http.routers.farmexa-platform.rule="Host(`farm.arosoftlabs.com`)" \
    traefik.http.routers.farmexa-platform.tls="true" \
    traefik.http.routers.farmexa-platform.priority="100" \
    traefik.http.routers.farmexa-platform.service="farmexa-platform" \
    traefik.http.routers.farmexa-wildcard-http.entrypoints="http" \
    traefik.http.routers.farmexa-wildcard-http.rule="HostRegexp(`[a-zA-Z0-9-]+\\.arosoftlabs\\.com`) && !Host(`farm.arosoftlabs.com`) && !Host(`www.arosoftlabs.com`) && !Host(`cp.arosoftlabs.com`) && !Host(`mail.arosoftlabs.com`) && !Host(`courses.arosoftlabs.com`) && !Host(`demo.arosoftlabs.com`) && !Host(`my.arosoftlabs.com`) && !Host(`arofi.arosoftlabs.com`) && !Host(`api.arosoftlabs.com`) && !Host(`admin.arosoftlabs.com`) && !Host(`support.arosoftlabs.com`) && !Host(`myfarm.arosoftlabs.com`)" \
    traefik.http.routers.farmexa-wildcard-http.priority="1" \
    traefik.http.routers.farmexa-wildcard-http.service="farmexa-platform" \
    traefik.http.routers.farmexa-wildcard.entrypoints="https" \
    traefik.http.routers.farmexa-wildcard.rule="HostRegexp(`[a-zA-Z0-9-]+\\.arosoftlabs\\.com`) && !Host(`farm.arosoftlabs.com`) && !Host(`www.arosoftlabs.com`) && !Host(`cp.arosoftlabs.com`) && !Host(`mail.arosoftlabs.com`) && !Host(`courses.arosoftlabs.com`) && !Host(`demo.arosoftlabs.com`) && !Host(`my.arosoftlabs.com`) && !Host(`arofi.arosoftlabs.com`) && !Host(`api.arosoftlabs.com`) && !Host(`admin.arosoftlabs.com`) && !Host(`support.arosoftlabs.com`) && !Host(`myfarm.arosoftlabs.com`)" \
    traefik.http.routers.farmexa-wildcard.tls="true" \
    traefik.http.routers.farmexa-wildcard.priority="1" \
    traefik.http.routers.farmexa-wildcard.service="farmexa-platform" \
    traefik.http.services.farmexa-platform.loadbalancer.server.port="80"

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
