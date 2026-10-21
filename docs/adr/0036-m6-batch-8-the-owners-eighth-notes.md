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
| Rolling week, per screen | **This screen's own choice** (`displayState.rollingWeek: boolean \| null`, null meaning the household's), by ADR 0031's way: remembered across reloads, kept through the idle return like the layout, and **a change of Settings → Display → Rolling week wins** (`HouseholdChoices.rollingWeek`), so the household's switch still sets every screen. A switch in the header that PATCHed the household setting was rejected: that route is parent-only, so a child's tap would raise the PIN pad, and with no PIN one tap would change every screen and phone. The control is **one round icon cell, Rolling week** (`ui/IconToggle`, lucide's `CalendarRange`), 8 px after Agenda · Hours, on the Week view only (laptops in the display shell too; phones never), pressed when on. A view kept by 0.13.0 has no such key and still comes back (`remembered()` reads a missing key as null; a new required field would have wiped every screen's memory once). **The header's room**, measured at 1920 Standard with both panels open: on the widest date and time (Wed, Sep 30, 12:30 PM, a two-digit temperature) one row with nobody filtered (44 px to spare) or one person (4 px), a second row with two or more (the filter clears after 2 idle minutes); on an ordinary morning (Wed, Oct 7, 9:40 AM) one row up to three people (8 px), two rows with four. The plan expected the wrap from three people on the widest dates; it comes at two. That is the header's designed overflow ("wraps rather than clips", UX §3), the two-row header Large, Extra large, laptops and portrait always have; folding Agenda · Hours into a menu, dropping the chosen view's word or floating a pill on the board were each worse. 16 px between the layout and the cell (its own group) would have cost the one-person case |
| Rows that open | **Every row that opens something ends in a chevron**, the mark Settings' rows already carry (`ui/ListRow`): an item's row on the wall and on phones, its words and meta one button with the chevron at its end, so the row reads as the button it always was (tapping an item's words already opened its sheet, and nothing said so). The sheets are kept: an item's (What, Who, Day, **Remove** with Undo, Save Changes) as it was. A list's doors stay **Change List** and the tile's long press (a tip says so); Change List's **Remove** spans the panel above the pinned Save Changes, so it's found without looking. Not chosen: a trash or pencil icon on every row (a second target inside a row that is already a button), a long press on rows (nothing shows it exists), a confirmation on Remove (Undo and Recently Removed cover it, UX §1) |
| Swipe | **Phones only**: a row swiped to the left shows **Remove** (`ui/SwipeRow`: `motion`'s drag on the row's content under the existing `MotionConfig`, a `danger`-filled button 6rem wide behind it), a shortcut for the sheet's Remove, never the only way; it does exactly what the sheet's does, toast and Undo. One row is open at a time, a press anywhere else closes it, and an open row's first tap only closes it; a drag under 8 px is still a tap, and the click after a swipe is swallowed. Past half the button or a flick left opens it (`swipeSettles`). Hidden, the button is `inert`, `aria-hidden` and out of the tab order, so a screen reader meets the sheet's Remove alone. On the list of lists, Remove on a list with anything on it opens Change List at its asking step ("Groceries still has 12 things on it." · Remove · Keep); an empty list goes at once with Undo. **The wall never swipes rows**: its columns scroll sideways under a finger, and a wet finger on the kitchen screen shouldn't find a Remove by accident. A link in a swiped row would start the browser's own drag, so the row cancels `dragstart` |

## Consequences

- No schema change from the People row. New in the frontend: `features/calendar/DayCaption.tsx`
  (the Day and People views), `BoardControls`'s `paging`, `ChoreColumn`'s and `ChoreRow`'s
  `readOnly`; the plugins' person column reads its `day`.
- No schema change from Rolling week. New in the frontend: `ui/IconToggle`; `DisplayState`'s
  `rollingWeek` and `HouseholdChoices`' `rollingWeek`; a tip ("rolling").
- No schema change from the rows. New in the frontend: `ui/SwipeRow` (`swipeSettles`, `REVEAL`);
  `ChangeListPanel`'s `asking`; two tips ("item-sheet", "list-hold").
