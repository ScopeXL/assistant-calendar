# M6, batch 8: the owner's notes of 2026-10-21, as tasks

Sunroom 0.13.0 is on the owner's wall and phones. The notes of 2026-10-21 are four: the People
view's arrows don't change the day; lists and tasks can be made but hardly managed (an item or a
task shows nothing that says it can be changed or removed, a list goes only through Change List,
and a task due next month is nowhere to be seen); Rolling week should be a switch on the Week
view itself; and the screensaver should draw on an Immich photo server, filtered by people,
albums or tags, as the first of several photo libraries. This file turns them into tasks for the
Opus 5.5 session that builds them (PLAN §15, M6 → **0.14.0**). It was written on 2026-10-21 from
a read of the code at `a3c2900` (v0.13.0); line numbers are from that commit and may drift a
little.

**Where this file lives.** `docs/M6-batch-8.md`, beside `docs/M6-batch-6.md` and the earlier
batches, committed as `docs: M6 batch 8, the owner's notes of 2026-10-21 as tasks` (T0).

## How to work through this file

- Read `CLAUDE.md` first: the priorities, the hard rules, the gotchas (and `docs/GOTCHAS.md`:
  "The wall's keyboard, sheets and panels", "Components and their tests", "End-to-end tests").
  Then UX §1, §2, §3 (the header), §4 (People, Lists, Tasks, Photos, Settings), §5 (the phone's
  Lists and Tasks), §8, §10; PLAN §6, §9, §10.3, §11.3, §11.4, §12.6, §14.7; `docs/PLUGINS.md`
  (T5 and T6 follow its rules); and `docs/M6-batch-6.md`, the same shape as this file (its "As
  built" notes say what surprised the last session).
- Do the tasks in order. T1 and T2 are small and independent; T3 and T4 are the lists and the
  tasks; T5 and T6 are the photo libraries (T5 carries the batch's only migration, so it comes
  after the others and is never blocked on them); T7 wraps up.
- **The gate is in two tiers** (CLAUDE.md "Definition of done", PLAN §14.7). Each task ends with
  the *quick gate*: `just quick`, the unit tests of what it touched (`just test-fe …`,
  `just test-py …`), its end-to-end spec on one project (`just e2e e2e/<spec> --project=<name>`),
  then docs, a CHANGELOG line under `[Unreleased]`, `just scan` (the hook runs it), one commit
  per task (or per lettered part), subject `area: summary` plus the `Co-Authored-By` trailer.
  Tick the task's box here and note the commit, so a session that stops early can be resumed.
  The *full gate* (`just check`, the whole `just e2e`, `just screenshots` with the review) runs
  once, in T7, and before anything is called done.
- Read test output only when it fails: the recipes use the terse reporters. Review the
  screenshots from the list in T7, not all of them.
- Never deploy, bump, tag or push: the owner does that with the deploy skill when they ask. The
  release will be 0.14.0 (minor: the family sees all of it); the skill decides.
- When something here turns out to be wrong about the code, fix the task in the smallest way that
  keeps its intent, say so in the commit message and in the final report. Don't stop to ask
  unless the owner's intent is genuinely unclear.
- Never skip a failing check. Stop and report.
- Seed and fixtures stay synthetic (Ana, Sam, Mia, Leo; Sample Town). Nothing private, ever: no
  real Immich address or key anywhere (not in tests, fixtures, screenshots or commit messages);
  the pretend library (T5) is the only Immich the repo ever meets.

## The owner's notes, mapped to tasks

| Note | Task |
|---|---|
| On the People view, Next day doesn't change the day; once fixed, show which day it is showing (when not today) | T1, and "Answers" A |
| Rolling week as a switch on the main view, when the Week view is showing | T2, and "Answers" C |
| No easy way to manage lists or tasks: deleting is hard to find (a list goes only through Change List); make changing and removing an item or a task easy (swipe? a sign that a row opens?) | T3 (lists), T4 (tasks), and "Answers" B |
| A task due next month can't be seen from the Tasks page; a way to see every task and change or remove it | T4, and "Answers" B |
| Photos from an Immich server with an API key, filtered by people, albums or tags, the choices fetched by themselves once the address and key are saved, "all photos" said plainly when nothing is picked; Immich as the first of several photo libraries | T5 (backend), T6 (the screens), and "Answers" D |

## Answers to the owner's questions

**A. Why People's arrows did nothing.** The header's arrows are one handler for every view
(`features/calendar/CalendarRoom.tsx:136-141`): Day steps `day`, Month steps `monthOffset`,
everything else steps `weekOffset`. People has no branch, so a tap moves `weekOffset`, which the
People view never reads: it gets only `today` and `now` (`:274-282`, `PeopleView.tsx:16-41`), its
events are fetched for today alone (`:83-84`), and `pages.turn(step)` still plays the page-turn
keyframes (`lib/motion.tsx:60-77`), so the columns slide and come back on the same day. The quick
jump on People is a stub that is always disabled (`:172-177`), and the arrows are named
"Previous week" and "Next week" there (`BoardControls.tsx:48`). Two side effects: the hidden
`weekOffset` keeps the taps, so switching to Week afterwards opens weeks ahead (until the idle
return zeroes it); and the Today view has the same dead arrows (`:178-185`). The fix is the Day
view's own pattern (`focusDay = state.day ?? today`, `:74`; arrows on `day`; Today disabled on
today; the day written over the board, `DayView.tsx:101-109`), and the plugins' column under each
person already takes a `day` it ignores (`chores/TodayBlocks.tsx:151-153`). T1.

**B. Managing lists and tasks: what exists, and the design.** More exists than shows. Tapping
an item's words already opens its editor (`lists/ListItems.tsx:188-242` → `ItemSheet`, `:348-440`:
What, Who, Day, **Remove**, Save Changes), and tapping a task's title opens its sheet
(`chores/ChoreBoard.tsx:386-395` → `ChoreSheet`, `:582-650`: Change, Skip Today, Remove). Nothing
on either row says so: the words look like a label, so the family never taps them, and a list's
only door is **Change List** in the header (or a 500 ms press on its tile), which the owner found
by looking. Three things are missing outright: a task is reachable only through a box due today,
so a task due next month (or one that repeats from next week) exists nowhere on any screen; a
finished one-off task, or a repeat that has ended, stays on the books for ever and even keeps its
person's column alive ("Nothing today" instead of the room's empty state,
`chores/service.py:311-332`); and no row has a shortcut the thumb expects.

The design, in the app's own grammar (ADR 0029, "rows you tap"; UX §1, "every action has a
visible button, swipes are shortcuts"):

1. **Every row says it opens.** Item rows and task rows, on the wall and on phones, get the
   chevron Settings' rows already carry (`ui/ListRow`): a quiet mark at the row's end after its
   words, so the row reads as a button, which it is. The sheets behind them are kept and
   polished: an item's sheet as it is; a task's sheet gains the task in words (its rule, its
   next day, its due time, its stars, whose it is), asks the PIN before the form opens on the
   wall (as the event sheet does), and offers Skip Today only when the task is due today.
2. **Swipe on phones, where the thumb looks for it.** On a phone, a row swiped left reveals
   **Remove** (an item, a task, or a list on the list of lists), and a tap on it does what the
   sheet's Remove does, Undo and all. It is a shortcut, never the only way; the wall gets no
   swipe (its columns already scroll sideways under a finger, and a wet finger on the kitchen
   screen shouldn't find a Remove by accident).
3. **All Tasks.** The Tasks room's **Today · This Week** control gains **All Tasks**: one column
   per person (and Anyone), every task that names them, soonest first, each row the title and
   one quiet line ("Every week on Sat · Sat, Nov 14 · by 5:00 PM · ★2", "Once · Tomorrow",
   "Every day · Today · Mia and Leo take turns"), a chevron, no box (a box completes, and that
   belongs to Today), a tap opening the task's sheet. The phone's Tasks tab gets the same
   choice, the phone's person first and open. For it, every task gains a **next day** computed
   by the backend from its rule (`domain/chores.py` already walks rules), and the Tasks board
   stops giving a column to tasks that have no next day.
4. **Finished tasks leave by themselves**, the way past countdowns do (ADR 0026): a one-off task
   done on its day, or a repeat whose last day has passed, leaves for Recently Removed the day
   after (Put Back brings it back for 7 days; its completions and stars stay, as history). So
   All Tasks lists what is ahead, not a graveyard, and the board's columns are the people with
   tasks.

Not chosen: a trailing trash or pencil icon on every row (a second target inside a row that is
already a button, and a look the app has nowhere); a long press on rows (the wall uses it only
for the list tiles, and nothing shows it exists); a confirmation on Remove (Undo and Recently
Removed cover it, UX §1); a "Finished" group kept for ever (the tidy is what countdowns do, and
the family asked to see what's coming); a "Paused" state (the API has `active`, no screen shows
it: a follow-up). T3 and T4.

**C. Rolling week on the Week view.** Rolling week is a household setting (`display_rolling_week`,
ADR 0033), and ADR 0033 itself names the way to a per-screen switch: ADR 0031's "the latest
choice wins", which Week layout already follows (`lib/displayState.ts:47-48, 307-333`;
`CalendarRoom.tsx:56, 204-207`). A switch in the header that PATCHed the household setting would
be wrong on the wall: the route is parent-only (`household/router.py:66-67`), so a child's tap
would raise the PIN pad, and with no PIN one tap would change every screen and phone. So the
switch on the Week view is **this screen's own choice**, remembered across reloads and kept
through the idle return like the layout, and Settings → Display → Rolling week stays the
household's, winning when it changes. The control is one round icon cell, **Rolling week**,
after Agenda · Hours on the Week view only, pressed when on. **The header's room:** at 1920
Standard with both panels open the Calendar's part has about 4 px to spare in its worst case
(Wed, Sep 30, 12:30 PM, four people filtered; `UX.md:138`), and a cell costs 64 px. On an
ordinary day with nobody filtered there is about 120 px more than that worst case (the Filter
button grows by three avatars and "+1" when four people are chosen), so the cell fits in one row
then, and with one person filtered; with three or four people filtered on the widest dates the
Calendar's part takes a second row for those two minutes (the filter clears after 2 idle minutes).
That is the header's designed overflow ("wraps rather than clips", UX §3), the same two-row
header Large, Extra large, laptops and portrait always have, and this plan accepts it rather than
spend the room elsewhere: folding Agenda · Hours into a menu costs a tap on the control the owner
asked for in batch 3; dropping the chosen view's word from the view switch undoes ADR 0030's
"the current view is written out"; a pill floating on the board covers chips. T2 measures the
worst case by hand and writes down what happened; the owner can overturn the choice at review.
T2.

