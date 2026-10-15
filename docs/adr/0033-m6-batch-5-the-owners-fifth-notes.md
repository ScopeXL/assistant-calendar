# ADR 0033: The owner's fifth notes (M6, batch 5)

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

- Sunroom 0.10.0 went on the owner's wall and phones, and the next day they sent a fifth set of
  notes, about the wall's header and the Hours grid: a scrollbar that flickers while a zoomed
  grid follows the minute, the weather sheet's words and its title, the header's date, time and
  weather (their alignment, their crowding, and nothing saying the weather can be tapped), and a
  question: a "rolling week" for the Week view. `docs/M6-batch-5.md` turns them into tasks,
  answers the questions and records every decision; this ADR keeps the ones that change an
  earlier decision or that a later session would otherwise have to rediscover (PLAN §15, M6 →
  0.11.0).

## Decision

| Question | Decision |
|---|---|
| The Hours scrollbar | **Hidden, on the Hours grid's scroller only** (`scrollbar-width: none`, and no gutter kept for it). The kitchen screen's Chromium draws overlay scrollbars (`--enable-features=OverlayScrollbar`): a bar shows while something scrolls and fades after. A resting grid sets its `scrollTop` once a minute to keep now a third of the way down (ADR 0031), and every set is a scroll, so the bar flashed once a minute. What says the grid scrolls is the hour cut off at its bottom edge, the hours moving under a finger, and Fit the day, which always shows the whole day. This changes UX §4's "a visible scrollbar", chosen in batch 1. The kiosk's flag stays, so every other scroller keeps its bar under a finger; the minute's step (under a pixel at one zoom, about five at the deepest) isn't eased |
| The forecast's title | **The place without its country**, on one line, cut with an ellipsis only if it must be: "Sample Town, Sample State" for "Sample Town, Sample State, United States", "Sampleton" for "Sampleton, United Kingdom", a place of one part as it is. The label is Sunroom's own (`place_label` joins the town, the region and the country with commas, the country last when Open-Meteo sends one), so a frontend helper drops its last part (`placeWithoutCountry`, beside the sky's words); no API or schema change, and a place sent without a country loses its region instead. Settings → Household keeps the full label, where the country helps. `ui/Sheet` gained `oneLineTitle` (the heading is the flex item that gives way; Close's least width is its word), so an event's long title still wraps in its own sheet |
| The forecast's sections | **Today** (it was The Next Hours): a soft line first, "Partly cloudy, 64° now. High 72°, low 55°." (", as of 9:10" after "now" when the forecast is old), then the next twelve hours as before; **Forecast** (it was The Week): the days, today's row included; "Weather by Open-Meteo" stays. The twelve hours still run past midnight in the evening: the owner chose "Today", and a heading that becomes "Tonight" is a follow-up if it bothers anyone |
