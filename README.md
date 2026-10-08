# Sunroom

A family wall calendar for the kitchen screen and everyone's phones. It runs on your own
computer at home, with no account anywhere and no subscription.

- **The week at a glance** on a touch screen in the kitchen: the clock, today lit up, and a line
  for now, readable from across the room.
- **Every phone** adds and changes things, and the screen follows within a second.
- **Made for a family:** one household password, a parent PIN for Settings on the shared screen,
  kids with their own colors, and nothing that needs a technical grown-up every week.
- **Your data stays home,** in one Docker container with nightly backups.

**Status:** early. Version 0.1 is the foundation: setup on a phone, pairing the kitchen screen,
the week board with its clock, the parent PIN and Settings. Calendars and events come next; the
[plan](docs/PLAN.md#15-milestones) lists what each milestone adds, and
[CHANGELOG.md](CHANGELOG.md) what each release did.

## Install

**Do you already run Docker somewhere at home** (a NAS, a mini PC, Portainer, Unraid)?

- No: put everything on one Raspberry Pi, [path a](#a-all-on-a-raspberry-pi).
- Yes: run Sunroom there and use a Pi only as the screen, [path b](#b-sunroom-on-your-server-the-pi-is-the-screen).
- Only trying it out: [path c](#c-any-computer-no-pi).

### a. All on a Raspberry Pi

You need a Raspberry Pi 4 or 5, a touch screen (HDMI plus its USB touch cable) and the official
power supply.

1. With [Raspberry Pi Imager](https://www.raspberrypi.com/software/), write **Raspberry Pi OS
   (64-bit)**, the one with the desktop. In Imager's settings, set the hostname to `sunroom`,
   your user name and password, your Wi-Fi, your time zone, and turn on SSH.
2. Start the Pi, open a terminal on it (or `ssh` in), and run:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/ScopeXL/assistant-calendar/main/kiosk/install.sh | bash
   ```

   It takes 10 to 20 minutes and ends by printing an address and a QR code.
3. **Set up the household on your phone:** scan the QR code, or open `http://sunroom.local:8080`.
   Choose a household password, add the people who live here, and set a parent PIN. Then add
   Sunroom to your home screen (Safari: Share → Add to Home Screen).
4. **Pair the kitchen screen:** after the Pi restarts, the screen shows a six-character code.
   On your phone, open **More → Pair a display** and type it.

If `sunroom.local` doesn't open, use the numbered address the installer printed: phones on a VPN
or on mobile data can't see `.local` names. [docs/KIOSK.md](docs/KIOSK.md) covers rotation,
screens that stay blank, updates and removal.

### b. Sunroom on your server, the Pi is the screen

Run the container on the computer that already runs Docker. Nothing needs configuring; it keeps
everything in the `sunroom_data` volume.

- **Portainer:** Stacks → Add stack → Web editor, paste
  [docker-compose.example.yml](docker-compose.example.yml), Deploy.
- **Docker Compose:** save that file as `docker-compose.yml`, then `docker compose up -d`.
- **Unraid, CasaOS, Synology:** add a container from the image `scopexl/sunroom:latest`, port
  8080, and a volume (or folder) for `/data`. If you map a folder, it must be writable by the
  container's user (`--user 99:100` on Unraid's appdata).

Open `http://<server>:8080` on your phone and set up the household (step 3 above). If you reach
it through your own HTTPS proxy, set `APP_ALLOWED_HOSTS` and `TRUSTED_PROXIES` first
([docs/DEPLOY.md](docs/DEPLOY.md)).

Then set up the Pi with the same installer, as the screen only:

```sh
curl -fsSL https://raw.githubusercontent.com/ScopeXL/assistant-calendar/main/kiosk/install.sh | bash -s -- --display-only --url http://<server>:8080
```

Use the address you open on a phone (an `https://` name works too), then pair the screen
(step 4 above).

### c. Any computer, no Pi

```sh
docker run -d --name sunroom --restart unless-stopped -p 8080:8080 -v sunroom_data:/data scopexl/sunroom:latest
```

Open `http://<computer>:8080` on a phone. Any browser shows the wall screen at `/display`; an old
tablet works as one (Android: Fully Kiosk Browser; iPad: Safari with Guided Access).

## Lost the household password?

Set `APP_PASSWORD` in the container's environment (it always wins), or run
`sudo docker exec -it sunroom sunroom reset-password`. Either way, phones sign in again and the
kitchen screen shows a new code to pair.

## Documentation

- [Plan](docs/PLAN.md): architecture, data model, plugins, milestones.
- [UX](docs/UX.md): screens, flows and visual design.
- [Decision records](docs/adr/README.md): why things are the way they are.
- [The kitchen screen](docs/KIOSK.md), [Deploying](docs/DEPLOY.md),
  [Restoring a backup](docs/RESTORE.md) and [Releasing](docs/RELEASING.md).
- [CLAUDE.md](CLAUDE.md): working rules for the AI sessions that build and maintain Sunroom.

## Developing

`just setup` once (it needs `uv`, `pnpm`, `gitleaks` and `jq`), then `just dev` for the app at
`http://localhost:5173`, `just seed` for the synthetic Sample Family, `just display` for the wall
screen in a window, and `just check` before every commit. `just` lists every command.

## Privacy

See [PRIVACY.md](PRIVACY.md). In short: your data stays on your own computer, and there are no
analytics or third-party scripts.

## License

[MIT](LICENSE)
