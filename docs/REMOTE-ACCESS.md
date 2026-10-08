# Remote access and HTTPS

Sunroom works on your home network with nothing to set up: phones open
`http://sunroom.local:8080` (or the server's numbered address) and everything works. This page
is for when you want more: Sunroom on your phone away from home, the app installed on Android,
or Sign in with Google. Those need Sunroom at an `https://` address, and this page shows four ways
to get one. The commands were checked against each tool's own documentation on 2026-10-08.

## What works without HTTPS

| | Plain http, at home | An https address |
|---|---|---|
| The calendar, lists, chores, meals, countdowns, photos, weather and live updates | Yes | Yes |
| Signing in, pairing the kitchen screen, and Add a phone (typing the code, or scanning the QR code with the phone's camera) | Yes | Yes |
| Adding photos from a phone | Yes | Yes |
| On an iPhone's or iPad's home screen, opening like an app | Yes, with iOS and iPadOS 26 | Yes |
| Installed as an app on Android (Chrome's **Install app**) | A home-screen shortcut only | Yes |
| Opening when the server can't be reached (it says it's offline instead of showing a browser error) | No | Yes |
| The kitchen screen on a Raspberry Pi | Yes: the installer sets the Pi's browser up for it | Yes |
| A tablet on the wall keeping its own screen awake | No: set the tablet never to sleep ([HARDWARE.md](HARDWARE.md)) | Yes |
| The **Copy** button beside the Google helper's address | No: select the address and copy it by hand | Yes |
| Sign in with Google | No: Google refuses `http://` addresses (its other two ways work, [SYNC.md](SYNC.md)) | Yes |
| Using Sunroom away from home | No | Yes, with the ways below |

An `http://` address and an `https://` one are separate sign-ins: when a phone moves to the new
address, sign in there once and add the new address to the home screen (and remove the old one).

## Which way

| Way | Away from home | What you need | Who can reach the sign-in page | Who else sees the traffic |
|---|---|---|---|---|
| [Stay at home](#stay-at-home-the-default) | No | Nothing | Your home network | Nobody |
| [Tailscale](#tailscale-recommended) (recommended) | Yes, on phones with the Tailscale app | A free Tailscale account | Only your own devices | Nobody: it's encrypted from end to end |
| [Your own HTTPS proxy](#your-own-https-reverse-proxy) | If your proxy is on the internet | A proxy you already run | Depends on your proxy | Usually nobody |
| [Caddy](#caddy-with-a-lets-encrypt-certificate) | Yes, in any browser | A domain name, two ports opened on your router | Anyone on the internet | Nobody |
| [Cloudflare Tunnel](#cloudflare-tunnel) | Yes, in any browser | A domain name on Cloudflare | Anyone on the internet | Cloudflare |

## Stay at home (the default)

- Nothing to set up. Phones on the home Wi-Fi use `http://sunroom.local:8080`, or the server's
  numbered address (the Pi's installer prints it).
- **Never forward port 8080 on your router.** That would put Sunroom on the internet over plain
  http, and the household password would cross the internet unencrypted. Use one of the ways
  below instead.
- If your router has its own VPN and phones use it away from home, they can reach the server's
  numbered address through it (`.local` names usually don't work over a VPN).

## The two settings

Every way below needs `TRUSTED_PROXIES`, and all but Tailscale need `APP_ALLOWED_HOSTS`. Sunroom
reads both from its environment: change them, then restart Sunroom.

- **`APP_ALLOWED_HOSTS`**: the name in your https address, for example `calendar.example.com`
  (several are separated by commas; `*.example.com` covers every name under it). Not needed for
  Tailscale's `.ts.net` names: Sunroom accepts those by itself, as it does `.local`, `.lan`,
  `.home`, `.home.arpa` and `.internal` names and numbered addresses.
- **`TRUSTED_PROXIES`**: the address the proxy's connections come from, as Sunroom sees them.
  Only connections from these addresses may tell Sunroom "this came in over https" and which
  phone it came from. Several are separated by commas; a range like `172.18.0.0/16` works.
  Never `*` or `0.0.0.0/0`: Sunroom refuses to start with them.

Where to put them:

| How you run Sunroom | Where | Then |
|---|---|---|
| All on the Pi, from the installer | Add a line such as `TRUSTED_PROXIES=172.18.0.1` to `/opt/sunroom/.env` (`sudo nano /opt/sunroom/.env`) | `cd /opt/sunroom && sudo docker compose up -d` |
| Docker Compose ([DEPLOY.md](DEPLOY.md)) | In `docker-compose.yml`, or a `.env` file beside it | `docker compose up -d` in that folder |
| Portainer, Unraid, CasaOS, Synology | The container's environment variables | Redeploy or restart the container |

What `TRUSTED_PROXIES` should be:

| Where the proxy runs | `TRUSTED_PROXIES` |
|---|---|
| On the computer that runs Sunroom, outside Docker (Tailscale, Caddy installed as a package, Cloudflare's `cloudflared` as a service) | The gateway of Sunroom's Docker network, which this prints, for example `172.18.0.1`: `sudo docker inspect sunroom --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'` (use your container's name if it isn't `sunroom`). Not `127.0.0.1`: Docker passes the proxy's connections on to Sunroom from the gateway |
| In Docker, on the same computer | That Docker network's range, for example `172.18.0.0/16` ([DEPLOY.md](DEPLOY.md), step 3) |
| On another computer | That computer's address, for example `192.168.1.30` |
| Not sure | Open the https address and try to sign in. It stops with "Sunroom is behind an https address but doesn't trust the proxy yet", and Sunroom's log then has a line `csrf.proxy_not_trusted` that names the proxy's address: use that address. The log is `sudo docker logs sunroom` on the Pi, or `docker compose logs sunroom` in Sunroom's folder |

## Tailscale (recommended)

Tailscale joins your phones and the computer that runs Sunroom into a private network of your
own, called a tailnet. Sunroom gets an https address with a real certificate, it works at home
and away, nothing changes on your router, and only your own devices can reach it. Tailscale's
free Personal plan covers a family (up to six people when this was written).

1. **Make a Tailscale account** at [tailscale.com](https://tailscale.com).
2. **Turn on HTTPS for your tailnet.** In Tailscale's admin console, open **DNS**, check that
   **MagicDNS** is on, and under **HTTPS Certificates** choose **Enable HTTPS**. Sunroom's address
   will be `https://<machine name>.<tailnet name>.ts.net`. Tailscale publishes these names in
   public certificate logs, so if the server's machine name says anything private (a family name,
   say), rename the machine in the admin console first.
3. **Install Tailscale on the computer that runs Sunroom** (the Pi itself, if everything is on
   the Pi):

   ```sh
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```

   Open the link it prints and sign in. On a NAS, use Tailscale's package for it instead
   (Tailscale's own install pages list them).
4. **Serve Sunroom on the tailnet:**

   ```sh
   sudo tailscale serve --bg 8080
   ```

   If you changed the left number of Sunroom's `ports:` line, use that number. It prints the
   https address, and it keeps serving after a restart. `sudo tailscale serve status` shows it
   again; `sudo tailscale serve reset` turns it off. Tailscale streams live updates by itself.
5. **Trust it:** set `TRUSTED_PROXIES` to the Docker gateway (see *The two settings*) and
   restart Sunroom. `APP_ALLOWED_HOSTS` isn't needed.
6. **On each phone:** install the Tailscale app (App Store or Google Play), sign in to your
   tailnet, and leave it connected. Invite the rest of the family from the **Users** page of the
   admin console. Then open the https address, sign in with the household password, and add it
   to the home screen.
7. **Check it** (see *Check that it worked*).

The kitchen screen can stay on its home-network address; nothing changes for it.

**Sign in with Google over Tailscale.** Once step 5 is done, Google's sign-in works at the
`.ts.net` address. The redirect address to add to your Google app is
`https://<machine name>.<tailnet name>.ts.net/api/calendar-sync/google/callback`; Sunroom shows
the exact one in its Sign in with Google steps (Settings → Calendars & accounts → Add an
account). Google's rules accept it: it's https, with a real domain name. Google never connects to
it; only your phone's browser comes back to it.

## Your own HTTPS reverse proxy

If you already run one (Nginx Proxy Manager, Traefik, Caddy and so on), add Sunroom like any
other app:

- Forward your name to Sunroom's port on the server (`http://<server>:8080`), or to
  `sunroom:8080` when the proxy and Sunroom share a Docker network.
- Pass the `Host` header through unchanged, and set `X-Forwarded-Proto` (and `X-Forwarded-For`).
  Every common proxy does all three by default.
- Live updates stream from `/api/events`: they must not be buffered or compressed, and HTTP/2
  should be on. [DEPLOY.md](DEPLOY.md), step 2, has the setting for each proxy.
- Set `APP_ALLOWED_HOSTS` to your name and `TRUSTED_PROXIES` to the proxy's address.
- If the name can be reached from the internet, so can Sunroom's sign-in page. Finish the setup
  before you open it up, and choose a long household password. Sunroom locks an address out for
  a while after 5 wrong passwords in 15 minutes.

## Caddy with a Let's Encrypt certificate

Caddy is a web server that fetches and renews its own certificates. With it, Sunroom is at your
own name, such as `calendar.example.com`, from any browser. You need:

- a domain name whose `A` record (and `AAAA`, if you have IPv6) points at your home's internet
  address; if that address changes now and then, your DNS provider's dynamic DNS keeps it up to
  date;
- ports 80 and 443 forwarded on your router to the computer that runs Caddy (usually the one
  that runs Sunroom).

1. **Install Caddy:** follow the "Debian, Ubuntu, Raspbian" steps on
   [caddyserver.com/docs/install](https://caddyserver.com/docs/install). It then runs as a
   service called `caddy`.
2. **Point it at Sunroom:** open its settings with `sudo nano /etc/caddy/Caddyfile` and replace
   what's there with:

   ```
   calendar.example.com {
       reverse_proxy localhost:8080
   }
   ```

3. **Apply it:** `sudo systemctl reload caddy`. Caddy fetches the certificate by itself (from
   Let's Encrypt, or ZeroSSL if that fails), renews it, and sends `http://` visits to `https://`.
   It streams live updates without any extra setting. Its log is
   `journalctl -u caddy --no-pager | less +G`.
4. **Tell Sunroom:** `APP_ALLOWED_HOSTS=calendar.example.com`, and `TRUSTED_PROXIES` set to the
   Docker gateway; restart Sunroom.
5. **Check it** (see *Check that it worked*).

Anyone on the internet can now reach Sunroom's sign-in page, so finish the setup first and use a
long household password. If Caddy runs in Docker instead, put it on a network with Sunroom, use
`reverse_proxy sunroom:8080`, and set `TRUSTED_PROXIES` to that network's range.

Caddy can also make an https address for the home network alone, without a domain
(`tls internal`), but then every phone has to be set up to trust Caddy's own certificate
authority. That's for people who already know how; most households are better off with
Tailscale.

## Cloudflare Tunnel

A small program from Cloudflare, `cloudflared`, runs on the server and connects out to
Cloudflare, which gives your name an https address. No ports are opened on your router.

**What Cloudflare sees.** Cloudflare holds the https end of the connection, so traffic is
decrypted at Cloudflare before it travels on to your server. Cloudflare can see every page,
event and photo that passes, and the household password whenever someone signs in. If that
matters to your family, use Tailscale instead.

You need a domain name whose DNS is run by Cloudflare. Cloudflare moves its menus now and then;
these are the names it uses now, and its guide "Create a tunnel (dashboard)" has the current
ones.

1. **Make the tunnel:** in the Cloudflare dashboard, go to **Networking → Tunnels → Create a
   tunnel**, give it a name such as `sunroom`, pick your system, and run the install command it
   shows on the server. It looks like `sudo cloudflared service install <token>`. The token is the
   tunnel's password: don't share it or paste it anywhere public.
2. **Route your name to Sunroom:** open the tunnel, then **Routes → Add route → Published
   application**. Enter a subdomain (`calendar`), choose your domain, set the service URL to
   `http://localhost:8080`, and add the route.
3. **Tell Sunroom:** `APP_ALLOWED_HOSTS=calendar.example.com`, and `TRUSTED_PROXIES` set to the
   Docker gateway (when `cloudflared` runs as a service on the server); restart Sunroom.
4. **Leave Rocket Loader off** for this name: Cloudflare's own documentation says it needs a looser
   security policy than Sunroom allows.
5. **Check it** (see *Check that it worked*).

Sunroom marks its answers and the family's photos as not to be cached, and Cloudflare follows
that. A Cache Rule that bypasses the cache for `/api/*` is still a good safety net
([DEPLOY.md](DEPLOY.md), step 2). Live updates stream through the tunnel as they are.

## Check that it worked

On a phone, open the new https address, sign in, and go to **More → Settings → About**. Under
**Connection**:

- **Live updates** says "connected".
- **This device uses** shows your `https://` address. If it shows `http://` with "Your proxy says
  https, but Sunroom doesn't trust it yet: set TRUSTED_PROXIES.", fix `TRUSTED_PROXIES`.
- **Sunroom sees it as** shows your phone's own address: one starting with `100.` over
  Tailscale, your phone's internet address through Caddy or Cloudflare. If it shows the proxy's
  own address instead (such as the Docker gateway), check `TRUSTED_PROXIES`, and that the proxy
  sets `X-Forwarded-For`.

`<your address>/api/version` should also show Sunroom's version.

## When something isn't right

- **"Sunroom doesn't answer to the address …"**: the name isn't in `APP_ALLOWED_HOSTS`. Add it and
  restart Sunroom.
- **"Sunroom is behind an https address but doesn't trust the proxy yet"**: set `TRUSTED_PROXIES`
  (see *The two settings*) and restart Sunroom.
- **"This request was blocked for safety" on every change**: the proxy is changing the `Host`
  header on its way through. Make it pass `Host` unchanged.
- **Live updates stay on "connecting" or "checking every 30 seconds"**: the proxy is holding the
  live-update stream back. See [DEPLOY.md](DEPLOY.md), step 2.
- **Sunroom stops at startup with exit code 78** after a change: one of the settings has a typo.
  The log names it. `TRUSTED_PROXIES` takes addresses or ranges separated by commas, and
  `APP_ALLOWED_HOSTS` takes names only (no `https://`, no port).
- **A phone was signed out after moving to the new address**: each address is its own sign-in.
  Sign in once more there.
