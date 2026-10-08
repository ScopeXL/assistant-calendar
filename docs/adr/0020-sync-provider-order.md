# ADR 0020: Calendar providers are wired in order: ICS and holidays, iCloud, Google by service account, Google OAuth

- **Status:** Accepted (default; the owner wasn't asked)
- **Date:** 2026-10-07

## Context

- Q6 asked which calendar service to wire first. It wasn't put to the owner, so this record uses the plan's default (PLAN §20).
- M2 builds the whole `calendar_sync` plugin: one engine and several providers (PLAN §8). Whichever provider comes first proves the engine.
- The providers need different things:
  - an ICS feed and the offline holidays calendar need no credentials;
  - iCloud needs an app-specific password, and adds pushes;
  - Google's service account needs a Google Cloud project;
  - Google OAuth needs a public HTTPS address, which the owner's proxy provides (ADR 0018).

## Decision

Wire the providers in this order:

1. **`ics` and `holidays`:** read-only and credential-free. They prove fetching, parsing, time zones and merging. Holidays may arrive in M1 instead, if it is cheap there.
2. **`caldav`, for iCloud:** the first two-way provider, with pushes, `If-Match` and the `raw_ical` round trip. Generic CalDAV comes with it (ADR 0005).
3. **`google` with a service account:** two-way Google on a LAN (ADR 0004).
4. **`google` with OAuth:** usable for the owner from M2 because of the proxy. Tailscale is verified end to end with it in M5.

Microsoft stays a later idea.

## Consequences

- The engine is tested against `FakeCalendarProvider` before any real account, and each real provider adds one new kind of risk.
- The owner's M2 checks follow the same order: an iCloud calendar syncing both ways within 5 minutes, a Google calendar through the secret address, and a Google calendar through the service account accepting an event added on the wall.
- If the owner later prefers another order, a new ADR records it.
