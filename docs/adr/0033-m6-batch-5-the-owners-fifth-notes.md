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
