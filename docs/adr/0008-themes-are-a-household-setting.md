# ADR 0008: Themes are a household setting: Light, Dark, or Auto by sunrise and sunset

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

- A wall display has no operating-system preference that a family can see or change.
- Glare at night is a common complaint about wall calendars, and Skylight has no dark mode at all (PLAN §18).
- Phones are personal, and their owners have already chosen light or dark.
- The visual concept is a wall whose light follows the time of day (ADR 0013).

## Decision

- **A household setting**, `household.theme`: `light`, `dark` or `auto`, set in Settings → Display.
- **Applied through `data-theme` on `<html>`.** Tokens are defined once on `:root`, overridden under `[data-theme="dark"]`, and under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])`, as in Dinner Bell's `tokens.css`.
- **Auto on the display** is dark from sunset to sunrise at the household's location, or from 7 PM to 7 AM without one. M1 ships the fixed schedule; the weather plugin brings sunrise and sunset in M4.
- **Auto on a phone** follows the phone's own setting. When the household forces Light or Dark, phones follow the household.
- **The change is gentle.** At sunset or sunrise the display waits for 10 s without a touch, then crossfades every token over 600 ms. Reduce Motion makes it instant.
- **The daylight tint** is a separate switch, `daylight_tint`. Through `data-daypart`, the wall steps through dawn, midday, afternoon and dusk in the light theme, and evening and night in the dark theme. With the tint off, the wall stays at its midday value.

## Consequences

- Every color pair must meet AA in both themes and at every tint stop. `tokens.test.ts` checks all of them.
- `just screenshots` captures 09:40, 16:10 and 21:30, so each stop and theme gets reviewed (UX §10).
- Real sunrise and sunset times come from the weather plugin, at the household's location. Without a location, or with the weather plugin off, Auto uses the fixed schedule.
- Night, from the sleep schedule, is a separate state: a black screen or a dim clock. A tap at night wakes the display for 2 minutes in the dark theme.
