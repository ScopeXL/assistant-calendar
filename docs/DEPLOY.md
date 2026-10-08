# Deploying Sunroom

How to run Sunroom with Docker Compose on a home server, behind your own HTTPS reverse proxy, with
a Raspberry Pi as the kitchen screen: path b in the [README](../README.md#install). Sunroom lives
in a folder of its own on the server, with a `docker-compose.yml` you edit by hand and start with
`docker compose up -d`. Household-specific values go in that file (or a `.env` beside it), never
into this repository. Portainer, if you use it, can show the logs and stop or start the container;
it doesn't need to manage it.

On a plain home network you can skip the proxy entirely: leave every variable empty and open
`http://<server>:8080`. Sunroom answers to local names and addresses on its own.

## What you need

- A Docker host with Docker Compose.
- For an HTTPS name: a reverse proxy with a subdomain for Sunroom. HTTPS lets phones install
  Sunroom to the home screen, keep working offline and reach it away from home.
- About 300 MB of disk, plus room for backups and photos.

## 1. Start Sunroom

1. On the server, make a folder for Sunroom and put the example compose file in it:

   ```sh
   sudo mkdir -p /opt/sunroom && cd /opt/sunroom
   sudo curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/ScopeXL/assistant-calendar/main/docker-compose.example.yml
   ```

   Any folder works, for example one named after the repo, next to your other apps.
2. Edit `docker-compose.yml` and fill in what applies, either in place of the `${…}` placeholders
   or in a `.env` file in the same folder (Compose reads it by itself):

   | Variable | Value |
   |---|---|
   | `APP_ALLOWED_HOSTS` | The name phones will use, e.g. `calendar.example.com` (comma-separated for several; `*.example.com` covers every name under it) |
   | `TRUSTED_PROXIES` | Your reverse proxy's address or Docker network (step 3) |
   | `TZ` | Your time zone, e.g. `America/New_York`. The setup on your phone suggests one too |
   | `APP_PASSWORD` | Optional. A household password that always wins over the one chosen in setup, 12 characters or more |
   | `APP_SECRET_KEY` | Optional. Without it, Sunroom makes one and keeps it on the volume. If you set it (`openssl rand -base64 48`), keep a copy in a password manager: changing it signs everyone out |

3. Keep the `volumes:` block at the end of the file, with `name: sunroom_data`. It creates the
   `sunroom_data` volume, where the database, the nightly backups and the photos live, with the
   right ownership by itself (and the commands in RESTORE.md find it by that name). To use a host
   folder instead, see *Troubleshooting*.
4. Another app already uses port 8080 on this server? Change only the left number of the
   `ports:` line, for example `"8081:8080"`, and point the proxy at that port.
5. Start it:

   ```sh
   docker compose up -d
   ```

   Within about a minute `docker compose ps` shows it **healthy** (so does Portainer's container
   list). `docker compose logs -f sunroom` follows the log.

## 2. Point the reverse proxy at it

- Forward your subdomain to the server on the host port from the `ports:` line (or put the
  container on the proxy's Docker network, remove the `ports:` lines, and forward to
  `sunroom:8080`). The proxy must pass the `Host` header through unchanged and set
  `X-Forwarded-Proto` (every common proxy does both by default).
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
  If another app behind the same proxy already has a `TRUSTED_PROXIES`, it's the same value.
- **The proxy runs on another machine:** use that machine's address.
- **Not sure:** open your Sunroom address on a phone and go through the setup until it stops
  with "doesn't trust the proxy yet". Sunroom's log (`docker compose logs sunroom`, or the
  container's **Logs** in Portainer) then has a line `csrf.proxy_not_trusted` with
  `proxy=<address>`. Use that address.

Then run `docker compose up -d` again to apply it. Never use `*` or `0.0.0.0/0`: Sunroom refuses
to start with them.

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

Each release prints these steps. In Sunroom's folder on the server:

1. `docker compose pull && docker compose up -d` (if you pinned a version in `image:`, change it
   to the new one first).
2. Wait for **healthy** (`docker compose ps`), then check `<your address>/api/version` shows the
   new version.

Before migrating, Sunroom copies the database into `/data/backups/pre-migrate/`. If a migration
fails, it refuses to start and the data is left exactly as it was. The kitchen screen picks up
the new version at its overnight restart.

**If Portainer manages it instead** (a stack pasted from the example): update the stack with
**Re-pull image and redeploy** switched on.

## Backups

- A verified copy is written every night at 03:30 (household time) into `/data/backups/`,
  keeping 14 daily and 8 weekly copies. **Settings → Backup** shows when the last one ran, and has
  **Back up now** and a download of the newest copy.
- Photos are files on the volume, not in the database. Include the whole `sunroom_data` volume in
  your host's own backups.
- To restore, see [RESTORE.md](RESTORE.md).

## Troubleshooting

**"Sunroom doesn't answer to the address …" (421).** The name in the browser isn't a local one
and isn't in `APP_ALLOWED_HOSTS`. Add it in `docker-compose.yml` and run `docker compose up -d`.

**A host folder instead of the volume.** Sunroom never runs as root: it runs as uid 10001, so a
folder you mount at `/data` must be writable by the user it runs as. The simplest is to run it as
the folder's owner: add `user: "1000:1000"` to the service, with the owner's ids from `id -u` and
`id -g`. Or give the folder to uid 10001: `sudo chown -R 10001:10001 <folder>`.

The container logs explain every refusal in plain words. The exit code says which step failed:

| Exit code | Meaning | Fix |
|---|---|---|
| 78 | A setting is invalid (the log names it, never its value) | Fix the setting named in the log, then `docker compose up -d` |
| 73 | `/data` isn't a mounted volume, isn't writable, is a network filesystem, or another instance is using it | Keep the example's `volumes:` block (the `sunroom_data` volume); with a host folder, see above. Run exactly one container per volume |
| 74 | Not enough disk space, or the pre-upgrade backup failed | Free disk space and start it again |
| 65 | The database was upgraded by a newer Sunroom than this image | Start the newer version, or restore the pre-upgrade backup (RESTORE.md) |
| 70 | A migration failed. Nothing was changed | Start the previous version (set it in `image:`) and report the log |

Live updates stuck on "connecting", or "checking every 30 seconds"? Your proxy is buffering the
stream: see step 2.
