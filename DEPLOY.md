# Deploying FlintTask

Production is **https://flinttask.com**, served from a single Ubuntu 22.04 VPS
at **103.38.237.217**, with the domain proxied through Cloudflare (SSL mode
Full; the origin holds a Let's Encrypt cert renewed by certbot webroot + a
deploy hook that reloads nginx).

To confirm you are looking at the right box, ask the origin directly — Cloudflare
hides it from DNS:

```bash
curl -k -H "Host: flinttask.com" https://103.38.237.217/api/health   # {"ok":true}
```

## The one command

```bash
bash scripts/deploy.sh
```

It builds, uploads, restarts, and then tails the boot log. Override the target
with `FLINT_HOST=user@host` if the box ever moves.

## Access (read this before assuming you're blocked)

**As of 2026-08-08 the Mac's `~/.ssh/id_ed25519` is authorised on the box**, so
`ssh root@103.38.237.217` just works. Before that there was no key and no CI —
deploys were hand-driven by an `expect` wrapper fed the root password:

```
# usage: ssh.exp <host> <password> <remote-command>
# usage: scp.exp <password> <local> <remote>
```

Those wrappers lived in a session scratchpad, so nothing about that setup
survived a session — which is why "deploy it" kept turning into "I can't reach
the server". If a future box ever loses the key, restore access the same way:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@103.38.237.217
```

Never handle the root password directly. Note that `~/.ssh/config` has **no**
entry for .217 — `xommuaban-vps` (103.38.237.40) and `dmticket`
(157.66.25.152) are different machines; don't mistake them for this one.

## Back up before restarting

The restart is when schema migrations run, and they are not reversible. Snapshot
first — `VACUUM INTO` captures the WAL, which a plain `cp` of `flint.db` does
not (the file is usually near-empty with everything still in `flint.db-wal`):

```bash
ssh root@103.38.237.217 'TS=$(date +%Y%m%d-%H%M%S); mkdir -p /root/backups/$TS
  cd /var/www/flint-api
  DEST=/root/backups/$TS/flint.db node -e "const D=require(\"better-sqlite3\");new D(\"data/flint.db\",{readonly:true}).prepare(\"VACUUM INTO ?\").run(process.env.DEST)"
  tar -czf /root/backups/$TS/flint-api.tgz --exclude node_modules -C /var/www/flint-api .
  tar -czf /root/backups/$TS/flint-web.tgz -C /var/www/flint .
  cp /etc/flint-api.env /root/backups/$TS/; echo $TS > /root/backups/LATEST'
```

`/root/backups/LATEST` names the newest snapshot.

## Layout on the box

| Piece | Where |
|---|---|
| Frontend (static Vite build) | `/var/www/flint` |
| Backend (Node + Express) | `/var/www/flint-api`, port 3001 |
| systemd unit | `flint-api` (`/etc/systemd/system/flint-api.service`) |
| Environment | `/etc/flint-api.env`, chmod 600 |
| Database (SQLite) | `/var/www/flint-api/data/flint.db` |
| nginx | `/api/` → `127.0.0.1:3001`; WebSocket map in `/etc/nginx/conf.d/flint-ws.conf` |

`npm run build` prerenders the public pages, so `dist/` contains
`index.html` (landing, canonical `/`), `api-docs.html`, and `app.html` (the
noindex SPA shell). The nginx SPA fallback is `try_files $uri $uri.html
/app.html` — **not** `index.html`, which is the landing page. Keep
`/var/www/flint/.well-known` when replacing the directory or certbot renewal
breaks; `scripts/deploy.sh` already does.

Pack tarballs with `COPYFILE_DISABLE=1` so macOS doesn't smuggle `._*` resource
forks onto the server.

## Environment that matters

`NODE_ENV=production` **must** be set in `/etc/flint-api.env`. Without it every
restart re-seeds four demo accounts — including `avery@workspace.dev` with role
`admin` and the shared password `demo1234`. `scripts/deploy.sh` appends it if it
is missing.

`ADMIN_PASSWORD`, when set, is authoritative: boot reconciles the stored hash to
match it. When unset, a random password is minted on first boot and printed once
to the journal, so an unconfigured box is inaccessible rather than open.

`JWT_SECRET` is minted randomly and persisted on first boot if absent. Rotating
it signs everyone out.

## After deploying

The workspace migration runs on the first restart carrying the multi-tenancy
change. It moves the old shared document into a real workspace owned by the
earliest admin and carries over everyone who could already see it, then says so:

```
[tenancy] Migrated the shared workspace document into "…" (<id>).
          Owner: … Members carried over: …
```

Read that line and remove anyone who should not be there:

```bash
curl -s https://flinttask.com/api/workspace/members -H "Authorization: Bearer <token>"
curl -s -X DELETE https://flinttask.com/api/workspace/members/<userId> -H "Authorization: Bearer <token>"
```

Then ping IndexNow so Bing re-crawls: `node scripts/indexnow-ping.mjs`.

## Known production debt

- The DB predates the 2026-08-07 credential hardening, so it may still hold the
  seeded demo accounts. New code never creates them, but it does not delete
  existing rows either — reset or remove them on the box.
- Cloudflare blocks AI crawlers (GPTBot and friends) with a 403 at the edge; the
  origin serves them fine. Turn off "Block AI bots" (Security → Bots) to enable
  GEO. Googlebot is unaffected.
- Uploaded files are not scoped per workspace. Ids are 128-bit random so they
  aren't enumerable, but the check belongs there.
