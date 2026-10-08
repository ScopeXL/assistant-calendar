# Deploying Sunroom

How to run Sunroom on a Docker host (Portainer) behind your own HTTPS reverse proxy, with a
Raspberry Pi as the kitchen screen: path b in the [README](../README.md#install). Everything
household-specific goes into Portainer's stack variables, never into this repository.

On a plain home network you can skip the proxy entirely: deploy the stack, leave every variable
empty, and open `http://<server>:8080`. Sunroom answers to local names and addresses on its own.

## What you need

- A Docker host, managed with Portainer (or plain `docker compose`).
- For an HTTPS name: a reverse proxy with a subdomain for Sunroom. HTTPS lets phones install
  Sunroom to the home screen, keep working offline and reach it away from home.
- About 300 MB of disk, plus room for backups and photos.

## 1. Create the stack

1. In Portainer: **Stacks → Add stack**. Name it `sunroom`.
2. Choose **Web editor** and paste [`docker-compose.example.yml`](../docker-compose.example.yml).
3. Under **Environment variables**, add what applies:

   | Variable | Value |
   |---|---|
   | `APP_ALLOWED_HOSTS` | The name phones will use, e.g. `calendar.example.com` (comma-separated for several; `*.example.com` covers every name under it) |
   | `TRUSTED_PROXIES` | Your reverse proxy's address or Docker network (step 3) |
   | `TZ` | Your time zone, e.g. `America/New_York`. The setup on your phone suggests one too |
   | `APP_PASSWORD` | Optional. A household password that always wins over the one chosen in setup, 12 characters or more |
   | `APP_SECRET_KEY` | Optional. Without it, Sunroom makes one and keeps it on the volume. If you set it (`openssl rand -base64 48`), keep a copy in a password manager: changing it signs everyone out |

4. **Deploy the stack.** The container turns **healthy** within about a minute.

All data lives in the `sunroom_data` named volume: the database, nightly backups and photos. A
named volume gets the right ownership automatically; for a bind mount, see *Troubleshooting*.

## 2. Point the reverse proxy at it

- Forward your subdomain to the container on port `8080` (or join the container to the proxy's
  Docker network and remove the `ports:` lines). The proxy must pass the `Host` header through
  unchanged and set `X-Forwarded-Proto` (every common proxy does both by default).
- Turn on **HTTP/2** for the host. Browsers allow only six HTTP/1.1 connections per site, and
  the live-update stream keeps one open on every phone and screen.
- Live updates use server-sent events on `/api/events`. They must not be buffered or compressed:

  | Proxy | What to set |
  |---|---|
  | Nginx Proxy Manager / nginx | Nothing is usually needed: Sunroom sends `X-Accel-Buffering: no`. If updates arrive late, add a custom location `/api/events` with `proxy_http_version 1.1; proxy_set_header Connection ""; proxy_buffering off; gzip off;` |
  | Traefik | Don't attach the `buffering` middleware to this router. If you use `compress`, set `excludedContentTypes: [text/event-stream]` |
  | Caddy | `reverse_proxy` already streams events. If you use `encode`, exclude the stream: `@notsse not path /api/events` then `encode @notsse zstd gzip` |
  | Cloudflare (proxied DNS or Tunnel) | Add a Cache Rule that bypasses `/api/*` |

## 3. Set TRUSTED_PROXIES

Sunroom believes forwarded headers (https, the real client address, the public name) only from
addresses you list. Until the proxy is listed, Sunroom refuses changes made through it, with the
message "Sunroom is behind an https address but doesn't trust the proxy yet".

- **The proxy runs in Docker on the same host:** use its Docker network, e.g. `172.18.0.0/16`.
  `docker network inspect <network> --format '{{(index .IPAM.Config 0).Subnet}}'` prints it.
- **The proxy runs on another machine:** use that machine's address.
- **Not sure:** open your Sunroom address on a phone and go through the setup until it stops
  with "doesn't trust the proxy yet". Sunroom's log (Portainer: the container's **Logs**) then
  has a line `csrf.proxy_not_trusted` with `proxy=<address>`. Use that address.

Update the stack. Never use `*` or `0.0.0.0/0`: Sunroom refuses to start with them.

## 4. First visit

Open the address on a phone and follow the setup: a household password, your household's name
and time zone, the people who live here, a parent PIN. Then:

- **iPhone:** Share → **Add to Home Screen**, and open Sunroom from there.
- **Android:** Chrome's menu → **Install app**.

**More → Settings → About** shows the version, "Live updates: connected", and under "Sunroom
sees it as", your phone's own address (not the proxy's) once `TRUSTED_PROXIES` is right.

## 5. The kitchen screen

On the Raspberry Pi (Raspberry Pi OS 64-bit with desktop):

```sh
curl -fsSL https://raw.githubusercontent.com/ScopeXL/assistant-calendar/main/kiosk/install.sh | bash -s -- --display-only --url https://calendar.example.com
```

After the restart it shows a code; type it on your phone under **More → Pair a display**.
[KIOSK.md](KIOSK.md) has the details.

## Updating

Each release prints these steps:

1. **Stacks → sunroom → Editor**. Keep `scopexl/sunroom:latest`, or set a specific version.
2. **Update the stack** with **Re-pull image and redeploy** switched on.
3. Wait for **healthy**, then check `<your address>/api/version` shows the new version.

Before migrating, Sunroom copies the database into `/data/backups/pre-migrate/`. If a migration
fails, it refuses to start and the data is left exactly as it was. The kitchen screen picks up
the new version at its overnight restart.

## Backups

- A verified copy is written every night at 03:30 (household time) into `/data/backups/`,
  keeping 14 daily and 8 weekly copies. **Settings → Backup** shows when the last one ran, and has
  **Back up now** and a download of the newest copy.
- Photos are files on the volume, not in the database. Include the whole `sunroom_data` volume in
  your host's own backups.
- To restore, see [RESTORE.md](RESTORE.md).

## Troubleshooting

**"Sunroom doesn't answer to the address …" (421).** The name in the browser isn't a local one
and isn't in `APP_ALLOWED_HOSTS`. Add it and update the stack.

The container logs explain every refusal in plain words. The exit code says which step failed:

| Exit code | Meaning | Fix |
|---|---|---|
| 78 | A setting is invalid (the log names it, never its value) | Fix the stack variable named in the log |
| 73 | `/data` isn't a mounted volume, isn't writable, is a network filesystem, or another instance is using it | Use the named volume from the example, or `chown -R 10001:10001` the host folder, or set `user:` to the folder's owner. Run exactly one container per volume |
| 74 | Not enough disk space, or the pre-upgrade backup failed | Free disk space and redeploy |
| 65 | The database was upgraded by a newer Sunroom than this image | Redeploy the newer version, or restore the pre-upgrade backup (RESTORE.md) |
| 70 | A migration failed. Nothing was changed | Redeploy the previous version and report the log |

Live updates stuck on "connecting", or "checking every 30 seconds"? Your proxy is buffering the
stream: see step 2.
