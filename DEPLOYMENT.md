# Farmexa Production Deployment

Farmexa is designed for Contabo VPS, aaPanel, Cloudflare DNS, Docker Compose, PostgreSQL, Redis, FastAPI, Celery, and React.

## 1. Environment Variables

Copy `.env.example` to `.env` and set strong passwords and secrets. Required production values include:

- `PRIMARY_PLATFORM_DOMAIN=farmexa.arosoft.io`
- `DEFAULT_TENANT_DOMAIN_SUFFIX=arosoft.io`
- `TENANT_DOMAIN_TARGET_IP=<contabo-server-ip>`
- `CLOUDFLARE_API_TOKEN=<zone dns edit token>`
- `CLOUDFLARE_ZONE_ID=<cloudflare zone id>`
- `SMTP_USERNAME=farmexa@arosoft.io`
- `SMTP_FROM_EMAIL=farmexa@arosoft.io`
- `SMTP_FROM_NAME=Farmexa`

## 2. Cloudflare API Setup

Create a Cloudflare API token with Zone DNS edit access for `arosoft.io`. Save it as `CLOUDFLARE_API_TOKEN` and set `CLOUDFLARE_ZONE_ID`.

## 3. Wildcard DNS

Create a wildcard record:

`*.arosoft.io -> <contabo-server-ip>`

Farmexa still stores each tenant domain in the database and can create explicit DNS records during signup.

## 4. aaPanel Reverse Proxy

Point `farmexa.arosoft.io` and `*.arosoft.io` to the VPS. In aaPanel, proxy HTTP/HTTPS traffic to the Docker Nginx service at `http://127.0.0.1:4021`. Enable SSL for the platform domain and wildcard/domain certificates according to your aaPanel setup.

## 5. Docker Compose Deployment

Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## 6. Migrations

Run:

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

## 7. Seed Admin User

The backend seeds roles, plans, modules, platform settings, and the developer admin user on startup. Set `SEED_DEV_ADMIN_EMAIL` and `SEED_DEV_ADMIN_PASSWORD` before first boot.

## 8. Start Services

Verify:

```bash
docker compose -f docker-compose.prod.yml ps
```

## 9. System Health

Check `https://farmexa.arosoft.io/health` and the dev admin system health dashboard.

## 10. Test Tenant Signup

Open `https://farmexa.arosoft.io/register`, register a farm, and confirm the success page shows a workspace like `https://ngali.arosoft.io/login`.

## 11. Test Subdomain Login

Open the tenant workspace URL and sign in using the tenant admin email and password.

## 12. Test Trial Expiry

For manual testing, set a tenant trial end date to yesterday, then run:

```bash
docker compose -f docker-compose.prod.yml exec celery_worker celery -A app.tasks.celery_app call tasks.process_expired_trials
```

Operational modules should lock while profile, subscription, billing, support, and logout remain available.

## 13. Backup and Restore

Use `scripts/backup.sh` and `scripts/restore.sh` with the same `.env` values used by Docker Compose.
