# ADR 0036: The owner's eighth notes (M6, batch 8)

- **Status:** Proposed
- **Date:** 2026-10-21

## Context

- Sunroom 0.13.0 went on the owner's wall and phones, and their notes of 2026-10-21 were four:
  the People view's arrows don't change the day; lists and tasks can be made but hardly managed
  (nothing on an item or a task says it can be changed or removed, a list goes only through
  Change List, and a task due next month is nowhere to be seen); Rolling week should be a switch
  on the Week view itself; and the screensaver should draw on an Immich photo server, filtered by
  people, albums or tags, as the first of several photo libraries. `docs/M6-batch-8.md` turns
  them into tasks, answers the owner's questions and records every decision; this ADR keeps the
  ones that change an earlier decision or that a later session would otherwise have to
  rediscover (PLAN §15, M6 → 0.14.0). It was started with the batch's first task and gained a row
  with each task after.

## Decision

| Question | Decision |
|---|---|
| People's day | **The arrows step the shown day on People as on Day** (`displayState.day`, shared by the two views, so paging one and switching to the other keeps the day): **Previous day**, **Next day**, and **Today** as the quick jump, disabled on today; the idle return already puts `day` back. The header's arrows were one handler for every view, and People had no branch, so its taps moved the Week's hidden `weekOffset` (the next visit to Week opened weeks ahead) while the page turn slid the columns back to the same day. **The day is written over the columns on every day**, one `DayCaption` shared with the Day view ("Thursday, October 8", with "today" beside it on today); the owner asked for it when not today, and always is one look with the Day view. People's h1 stays "People", so there the caption is read by a screen reader (the Day view's h1 already names its day, and hides its caption). The events, the Free day pill, the past events' dimming (today only) and the plugins' column under each person follow the day; **a person's tasks have working boxes on today only**: another day's rows say done (a check mark and "Done by Mia · 7:42 AM") or the due line in words, and the title still opens the task (the API would take a completion on any day the rule makes; the column, not the API, keeps a child from doing tomorrow's tasks for stars). **The Today view has no arrows and no quick jump** (`BoardControls`'s `paging`): it is always today and the six days after, and its arrows paged nothing |

## Consequences

- No schema change from the People row. New in the frontend: `features/calendar/DayCaption.tsx`
  (the Day and People views), `BoardControls`'s `paging`, `ChoreColumn`'s and `ChoreRow`'s
  `readOnly`; the plugins' person column reads its `day`.
