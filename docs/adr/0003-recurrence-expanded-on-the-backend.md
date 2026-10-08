# ADR 0003: Recurrence is expanded on the backend

- **Status:** Accepted; the engine library (`python-dateutil`) superseded by ADR 0023
- **Date:** 2026-10-07

## Context

- Events come from local calendars and from Google, iCloud, other CalDAV servers and ICS feeds. All of them carry RFC 5545 rules, with EXDATEs, RDATEs and RECURRENCE-ID overrides.
- Synced masters have to be expanded locally anyway: iCloud doesn't expand recurrences on the server, and Google's `syncToken` can't be combined with a time window (PLAN §8.1).
- The JavaScript rrule ecosystem is thinly maintained. Python has `python-dateutil` and `icalendar`, and `recurring-ical-events` as an independent check.
- Correctness comes right after ease of use (PLAN §1): times, zones and recurrences must be right, and a DST change must not move "9:00 every day".
- A Pi's CPU is enough for this.

## Decision

- **The backend expands; the frontend renders.** `GET /api/calendar/occurrences?from&to…` returns concrete occurrences for a half-open range in the household zone (at most 93 days), sorted by start, each keyed `event_id|recurrence_id`. Occurrences are never stored.
- **One engine** for local and synced events: `domain/recurrence.py`, on `python-dateutil` and `icalendar`. A timed rule runs on naive local times in the event's `tzid`, so 9:00 stays 9:00 across DST, and each occurrence is then converted to UTC. All-day events expand on dates, with no zone.
- **Strict rules.** `FREQ` must be daily, weekly, monthly or yearly, with `INTERVAL ≥ 1`, `COUNT ≤ 1000` and `UNTIL ≥ DTSTART`. Hourly and finer rules are refused (422 `rrule_unsupported`). Expansion stops at 1000 occurrences per master per week bucket.
- **A cache** of 512 entries, keyed `(calendar_id, bucket_monday, calendar.version)`. Every event write bumps its calendar's version.
- **Edits stay on the server.** "Just this one", "This and the ones after" and "All of them" become overrides, splits and exdates in one write transaction, with a revision for Undo (PLAN §7.4). `GET /api/calendar/rrule/describe` gives the editor its sentence.
- **The frontend does no recurrence math.** rrule.js is not used; `date-fns` and `date-fns-tz` only format.

## Consequences

- There is one implementation to test: twelve ICS fixtures with golden occurrences, cross-checked against `recurring-ical-events` (a dev dependency only), and a Hypothesis property that splitting a series never gains or loses an occurrence.
- Speed has a budget: `sunroom bench occurrences --events 500 --recurring 100 --weeks 1` must stay under 100 ms cold and 10 ms warm on a Pi 4 (M1).
- The server decides which day an occurrence falls on, in the household zone. A Pi display has no clock of its own at boot and shows the server's time (PLAN §13.10), and a phone may be in another zone; neither changes the answer.
- Every view asks the server for a range. A phone that loses its connection shows only what it already fetched, never occurrences it computed itself.
- Plugins add read-only occurrences (meals, countdowns, chores due) to the same endpoint through overlays computed at read time and not cached (PLAN §7.6).
- `domain/recurrence.py` may import `zoneinfo` and `dateutil.rrule`; the purity test still bans clocks and randomness there.
