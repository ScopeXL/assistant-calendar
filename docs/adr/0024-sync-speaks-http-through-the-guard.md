# ADR 0024: Sync providers speak HTTP through Sunroom's guarded client, with their own small CalDAV and Google clients

- **Status:** Accepted
- **Date:** 2026-10-08
- **Supersedes:** the libraries named in ADR 0005 (`caldav` 3's async client) and PLAN §5.2
  (`google-api-python-client` + `google-auth`)

## Context

- Every outbound request goes through `core/http.py` (PLAN §12.6). It checks the address isn't
  private unless a parent allowed it, pins the connection to the address it checked (so DNS
  can't change its answer in between), follows at most three redirects and re-checks each, caps
  response sizes, and times out. A test fails if any other module builds an HTTP client.
- `caldav` 3 brings its own HTTP stack (niquests or requests), and `google-api-python-client`
  with `google-auth` brings httplib2 or requests. Neither can be handed our pinned, guarded
  client, so using them would mean either an exception to the guard or wrapping their transports
  in ways their maintainers don't support.
- What Sunroom needs from each protocol is small:
  - CalDAV: discovery, `sync-collection`, a ctag and etag listing, `calendar-multiget`, and `PUT`
    and `DELETE` with `If-Match`.
  - Google: a token from a service-account key (an RS256 JWT, which `cryptography` already signs)
    or from an OAuth refresh token; then `calendarList.insert`, `events.list` with a `syncToken`,
    and `events.insert`, `update` and `delete`.

## Decision

- `plugins/calendar_sync/providers/caldav.py` is a small async CalDAV client on the plugin's
  guarded HTTP client. It parses XML with the standard library, whose bundled expat refuses
  entity-expansion attacks.
- `plugins/calendar_sync/providers/google.py` is a small Google Calendar REST client on the same
  client. Google's hosts are constants.
- `icalendar` (with `x-wr-timezone`) reads and writes iCalendar text, and `holidays` makes the
  offline holidays. Neither does any networking.
- Neither `caldav` nor the Google client libraries are dependencies.

## Consequences

- Every byte Sunroom fetches for a calendar passes the same checks, caps and timeouts, and the
  "no other HTTP client" test stays absolute.
- The protocol code is ours to maintain. Tests drive it against scripted servers (httpx's
  `MockTransport` behind the real guard); `just smoke-caldav` runs it against a real Radicale
  server.
- Server quirks met along the way go in `docs/SYNC.md`.
