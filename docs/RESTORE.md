# Restoring a backup

Use this when the database is damaged, to roll back after a release that changed the database,
or to move Sunroom to a new server or a new Raspberry Pi. Every step keeps the previous files, so
you can always go back.

## What you can restore from

| Backup | Where it is | What's in it |
|---|---|---|
| Nightly copies | `backups/sunroom.YYYY-MM-DD.db` in the `sunroom_data` volume (14 daily and 8 weekly are kept) | The database |
| The copy before each upgrade | `backups/pre-migrate/sunroom.<revision>.<time>.db` in the volume | The database |
| **Download backup** | Settings → Backup on a phone or computer: the newest nightly copy, a few MB | The database |
| **Download everything** | Settings → Backup on a phone or computer: `sunroom-YYYY-MM-DD.zip` | The database, every photo, and a `manifest.json` |

The database holds everything the family added: people, calendars and events, lists, chores,
meals, countdowns, settings and the household password. Photos are files beside it, so only
**Download everything** (or a copy of the whole volume) has them.

No backup holds the server's secret key (`secret.key` in the volume), on purpose: a lost backup
can't sign anyone in or unlock a connected account. A restore into the same volume keeps the key.
On a new volume Sunroom makes a new key, so synced calendars (Google, iCloud, other calendar
servers, calendar addresses) and a photo source such as Immich ask to be connected again. If the
server's settings set `APP_SECRET_KEY`, use the same value on the new server and they keep
working.

## 1. Download everything, now and then

On a parent's phone or a computer: **More**, then **Settings**, then **Backup**, then **Download
everything**. (On the kitchen screen, Backup says to do it from a phone.) Every photo is in the
zip, so it can take a while and be large. Keep it somewhere other than the Sunroom server: a
computer, a USB stick, or cloud storage.

- Keep the `.zip` exactly as it is. `restore` refuses a zip that was unzipped and zipped again.
- On a Mac, Safari unzips a downloaded `.zip` by itself. Download it with another browser there.

To see what a zip holds, look at the `manifest.json` inside it: when it was made (`created_at`),
the Sunroom version, and how many photos and events it has.

## 2. Pick the backup

To see the copies in the volume (the ones before upgrades are listed under `pre-migrate`):

```bash
docker run --rm -v sunroom_data:/data --entrypoint ls scopexl/sunroom:latest -R /data/backups
```

`inspect-backup` shows a `.db` file's database revision, app version, integrity check and row
counts. On the server, run it in a throwaway container (on a computer with this repository,
`just inspect-backup <file>` does the same):

```bash
docker run --rm -v sunroom_data:/data --user 10001:10001 \
  scopexl/sunroom:latest inspect-backup /data/backups/sunroom.2026-10-06.db
```

A zip from Download everything doesn't need this step: `restore` checks it before it changes
anything.

## 3. Stop Sunroom

- In the folder with Sunroom's `docker-compose.yml`: `docker compose stop` (Portainer's
  **Stop** button does the same).
- On a Raspberry Pi that runs Sunroom: `cd /opt/sunroom && sudo docker compose stop`.
- Otherwise: `docker stop sunroom`.

## 4. Restore

### A copy in the volume

```bash
docker run --rm -v sunroom_data:/data --user 10001:10001 \
  scopexl/sunroom:latest restore /data/backups/sunroom.2026-10-06.db
```

### A file you downloaded: a .db or the zip

Copy the file onto the server, for example into your `Downloads` folder there. Then mount that
folder as well, read-only, and give the file's path inside it:

```bash
docker run --rm -v sunroom_data:/data -v "$HOME/Downloads:/restore:ro" --user 10001:10001 \
  scopexl/sunroom:latest restore /restore/sunroom-2026-10-06.zip
```

The same command takes a `.db`, for example `/restore/sunroom.2026-10-06.db`. On a Raspberry Pi
that runs Sunroom, put `sudo` in front of `docker run`.

