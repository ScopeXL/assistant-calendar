# ADR 0035: Sunroom Screen (M7), and the keyboard's number row

- **Status:** Accepted
- **Date:** 2026-10-20

## Context

- Sunroom 0.12.0 went on the owner's wall and phones. On 2026-10-20 the owner asked for two small
  wall fixes (the keyboard's number row, and the Hours view's now line drawn over the day heads)
  and for a plan: a flashable "Sunroom OS" for a Raspberry Pi, the device's own settings as an
  overlay on the wall, and one install command per OS that ends on a page which finds Sunrooms on
  the network. `docs/M7.md` is that plan, with the research, the design and every decision; this
  ADR keeps the ones that change an earlier decision or that a later session would otherwise have
  to rediscover (PLAN §15, M7). It is started with batch 0's first task and gains a row with each
  task after.

## Decision

| Question | Decision |
|---|---|
| The keyboard's number row | **Gone** (reverses that part of ADR 0032). The letters page (the `text` and `password` layouts) is the three rows of letters again; **123**, the bottom-left key, switches to the numbers and symbols, whose first row is `1234567890`; the number pad for times, PINs and codes is unchanged. The row cost a row of board on every field (64 px, 72 in portrait) and the family reached for 123 anyway |

## Consequences

- No schema or API change. `ui/Keyboard` lost its `DIGITS` row; `Keyboard.test.tsx` and the
  `shell.spec` dock case check that the first row is the letters' and that 123 reaches the digits.
- Noticed and left as it is: the symbols page's last row (ten symbols and a Delete one and a half
  keys wide) is about 1004 px against the 960 px box of keys in landscape, where it overhangs the
  box but stays in the dock, and 1096 px in portrait, where its first and last keys lose 8 px at
  the screen's edges.