**D. Photo libraries, and Immich first.** The seat was built in M4 and never filled: the
`photo_sources` table has `kind` (`inbox | immich | nextcloud`), `config_json`,
`credentials_enc` and `allow_private` (`plugins/screensaver/models.py:29-43`); each source
imports into core's photo store under its own `source_key` (`service.py:154-156`,
`"source:<id>"`), and the screensaver's manifest, the Photos room, Hide from Screensaver, the
Needs Attention line for a failing source and the export's masking of `credentials_enc` all work
on whatever a source brings in. So an Immich photo is **a copy on Sunroom's own volume**, like an
uploaded one, and that is not only convenient but required: the page's content-security policy
allows images from Sunroom's origin only (`web/headers.py:19-24`, `img-src 'self' data: blob:`),
and the API key must never reach a browser anyway. The copies are Immich's own previews (about
1440 px on the long side, re-encoded to WebP at up to 2560 px by the store, dated from Immich's
record since a preview carries no EXIF), capped per library (**Keep up to** 500 by default,
newest first), so a library of fifty thousand photos costs the Pi a few hundred megabytes, not
a disk. What the family picks: **people**, **albums** and **tags**, fetched the moment the
address and key are saved and shown as faces (Immich's own face thumbnails, proxied), album
chips with counts, and tag chips; a photo is shown when it matches **any** pick ("Photos of Mia
or Leo, or in Beach 2026"); with nothing picked the line says plainly that every photo is used
("Showing every photo, newest first, up to 500. Pick people, albums or tags to narrow it."). Any
is the rule because it is what a family means by picking two children and a holiday album, it
is the easiest sentence to say, and it never produces an empty screensaver out of two picks that
don't overlap; Immich's own search means "all of these" for several people, so Sunroom asks once
per pick and merges. "Immich first of many": the library code is one small interface
(`check`, `choices`, `find`, `fetch`, `thumb`) behind a registry keyed by `kind`, the API tells
the screens which kinds exist and what each asks for, and everything after the fetch (the
import, the cap, the diff, the status, the problems, the screens) knows nothing of Immich.

Three things found on the way must be fixed first, and are part of T5: (1) **the home-network
rule has no door.** The guard allows a private address only when the source ticked "This
server is on your home network" *and* its host is in the network allowlist, and tells the
family to "add it under Settings → Network" (`core/netguard.py:117-121`), a page that does not
exist: today a LAN Immich (nearly all of them, `http://192.168.1.30:2283`) and a LAN Nextcloud
calendar can't be allowed from any screen. The fix keeps the guard's rule and gives the tick its
meaning: when a parent connects a source or an account with the tick on, Sunroom itself lists
the host in the allowlist, in a row named after it, and takes the row out when the source goes;
the message and the two hints in Add an Account change to match. (2) **The API key would follow
a redirect to another server**: the guard strips only `authorization`, `proxy-authorization`
and `cookie` on a cross-origin hop (`core/http.py:34, 112-114`); `x-api-key` joins them. (3)
**The log redactor** masks `api_key` and not the hyphenated header (`core/logging.py:17-20`).
Also: `photo_sources` has no `status`, so a changed secret key wipes its key with no way to say
"connect again" (`boot.py:202-208`; the migration adds it); `PhotoStore.ingest` takes no
`taken_at` (it gains one); re-importing a photo the family removed would bring it back (the
dedupe at `photos/store.py:204-210` un-removes a matching row), so a library's photos can be
**hidden** from the screensaver but not removed one by one (the sheet says where they come from;
removing the library removes them all).

## Decisions (decided here, with the reason; the owner can overturn any at review)

| Question | Decision |
|---|---|
| People's day | The arrows step `day` on People as on Day; **Today** is the quick jump, disabled on today; the day is written over the columns on every day, "Thursday, October 8" with "today" beside it on today (one `DayCaption` shared with the Day view). The owner's note asks for it when not today; always is one look with the Day view, and a one-line condition if they'd rather. A person's tasks follow the day; boxes work on today only. The Today view's arrows and quick jump go (they paged nothing) |
| Rolling week | **Per screen**, `displayState.rollingWeek: boolean | null`, with `HouseholdChoices` (ADR 0031): a round icon cell **Rolling week** after Agenda · Hours, Week view only, pressed when on; Settings → Display → Rolling week stays the household's and wins when changed; phones unchanged. The worst-case header row may wrap with three or more people filtered; measured in T2, written in the ADR |
| Rows that open | A chevron at the end of every item row and task row (wall and phone); the sheets stay; a task's sheet asks the PIN before Change opens its form, and shows Skip Today only when due today |
| Swipe | **Phones only**, left to reveal **Remove** (items, tasks, lists on the list of lists), one row open at a time, a tap elsewhere closes it; built on `motion`'s drag under the existing `MotionConfig`; the wall never swipes rows |
| All Tasks | A third choice of the Tasks room's Show control (wall and phone): columns per person and Anyone, every task naming them, soonest first, rows with the rule line and a chevron, no boxes; `ChoreOut.next_due` computed in `domain/chores.py`; the board's columns count only tasks with a next day |
| Finished tasks | Leave for Recently Removed the day after (a one-off done on its day; a repeat past its last day), untouched for 24 hours first; completions and stars stay; Put Back works, and the task leaves again a day later unless its day changes. ADR 0025 gains the rule |
| Photo libraries | **Copies on the volume** through core's store (ADR 0009), `source_key = "source:<id>"`, Immich's **preview** size, dated from Immich, capped per library (**Keep up to** 100 / 250 / 500 / 1,000 / 2,000, default 500, newest first); a library's photos can be hidden, not removed one by one; removing the library removes them (soft, as any photo; files go with core's 7-day prune) |
| The picks | People, albums and tags; **any** pick matches; nothing picked means every photo, said in a sentence under the picks; the choices are fetched on connect and cached (`options_json`, refreshed when the sheet opens and they are over an hour old, and by **Refresh Choices**); the picks save as they change (ADR 0029) and start a pass |
| Immich's API | **Immich 2.x** (the API stable since 2.0): `x-api-key`; `GET /api/server/ping`, `/api/server/about`; `GET /api/people`, `/api/people/{id}/thumbnail`; `GET /api/albums`, `/api/albums/{id}`; `GET /api/tags`; `POST /api/search/metadata` (`personIds`, `tagIds`, `type: IMAGE`, paged); `GET /api/assets/{id}/thumbnail?size=preview`. **Every path, field and error is verified against the 2.x OpenAPI spec before the client is written** (Before the first task, 4); an older server is refused with a plain line |
| The home-network tick | A parent's tick on a source or an account **writes its host into the network allowlist** (a row named after it, through a new context facade; removed with the source or account). The guard's two conditions stay; its message and Add an Account's hints stop pointing at a page that doesn't exist (changes the words of PLAN §12.6, not its rule) |
| The guard | `x-api-key` is dropped on a cross-origin redirect like the other credential headers; the redactor masks `x-api-key` and `api-key` |
| Where the screens are | Settings → **Photos & Screensaver** (the plugin's own page) gains **Photo Libraries**: a row per library (status, count, chevron) and **Add a Library**; one panel for connecting and for a library's settings; the Photos room's viewer and the phone's photo sheet say "From Immich" and offer Hide, not Remove, for a library's photo; Needs Attention names a library that fails or needs its key |
| Verification | Two tiers (above); each task names its spec and project; T7 runs the full gate once. **0.14.0**; the deploy skill decides |
| Database | **One migration**, in T5: `photo_sources` gains `status`, `options_json`, `options_at`; the new table `photo_source_items`. The 0.13.0 fixture `202610201813.sql` exists (checked 2026-10-21); T5 builds the 0.14.0 fixture for the new revision |
| The ADR | **One, 0036**, in 0034's shape, with a row per decision above; it changes parts of 0025 (finished tasks leave), 0031 and 0033 (Rolling week per screen), 0026 (library sources built; the sheet's Remove), and the words of PLAN §12.6 (the tick is the allowlist entry). It is started in T1 and gains its rows task by task |

## Before the first task

1. `just check` must be green at the commit this file landed on (one after `a3c2900`; confirm,
   don't assume). `CHANGELOG.md`'s `[Unreleased]` is empty there.
2. `backend/src/sunroom/migrations/released.lock` ends with `202610201813`, and
   `backend/tests/fixtures/db/202610201813.sql` exists (both checked on 2026-10-21). One
   migration comes in this batch (T5), which builds the 0.14.0 fixture.
3. `just screenshots` once, before any task, into `.screenshots/before-0.13.0/` (gitignored),
   the "before" for T7's review.
4. **Immich's API.** Before T5 writes a line of the client, fetch the newest 2.x tag's spec,
   `https://raw.githubusercontent.com/immich-app/immich/<tag>/open-api/immich-openapi-specs.json`
   (or read `https://immich.app/docs/api/`), and check every path, query parameter, request body
   and response field T5 names: the ping and about routes, the people list and its paging and
   `withHidden`, the person thumbnail, the album list and an album's `assets`, the tag list,
   `searchAssets`'s `personIds`, `tagIds`, `type`, `page`, `size`, `order` and the reply's
   `assets.items` and `nextPage`, the asset's `localDateTime` / `fileCreatedAt` and
   `exifImageWidth` / `exifImageHeight`, the thumbnail route's `size=preview`, and the 401 and
   403 bodies. Write the tag checked into `sources/immich.py`'s docstring and fix the plan's
   names in the smallest way where the spec differs (say so in the commit).

## Tasks

### T0 Save this plan

- [x] Done (the commit that added this file: `docs: M6 batch 8, the owner's notes of 2026-10-21
  as tasks`)

This file is the plan, saved as `docs/M6-batch-8.md` and committed alone by the session that
wrote it. Nothing else to do here; T1 starts ADR 0036.

### T1 People: the arrows page a day, and the day is written over the columns

- [x] Done (commit: "calendar: People pages a day and says which; the Today view has no arrows")

**Owner's note.** "When viewing the calendar from the People tab, navigating to the next day
doesn't change the day. When it's fixed, display the day it is showing the items for (if not on
Today)."

**What exists, and the cause.** "Answers" A. The pieces: `CalendarRoom.tsx:136-141` (the `page`
handler), `:83-84` (People's range), `:172-177` (People's header entry), `:178-185` (the Today
view's), `:274-282` (`<PeopleView today={today} now={now} …>`), `:74` (`focusDay`);
`PeopleView.tsx:16-41` (props and the one day it builds), `:57-64` (`EventChip … dimPast={dimPast}
… day={today}`), `:74-79` (Free day), `:81-83` (the plugins' extras, `<Extra memberId day={today}>`);
`BoardControls.tsx:48` (`span`); `DayView.tsx:50` (`isToday`), `:85` (`dimPast && isToday`),
`:101-109` (the day caption); `chores/TodayBlocks.tsx:151-166` (`ChoresPersonColumn`, which reads
the clock and returns null when `total === 0`); `chores/router.py:74-78` (`GET /api/chores/today?
date=` takes any date); `chores/service.py:459-476` (`complete` accepts any due date the rule
makes); `lib/displayState.ts:293-304` (`backToNow` puts `day` back to null, so the idle return
needs nothing new). Nothing in e2e taps an arrow on People (`calendar.spec.ts:175-183` checks the
columns, Filter's absence and Free day; `a11y.spec.ts:302-305` and `screenshots.spec.ts:137-140`
loop over the views).

**Build.**

(a) `CalendarRoom.tsx`: the `page` handler steps `day` for `"people"` as for `"day"`
(`if (view === "day" || view === "people") …`); the range for People is `focusDay` to
`addDays(focusDay, 1)`; the `header` entry for `people` becomes Day's twin (`homeLabel: "Today"`,
`atHome: focusDay === today`, `home: () => updateDisplay({ day: null })`), keeping
`title: "People"` (the hidden h1 and the region's name, which the e2e specs look up);
`<PeopleView day={focusDay} today={today} …>` (it needs both: `today` for "today" and the dimming).
`BoardControls.tsx:48`: `span` is `"day"` for People too, so the arrows read "Previous day" and
"Next day".

(b) `PeopleView.tsx`: a `day` prop drives the column (`:32-41`), the chips (`:57-64`) and the
extras (`:81-83`); `dimPast` applies only when `day === today`, as `DayView.tsx:85` and
`WeekView.tsx:211` do. Over the columns, the day: lift `DayView.tsx:101-109` into
`features/calendar/DayCaption.tsx` (`longDate(day)` at title size, 32 px, bold, and "today" in
`ink-soft` at secondary size beside it when `day === today`; `aria-hidden`, as it is now, because
the room's h1 speaks for a screen reader) and use it in both views. It shows on every day, today
included (Decisions). The Free day pill and the rest are unchanged. The region keeps its
`snap-x` scroller; the caption sits above it, outside the scroller.

(c) `chores/TodayBlocks.tsx:151-166`: `ChoresPersonColumn` reads its `day` prop
(`useChoresDay(day)`) and passes `boxes` so `ChoreColumn` draws them **without boxes when `day`
isn't today**: `ChoreColumn` (`ChoreBoard.tsx:70-199`) gains `readOnly?: boolean`, which makes
`ChoreRow` draw its state in words instead of a `TickBox` (a check mark for a done box with
its "Done by Mia · 7:42 AM" line, the due line otherwise) and keeps the title button (it still
opens the task's sheet, T4). Today keeps its working boxes. (The backend would accept a
completion on any date the rule makes; the column, not the API, keeps a child from doing
tomorrow's chores for stars.)

(d) The Today view (`CalendarRoom.tsx:178-185`): it is always today and the six days after, so
its part of the header draws **no arrows and no quick jump**: `BoardControls` gains
`paging?: boolean` (false for `"today"`), and with it off the first group isn't drawn. Filter and
the view switch were already hidden there.

(e) Start ADR 0036 (`docs/adr/0036-m6-batch-8-the-owners-eighth-notes.md`, in ADR 0034's
shape: Status Proposed, Date, a Context paragraph naming this file, the Decision table with the
People row, Consequences to fill) and its row in `docs/adr/README.md`; each task after adds
its rows.

**Tests.** `just test-fe src/features/calendar src/features/chores` (a small `DayCaption.test.tsx`:
the date, and "today" only on today; `ChoreRow` read-only draws no checkbox). End to end,
`e2e/calendar.spec.ts` (`display-1080p`; its `beforeEach` sets Wed 2026-10-07 and seeds): "People
pages a day at a time and says which day": open People; the caption reads "Wednesday, October 7"
and "today"; the arrows are named "Previous day" and "Next day"; **Next day** → "Thursday, October
8" without "today", **Today** is enabled, and Mia's column, which read "Free day" on Wednesday,
now shows "Soccer practice" (the seed's Tuesday-and-Thursday event, `meta/testing.py:230-239`;
Sam's shows "Book club"); **Today** → Wednesday again and the button disabled; then switch to
Week: **This Week** is disabled (the hidden drift is gone). A
second case: on the Today view there are no arrows and no quick jump (set `display_home_view:
today` through a parent PATCH, reload). Run `just e2e e2e/calendar.spec.ts --project=display-1080p
-g "People|Today view"`. By hand in `just display`: People, Next day twice, then the idle return
(the e2e helper `hours.spec` uses, or two minutes): the columns are back on today; a person's
tasks on tomorrow show without boxes.

**Docs.** `UX.md:254` (People): "Today or This Week (rows per day inside each column…)" becomes
"one day: today, or the day the arrows reach (Previous day, Next day; Today brings it back, and
so does the idle return), written over the columns as the Day view writes its day ('Thursday,
October 8', with 'today' beside it on today); a person's tasks follow the day, with working
boxes on today only". `UX.md:138` (the Calendar's header): "(or Today, This Month)" gains "Today
on the Day and People views; the Today view has no arrows". `UX.md:232` (Day view): "the one
place a weekday is spelled out" → "where a weekday is spelled out (People does the same)".
GOTCHAS, a new group "The board": "People's arrows stepped `weekOffset`, which the view never
read: every view's arrows must change what that view reads, and `BoardControls` names the step
by the view."

**CHANGELOG** (Fixed). "On the People view, the arrows go to the day before or after, Today
brings it back, and the day is written over the columns. The Today view no longer shows arrows
that did nothing."

### T2 Rolling week, on the Week view itself

- [x] Done (commit: "calendar: Rolling week, this screen's own switch in the Week view's header")

**Owner's note.** "Add the Rolling Week setting to the main view as something they can toggle on
or off if they are currently on the Week view in the calendar."

**What exists.** "Answers" C. The pieces: the column `household/models.py:121-123`, the schemas
(`schemas.py:86, :128`), the switch in Settings → Display → Layout (`settings/DisplayPage.tsx:
147-154`), its one reader `CalendarRoom.tsx:69-73`, and the Week layout pattern:
`lib/displayState.ts` (`weekLayout` at `:47-48`, `INITIAL` `:63`, `isLayout` `:81-82`,
`remembered()` `:99-143`, `remember()` `:159`, `backToNow` `:293-304`, `HouseholdChoices` and
`householdChose()` `:307-333`), `DisplayShell.tsx:237-246` (feeds the household's choices),
`CalendarRoom.tsx:56` (`state.weekLayout ?? settings?.display_week_layout`) and `:204-207` (the
header's Agenda · Hours calls `updateDisplay` only), `BoardControls.tsx:10-13, 76-78`
(`IconSegmented`), `ui/Segmented.tsx:98-137` (`IconSegmented`'s cell: round, `h-tap min-w-tap`,
`aria-pressed`, filled with ink when chosen). `remembered()` rejects the whole saved view when
any field fails, and `isChoice(undefined)` is false (`:81-83`, `:123`): a new required field
would wipe every screen's memory once (`M6-batch-5.md:553-555`). The e2e for the household
setting is `calendar.spec.ts:415-461` (the Friday clock); the pattern "the household's change
wins over the screen's choice" is `hours.spec.ts:295-304`; the one-row check is
`shell.spec.ts:273-274`. `lucide-react` has `CalendarRange`.

**Build.**

(a) `lib/displayState.ts`: `rollingWeek: boolean | null` in `DisplayState` (null: the
household's), `INITIAL`, `remember()`, and `remembered()`, where **a missing key reads as null**
(`const rollingWeek = kept.rollingWeek ?? null;` then `isChoice(rollingWeek)`), so a view saved
by 0.13.0 still comes back; `displayState.test.ts`'s `KEPT` fixture (`:17-28`) gains the field,
and a new case feeds a 0.13.0-shaped view (no `rollingWeek`) and expects it back with
`rollingWeek: null`. `HouseholdChoices` gains `rollingWeek: boolean`; `householdChose()` sets
`change.rollingWeek = null` when it differs; `DisplayShell.tsx:237-246` passes
`settings.display_rolling_week`; `backToNow()` leaves it alone (a deliberate choice, like the
layout; its docstring and `:293-304`'s comment say so).

(b) `ui/Segmented.tsx`: `IconToggle({ label, icon, pressed, onToggle })`, one round cell with
`IconSegmented`'s classes (`h-tap min-w-tap` on the wall, `h-11 min-w-11` on phones, `press
select-fill`, `aria-pressed:bg-ink aria-pressed:text-on-ink`), `aria-label={label}`,
`aria-pressed={pressed}`; `Segmented.test.tsx` gets a case.

(c) `CalendarRoom.tsx:69-73`: `const rolling = state.rollingWeek ?? settings?.display_rolling_week
?? false;`, and `onRolling={(rollingWeek) => { updateDisplay({ rollingWeek }); }}` into
`BoardControls`, which gains `rolling` and `onRolling` and draws, on the Week view only, right
after the `IconSegmented` (the same `gap-x-4` of the room's part separates them; inside, 8 px
as the icon cells have), `<IconToggle label="Rolling week" icon={CalendarRange}
pressed={rolling} onToggle={…} />`. A tap: the board redraws at once (the window around today,
today in the second column) and the This Week button and the arrows behave as ADR 0033 says.
Laptops in the display shell get the same cell; phones never.

(d) `settings/DisplayPage.tsx:147-154`: the hint gains one sentence: "Each screen can switch it
for itself from the Week view's header; changing it here puts every screen on this choice."
(`DisplayPage.test.tsx:52-58` checks the row's place; the hint's text needs no test.)

(e) A tip in `features/tips/tips.ts`: `{ id: "rolling", text: "Rolling week keeps today in the
same column. Switch it from the Week view's header." }` (`tips.test.ts` checks the shape).

(f) ADR 0036: the Rolling week row, with the measurement from "Tests".

**Tests.** `just test-fe src/lib/displayState.test.ts src/ui/Segmented.test.tsx src/features/
settings src/features/tips`. End to end, `e2e/calendar.spec.ts` beside the rolling-week case
(`:415-461`, `display-1080p`, the Friday clock): "a screen switches Rolling week for itself, and
Settings wins": the toggle "Rolling week" has `aria-pressed="false"`; tap it → the `[data-day]`
heads start on `2026-10-08`, `[aria-current=date]` is the second, the toggle is pressed, and
`GET /api/settings` (as a parent on `request`) still says `display_rolling_week: false`; reload
→ still rolling (remembered); a parent PATCHes `display_rolling_week: true` then `false` → the
board follows the household both times (the screen's choice gave way). `shell.spec.ts:273-274`
must still pass. Run `just e2e e2e/calendar.spec.ts --project=display-1080p -g "Rolling"`. By hand
in `just display`: the toggle on and off, in Agenda and Hours; `--portrait`; and **the worst
case once**: `POST /api/_test/clock {set: "2026-09-30T12:30:00"}` in the household's zone, four
people filtered, both panels open, 1920×1080 Standard: note in "As built" whether the Calendar's
part wrapped, and with how many people filtered it still fits.

**Docs.** `UX.md:138` (the Calendar's header): after "Agenda · Hours" add "and **Rolling week**, a
round cell pressed when on: this screen's own choice, as the layout is (Settings → Display →
Rolling week is the household's, and a change there wins, ADR 0031)"; the budget sentence: what
the worst case does now (from the measurement). `UX.md:228` (the Week board) and `:447` (the
Display row): the per-screen switch in one clause each. `UX.md:76` (Idle, wake and reset): "the
Week's layout and zoom" → "the Week's layout, Rolling week and zoom". ADR 0031's and ADR 0033's
annotations: a line pointing at ADR 0036. GOTCHAS if anything cost time.

**CHANGELOG** (Added). "The Week view's header has a Rolling week switch, so a screen can keep
today in the same column for itself; Settings → Display → Rolling week still sets every screen."

**As built.** As planned, with the cell **8 px after Agenda · Hours** in one group with them
(the plan's "a cell costs 64 px"; its "the same `gap-x-4` … separates them" read the other way
would have cost 72 px and the one-person case below). Measured with a throwaway spec (not
committed) at 1920×1080 Standard, both panels open, the clock set before the seed: on the widest
date and time (Wed, Sep 30, 12:30 PM, 61°) the Calendar's part is one row with nobody filtered
(44 px to spare) and with one person (4 px), and takes a second row with two, three or four
(the header 141 px instead of 80); on an ordinary morning (Wed, Oct 7, 9:40 AM) it is one row
with up to three people filtered (8 px to spare) and two rows with four. So the wrap comes with
two people on the widest dates, not three as "Answers" C guessed; accepted as planned (the
header's designed overflow, for at most two idle minutes), and written in UX §3 and ADR 0036.
The e2e header test (`shell.spec`, an ordinary day, nobody filtered) still sees one row.

### T3 Lists: rows that say they open, and a swipe on phones

- [x] Done (commit: "lists: rows end in a chevron, and a phone swipes a row for Remove")

**Owner's note.** "Currently there is no way to manage Lists or Tasks. You can create new ones,
but deleting is hard to find. I see you can delete lists if you open the Change List modal.
Managing a list or task should be easy for the user. Design a new way to manage items (perhaps a
swipe to delete? Or an indicator they can select the item to change/remove it)."

**What exists.** "Answers" B. The pieces: `lists/ListItems.tsx:82-186` (`ItemRows`: a tap on the
text calls `setEditing(item)`), `:188-242` (`ItemRow`: a `TickBox`, then a `press-row` button
across the rest of the row with the text and `itemMeta`'s line), `:348-440` (`ItemSheet` /
`ItemEditor`: a `SidePanel` titled with the item's text; What, Who, Day; `Remove {text}` as
`quiet-danger`; pinned Save Changes; the remove toasts "Removed X" with Undo through
`restore-items`, `lists/data.ts:79-96`); `lists/ListsRoom.tsx:111-139` (`ListTile`, a `Link` with
`useLongPress` → `ChangeListPanel`), `:247-267` (the list page's header: Clear Done, Change List),
`:296-391` (`ChangeListPanel`: Name, the inline "still has N things" step, `Remove {name}`,
Save Changes; `removeList` is `asParent`, `data.ts:244-261`); `lists/ListsTab.tsx:23-85`
(`PhoneLists`: rows as `Link`s with a chevron), `:87-153` (`PhoneList`: the count, Clear Done
and Change List as buttons under the title, then `ItemRows`); `lists/router.py:48-110` (every
route `ActorDep`; `DELETE items/{item}` checks `_check_item_rights`, `service.py:142-164`: a kid's
phone may remove only its own; no PIN on the wall); `ui/ListRow.tsx:60-87` (the chevron rows
Settings uses); `lib/motion.tsx:23-37` (`MotionConfig` with the nonce; `GLIDE` at `:50`);
`motion`'s `drag` is used nowhere yet; both row kinds are `motion.li layout="position" layoutId`;
the wall's Tasks columns scroll sideways (`snap-x overflow-x-auto`, `ChoreBoard`), so the wall
never gets a row swipe. `ui/Button` has `danger` and `quiet-danger` variants (`Button.tsx:6`).
The e2e `lists.spec.ts` covers adding, checking, Clear Done, New List, the empty room and the
tile's long press, never an item's sheet or a removal; `a11y.spec.ts:132-140` opens an item's
dialog by tapping "Eggs" on a phone.

**Build.**

(a) **The chevron.** `ItemRow` (`ListItems.tsx:188-242`): inside the text button, after the meta,
`<ChevronRight aria-hidden="true" className="shrink-0 text-ink-soft size-6 (phones size-5)" />`,
the button `justify-between` as it is, the meta and the chevron grouped at the right with
`gap-3`; the button's name is unchanged (the text and the meta). Done rows get it too (their
sheet still offers Remove). `ListsRoom`'s tiles are unchanged (the long press and Change List
stay the list's doors; a tip says so, (e)).

(b) **`ui/SwipeRow.tsx`**, phones only (`useShell() === "phone"`; on the wall it renders its
children as they are):

```tsx
<SwipeRow action="Remove" label={`Remove ${text}`} onAction={…} disabled={…}>…the row…</SwipeRow>
```

A relative box; behind the content, at the right, a `danger`-filled button as tall as the row
and 6rem wide reading **Remove** (`aria-label` from `label`), `tabIndex={-1}` and `inert` while
hidden so a screen reader meets one Remove (the sheet's); the content a `motion.div` with
`drag="x"`, `dragDirectionLock`, `dragConstraints={{ left: -REVEAL, right: 0 }}`,
`dragElastic={0.05}`, `dragMomentum={false}`, `animate={{ x: open ? -REVEAL : 0 }}`, and
`onDragEnd` opening when `info.offset.x < -REVEAL / 2 || info.velocity.x < -300`, else closing;
`REVEAL = 96`. One open at a time: a module store `openSwipe` (an id); opening one closes the
other; a `pointerdown` outside any open row (a document listener while one is open) closes it;
a tap on the revealed button calls `onAction` and closes. A drag under 8 px is a tap (the
inner button still fires: `motion` only claims the gesture once it moves). Reduce Motion: the
drag still follows the finger; the snap is instant under the `MotionConfig`. Vitest:
`SwipeRow.test.tsx` renders on a phone shell, fires pointer events through `motion`'s drag (or
tests the `onDragEnd` rule as a pure function `swipeSettles(offset, velocity)` exported beside
it) and checks the hidden button's `inert`.

(c) **Where it swipes.** `ItemRow`: wrapped in `SwipeRow` (Remove → `changes.removeItem`, the
sheet's own call and toast). `PhoneLists` rows (`ListsTab.tsx:23-85`): wrapped (Remove → when the
list has anything on it, open `ChangeListPanel` for that list with its asking step already
showing, "Groceries still has 12 things on it." · Remove Groceries · Keep Groceries; otherwise
`removeList` at once, with its Undo). `ChangeListPanel` gains `asking?: boolean` for that.

(d) **Change List's Remove reads as a row.** `ListsRoom.tsx:296-391`: `Remove {name}` becomes
`block` (the width of the panel, still `quiet-danger`), above the pinned Save Changes, so it is
found without looking; the inline asking step is unchanged.

(e) **Tips** (`tips.ts`, `needs: ["lists"]`): "Lists: tap an item to change its day or who it's
for, or to remove it." and "Hold a list's tile to rename or remove the list."

(f) ADR 0036: the rows-that-open and swipe rows.

**Tests.** `just test-fe src/ui src/features/lists`. End to end, `e2e/lists.spec.ts`: on
`display-1080p`, "an item's row opens its sheet, and Remove takes it off the list with Undo":
open Groceries, the row "Eggs" has a chevron (the button contains an `svg`; or assert the sheet
opens from a tap on the row's words), tap → the panel "Eggs"; **Remove Eggs** → the row is gone
and the toast "Removed Eggs" shows Undo → Undo brings it back. On `phone-chromium`, "a swiped row
shows Remove": sign in, open Groceries, drag "Eggs" 120 px to the left with `page.mouse`
(`down`, three `move`s, `up`) → the button "Remove Eggs" is visible and hittable → tap → the
toast with Undo; and on the list of lists, a swipe on "Groceries" shows Remove, and tapping it
opens Change Groceries at its asking step. Run `just e2e e2e/lists.spec.ts --project=
display-1080p -g "row opens"` and `… --project=phone-chromium -g "swiped"`. The tap-target
check (`checks.ts`) must still pass on the list page: the hidden Remove is `inert`, so it isn't
measured.

**Docs.** `UX.md:361` (List detail): "Tapping a row's text opens a small sheet: Rename, Who, Day,
Remove." → "Every row ends in a chevron, because the row is a button: a tap on its words opens
the item (What, Who, Day, **Remove** with Undo, Save Changes). On a phone, a row swiped to the
left shows **Remove** (one row at a time; a tap elsewhere puts it back): a shortcut for the
sheet's, never the only way; the wall's rows never swipe." `UX.md:341` (Lists room): after the
long press, "on a phone, a row of the list of lists swiped left shows Remove, which asks first
when the list has anything on it". `UX.md:554` (phone Lists): "rows with a chevron, and a swipe
to the left for Remove". `UX.md:38` (§1 swipes): "swipes (week paging, a phone's row for Remove)".
GOTCHAS if `motion`'s drag and the rows' `layout` fought.

**CHANGELOG** (Changed). "Every item on a list ends in a chevron, so it's plain that a tap opens
it to change its day, who it's for, or remove it; on a phone, a row swiped to the left shows
Remove, for an item or a whole list."

**As built.** As planned, with three changes. The chevron sits at the very end of the row's
button, after a wrapping group of the words and the meta, rather than grouped with the meta
(which wraps under long words and would have taken the chevron with it to the left). The swiped
row's hidden Remove is `aria-hidden` as well as `inert` (Playwright's role queries don't skip
`inert`, so the a11y journey's `{ name: "Eggs" }` found both). And the row cancels `dragstart`:
on the list of lists the row is a link, and a link starts Chromium's own drag-and-drop under a
mouse, so the swipe never moved. `motion`'s drag and the rows' `layout` didn't fight. The phone
cases in `lists.spec.ts` run on `phone-chromium` (the spec's `beforeEach` now admits it, and each
case says which it's for). Found in T4 and fixed in its own commit: on a phone `asParent` waits
for a PIN pad that only the wall mounts, so a list's swipe on a child's phone would have hung on
a list someone else made; a list row now swipes only on a parent's phone or for its maker.

### T4 Tasks: rows that open, a swipe on phones, All Tasks, and finished tasks that leave

- [x] Done (commit: "chores: All Tasks, a task's next day, rows that open, and finished tasks that leave")

**Owner's note.** As T3, and: "Also, if a task is scheduled for next month, there is no way to
see it from the Tasks page. Design a way to view all tasks and easily make changes to or remove
them."

**What exists.** "Answers" B. The pieces: `chores/ChoreBoard.tsx:70-199` (`ChoreColumn`),
`:206-398` (`ChoreRow`: the `TickBox`, then a `press-row` title button with `boxLine`'s line;
`setEditing(true)` opens the sheet), `:582-650` (`ChoreSheet`: a `SidePanel` titled with the
box's title; `repeat_text`; **Change** → `ChoreEditor` in edit mode, the PIN asked only on Save;
**Skip Today** when `chore.rrule`; `Remove {title}` with Undo through `restoreChore`; every
change is `asParent` with "Changing tasks on this screen asks for the parent PIN.",
`chores/data.ts:38, 168-264`); `chores/ChoresRoom.tsx:36-92` (`ChoresBoard`: `useChoresDay(today)`;
the header's `Segmented` "Show" with **Today | This Week** at `:45-70`, and the Stars & Rewards
link), `:94-114` (`TodayColumns`: a `snap-x overflow-x-auto` row of `ChoreColumn`s), `:117-176`
(`WeekColumns`: counts only, rows not tappable); `chores/ChoresTab.tsx:34-111` (`PhoneChores`:
the Segmented, `Sections` with the phone's person first and open, `PhoneWeek`); `chores/
ChoreEditor.tsx:42-234` (`ChoreEditor({ chore?, startDay, onDone })`, edit mode with `chore`);
`chores/words.ts` (`boxLine`, `clockText`, `namesText`); `chores/data.ts:58-63` (`useChores()` →
`GET /api/chores`, every active task, used only to find a tapped box's chore); `chores/
schemas.py:25-39` (`ChoreOut`: `repeat_text`, `start_date`, `due_time`, `assignee_mode`,
`assignee_member_ids`, `points`, `active`, no next day); `chores/router.py:64` (`GET /api/chores
?include_inactive`), `:193-209` (`PATCH`, `DELETE`, `restore`, `skip`, `unskip`: parents);
`chores/service.py:261-278` (`remove_chore` keeps completions; `restore_chore`), `:311-332`
(`_column_ids`: a column for every assignee of any active fixed chore, whatever its dates, and
Anyone when any rotate or any-mode chore exists), `:367-422` (`day_view`); `domain/chores.py`
(`due_days(rule, start, end)` `:123-126`, `turn_on` `:129-148`, `Schedule` `:151-245` with the
one-off carry-over rule in `due_on`, `streak`, `tally`); `plugin.py`'s hourly `prune` (routine
checks over 60 days; chores, completions and redemptions are history); `EventSheet.tsx:166` (the
sheet asks the PIN before its editor opens); `countdowns`' tidy (`countdowns/service.py`, "a
one-off countdown whose day has passed leaves for Recently Removed") and `chores/Removed.tsx`
(Put Back → `restoreChore`). The e2e `chores.spec.ts:271-379` adds a task every two weeks and
checks its future dates only through the API, "because the UI can't show them".

**Build.**

(a) **Backend: the next day, the columns, the tidy.** `domain/chores.py`: `next_due(rule, today,
done: Callable[[date], bool] | frozenset) -> date | None`, pure: for a repeating rule, the first
day in `due_days(rule, today, today + 366 days)` not skipped (None when none: the rule has
ended, or nothing within a year); for a one-off, `start_date` when it is today or later, else
today when its boxes on `start_date` aren't all done (the same carry-over `Schedule.due_on`
applies: fixed means every assignee, rotate or any means one completion), else None. A rule's
**last day** helper beside it (`last_due(rule)`: None for one that never ends) for the tidy.
`chores/schemas.py`: `ChoreOut.next_due: date | None`. `chores/service.py`: `chore_out` fills it
(the completions of its start day read in one query for the one-offs); `GET /api/chores` returns
them sorted by `next_due` (None last), then title; `_column_ids` (`:311-332`) counts only chores
whose `next_due` is not None, so a person whose only task is finished has no column and the
room shows its empty state. **The tidy**, in the hourly job: a chore with `next_due is None`,
last changed over 24 hours ago, whose last day (a one-off's `start_date`; a repeat's `last_due`)
is before today, gets `deleted_at = now` and `chores.changed` (completions, stars and streak
history untouched; it shows in Recently Removed with "A task"; Put Back clears `deleted_at` and
sets `updated_at`, so it stays a day). `backend/tests/domain/test_chores.py`: next_due for a
daily (today), a weekly on Sat (the coming Sat), a one-off next month (its date), a one-off done
on its day (None), a one-off from last week not done (today), a rule with UNTIL passed (None), a
skipped next day (the one after). `backend/tests/chores/`: the sort and `next_due` in `GET
/api/chores`; the column rule (a person with only a finished task has no column; with only a
future task, a column reading "Nothing today"); the tidy (a one-off done yesterday leaves at the
next tick and is listed by `GET /api/chores/removed`; an undone one stays; an ended repeat leaves;
one put back stays for a day); `just api-types`.

(b) **The chevron, and the sheet.** `ChoreRow` (`ChoreBoard.tsx:386-395`): the chevron at the
end of the title button, as T3(a). `ChoreSheet` (`:582-650`): it takes `{ chore_id, title,
due_date: string | null }` instead of a box, so All Tasks can open it (`due_date` null); under the
title, `ruleLine(chore, people, stars, today)` from `words.ts` (below) instead of `repeat_text`
alone; **Change** asks the PIN first on the wall, as `EventSheet.tsx:166` does, then opens
`ChoreEditor`; **Skip Today** only when the chore repeats and `next_due === today`; **Remove**
as it is. `words.ts`: `nextWord(next_due, today)` ("Today", "Tomorrow", else `shortDate`:
"Sat, Nov 14"; "" for null) and `ruleLine(chore, people, stars, today)`: the rule ("Once" for
"Doesn't repeat", else `repeat_text`), then the next day, then "by 5:00 PM", then "★2" (stars
on), then "Mia and Leo take turns" (rotate) or "Mia and Leo each" (fixed with several) or
"Anyone" (any), joined with " · "; `words.test.ts` cases.

(c) **Swipe on phones.** `ChoreRow` wrapped in T3's `SwipeRow` (Remove → `changes.removeChore`,
`asParent`: a parent's phone removes at once with Undo; a child's phone gets the server's plain
refusal as today); the wall never swipes.

(d) **All Tasks on the wall.** `ChoresRoom.tsx:45-70`: the Segmented "Show" gains **All Tasks**
(`Today | This Week | All Tasks`); `chores/AllTasks.tsx`: `AllTasksColumns` in `TodayColumns`'
scroller (a column per person any task names, household order, then Anyone; fixed: each
assignee, rotate: each member in the turn order, any: Anyone), each column headed by the avatar,
the name and "5 tasks" (no stars, no count ring), then `TaskRuleRow`s: the title, `ruleLine`,
a chevron, no box, `min-h-[72px]`, a tap opening `ChoreSheet`; sorted by `next_due` then title;
a column with none isn't drawn; the room with no tasks shows its empty state as Today does. The
data is `useChores()` (it refreshes on `chores.changed`).

(e) **All Tasks on a phone.** `ChoresTab.tsx:34-111`: the Segmented gains All Tasks; `Sections`
with `TaskRuleRow`s (the phone's person first and open, as Today), each wrapped in `SwipeRow`.

(f) **Tips** (`needs: ["chores"]`): "Tasks: All Tasks lists every task, due this week or next
month. Tap one to change or remove it." and "Tap a task's name to change it, skip it today, or
remove it."

(g) ADR 0036: the All Tasks, finished-tasks and task-sheet rows; ADR 0025's annotation.

**Tests.** `just test-py tests/domain/test_chores.py tests/chores`; `just test-fe src/features/
chores`. End to end, `e2e/chores.spec.ts` (`display-1080p`, the seed's PIN as the other cases
use it): "a task due next month shows under All Tasks and can be removed": add a one-off task
for `today + 30` days through the API (`POST /api/chores`, as the two-weeks case does), open
Tasks, **All Tasks** → a row with its title and "Once · Sat, Nov 14" (the date from the clock),
no checkbox in that column; tap it → the panel with the same line; **Remove** → the PIN pad (the
household has one in the seed) → the PIN → the toast "Removed …" with Undo; Undo → the row is
back. The tidy is tested in pytest only (there is no test route that runs jobs; countdowns'
tidy is tested the same way, `tests/countdowns/test_plugin.py:166-185` calling
`service.tidy(ctx)` with the clock moved). On `phone-chromium`: "All Tasks on a phone, and a
swiped row": the Segmented's All Tasks, the person's section open, a swipe showing Remove. Run
`just e2e e2e/chores.spec.ts --project=display-1080p -g "All Tasks"` and `… --project=
phone-chromium -g "phone"`. By hand in
`just display`: Today's chevrons; a task's sheet from Today (Skip Today present) and from All
Tasks on a task due later (absent); the PIN before Change.

**Docs.** `UX.md:365-382` (Tasks room): the header line in the wireframe gains `[All Tasks]`; a
new paragraph after "Editing: tap the title…": "**All Tasks**: the same columns, every task that
names the person (Anyone's last), soonest first: the title over one quiet line, 'Every week on
Sat · Sat, Nov 14 · by 5:00 PM · ★2', 'Once · Tomorrow', 'Every day · Today · Mia and Leo take
turns'; no boxes (Today is for doing), a chevron, and a tap opens the task (Change, Skip Today
when it's due today, Remove with Undo). A task due next month is here the moment it's added. A
finished task (a one-off done on its day, a repeat past its last day) leaves for Recently
Removed the day after, as a past countdown does; Put Back keeps it a day." "Editing: tap the
title → …" becomes "Every row ends in a chevron: tap the title → the task (Change, which asks
the PIN first on the wall; Skip Today, with Undo; Remove, with Undo)". `UX.md:558-579` (phone
Tasks): `[Today | This Week | All Tasks]`, and "a row swiped left shows Remove". `UX.md:453`
(Recently Removed): "tasks (finished ones come here by themselves)". `UX.md:759-760` (§8): a line
"All Tasks, none for a person | the column isn't drawn". `PLAN.md:493` (chores' endpoints):
`next_due` on `GET chores`; `PLAN.md:515` (`chores:prune`): "and finished tasks leave for
Recently Removed". ADR 0025: an annotation.

**CHANGELOG** (Added). "Tasks → All Tasks lists every task, due this week or next month, with
its rule and its next day; tap one to change or remove it." (Changed.) "Every task row ends in
a chevron; on a phone a row swiped to the left shows Remove. A task that's finished (done on its
day, or past its last repeat) leaves for Recently Removed the next day, where Put Back keeps it."

**As built.** As planned, with these differences, each in ADR 0036:
- *The columns* count a person with a task still ahead **or a box on the days shown**, not only
  the first: `day_view` draws only the boxes whose owner has a column, so a one-off done late
  (finished, but stamped today) would have vanished from today's board, and the week would have
  lost the columns its past days had.
- *"Finished"*: a task with no next day reads "Finished" in its line instead of nothing (the
  plan's `""`), so a row never looks as if its day went missing.
- *The sheet* takes `{ chore_id, title }`, with no `due_date`: Skip Today shows only while the
  task repeats and is due today, so it always skips today.
- *The swipe on tasks* is offered only with a parent's rights (`viewer.answers`): on a phone with
  a PIN set, `asParent` waits for a PIN pad that only the wall mounts, so a child's swipe would
  have hung rather than shown "the server's plain refusal". (The sheet's own Remove on a child's
  phone still does: the follow-up below.)
- *`last_due`* needed the rule's last day: `domain.recurrence.last_day` exposes the walk's own.
- *The first tip* was 94 characters, over the list's 90: "Tasks: All Tasks lists every task,
  even next month's. Tap one to change or remove it."
- The phone's Today sections fold with the same `Folding` as All Tasks'.
- The hidden Remove drew a red hairline round every row at rest (fractional pixels); it's drawn
  only while a row is off its rest.
- Tested also: a one-off done late keeps its column that day; a paused task isn't tidied.

### T5 Photo libraries: the backend, with Immich as the first

- [x] Done (commits: "net: the home-network tick writes the allowlist, and an API key never
  follows a redirect" for (a); "screensaver: photo libraries, Immich first (the backend)" for the
  rest)

**Owner's note.** "Plan an integration to Photos where they can connect to an Immich server with
an API Key and can select various filters on what to use for the screensaver. List People they
can filter by, or specific albums and/or tags. Once the Immich instance URL and API key is saved,
the UI should automatically fetch these options so they can easily select the custom set of
images they want for their screensaver. If no filters are provided let the user know that it
will use all images. Plan it in such a way that Immich will be the first of many different photo
library options they can use (to be built later)."

**What exists.** "Answers" D. The pieces, backend: `plugins/screensaver/models.py:23-48`
(`SourceKind`, `PhotoSource`, `EXPORT_COLUMN_EXCLUDED`), `schemas.py:38-57` (`SourceOut`,
`SourcePatch`, `ScanOut`), `router.py:31-47` (`GET manifest` A; `GET sources`, `PATCH
sources/{id}`, `POST sources/{id}/scan` P), `service.py:56-71` (constants, `VISIBLE`), `:104-125`
(`manifest`), `:131-151` (`problems`: an enabled source with a `last_error`), `:154-156`
(`source_key`), `:198-208` (`ensure_inbox`), `:241-433` (the inbox import: each file encoded in a
thread before a short write transaction, one `_Tally`, `_record` for `last_error`), `:436-452`
(`scan_source`: 409 `cant_check` for any kind but the inbox), `plugin.py:20-21, 89-102` (the
jobs); `photos/store.py:40-50` (sizes), `:180-187` (`encode`), `:189-225` (`ingest(session, data,
*, kind, zone, now, source_key, original_name, encoded)`: the sha dedupe at `:204-210`),
`:241` (`delete_files`); `photos/models.py:21-40` (`Photo`: `source_key`, `hidden`,
`deleted_at`); `photos/router.py:146-179` (`DELETE`, `restore`, `hide`); `app.py:73, 228-243`
(removed photos hard-deleted after 7 days); `plugins/context.py:356-399, 416, 434, 459-473`
(`ctx.http(allow_private=)` → `PluginHttp.get/request`; `ctx.photos` is the `PhotoStore`;
`encrypt`/`decrypt`; `every`); `core/http.py:27-34, 92-176` (`GuardedHttp`, `CREDENTIAL_HEADERS`,
the per-hop guard, `FetchResult`, the caps and timeouts, `OutboundError` codes); `core/
netguard.py:68-82, 115-121, 139-149` (private means not `is_global`; the allowlist match; the
message); `core/logging.py:17-20` (the redactor's pattern); `household/models.py:207`
(`NetworkAllowEntry`), `household/router.py:38-52, 248-278` (`allow_target`, the allowlist API);
`boot.py:154-165, 202-208` (`_credential_tables`, the wipe); `calendar_sync` as the precedent for
a connection check and its words (`service.py:647-713`, `providers/caldav.py:83-88, 356-397`;
`AccountStatus`, `models.py:37-41`), for `allow_private` carried from the row (`service.py:585`),
and for test fakes (`tests/sync/test_accounts.py:47-92`: a `MockTransport` handler and a
resolver; `test_caldav.py:422-435`: a `GuardedHttp` over a fake transport); the weather's
cache-and-stale pattern (`weather/service.py:48-51, 233-303`). Tests that pin things:
`tests/test_boot.py:116-145` (expects `("photo_sources", False)`: no status column),
`tests/test_export.py`, `tests/plugins/test_contract.py`, `tests/test_ssrf_audit.py` (no literal
`allow_private=True`; the client made once), `tests/screensaver/test_inbox.py:338-350` (a
non-inbox kind answers `cant_check`), `scripts/image_common.sh` (the export's tables).
Doc drift found: PLAN §6.2 (`PLAN.md:267`) calls `ctx.photos` a facade with `ingest, list,
remove`; PLAN §5.3 (`:177`) lists `screensaver/sources/{inbox,immich,nextcloud,fake}.py`, which
doesn't exist; PLAN §11.1 (`:477`) lists a `photos/{id}/thumb` route and a multipart upload
that aren't the code's; `SUNROOM_ALLOW_PRIVATE_URLS` is in PLAN §14.2 (`:706`) and `config.py:67`
but in no `.env.example` or README line.

**Build.** Verify Immich's API first (Before the first task, 4).

(a) **The guard's three fixes.** `core/http.py:34`: `CREDENTIAL_HEADERS` gains `"x-api-key"`
(and the comment says why: a library's key must never follow a redirect to another server);
`core/logging.py:18`: the pattern gains `api[-_]?key` in place of `api_key`; `core/netguard.py:
117-121`: the message becomes 'That address is on your home network. A parent can allow it: tick
"This server is on your home network".' `plugins/context.py`: a facade `ctx.network` with
`allow(target: str, label: str) -> None` (normalises with `allow_target`, moved from
`household/router.py:38-52` into `household/service.py` with the router importing it from there;
adds a `NetworkAllowEntry` unless one with that target exists, through the household's own module
so the plugin never touches the table) and `disallow(target, label)` (removes the rows with that
target **and** that label; a row someone added by hand, or another feature's, stays). The sync
plugin uses it (`calendar_sync/service.py:306, 664`: after a successful check with
`allow_private` on, `ctx.network.allow(host, f"{label} (Calendars & Accounts)")`; on account
removal, `disallow`); `frontend/src/features/sync/AddAccount.tsx:443, :659`: the hints lose "A
parent also adds it under Settings → Network." (they read "Only for a server at home: a parent's
tick lets Sunroom reach a home address."). `.env.example`: the `SUNROOM_ALLOW_PRIVATE_URLS` line
with its one-line comment (off; not needed when the tick is used). Tests: `tests/test_netguard.py`
(beside `test_credentials_never_follow_a_redirect_to_another_server`, `:139`): `x-api-key`
dropped on a cross-origin hop and kept on a same-origin one; `tests/test_logging.py`: `x-api-key`
masked; `tests/sync/test_accounts.py`:
adding a private CalDAV account with the tick lists its host, and removing the account unlists
it; the audit stays green (the facade passes nothing literal).

(b) **The migration** (after the models change): `photo_sources` gains `status: String(20)`
(`connected | needs_reconnect | error`, `server_default="connected"`; the inbox row stays
`connected`), `options_json: Text` (`server_default="{}"`), `options_at: UTCDateTime | None`;
a new table **`photo_source_items`**: `id`, `source_id` (FK `photo_sources.id`), `remote_id
String(100)`, `photo_id String(36) | None` (core's photo, no FK: core hard-deletes photos after 7
days and the mapping then fetches again), `taken_at`, `seen_at` (the last pass that listed it),
`fetched_at | None`, `dropped_at | None` (no longer matching the picks; its photo removed),
`UNIQUE(source_id, remote_id)`, an index on `source_id`. `TABLES` gains it; `EXPORT_TABLES` stays
`("photo_sources",)` (the mapping is a cache). `just db-revision "screensaver: photo libraries"`,
shaped like the released ones (`batch_alter_table`, `downgrade` raises). The fixture:
`tests/fixtures/db/build.py` gains `_v0_14_0()` (0.13.0's rows plus a library source with a
status, options and two mapping rows), registered under the new revision; `cd backend && uv run
python -m tests.fixtures.db.build <revision>`; commit the SQL with the migration.
`tests/test_boot.py:116-145`: `("photo_sources", True)`, and the wiped library ends
`needs_reconnect` (boot's code already handles a table with a status column; confirm). `tests/
test_export.py`: `photo_source_items` among the tables left out; `scripts/image_common.sh`: no
change to the export list (nothing new is exported), but the smoke test's probe of
`GET /api/screensaver/sources` must still pass.

(c) **The library interface and the registry**, `plugins/screensaver/sources/` (a package:
`__init__.py` a docstring; `base.py`; `immich.py`; `fake.py`; `registry.py`): in `base.py`,

```python
@dataclass(frozen=True) class LibraryKind: kind: str; name: str; address_hint: str; key_help: str
@dataclass(frozen=True) class LibraryInfo: name: str; version: str; photo_count: int | None
@dataclass(frozen=True) class Choice: id: str; name: str; count: int | None; has_thumb: bool
@dataclass(frozen=True) class Choices: people: list[Choice]; albums: list[Choice]; tags: list[Choice]; unnamed_people: int
@dataclass(frozen=True) class Picks: people: list[str]; albums: list[str]; tags: list[str]   # ids
@dataclass(frozen=True) class RemotePhoto: id: str; taken_at: datetime | None; width: int | None; height: int | None
class LibraryError(Exception): code: Literal["auth", "forbidden", "not_a_library", "too_old", "unreachable", "bad_reply"]; message: str  # plain English
class Library(Protocol):
    kind: LibraryKind
    async def check(self, http, url, key) -> LibraryInfo
    async def choices(self, http, url, key) -> Choices
    async def find(self, http, url, key, picks, limit) -> list[RemotePhoto]   # newest first, at most limit; any pick matches; images only
    async def fetch(self, http, url, key, photo) -> bytes                       # the preview
    async def thumb(self, http, url, key, *, person: str | None, asset: str | None) -> tuple[bytes, str]  # a face or a cover, with its media type
LIBRARIES: dict[str, Library] = {"immich": ImmichLibrary()}
```

`immich.py`: `ImmichLibrary` on `PluginHttp` (`x-api-key` header; JSON bodies through
`request(..., content=json.dumps(...).encode(), headers={"Content-Type": "application/json"})`;
`max_bytes` 20 MB for lists, `MAX_FILE_BYTES` for a preview): `check` = `GET /api/server/ping`
(`{"res": "pong"}`, else `not_a_library`), `GET /api/server/about` (the version; below 2.0 →
`too_old`, "Sunroom works with Immich 2.0 and newer; this one is 1.x."), then a one-item search
to prove the key reads photos (401 → `auth`, "Immich said that key isn't right. Make a new API
key in Immich and connect again."; 403 → `forbidden`, "That key can't read photos. In Immich, make
a key that can read photos, albums, people and tags."), the reply's total as `photo_count` when
it is there; `choices` = people (`withHidden=false`, paged; named ones as choices with
`has_thumb`, the unnamed counted), albums (name, `assetCount`), tags (`value`, the full path, as
the name); `find` = with no picks, `POST /api/search/metadata {type: "IMAGE", order: "desc",
size: 1000, page}` until `limit`; otherwise one search per person (`personIds: [id]`) and per tag
(`tagIds: [id]`) paged until `limit` each, and `GET /api/albums/{id}` per album (its `assets`,
images only), the lot merged by id, newest first by `localDateTime` (else `fileCreatedAt`), cut
to `limit`; trashed and archived (or non-timeline) assets left out as the spec names them;
`fetch` = `GET /api/assets/{id}/thumbnail?size=preview`; `thumb` = `GET /api/people/{id}/
thumbnail` or `GET /api/assets/{id}/thumbnail?size=thumbnail`. Every `OutboundError` becomes
`LibraryError("unreachable", its message)` (the guard's own words for a private address, not
found, timeout); a reply that isn't JSON → `bad_reply` ("Immich sent a reply Sunroom couldn't
read."). The docstring names the spec tag checked. `fake.py`: `FakeLibrary`, the pretend Immich
for the test server and tests: scripted people (Ana, Sam, Mia, Leo, two unnamed), albums ("Beach
2026", "Sample Street", "Birthdays"), tags ("Wall", "Favorites"), twelve generated images (Pillow,
each 1440×960 in a flat color with its number) with taken dates spread over a year, faces as
small generated circles; a key of `sample-key` works, anything else is `auth`; the URL
`http://immich.test` only. `registry.py` adds the fake under its own kind name **only in test
mode** (`ctx.settings().test_mode`), with `kind="immich"` and the host `immich.test`, so the
screens exercise the real Immich path with no network: the service picks `FakeLibrary` when
test mode is on and the address's host is `immich.test`.

(d) **The service**, `plugins/screensaver/libraries.py` (keeping `service.py` to the inbox and
the manifest): `add_library(ctx, actor, body)` (kind in `LIBRARIES`, else 422 "That kind of
library isn't one Sunroom knows."; the address normalised: scheme and host (and port), a trailing
`/api` or `/` dropped; the guard's classification first (`ctx.http(allow_private=body.allow_private)`
does it on the first request: a private address with the tick off comes back as the guard's
sentence, 422 `private_address`); `check` → 422 with the `LibraryError`'s message and code on
failure (nothing saved); on success: `ctx.network.allow(host, f"{name} (Photos & Screensaver)")`
when the tick is on, the row (`kind`, `label` = the kind's name, `config_json = {"url", "picks":
{"people": [], "albums": [], "tags": []}, "limit": 500}`, `credentials_enc = ctx.encrypt(key)`,
`allow_private`, `status = connected`), then `choices` cached into `options_json` / `options_at`
(a failure here records `last_error` and leaves the choices empty: the row is saved either
way), `screensaver.changed`, and a pass started (below); returns `LibraryOut`).
`update_library` (`picks`, `limit`, `enabled`, `label`: saved; a change of picks or limit starts
a pass). `reconnect_library(key, url?)`: `check`, then the new key (and address), `status =
connected`, `last_error = None`, a pass. `remove_library`: `deleted_at`, every mapping row's
photo soft-removed (`Photo.deleted_at = now` for its `photo_id`s; files go with core's 7-day
prune), `ctx.network.disallow(host, label)`, `screensaver.changed` and `photos.changed`.
`choices(ctx, source, refresh)`: the cache, refreshed when asked or over an hour old.
`thumb(ctx, source, person, asset)`: proxied bytes. **The pass** (`sync_library(ctx, source)`):
one at a time per source (an `asyncio.Lock` per id, 409 `already_checking` from Check Now);
`find` → the wanted ids, newest first, cut to `limit`; the mapping rows diffed: new ids get rows
(`seen_at`); ids no longer wanted get `dropped_at` and their photo soft-removed; ids back again
get `dropped_at = None` and their photo restored (`deleted_at = None`) when the photo row is
still there, else fetched again; then **the fetches**: for each row with no `photo_id` (or a
photo row that no longer exists), `fetch` → `ctx.photos.encode(data, kind=LIBRARY, zone)` in a
thread → `ctx.photos.ingest(session, data, kind=LIBRARY, zone, now, source_key=f"source:{id}",
original_name=f"{remote_id}.jpg", encoded, taken_at=photo.taken_at)` in one short write
transaction each (`PhotoStore.ingest` gains `taken_at: datetime | None = None`, used when EXIF
has none; `photos/store.py:189-225`), the mapping's `photo_id` and `fetched_at` set in the same
transaction, `photos.changed` published after every 20 and at the end; **at most 200 fetches per
pass**, and a pass that still has work schedules the next at once (`ctx.spawn`, after a 2 s
pause), so a first fill of 500 completes in minutes while the wall starts showing the first
ones; a fetch that fails is counted and skipped (three tries over three passes, then `dropped_at`
with a count in the log, never a raise); a `LibraryError` on the listing records `last_error`
in plain words, `status = needs_reconnect` for `auth` and `forbidden`, `error` otherwise, and
ends the pass; a success clears `last_error` and sets `status = connected`, `last_scan_at = now`,
`items_seen += new`. The job: `ctx.every("library-sync", 30 * 60, …)` over every enabled library,
in `plugin.py` beside the inbox's; a failing library never raises out of the job (hard rule 7's
"a failure stays inside": the inbox keeps scanning). `problems(ctx)` (`service.py:131-151`)
gains the libraries: `needs_reconnect` → "Immich needs its key again." (`page="screensaver"`);
`error` → "Immich hasn't answered since 9:10 AM. Showing the photos it had."; the detail for
parents is `last_error`. `scan_source` (`:436-452`) runs the pass for a library kind instead of
`cant_check`. The boot wipe: a library whose key was wiped ends `needs_reconnect` with
`last_error` "Sunroom can't read this library's saved key any more. Connect it again." (set
where the sync plugin sets its own, or by boot for tables with a status column: confirm which).

(e) **Shapes and routes** (`schemas.py`, `router.py`; every class name unique, prefixed
`Library`): `LibraryKindOut(kind, name, address_hint, key_help)`; `LibraryIn(kind, url, api_key,
allow_private, label | None)`; `LibraryPatch(picks | None, limit | None, enabled | None, label |
None)` (limit one of 100, 250, 500, 1000, 2000); `LibraryReconnectIn(api_key, url | None)`;
`LibraryChoiceOut(id, name, count, has_thumb)`; `LibraryChoicesOut(people, albums, tags,
unnamed_people, fetched_at)`; `LibraryOut(id, kind, name, url, status, enabled, allow_private,
picks, limit, photo_count, pending (rows not yet fetched), checking (a pass running), last_scan_at,
last_error, options_at)`; `SourceOut` stays for the inbox (the list route returns both kinds:
`GET sources` keeps `SourceOut` for the inbox and the libraries appear in `GET libraries`, so no
existing shape changes). Routes, all parents, under `/api/screensaver`: `GET library-kinds`,
`GET libraries`, `POST libraries` (201), `GET libraries/{id}`, `PATCH libraries/{id}`, `POST
libraries/{id}/reconnect`, `DELETE libraries/{id}`, `GET libraries/{id}/choices?refresh=`, `GET
libraries/{id}/thumb?person=|asset=` (bytes, the library's media type, `Cache-Control: private,
max-age=3600`, 404 when the library has no such thing), `POST libraries/{id}/scan` (the pass;
409 while one runs; or route the existing `sources/{id}/scan` to it: pick one and say so). A
test-only route, `POST /api/screensaver/_test/library`, adds the pretend library connected and
synced (for `just seed` and the screenshots). `just api-types`.

(f) **The seed** (`sample.py`): nothing by default (a library is the family's); the screenshots
spec uses the test route.

(g) ADR 0036: the library rows; PLAN §6.2's `ctx.photos` line made true (`:267`: "the
`PhotoStore` itself: `encode`, `ingest`, `file`…"); PLAN §5.3 (`:177`): `sources/{base,immich,
fake,registry}.py, libraries.py`; PLAN §9 (`:402`), §10.3 (`:453`: the new columns and
`photo_source_items`), §11.3 (`:496`: the routes), §11.4 (`:509`: `screensaver:library-sync`
every 30 min, at most 200 photos a pass, the rest at once), §12.6 (`:559`: the tick writes the
allowlist row; `x-api-key` among the stripped headers), §14.2 (`:706`: unchanged); `docs/
RESTORE.md:47` already says a photo source asks to be connected again (true now); `docs/
PLUGINS.md`: a line under "Stored secrets" that `photo_sources` has its status; `PRIVACY.md`: a
row in "What leaves the server": "**Photo libraries you connect** | The Immich server you add |
Every 30 minutes, and when you check | Your API key for it, to that server only; copies of the
photos it picks are kept on this server, resized, as uploaded photos are" and "What Sunroom
stores" gains "the key of a photo library you connect, encrypted".

**Tests.** `backend/tests/screensaver/test_libraries.py`, the pretend Immich as a
`MockTransport` handler (`FakeImmichServer`: the routes above, synthetic data, small generated
JPEGs; a resolver mapping `immich.test` to a public address and `immich.home` to a private one):
connect (201; the row; `status`; the choices cached; a pass ran and the manifest grew; the
photos' `source_key`, `taken_at` from the API, no EXIF); a private address with the tick off →
422 `private_address` with the guard's sentence, and nothing saved; with the tick on → the
allowlist row named after it, and gone after `DELETE`; a bad key → 422 `auth`; a reply that isn't
Immich → 422 `not_a_library`; an old version → 422 `too_old`; unreachable → 422 with the guard's
words; picks: a person, an album and a tag are a union, newest first, cut to `limit`; a pick
removed → its photos soft-removed on the next pass and back without a fetch when picked again
within the week; a hidden photo stays hidden through a drop and a return; the 200-per-pass cap
and the follow-on pass; a fetch that fails three times is dropped, the pass still succeeds;
`auth` mid-way → `needs_reconnect`, a problem "Immich needs its key again.", and the inbox scan
still runs; reconnect clears it; `scan` 409 while running; `DELETE` removes the photos and the
mapping; the plugin switched off answers 404 on every library route and the data is back on;
`GET library-kinds` lists Immich; the fake registered only in test mode; `test_boot` and
`test_export` as (b). `just test-py tests/screensaver tests/test_boot.py tests/test_export.py
tests/test_netguard.py tests/test_logging.py tests/test_photos.py tests/sync tests/plugins
tests/test_ssrf_audit.py tests/test_migrations.py`. No end-to-end spec in T5 (T6 drives the
whole thing from the screens); `just smoke-image` is not run until the deploy.

**Docs.** As (g). GOTCHAS: whatever cost time (the mapping without a foreign key; the fake's
registration; `ingest`'s `taken_at`).

**CHANGELOG** (Added, one line shared with T6; T5 writes it, T6 edits it). "Settings → Photos &
Screensaver → Photo Libraries: connect an Immich server with its address and an API key, pick
the people, albums or tags to show (or show every photo), and the screensaver draws on them;
Immich is the first library, and more kinds can follow." (Fixed.) "A calendar server or a photo
library on the home network can be allowed from its own sheet: the 'This server is on your home
network' tick now does what it says."

**As built.** In two commits, (a) and then the rest. What differs, each in ADR 0036:
- *Immich's API* was checked against the specs at **v2.7.5** and **v3.3.4**: Immich 3.0 came out
  in July, and 3.3.4 the day before this batch, so the client is "2.0 and newer", tested against
  both versions' answers. Smallest fixes to the plan's names: the version from
  `/api/server/version` (`/server/about` needs a permission a family's key may lack); an album's
  photos through the search's `albumIds` (since 3.0 an album no longer carries its `assets`); a
  photo's own `width`/`height`; `visibility: "timeline"` and `withDeleted: false` (the search has
  no `isArchived`/`isTrashed`); the library's count from `/api/assets/statistics` (the search's
  `total` counts one page). The search's flat filters and `page` are deprecated since 3.2.0 in
  favour of `filter` and `cursor`, but still answer and are all 2.x knows: a follow-up below.
- *The tick*: the guard wants both the tick and the allowlist row, so the row is written
  **before** the first check and taken back if the check fails (the plan had it after a
  successful check, which could never succeed for a home server). Rows are named after the
  feature ("Calendars & Accounts", "Photos & Screensaver") rather than the account, and added
  unless that feature's row is there: a renamed account still finds its row, and two features or
  accounts on one server never cut each other off.
- *Passes* run in tasks of their own, and the 30-minute job only starts them: a job or spawned
  task that raises stops the whole plugin, and a pass of 200 fetches would otherwise hold up the
  inbox's scan. `photo_source_items` has a `fetch_failures` column the plan didn't list, for
  "three tries over three passes". Check Now is `POST libraries/{id}/scan`, which starts a pass
  (the plan's first option); `sources/{id}/scan` stays the inbox's, and `GET sources` lists only
  the inbox, so the existing page shows no library twice.
- *`LibraryOut`* also carries `version` and `library_photos` (for T6's "Connected · Immich 2.7 ·
  12,345 photos"), kept in `config_json` from the last check; `LibraryKindOut` a `placeholder`.
- *The pretend Immich* answers at `http://immich.test` with `sample-key` when `ctx.test_mode` is
  on (the plan wrote `ctx.settings().test_mode`); pytest's own pretend server is a
  `MockTransport` handler at made-up hosts, so tests never meet the test-mode stand-in.
- A library switched off keeps its photos, and the manifest leaves them out; problems, `GET
  sources` and Check Now in `service.py` are the inbox's, and the plugin adds the libraries'.
- Tested also: Immich 3.x answers the same; picks that come back restore without a fetch; a key
  wiped by a new secret key; faces proxied with an id that can't reach another path; the routes
  are a parent's. No end-to-end spec (T6 drives it from the screens).

### T6 Photo libraries: the screens

- [x] Done (commit: "screensaver: Photo Libraries in Settings, and a library's photo says where it's from")

**What exists.** `features/screensaver/SettingsScreensaver.tsx:22-92` (the page: the generic
form's **Screensaver** group, then one `SourceGroup` per source with its switch, "N photos from
here · Checked at 9:10 AM", the error in red, **Check Now**); `features/screensaver/data.ts`
(`useSources` `:56-62`, `usePhotoChanges` `:73-192` with `scan` and `setSource` and their
toasts); `features/screensaver/index.ts:12-26` (the room, the overlay, the settings page
"Photos & Screensaver"); `PhotosRoom.tsx:30-228` (the viewer: Previous, Next, Hide from
Screensaver, Close; no Remove on the wall); `PhotosTab.tsx:20-132` (the phone's sheet "Photo":
Hide / Show, **Remove**); `features/sync/AddAccount.tsx:545-669` (`ServerFlow`: the fields, the
switch **This server is on your home network**, one **Connect** that reads **Connecting…**, the
error under the password field) and `AccountSheet.tsx:215-222, 499-553` (**Connect Again**); `ui/
WhoPicker.tsx` (64 px avatar cells with names, the selected ring: the look for faces); `ui/Chip`,
`ui/ChipRow`, `ui/Segmented`, `ui/Switch`, `ui/TextField` (`layout="password"` for a masked key
on the wall's keyboard; `autoCapitalize="none"` for an address, GOTCHAS), `ui/ListRow`,
`ui/SidePanel` (a side panel on the wall, a sheet on phones), `ui/SavedMark` (the quiet "Saved"),
`lib/parent` (`asParent`); `features/problems/data.ts:43-53` (page titles for Needs Attention;
`screensaver` is there); the e2e `screensaver.spec.ts` (idle, a phone starts it, add and remove
with Undo, a computer adds while the wall shows a QR), `a11y.spec.ts:172, 376`, `screenshots.
spec.ts` (`settings-screensaver`? confirm which settings pages it shoots).

**Build.**

(a) **Data** (`data.ts`): `useLibraryKinds`, `useLibraries`, `useLibrary(id)`,
`useLibraryChoices(id, refresh)`, and in `usePhotoChanges`: `addLibrary` (pending "Connecting…";
the error shown in the sheet, not a toast), `patchLibrary` (saves as it changes; the `SavedMark`),
`reconnectLibrary`, `removeLibrary` (toast "Removed Immich"; no Undo: the key is gone, the sheet
asked first), `checkLibrary` (toast "Checking Immich…" then the row's line does the talking);
query keys under `qk.screensaver.*`; `lib/eventRouter.ts:135-138`: `screensaver.changed`
already invalidates `["screensaver"]`, which these keys share; while any library is `checking` or
has `pending > 0`, `useLibraries` refetches every 5 s (the row's progress). `words.ts` beside the
feature (new): `picksSentence(picks, choices, limit)`: "Showing every photo, newest first, up to
500. Pick people, albums or tags to narrow it." / "Showing photos of Mia or Leo, or in Beach
2026, or tagged Wall, newest first, up to 500." (names from the choices; an id the choices no
longer have reads as "one that's gone"); `libraryLine(library)`: "Checked 9:10 AM · 480 photos",
"Bringing in photos… 120 of 480", "Not checked yet", "Needs its key again", or the error; tests
in `words.test.ts`.

(b) **The page.** `SettingsScreensaver.tsx`: after the inbox's group, a group **Photo Libraries**:
a line "Sunroom can show photos kept on a photo server. Immich works today." under the heading;
one `ListRow` per library: the kind's name as the title ("Immich"), `libraryLine` as the
subtitle (red, `role="status"`, when it is an error or needs its key), the count as the value
("480 photos"), a chevron → its sheet; with none: "No library connected yet."; then **Add a
Library** (secondary). On a paired screen the same (the key is typed on the wall's keyboard,
masked, as an account's password is; ADR 0028).

(c) **One panel, two openings**: `features/screensaver/LibraryPanel.tsx` (a `SidePanel`).
**Add a Library** opens it on its first page: a row of kind chips (Immich alone today, chosen;
the row exists so a second kind is a chip, not a redesign); **Address** (`TextField`, placeholder
`http://192.168.1.30:2283`, hint "The address you open Immich at.", `autoCapitalize="none"`,
`inputMode="url"` on phones); **API key** (masked, `layout="password"`, hint from the kind's
`key_help`: "In Immich: Account Settings → API Keys → New API Key. Name it Sunroom; it needs to
read photos, albums, people and tags."); the switch **This server is on your home network**,
hint "For an Immich at home (an address like 192.168…). A parent's tick lets Sunroom reach it.",
**pre-ticked** when the address is `localhost`, an IP literal in a private range (10., 172.16–31.,
192.168., 169.254.), or a single-label or `.local` / `.lan` / `.home` / `.internal` name (a
`isHomeAddress(url)` beside `lib/address.ts`'s `isLoopbackAddress`, with tests), off otherwise,
and always editable; **Connect** (pinned; disabled until both fields have text; "Connecting…"
while pending); the server's refusal under the key field in its own words (the guard's sentence
for a private address with the tick off, "Immich said that key isn't right…", "That address
isn't an Immich server.", "Can't reach that address from here." and the rest). On success the
panel **stays open and becomes the library's**: the title "Immich", a line "Connected · Immich
2.3 · 12,345 photos" (the count when the server gave one), then the picks (d). **A library's row**
opens the same panel on that page.

(d) **The library's page** (the same panel): the status line (`libraryLine`); when it needs its
key, a field **API key** and **Connect Again** at the top (and **Change Address** as a quiet
opener for the address field); then **What to Show**, with the sentence (`picksSentence`) under
the heading, which updates as picks change; **People**: the named people as 64 px round faces
(the proxied thumbnail, or the initial in a neutral circle when the library has none) with the
name under each, wrapping (not one row: a family's Immich can know thirty people), a tap toggles,
the chosen ones ringed as the Who picker rings, with "and 12 people without a name aren't
listed" when there are; **Albums**: `Chip`s that wrap, "Beach 2026 · 240", chosen ones first;
above them a search field **Find an album** when there are more than twelve, filtering as you
type (`useDebounced`); **Tags**: chips, the same; a group with nothing to pick reads "No albums
in Immich yet."; **Refresh Choices** (quiet) under the three, with "Choices from 9:10 AM"; every
tap saves (`patchLibrary`, the `SavedMark` by the heading), and the sentence and the status line
follow (the pass starts on the server). Then **Keep up to**: a `Segmented` 100 / 250 / 500 /
1,000 / 2,000, hint "The newest ones. More photos take more room on the server."; **Show on the
screensaver** (the `enabled` switch, "Off keeps the photos and shows none of them."); **Check
Now**; and **Remove Library** (`quiet-danger`, `block`), which asks in place as Change List does:
"Remove Immich? Its 480 photos leave the screensaver and this server. Nothing changes in Immich."
· **Remove Immich** · **Keep It**; toast "Removed Immich". Every control is 56 px on the wall and
44 on phones (the faces' cells as the Who picker's). The panel's body scrolls; the wall's keyboard
docks under its fields as under an account's (`--osk-h`).

(e) **The Photos room and the phone's sheet.** A photo whose `source_key` starts with `source:`
is a library's: `PhotosRoom.tsx`'s viewer and `PhotosTab.tsx`'s sheet show "From Immich" (the
kind's name by the source id from `useLibraries`, or "From a photo library" when the library is
gone) under the picture, and the phone's sheet offers **Hide from Screensaver** and no
**Remove** (the backend refuses too: `DELETE /api/photos/{id}` on such a photo → 409
`from_library`, "This photo comes from a photo library. Hide it from the screensaver instead,
or take it out of the library." in `photos/router.py:146-154`; `tests/test_photos.py` gets the
case). The room's "N photos" counts them as it does now.

(f) **Needs Attention**: nothing to draw: the plugin's `problems()` (T5) already reaches the
sheet with `page="screensaver"`, and the page is in `features/problems/data.ts`.

(g) **Tips** (`needs: ["screensaver"]`): "Photos: Settings → Photos & Screensaver can show the
photos on your Immich server, by person, album or tag."

(h) ADR 0036: the screens' rows.

**Tests.** `just test-fe src/features/screensaver src/lib/address.test.ts`. End to end,
`e2e/screensaver.spec.ts`: on `desktop` (a laptop in the display shell, with a real keyboard, so
the key is typed at once), "a parent connects Immich, picks a person, and the screensaver gets
its photos": sign in as a parent; Settings → Photos & Screensaver; **Add a Library**; the address
`http://immich.test` and the key `sample-key`; the home-network switch is off (the host isn't a
home address) and stays off; **Connect** → the panel's title is "Immich", the line reads
"Connected · Immich …", the sentence says every photo is shown, the faces list Ana, Sam, Mia and
Leo with "and 2 people without a name aren't listed", the albums list "Beach 2026 · N"; tap
**Mia** → the sentence reads "Showing photos of Mia…" and the saved mark shows; within a few
seconds the row's line reads "Checked … · N photos" (the fake's photos of Mia) and `GET
/api/screensaver/manifest` lists that many with `source_key` not needed (count them); the Photos
room's count grew; **Remove Library** → the asking step → **Remove Immich** → the row is gone
and the manifest is back to the seed's count. A second case, "a wrong key says so": the key
`wrong` → "Immich said that key isn't right…" under the field, nothing saved. On
`display-1080p`, "the wall shows a library's row and a photo from it says where it's from": the
test route `POST /api/screensaver/_test/library` first; Settings (the PIN) → the page's row
"Immich" with its count; the Photos room's viewer on a library photo reads "From Immich" and has
no Remove. On `phone-webkit`, "a phone's photo sheet hides, never removes, a library's photo".
Run `just e2e e2e/screensaver.spec.ts --project=desktop -g "Immich"` and the two others on their
projects. `a11y.spec.ts`: the library panel on the wall (`display: a photo library`) and on a
phone; `screenshots.spec.ts`: `settings-screensaver-library-{light,dark}` on both walls and a
phone (the test route first). By hand in `just display`: the key typed on the wall's keyboard,
masked; the faces at Extra large; the sentence as picks change; the Needs Attention line after
the fake's key is wiped (`POST /api/screensaver/_test/library {wipe: true}`, if cheap to add).

**Docs.** `UX.md:420` (Photos room): "Tapping one opens it full screen with Previous, Next and
Hide from screensaver; a photo from a library says 'From Immich' and can be hidden, never
removed (the library is the place for that); the display can hide photos but never deletes
them (phones delete their own, with Undo)". `UX.md:445` (Features) unchanged. A new paragraph
after the Photos room: "**Photo Libraries** (Settings → Photos & Screensaver, ADR 0036): a line
under the heading, a row per library ('Immich', 'Checked 9:10 AM · 480 photos', a chevron) and
**Add a Library**, which opens one panel: the kind (Immich), **Address**, **API key** (masked on
the wall's keyboard), **This server is on your home network** (ticked by itself for a home
address) and **Connect**; connected, the same panel is the library's: 'Connected · Immich 2.3 ·
12,345 photos', **What to Show** with a sentence that says what's shown ('Showing every photo,
newest first, up to 500. Pick people, albums or tags to narrow it.'), **People** as faces,
**Albums** and **Tags** as chips (a search above the albums when there are many), **Refresh
Choices**, **Keep up to**, **Show on the screensaver**, **Check Now**, **Remove Library** (asks
first). Any pick matches; the picks save as they change and the photos follow within minutes.
The screensaver and the Photos room show a library's photos as any others." `UX.md:583` (phone
More): "deleted (with Undo; a library's photos are hidden instead)". `UX.md:779` (§8, Needs
Attention): "a photo library that needs its key again or stopped answering". `UX.md:788-789`
(§8 rows): a row "A photo library's key stopped working | Needs Attention: 'Immich needs its key
again.' **Open Photos & Screensaver** goes to the page, where the row says so and its sheet's
**Connect Again** takes the new one". `UX.md:606` (§6): a flow "**Connect a photo library**
(any signed-in device or a paired screen). Settings → Photos & Screensaver → Add a Library →
Immich; the address and the key (in Immich, Account Settings → API Keys → New API Key); the
home-network tick for an Immich at home; Connect → the faces, albums and tags appear; pick what
to show, or nothing for every photo; the wall's screensaver shows the first photos within a
minute and the rest as they come." `UX.md:2`'s word list: **Photo Libraries**, **Add a
Library**, **Remove Library**, **What to Show**, **Keep up to**. `PLAN.md:402` (§9) as T5.

**CHANGELOG.** T5's line, edited to say what the screens do.

**As built.** As planned, with these differences:
- The panel's first page is titled **Add a Library**; a library's row says **Edit Immich** to a
  screen reader, as an account's says Edit; Remove Library's question ends **Keep It**.
- `PhotoOut` gained `source_key` (a core shape): the viewer and the phone's sheet need it to know
  a library's photo. Its name ("From Immich") comes from the libraries, which are a parent's to
  read, so a device without a parent's rights says "From a photo library".
- The tip is shortened to fit the list's 90 characters: "Photos: Settings → Photos &
  Screensaver shows your Immich photos, by person, album or tag."
- `getByLabel("Address")` in the e2e also found the home-network switch, whose label wraps its
  hint ("an address like 192.168…"): the specs use `exact`.
- The screenshots add `settings-screensaver-add-library-*` on the walls beside
  `settings-screensaver-library-*` (walls and phones), and the wall's Photos shots open a library
  photo; the a11y journeys check both panels on the wall and on a phone.
- No `_test/library {wipe}` look by hand in this session; the route has it (and the pytest
  covers the wiped key).

### T7 Wrap up the batch

- [ ] Done (commit: )

1. **The full gate.** `just check`; the whole `just e2e`; `just screenshots`. Fix what fails;
   a failure is traced by running the failing spec at each task's commit. Review, against UX §10
   and `.screenshots/before-0.13.0/`: on `display-1080p` and `display-portrait`:
   `board-standard-{light,dark}-{0940,1610,2130}` (the Week view's header with the Rolling week
   cell, one row at 1920 Standard), `board-small-*` and `board-xl-*` (one row and two), `view-people`
   (the caption over the columns), `lists-groceries-*` (the chevrons), `chores-*` (the chevrons;
   add `chores-all-*` for All Tasks), `settings-screensaver-*` and the library panel (`settings-
   screensaver-library-*`), `photos-*` and `photos-one-*` (the viewer; shoot it on a library
   photo after the test route, so "From Immich" is reviewed); on `desktop`: `board-light-0940`;
   on the phones: `lists-groceries-*`, `chores-*` (All Tasks), `settings-screensaver-library-*`.
2. **ADR 0036**: every row filled as built, the Consequences (new files, routes, the migration,
   what wasn't built and why), its README row; the annotations in ADR 0025 (T4), 0026 (T5), 0031
   and 0033 (T2).
3. **PLAN §15.** The M6 heading "→ 0.7.0 … 0.12.0" → "… 0.14.0"; a batch 8 paragraph after
   batch 6's (and a line that batch 7 is planned and unbuilt): "Batch 8 (the owner's notes of
   2026-10-21) is in `docs/M6-batch-8.md`, built in 0.14.0 (ADR 0036): People's arrows page a
   day and the day is written over the columns; Rolling week on the Week view itself, per
   screen; rows that say they open, with a chevron, and a swipe for Remove on phones; All Tasks,
   a task's next day, and finished tasks that leave by themselves; photo libraries, Immich first,
   with the people, albums and tags to show, the home-network tick that means what it says, and
   the guard keeping an API key off a redirect." Every PLAN line the tasks name.
4. **UX.** Every line the tasks name; read §3's header paragraph, §4's People, Lists, Tasks and
   Photos paragraphs and the Settings table's Display row, §5's Lists and Tasks, and §8 once more
   as a whole.
5. **CLAUDE.md.** The status line: "batch 8 (docs/M6-batch-8.md, ADR 0036) for 0.14.0"; the
   architecture map's `screensaver` line gains `sources/` and `libraries.py` if it names plugin
   folders (it doesn't today: leave it); the gotchas from T3 and T5. Under 15 KB: move lines to
   `docs/GOTCHAS.md` if needed.
6. **GOTCHAS.** Everything that cost time in this batch.
7. **CHANGELOG.** `[Unreleased]` reads as one list in plain English: Added, Changed, Fixed. No
   version heading: the deploy skill writes it.
8. **This file.** Every task's box ticked with its commit, and "As built" filled in where the
   build differed from the plan (T2's measurement in particular).
9. **The report to the owner.** What was built and what differs, in a few lines each; the
   database change (one migration, forward-only, the 0.14.0 fixture built in T5); no new server
   steps (no env, no compose change; `SUNROOM_ALLOW_PRIVATE_URLS` stays optional); the things to
   look at on the wall and a phone: People's arrows; the Rolling week cell (and whether the
   header wrapped in the worst case); an item's and a task's chevron and sheet; a phone's swipe;
   Tasks → All Tasks; Settings → Photos & Screensaver → Add a Library on the owner's own Immich
   (the address and key are the owner's to type, after the deploy, never in a session); the
   Immich spec tag the client was checked against. The owner deploys.

## Follow-ups noticed but not in this batch

- **Settings → Network**: the allowlist has an API and no page; the tick writes rows now, but a
  parent can't see or remove rows (or add a CIDR) from a screen. A small page under Household.
- **A library's original quality**: the copies are Immich's previews (about 1440 px); a switch
  for the originals (bigger downloads, HEIC through pillow-heif, RAW refused) if the wall's
  photos look soft up close.
- **Favorites only** and **since a date** as picks (Immich's `isFavorite` and `takenAfter`).
- **Album covers** beside the album chips (the `thumb?asset=` route is there).
- **The next kinds**: Nextcloud (WebDAV folders), a plain folder on a network share, Google
  Photos (its API no longer allows third-party library reads: likely never).
- **Immich's newer search**: since 3.2.0 the flat search filters and `page` are deprecated for a
  `filter` object (with `or` branches, which could ask for every pick at once) and a `cursor`.
  When a release drops the flat ones, ask for `filter` on 3.2 and newer (the version is checked
  already) and keep the flat ones for 2.x.
- **Paused tasks**: `active` exists in the API; a Pause in the task's sheet and a Paused group in
  All Tasks.
- **Undo after adding a task** asks the PIN on the wall (`DELETE chores/{id}` is parent-only;
  found by the lists and tasks read): a creator's own undo within a minute could be allowed.
- **A child's phone and `asParent`**: `PinDialog` is mounted only in the display shell, so a
  refusal on a child's phone shows the sentence and no pad (batch 6's list); `removeItem` and
  `restoreItems` skip `asParent` for that reason today.
- **Reordering** lists and items (`PUT /lists/order`, item `position`): the API exists, no screen
  uses it.
- **The Tasks "This Week" rows** could open that day's boxes (they are counts today).
- Doc drift found while planning: PLAN §11.1 (`:477`) lists `GET photos/{id}/thumb` and a
  multipart upload that aren't the code's; `settings/DisplayPage.tsx:12-16` says the screensaver's
  settings "join this page", and UX §4's Display row says "Screensaver (as in Photos)", but the
  settings live on their own page; `HouseholdPage.tsx:24-25` says Recently Removed is part of
  Household (it's a page of its own).
- Still open from batch 6 and before: the header's worst-case row with a three-digit temperature;
  night icons in the forecast's hours; "Tonight" after 6 PM; sunrise and sunset never shown; the
  phone's weather block; and batch 4's and 3's lists.