### On a new server or a new Raspberry Pi

1. Install Sunroom as usual ([DEPLOY.md](DEPLOY.md), or the Pi installer in
   [KIOSK.md](KIOSK.md)) and let it start once: that creates the `sunroom_data` volume. There's
   no need to set it up: whatever is there is moved aside.
2. Stop it (step 3), then restore the zip from Download everything as above.
3. Start it (step 5) and pair the wall screen again (step 6). If the server's address changed,
   run the Pi installer again with the new `--url` ([KIOSK.md](KIOSK.md)).

### What restore does

`restore` refuses while Sunroom is running, and refuses a damaged backup, a database from a
newer Sunroom, and a zip with anything in it that Download everything didn't put there. It
checks all of that before it changes anything. Then it:

1. copies the backup's database in beside the current one and checks it again;
2. moves the current database and its `-wal` and `-shm` files aside together, as
   `sunroom.pre-restore.<time>.db…` (a stale `-wal` next to a restored file would corrupt it),
   and swaps the backup in;
3. signs every device out: phones sign in again, and wall screens show a code to pair again;
4. from a zip, puts the photos back into the volume's `photos` folder, keeps any photo that is
   already there exactly as it is, and says how many came back;
5. prints the oldest Sunroom version that can open the restored database.

A `.db` holds no photos, so the photos in the volume stay as they are. Photos that the restored
database doesn't know about are moved to `photos/.orphans` when Sunroom starts; nothing is
deleted.

## 5. Start the right version

Start an image **at or above** the version `restore` printed: in Sunroom's folder, set that
version in `image:` if you pin one, then run `docker compose up -d`. Sunroom runs any newer
migrations itself, after taking its own pre-upgrade copy. An image older than the backup's
database refuses to start (exit 65) instead of guessing.

## 6. Check

- `<your address>/api/version` shows the version you started.
- Every phone signs in again with the household password: the one set when the backup was made
  (unless `APP_PASSWORD` is set in the server's settings; it always wins).
- The kitchen screen shows a code. On a phone, open Sunroom, then **More**, then **Pair a
  display**, and type the code.
- On a new volume, open **More**, then **Settings**, then **Calendars & accounts**, and tap
  **Connect again** on each synced calendar.
- Look at this week's events, a list or two, and Photos.
- Keep the `sunroom.pre-restore.*` files for a week, then delete them:

  ```bash
  docker run --rm -v sunroom_data:/data --entrypoint sh scopexl/sunroom:latest \
    -c 'rm /data/sunroom.pre-restore.*'
  ```

## Going back to the previous database

If the restore wasn't what you wanted, stop Sunroom and restore the copy it moved aside; restore
printed its name:

```bash
docker run --rm -v sunroom_data:/data --user 10001:10001 \
  scopexl/sunroom:latest restore /data/sunroom.pre-restore.20261008T101500Z.db
```

Its `-wal` file, if it has one, comes along by itself, and the database you're leaving is moved
aside in turn. Restore never deletes photos: photos a zip brought back stay, and those the older
database doesn't know about move to `photos/.orphans` when Sunroom starts. Then start Sunroom
again (step 5).

## If restore refuses

| It says | What to do |
|---|---|
| Sunroom is running | Stop it (step 3), then run restore again |
| That backup is damaged | Pick another backup |
| That backup (or zip) is from a newer Sunroom | Run restore with that version's image, for example `scopexl/sunroom:0.6.0`, then start that version |
| That zip has something in it that Sunroom didn't put there, or has no manifest.json | Use the zip exactly as Download everything made it, not unzipped and zipped again |
| Restore isn't allowed to read the file | On the server, run `chmod a+r` on the file, then run restore again |
| /data is not a mounted volume | Add `-v sunroom_data:/data` to the command |
| There isn't enough free space | Free some space on the server's disk, then run restore again |
