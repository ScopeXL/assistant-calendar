# ADR 0005: iCloud through CalDAV with an app-specific password; ICS as the fallback

- **Status:** Accepted; the `caldav` library superseded by ADR 0024 (the protocol choices stand)
- **Date:** 2026-10-07

## Context

- Apple has no OAuth for CalDAV. An app-specific password, made in the Apple ID settings with two-factor authentication on, is the only way in, and it needs no developer account.
- iCloud's CalDAV is unofficial (PLAN §17, risk 2). What was verified on 2026-10-07 (PLAN §8.1):
  - the `pNN-caldav.icloud.com` host has to be discovered, never hard-coded;
  - a 401 with the right password means the Apple ID password was used instead of an app-specific one;
  - changing the Apple ID password revokes every app-specific password;
  - iCloud doesn't expand recurrences on the server and sends undocumented 503 rate limits;
  - the same UID can't exist in two calendars, `event_by_uid` doesn't work, and Reminders can't be reached.
- Nextcloud, Fastmail, Radicale and Baïkal speak the same protocol.
- Many calendars a family wants exist only as links: school and sports feeds, Outlook's "Publish calendar", iCloud public calendars, Google's secret address.

## Decision

- **One `caldav` provider** serves iCloud and generic CalDAV, on the `caldav` 3 library's async client. It takes a server URL, a username and an app-specific password, starts iCloud at `caldav.icloud.com`, and syncs both ways.
  - Discovery: `.well-known/caldav`, then the current-user principal, the calendar home set and the calendars.
  - Changes: `sync-collection` with a sync token where the server supports it, otherwise a ctag and etag diff. Reads use `calendar-multiget` on hrefs.
  - Pushes `PUT` the whole VCALENDAR with `If-Match`, editing the stored `raw_ical` component rather than rebuilding it, so `X-APPLE-*` properties and alarms survive.
  - Polling every 5 minutes, plus "Sync now".
- **The `ics` provider is the read-only fallback** for any calendar link: `webcal://` becomes `https://`, responses are cached by ETag and If-Modified-Since, and feeds refresh every 30 minutes by default, never more often than every 5.
- **Credentials** are typed only on a phone, never on the wall, and stored Fernet-encrypted in `credentials_enc` under an HKDF subkey.
- **Microsoft waits.** Graph needs a free Entra tenant to register an app; "Publish calendar" covers read-only today.

## Consequences

- Connecting iCloud takes three illustrated steps on the phone and no developer account.
- An Apple ID password change shows up as `needs_reconnect` and a quiet banner that spells out the fix: make a new app-specific password.
- 503s back off (`interval × 2^failures`, at most 60 minutes, ±20 % jitter). Recurrences use Sunroom's own expansion (ADR 0003).
- A CalDAV server on the LAN, such as a home Nextcloud, has a private address, so a parent adds it to the network allowlist and ticks "This server is on your home network" (PLAN §12.6).
- Every quirk met goes in `docs/SYNC.md`. `just smoke-caldav` runs the real adapter against a Radicale container with the ICS fixtures imported.
