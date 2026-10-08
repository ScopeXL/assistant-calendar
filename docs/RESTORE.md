# Restoring a backup

Use this when the database is damaged, or to roll back after a release that changed the
database. Every step leaves the previous files in place, so you can always go back.

Backups live in the `sunroom_data` volume:

- `backups/sunroom.YYYY-MM-DD.db`: the nightly copies (14 daily and 8 weekly are kept);
- `backups/pre-migrate/sunroom.<revision>.<time>.db`: the copy taken before each upgrade.

**Settings → Backup** can also download the newest copy to a phone or computer. Photos are files
on the volume, not in the database: a restore keeps the photos that are there, so back up the
whole volume to keep them safe.

## 1. Pick the backup

On a computer with this repository, `just inspect-backup <file>` shows a backup's database
revision, app version, integrity check and row counts. On the server, do the same in a throwaway
container:

```bash
docker run --rm -v sunroom_data:/data --user 10001:10001 \
  scopexl/sunroom:latest inspect-backup /data/backups/sunroom.2026-10-06.db
```

## 2. Stop Sunroom

- Portainer: **Stacks → sunroom → Stop this stack**.
- On a Raspberry Pi that runs Sunroom: `cd /opt/sunroom && sudo docker compose stop`.
- Otherwise: `docker stop sunroom`.

## 3. Restore

```bash
docker run --rm -v sunroom_data:/data --user 10001:10001 \
  scopexl/sunroom:latest restore /data/backups/sunroom.2026-10-06.db
```

For a file you downloaded, mount its folder too and give that path:

```bash
docker run --rm -v sunroom_data:/data -v "$HOME/Downloads:/restore:ro" --user 10001:10001 \
  scopexl/sunroom:latest restore /restore/sunroom.2026-10-06.db
```

`restore` refuses while Sunroom is running and refuses a damaged backup. It moves the current
database and its `-wal` and `-shm` files aside together (a stale `-wal` next to a restored file
would corrupt it) as `sunroom.pre-restore.<time>.db…`, copies the backup in, checks it, and
prints the oldest Sunroom version that can open it.

## 4. Start the right version

Start an image **at or above** the version `restore` printed. Sunroom runs any newer migrations
itself, after taking its own pre-upgrade copy. An image older than the backup's database refuses
to start (exit 65) instead of guessing.

## 5. Check

- `<your address>/api/version` shows the version you started.
- Every phone signs in again with the household password, and the kitchen screen shows a code to
  pair again: a restore signs everyone out on purpose.
- Spot-check the data.
- Keep the `sunroom.pre-restore.*` files for a week, then delete them.
