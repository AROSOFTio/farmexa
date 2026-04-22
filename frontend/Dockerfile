# ─────────────────────────────────────────────────────────────
# Frontend Production Dockerfile
# Stage 1: Build React app
# Stage 2: Serve with Nginx
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM nginx:alpine AS production

LABEL maintainer="PERP Platform"
LABEL description="Poultry ERP Frontend — React + Vite"

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -q --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
