# ADR 0028: The owner's first notes (M6, batch 1)

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

- Sunroom 0.6.0 went on the owner's wall and phones, and after the first day of use they sent
  fourteen notes. `docs/M6.md` turns them into tasks; the decisions below were made with the
  owner on 2026-10-09 and settled while building them (PLAN §15, M6 → 0.7.0).
- The rule that held until now was "sentence case everywhere" (ADR 0013, UX §7). The owner wants
  titles to read as titles ("Calendars & Accounts", "This Week").

## Decision

| Question | Decision |
|---|---|
| The case of words | Title Case for titles, headings and navigation: screen, page, room, sheet, panel and dialog titles, section headings (the Today panel's too), view and tab names, rail rooms and the header's quick jumps. Every word is capitalized except a, an, the, and, or, but, of, to, in, on, at, by, for, with, unless it comes first, last or after a colon. Everything else (buttons, toasts, hints, row labels, chips, body, errors) stays sentence case, and nothing is ever all caps. The design-rules test checks every title written as a literal (`title="…"`, an h1 to h3's text, the Settings pages). This supersedes ADR 0013's "sentence case everywhere" |
| "Kid" | The family reads **Child** and **children** everywhere: the role picker, the person rows, Child-safe editing, a child's phone, the hints. The stored value `kid` stays (`members.role`, `is_kid_device`, `kid_safe_editing`, `every_kid`, the error code `kiosk_not_kid`), so there's no migration and no API change |

## Consequences

- A page's name keeps its Title Case inside a sentence ("Settings → Calendars & Accounts"), and
  so do the plugins' names from their manifests ("Synced Calendars", "Photos & Screensaver").
- The rule is mechanical, so a small word stays lowercase even where it belongs to the verb
  ("Bring in Your Calendars", "Sign in with Google").
