# ADR 0025: Chores are rules: due days, turns, credit and streaks are computed

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

- ADR 0019 chose the full kids layer and left one question to M3: whether streaks and rotation get switches of their own.
- PLAN §10.3 stores a chore as a rule plus its completions, never as rows per day, and computes the due list, balances and streaks.
- Building M3 meant settling how those rules behave where the plan says nothing: when a chore without a rule is due, how turns go round, who gets the credit on a shared screen, and what a streak counts.

## Decision

The rules live in `domain/chores.py` and `domain/points.py`: pure, tested, with `today` passed in.

| Question | Decision |
|---|---|
| When a chore is due | A repeating chore is due on each day its rule makes from its first day, except the days a parent skipped. A chore without a rule is due on its day and stays on the list ("since Mon") until somebody does it; it then shows on the day it was done |
| Fixed, rotating, anyone | A fixed chore gives each of its people a box in their own column. An anyone chore and a rotating chore give one box, in the Anyone column; a rotating chore says whose turn it is |
| Whose turn | Turns go round the chore's people in order, one per day the chore is due, starting from `rotation_index`. A skipped day isn't a turn. Who actually did it doesn't move the turn, so "Leo's turn tomorrow" holds |
| Who gets the credit | On the wall screen, the person tapped (`X-Sunroom-Member`: the column's person, or the "Who did it?" answer). On a phone, the person using it; a parent's phone may name anyone |
| Waiting for a parent | A chore that needs approval (its own setting, else the plugin's) waits when a kid gets the credit, unless a parent's phone or a PIN grant ticked it. Its stars arrive when a parent says yes |
| Streaks | A day counts when every box that was the person's that day got done: their fixed chores, and rotating ones on their turn. Days with nothing of theirs neither count nor break it. Today counts once it's finished, and an unfinished today doesn't break it |
| Switches | Stars, rewards and routines have switches (ADR 0019). Streaks show with stars and have no switch of their own. Rotation is each chore's own choice, so it needs none |
| Undo | Undo deletes the completion, and its stars go with it. There's no "undone" row |
| Routines' stars | Finishing a routine is stored once per kid and day (`routine_finishes`) with the stars it gave. Balances count them as they count chores |

## Consequences

- The chores plugin's tables gain `chores.skipped_dates_json`, `routines.points` and `routine_finishes`; `chore_completions` has no `undone_at` (PLAN §10.3).
- Turns are predictable a week ahead and fair across skipped days; a kid who covers a sibling's turn still gets the stars.
- A streak looks back 400 days through one `Schedule`, which walks each rule once; a test keeps it under two seconds for eight daily chores over two years.
- The chore editor starts a repeating chore on a day its rule makes, as the event editor does, because the recurrence engine always counts the first day (ADR 0023).
