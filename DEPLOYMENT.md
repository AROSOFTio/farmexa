# Farmexa Production Deployment

Farmexa is designed for Contabo VPS, aaPanel, Cloudflare DNS, Docker Compose, PostgreSQL, Redis, FastAPI, Celery, and React.

aaPanel and Cloudflare manage public HTTPS. The Docker stack only exposes the internal HTTP app gateway on port `4021`.

## 1. Environment Variables

Copy `.env.example` to `.env` and set strong passwords and secrets. Required production values include:

- `PRIMARY_PLATFORM_DOMAIN=myfarm.arosoftlabs.com`
- `PLATFORM_HOSTS=myfarm.arosoftlabs.com,farm.arosoftlabs.com,arosoftlabs.com,localhost,127.0.0.1`
- `DEFAULT_TENANT_DOMAIN_SUFFIX=arosoftlabs.com`
- `TENANT_DOMAIN_TARGET_IP=<coolify-server-public-ip>`
- `CLOUDFLARE_API_TOKEN=<zone dns edit token>`
- `CLOUDFLARE_ZONE_ID=<cloudflare zone id>`
- `ENABLE_CLOUDFLARE_DNS_AUTOMATION=true`
- `TENANT_DNS_TARGET_TYPE=A`
- `TENANT_DNS_PROXIED=true`
- `SMTP_HOST=<smtp host>`
- `SMTP_USERNAME=farmexa@arosoftlabs.com`
- `SMTP_PASSWORD=<smtp password or app password>`
- `SMTP_FROM_EMAIL=farmexa@arosoftlabs.com`
- `SMTP_FROM_NAME=Farmexa`

## 2. SSL Ownership

Do not add manual `ssl_certificate`, certbot, or Let's Encrypt paths to repo deployment files or server vhost files. Use aaPanel SSL for the origin certificate and Cloudflare DNS/proxy settings for public traffic.

For aaPanel Let's Encrypt file verification, keep the Cloudflare record as DNS only until the certificate is issued. After aaPanel shows the certificate as deployed, Cloudflare can be switched back to proxied if needed.

## 3. Cloudflare API Setup

Create a Cloudflare API token with Zone DNS edit access for `arosoftlabs.com` if Farmexa should create tenant DNS records. Save it as `CLOUDFLARE_API_TOKEN` and set `CLOUDFLARE_ZONE_ID`.

## 4. Wildcard DNS

Create a wildcard record:

`*.arosoftlabs.com -> <contabo-server-ip>`

Farmexa still stores each tenant domain in the database and creates explicit Cloudflare DNS records during signup when Cloudflare credentials are configured.

## 5. aaPanel Reverse Proxy

Point the site domain to the VPS. For the current deployment, use:

- `myfarm.arosoftlabs.com -> <coolify-server-public-ip>`
- `*.arosoftlabs.com -> <coolify-server-public-ip>`

In aaPanel, create the site, apply SSL using aaPanel, then configure reverse proxy traffic to the Docker gateway:

`http://127.0.0.1:4021`

Do not paste certificate blocks into nginx manually. Do not run certbot from this repository.

## 5A. Coolify Domains

For the single-container Coolify deployment, add both the platform domain and the wildcard tenant domain to the application domains:

- `https://myfarm.arosoftlabs.com`
- `https://*.arosoftlabs.com`

Keep direction set to allow non-www. If tenant URLs such as `https://benjamin.arosoftlabs.com/login` show `no available server`, DNS may already point to the server, but Coolify has not routed the wildcard host to this application yet.

The root Dockerfile also ships Traefik catch-all labels for `*.arosoftlabs.com`, so new tenant hosts do not need to be added one by one. If Coolify rewrites application labels, open **Advanced > Container Labels**, disable read-only editing, and make sure the labels beginning with `traefik.http.routers.farmexa-wildcard` are present after redeploy.

## 6. Docker Compose Deployment

Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## 7. Migrations

Run:

```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

## 8. Seed Admin User

The backend seeds roles, plans, modules, platform settings, and the developer admin user on startup. Set `SEED_DEV_ADMIN_EMAIL` and `SEED_DEV_ADMIN_PASSWORD` before first boot.

## 9. Start Services

Verify:

```bash
docker compose -f docker-compose.prod.yml ps
```

## 10. System Health

Check `https://myfarm.arosoftlabs.com/health` and the dev admin system health dashboard.

## 11. Test Tenant Signup

Open `https://myfarm.arosoftlabs.com/register`, register a farm, and confirm the success page shows a workspace like `https://ngali.arosoftlabs.com/login`.

## 12. Test Subdomain Login

Open the tenant workspace URL and sign in using the tenant admin email and password.

## 13. Test Trial Expiry

For manual testing, set a tenant trial end date to yesterday, then run:

```bash
docker compose -f docker-compose.prod.yml exec celery_worker celery -A app.tasks.celery_app call tasks.process_expired_trials
```

Operational modules should lock while profile, subscription, billing, support, and logout remain available.

## 14. Backup and Restore

Use `scripts/backup.sh` and `scripts/restore.sh` with the same `.env` values used by Docker Compose.
