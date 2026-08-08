#!/usr/bin/env bash
# Deploy FlintTask to the production VPS.
#
#   bash scripts/deploy.sh
#
# Frontend: the prerendered dist/ into /var/www/flint (keeping .well-known so
# certbot's renewal challenge survives). Backend: the server/ sources into
# /var/www/flint-api, then a systemd restart — which is also when the workspace
# migration runs, so the boot log is worth reading.
set -euo pipefail

HOST="${FLINT_HOST:-root@103.38.237.217}"
WEB_DIR=/var/www/flint
API_DIR=/var/www/flint-api
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

say "Building the frontend"
npm run build

say "Packing"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
# COPYFILE_DISABLE keeps macOS from smuggling ._* resource forks into the tar.
COPYFILE_DISABLE=1 tar -czf "$STAGE/dist.tgz" -C dist .
COPYFILE_DISABLE=1 tar -czf "$STAGE/server.tgz" \
  --exclude node_modules --exclude data --exclude '*.db*' \
  -C server .

say "Uploading"
scp -q "$STAGE/dist.tgz" "$STAGE/server.tgz" "$HOST:/tmp/"

say "Installing on $HOST"
ssh "$HOST" 'bash -s' <<REMOTE
set -euo pipefail

# --- frontend ---
mkdir -p $WEB_DIR
find $WEB_DIR -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} +
tar -xzf /tmp/dist.tgz -C $WEB_DIR
rm -f /tmp/dist.tgz

# --- backend ---
tar -xzf /tmp/server.tgz -C $API_DIR
rm -f /tmp/server.tgz
cd $API_DIR
npm install --omit=dev --no-audit --no-fund >/dev/null

# Without NODE_ENV=production every restart re-seeds the demo accounts, one of
# which (avery@workspace.dev) is an admin sharing a published password.
grep -q '^NODE_ENV=' /etc/flint-api.env || echo 'NODE_ENV=production' >> /etc/flint-api.env

systemctl restart flint-api
sleep 2
systemctl is-active flint-api
REMOTE

say "Boot log (the migration reports itself here)"
ssh "$HOST" 'journalctl -u flint-api -n 40 --no-pager'

say "Health"
curl -fsS https://flinttask.com/api/health && echo
