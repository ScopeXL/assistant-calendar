# ADR 0021: Changing numbers sit in fixed-width digit boxes, because Lexend has no tabular figures

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

- The visual direction (ADR 0013) uses one family, Lexend, and asks for tabular figures on times
  and counters, so the wall clock and a ticking count never jiggle as digits change.
- PLAN §4 left a check for M0: if Lexend ships no tabular figures (`tnum`), either render the
  clock's digits in fixed-width boxes or switch the family to Albert Sans, and record which.
- M0 checked the self-hosted variable Lexend (`@fontsource-variable/lexend`): it has no `tnum`
  feature, so `font-variant-numeric: tabular-nums` changes nothing. At 100 px and weight 800 the
  1 is 59 px wide and the 0 is 71 px, so "1:11" is visibly narrower than "10:08".

## Decision

- **Keep Lexend.** Its open, wide letters are why it was chosen, and the problem is only numbers
  that change in place.
- **Numbers that change in place render through `ui/Digits`:** each digit sits in a centred
  inline-block box as wide as Lexend's widest digit, the 0, at the text's weight: 0.62em at 400,
  0.65em at 600, 0.67em at 700 and 0.71em at 800 (measured at M0; `styles/tokens.css`). Colons,
  spaces and letters keep their natural width. Screen readers get the plain text once (the boxes
  are `aria-hidden`, the text is `sr-only`).
- Uses so far: the rail and Today-band clock, the Night clock. Counters, countdowns and the
  routine timer use it as they arrive.
- Static numbers (dates in headings, a member's birthday) stay plain text.

## Consequences

- The design-rules guidance in CLAUDE.md says ticking numbers use `ui/Digits`, and an e2e check
  asserts every clock digit box has the same width.
- If a future Lexend release adds `tnum`, `ui/Digits` can drop the boxes and keep its API.
- A new weight for a ticking number needs its box width measured and added beside the others.
- Copying the clock on a laptop copies the time twice (the boxes and the hidden text). Nobody
  copies the clock, so that's accepted.
