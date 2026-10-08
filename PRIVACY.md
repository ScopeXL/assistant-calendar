# Privacy

**Status:** current as of version 0.6.0. Each release that changes what Sunroom stores or sends
updates this page.

Each Sunroom installation is run by the household that deploys it. The authors of this project
receive no data from any installation.

## What Sunroom stores

Everything is kept on the server's `/data` volume: a SQLite database, its nightly backups and
photo files.

- The household's name, time zone and settings, and the place you give for the weather (a place
  name and its coordinates), which also times the screen's sunrise and sunset theme.
- Household members' names, whether each is a parent or a kid, their color, and optionally a
  birthday and a photo.
- What the family adds: calendars and events (with their places, notes, people and reminders),
  lists, chores, stars, rewards and routines, meals, and countdowns. Removed things wait in
  Recently removed before they're deleted, and an event's earlier versions are kept for 30 days,
  for Undo.
- Copies of the events in calendars you connect (below), so the screen works when they can't be
  reached.
- Photos you upload or put in the photos inbox, resized, with their location and other EXIF data
  removed (the date taken is read first).
- Signed-in phones and paired screens: a short label, whose phone it is, and when it was last
  used. Phones' IP addresses are not stored or logged: the server keeps them in memory only for a
  few minutes, to slow down password guessing. (Behind a reverse proxy that isn't trusted yet,
  the proxy's address is logged once, to help set `TRUSTED_PROXIES`.)
- The household password and the parent PIN, only as one-way hashes.
- "Add a phone" and pairing codes, as one-way hashes, usable once, for a few minutes.
- The passwords, keys and sign-ins of calendars you connect, encrypted with the server's secret
  key (`secret.key` in the volume, or `APP_SECRET_KEY`). Backups never include that key.

The server's log records each request's method, address path, result and duration, never what
was in it.

## What leaves the server

Only what the features below need, and only while they're in use. Turning a feature off in
Settings → Features stops it.

| What | Sent to | When | What they see |
|---|---|---|---|
| **The weather** | Open-Meteo (`api.open-meteo.com`) | About once an hour, once you've set where home is | The place's coordinates (rounded to about 10 m), the time zone and the units, and the server's internet address |
| **Finding your place** for the weather | Open-Meteo's place search (`geocoding-api.open-meteo.com`) | When a parent searches for a place | The words typed into the search |
| **Calendars you connect** | iCloud, Google, or the calendar server or address you add | Every 5 minutes or so (a calendar address as often as you chose) | Those calendars' events, both ways for iCloud, Google and other calendar servers; the sign-in you gave for them |
| **Check for new versions daily** (off unless you turn it on) | GitHub (`api.github.com`) | Once a day | The server's internet address and Sunroom's version |

Holidays calendars are made on the server from a built-in list; nothing is sent for them.

Installing and updating download Sunroom from Docker Hub and GitHub (and, on a Raspberry Pi,
software from Raspberry Pi OS's own servers), as any software install does.

If you reach Sunroom through a service such as Cloudflare Tunnel, that service decrypts the
traffic on its way through and can see everything that passes, including the household password
when someone signs in. Tailscale doesn't: it's encrypted from end to end
([docs/REMOTE-ACCESS.md](docs/REMOTE-ACCESS.md)).

## What Sunroom does not do

- No analytics, tracking, advertising or telemetry.
- No third-party scripts or CDNs. Fonts are served by the app itself.
- No selling or sharing of data with anyone.

## Your control

- **Export everything** as JSON: Settings → Backup → Export everything, on a phone or computer.
- **Download everything** (the database and every photo, to restore from): Settings → Backup.
  Keep it somewhere safe: it holds everything the family added.
- **Remove a person:** Settings → Family → Change → Remove (with Undo).
- **Disconnect a calendar:** Settings → Calendars & accounts → Disconnect. Its sign-in is deleted
  at once.
- **Sign out a phone or unpair a screen:** Settings → Phones & screens.
- **Delete all data:** whoever runs the server removes the `sunroom_data` volume.

## Contact

Report security issues privately through the repository's GitHub security advisories (private
vulnerability reporting). Other questions can go in a GitHub issue.
