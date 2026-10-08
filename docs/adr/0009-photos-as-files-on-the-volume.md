# ADR 0009: Photos are files on the volume, indexed in SQLite

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

- The screensaver shows the family's own photos: over time, thousands of large phone pictures, from uploads, a watched folder and later Immich.
- Avatars need photos too, so the photo store is core rather than part of the screensaver plugin (PLAN §18).
- Dinner Bell stores its meal photos in SQLite as WebP (Dinner Bell's ADR 0020). That suits a few hundred small images. Thousands of large ones would bloat the database, its nightly backups and its exports.

## Decision

- **Files under `/data/photos`, rows in SQLite.** The core `photos` package re-encodes every image to WebP with Pillow: library images at most 2560 px, thumbnails at most 400 px, avatars 512 px square. EXIF orientation is applied, and EXIF data is stripped once the date taken has been read. iPhone HEIC files go through `pillow-heif`.
- **The `photos` table** indexes each file: kind (library or avatar), source, original name, date taken, size, a sha256 that is unique per kind (so duplicates are dropped), and hidden and deleted flags.
- **Sources:** phone uploads, up to 15 MB and 10 files at a time; an inbox folder on the volume, scanned every 5 minutes; later Immich and Nextcloud, through the screensaver plugin's `photo_sources`.
- **Serving:** `/photos/*` needs a session and is cached privately for a year, keyed by content hash.
- **Housekeeping:** every 6 hours a reconcile hides rows without files and moves files without rows to `.orphans/`. A backlog job rebuilds thumbnails missing after a crash.

## Consequences

- The database stays small, and the nightly verified backup stays a few MB.
- A backup is no longer one file, which undoes a consequence of Dinner Bell's ADR 0020. Settings → Backup offers "Download backup" (the database) and "Download everything" (a zip with the database, the photos and a manifest), and `sunroom restore` restores both (PLAN §13.7). `docs/RESTORE.md` says to back up `/data` whole.
- The JSON export carries photo metadata, not the files.
- Disk space becomes something a family can see: the Photos room and About show the free space.
- Photos live on the same `/data` volume, which must be local storage (not NFS or CIFS), as in Dinner Bell.
