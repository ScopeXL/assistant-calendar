# ADR 0019: Chores ship the full kids layer, each part switchable

- **Status:** Accepted (the owner's answer to Q4)
- **Date:** 2026-10-07

## Context

- Q4 asked how far the chores plugin goes for kids (PLAN §20).
- Children use the wall. Completing a chore is the signature moment of the app (PLAN §2), and the success test ends with a child checking one off on the wall while the family sees it on their phones (PLAN §1).
- Competing products charge for this layer: Skylight and Hearth both sell stars and rewards, and a big celebration at the end of a list is what families remember (PLAN §18).

## Decision

The full layer, each part switchable, all on by default:

| Part | What it is |
|---|---|
| Assignment and rotation | A chore belongs to fixed people, rotates through an ordered list (the UI says whose turn it is), or is for anyone, and then the display asks "Who did it?". The day's due list is computed from the rule and the completions, never stored |
| Stars | Points per chore, shown as stars. A balance is computed from completions, adjustments and redemptions in `domain/points.py` |
| Rewards with parent approval | A kid asks for a reward; a parent approves on a phone, or on the display with the PIN |
| Streaks | Computed from completions, never stored |
| Routines | Morning and bedtime checklists per kid that reset daily, run step by step on a full-screen runner |

- Approving completed chores is optional too: a plugin setting that each chore can override.
- Settings → Chores has switches for stars, rewards and routines. Turning stars off hides every star glyph.

## Consequences

- The `chores` plugin owns eight tables (`chores`, `chore_completions`, `point_adjustments`, `rewards`, `redemptions`, `routines`, `routine_steps`, `routine_checks`) and lands in M3.
- The parent PIN and Kid-safe editing (ADR 0006) carry the trust model: kids complete and ask, parents approve.
- Undo on a completion takes back the stamp and the stars together.
- The copy never shames: a broken streak just reads "0 days in a row" (UX §10).
- The plan names switches only for stars, rewards and routines. Whether streaks and rotation get their own is settled in M3.
- M3's owner checklist has the kids complete real chores for a week, with the owner noting what felt wrong.
