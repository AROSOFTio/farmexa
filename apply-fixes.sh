#!/bin/bash
# ============================================================
# Apply all routing/DNS fixes and commit to repo
# Run from repo root
# ============================================================
set -euo pipefail

git add \
  backend/app/services/cloudflare_service.py \
  backend/app/utils/domains.py \
  backend/app/main.py \
  docker-compose.prod.yml \
  frontend/nginx.conf

git commit -m "fix: harden DNS provisioning and routing guards

- cloudflare_service: add is_infrastructure_host + is_reserved_slug guards
  so cp.*, mail.*, admin.* etc can never be auto-provisioned via the API
- domains.py: add 'myfarm' to RESERVED_SLUGS (used as CNAME target)
- main.py: add allow_origin_regex to CORSMiddleware so all provisioned
  tenant subdomains (*.arosoftlabs.com) can make API calls without
  needing each one listed statically in ALLOWED_ORIGINS
- docker-compose.prod.yml: bind adminer to 127.0.0.1 only (security)
- frontend/nginx.conf: use explicit server_name instead of catch-all _

CLOUDFLARE MANUAL STEPS REQUIRED (cannot be automated from code):
1. Change *.arosoftlabs.com DNS record from Proxied to DNS only
   (this stops cp.*, mail.*, www.* being captured by the wildcard)
2. Confirm farm.arosoftlabs.com A record is Proxied (orange cloud)
3. Confirm cp.arosoftlabs.com A record is DNS only (grey cloud)
   pointing to the server IP where Coolify listens directly

See farmexa-audit-and-fixes.md for full details."

echo "Committed. Run: git push origin main"
