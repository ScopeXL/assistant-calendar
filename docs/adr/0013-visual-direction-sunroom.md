# ADR 0013: Visual direction "Sunroom": a calm wall whose light follows the day

- **Status:** Accepted; the case rule ("Sentence case everywhere") is superseded by [0028](0028-m6-batch-1-the-owners-first-notes.md)
- **Date:** 2026-10-07

## Context

- The display hangs in a shared room and is read from the doorway, at every hour, by everyone in the household, children and guests included.
- The look must be distinct from Dinner Bell's "Fridge door" (Dinner Bell's ADR 0012) and from the generic family-app look: rounded pastel cards and playful script type (PLAN §3).
- The bar from the UX spec: if a six-year-old, a grandparent or a guest has to ask how the screen works, the design failed.

## Decision

"Sunroom" ([UX §7](../UX.md#7-visual-direction-sunroom); implemented in `frontend/src/styles/tokens.css`):

- **Concept.** A sunroom is the bright, quiet room where a family sits, with light moving across the wall through the day. The display is that wall: calm, large and legible from the doorway, never a dashboard.
- **Two things carry the identity:**
  - *Light that follows the day.* The wall's tint steps through dawn, midday, afternoon and dusk, and through evening and night in the dark theme, crossfading over two seconds. Today's column is "lit", and a thin amber now line glides down it.
  - *The person color, the one bold element.* Each member owns one saturated color, used for their avatar, the edge and tint of their chips, their chore rows, their progress ring and their celebration burst. Shared things are ink on surface.
- **Tokens by role**, each with a light and a dark value: `wall` (the tinted background), `surface` (today's column, sheets, the Today panel), `ink` and `on-ink` (text and primary actions, as in Dinner Bell's ADR 0027), `ink-soft`, `line`, `sun` (the lit accent), `sun-ink` (now labels in the light theme), `alert` and `scrim`.
- **Eight person colors,** computed in OKLCH so they sit at one lightness: clay, olive, moss, sea, sky, iris, berry and rose. People see them as Red, Olive, Green, Teal, Blue, Purple, Plum and Pink. Each has a light and a dark solid; tints, edges and text come from `color-mix`, so there are no extra tokens. There is no yellow, because it fails as text.
- **Type.** Lexend only, self-hosted, at weights 400, 600, 700 and 800, chosen because its open, wide letters hold up at a distance. Times and counters use tabular figures. Sentence case everywhere.
- **Shape.** An 8 px grid. The board is one square-cornered wall surface; chips are the only card-like objects; there are no shadows except under a lifted chip and an open sheet.
- **Icon.** A window with four panes, light filling the lower-left one.

The self-critique in UX §7, in short:

| Default avoided | What Sunroom does instead |
|---|---|
| A pastel palette, a rounded display face, emoji everywhere | A cool daylight wall, one amber accent for time, one legible sans |
| A cream background, a serif display face, a terracotta accent | Cool-to-warm daypart tints and no serif; cream glares at night |
| A grid of identical shadowed cards | One board surface, with chips the only cards |
| All-caps eyebrows, dot-joined meta strings, monospace times | Sentence case, stacked lines, tabular figures in the same family |
| A red hairline for the current time (Google Calendar's) | An amber line with a soft glow, the lit column and the wall's tint |
| Confetti on everything | One celebration, Done, in the person's color |

## Consequences

- Color is never the only signal: every chip shows an avatar or initial, and names are written out.
- `tokens.test.ts` checks every pair for AA in both themes and at every tint stop. M0 re-runs it and nudges any person color that fails. In the light theme a person color is never used for body text on a tint.
- The boldness is spent in one place, so the Done moment keeps meaning something (ADR 0007).
- If Lexend lacks tabular figures, the clock gets fixed-width digit boxes or the family becomes Albert Sans, recorded in a new ADR (PLAN §5.2).
- The exact values live in UX §7 and `tokens.css`; this record doesn't repeat them.
