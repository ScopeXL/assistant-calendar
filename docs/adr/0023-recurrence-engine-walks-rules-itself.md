# ADR 0023: The recurrence engine walks rules itself; python-dateutil is its test reference

- **Status:** Accepted
- **Date:** 2026-10-08
- **Supersedes:** the engine library in ADR 0003 ("on `python-dateutil` and `icalendar`")

## Context

- ADR 0003 puts recurrence on the backend in one engine, `domain/recurrence.py`, and named
  `python-dateutil` as the library under it.
- Building M1 showed four problems with `dateutil.rrule` as the engine:
  - It checks UNTIL and COUNT only when a date matches. A rule that never matches (for example
    `FREQ=MONTHLY;BYMONTH=2;BYMONTHDAY=30`) scans to the year 9999: 0.16–0.24 s per call on a
    laptop, about a second on a Pi, for every week the board shows.
  - It reads `BYDAY=MO,1TU` as "Mondays that are also the first Tuesday", where RFC 5545 means
    all Mondays plus the first Tuesday.
  - Its default week start comes from a process-wide setting (`calendar.firstweekday()`).
  - It picks BYSETPOS positions from a partial first week.
- The occurrence endpoint has a budget of 100 ms cold on a Pi (PLAN §7.3), and a rule from years
  ago has to cost what a new one does.

## Decision

- `domain/recurrence.py` walks a rule itself, one period (a day, week, month or year) at a time,
  and jumps straight to the first period a window touches when there is no COUNT. It covers
  what a family calendar needs: DAILY to YEARLY, INTERVAL, COUNT or UNTIL, BYDAY (nth weekdays
  in monthly and yearly rules), BYMONTHDAY, BYMONTH, BYSETPOS and WKST. HOURLY and finer,
  BYHOUR, BYMINUTE, BYSECOND, BYYEARDAY and BYWEEKNO are refused as `rrule_unsupported`.
- DTSTART is always the first occurrence and counts toward COUNT (RFC 5545), even when the rule
  wouldn't produce it.
- `python-dateutil` and `recurring-ical-events` become dev dependencies, used only as references:
  a Hypothesis property checks the engine against `dateutil.rrule` over random rules, and the
  twelve ICS fixtures' goldens are checked against `recurring-ical-events`. `icalendar` stays for
  parsing synced calendars (M2).

## Consequences

- Every call is bounded by its window: a one-week window over a ten-year-old daily rule takes
  about 20 µs, and 500 series (100 repeating) for one week about 1 ms on a laptop.
- The engine is ours to maintain. The differential property, the goldens and hand-checked
  occurrence counts guard it; deliberately breaking it nine different ways failed the tests
  nine times.
- Where the references disagree with RFC 5545 the engine follows the RFC, and the tests say so:
  a date-only UNTIL on a timed series means the end of that day (recurring-ical-events reads
  midnight UTC), and an occurrence keeps the master's length as an absolute time across a clock
  change.
- The engine no longer needs `python-dateutil`. (Since M2, `icalendar`, a runtime dependency
  for synced calendars, brings it into the image anyway; nothing of Sunroom's calls it.)
