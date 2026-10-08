# Privacy

**Status:** current as of the first release (0.1), which has every feature this page describes.
Each release that changes what Sunroom stores or sends updates this page.

Each Sunroom installation is run by the household that deploys it. The authors of this project
receive no data from any installation.

## What Sunroom stores

Everything is kept on the server's `/data` volume: a SQLite database, its nightly backups and
photo files.

- The household's name, time zone and settings.
- Household members' names, whether each is a parent or a kid, their color, and optionally a
  birthday and a photo.
- Photos you upload, resized, with their location and other EXIF data removed.
- Signed-in phones and paired screens: a short label, whose phone it is, and when it was last
  used. Phones' IP addresses are not stored or logged. (Behind a reverse proxy that isn't
  trusted yet, the proxy's address is logged once, to help set `TRUSTED_PROXIES`.)
- The household password and the parent PIN, only as one-way hashes.
- "Add a phone" and pairing codes, as one-way hashes, usable once, for a few minutes.

## What leaves the server

Nothing, in this version. Later features that talk to outside services (calendars you connect,
the weather) will each be listed here, and each one is off until you turn it on.

## What Sunroom does not do

- No analytics, tracking, advertising or telemetry.
- No third-party scripts or CDNs. Fonts are served by the app itself.
- No selling or sharing of data with anyone.

## Your control

- **Export everything** as JSON: Settings → Backup → Export everything, on a phone or computer.
- **Remove a person:** Settings → Family → Change → Remove (with Undo).
- **Sign out a phone or unpair a screen:** Settings → Phones & screens.
- **Delete all data:** whoever runs the server removes the `sunroom_data` volume.

## Contact

Report security issues privately through the repository's GitHub security advisories (private
vulnerability reporting). Other questions can go in a GitHub issue.
