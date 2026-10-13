# M6, batch 3: the owner's third notes, as tasks

Sunroom 0.8.0 is on the owner's wall and phones. After a day they sent a third set of notes, most
of them about the header, the rail and the Add panel, plus a request to audit the whole UI for
clutter. This file turns them into tasks for the Opus 5.5 session that builds them (PLAN §15, M6 →
**0.9.0**). It was written on 2026-10-13 from a read of the code at `65d1bc9` (v0.8.0); line
numbers are from that commit and may have drifted a little.

The owner also attached a screenshot of a Skylight Calendar for the header and the left navigation.
**The screenshot did not reach the planning session.** The layout here follows the owner's words
and Skylight's known shape (a slim icon rail at the left with the brand at its top, a top bar with
today and the paging at the left and the view switch and a people filter at the right). If the
screenshot shows something this plan missed, the owner will say so at review.

**Where this file lives.** `docs/M6-batch-3.md`, beside `docs/M6-batch-2.md` (batch 2) and
`docs/M6.md` (batch 1), committed as `docs: M6 batch 3, the owner's third notes as tasks`.

## How to work through this file

- Read `CLAUDE.md` first: the priorities, the hard rules, the definition of done, the gotchas
  (and `docs/GOTCHAS.md` for the wall's keyboard, sheets and panels). Then UX §1, §2, §3, §4
  (`docs/UX.md`), PLAN §10.1, §12.1, §12.3, §15, `docs/M6-batch-2.md` (the same shape as this
  file; its "As built" notes say what surprised the last session, and its T4, T5, T7 and T8 built
  what this batch reshapes) and `docs/PLUGINS.md`.
- Do the tasks in order. Each one ends with the definition of done (CLAUDE.md): `just check`
  green, `just e2e` green for what it touched, screenshots reviewed when it changed a screen, docs
  updated, a CHANGELOG line under `[Unreleased]`, `just scan` clean, one commit per task (or per
  lettered part where a task has them), subject `area: summary` plus the `Co-Authored-By` trailer.
  Tick the task's box here and note the commit, so a session that stops early can be resumed.
- Never deploy, bump, tag or push: the owner does that with the deploy skill when they ask. The
  release will be 0.9.0 (minor: the family sees every one of these); the skill decides.
- When something here turns out to be wrong about the code, fix the task in the smallest way that
  keeps its intent, say so in the commit message and in the final report. Don't stop to ask unless
  the owner's intent is genuinely unclear.
- Never skip a failing check. Stop and report.
- The owner's household has **five people**; the seed has four (Ana, Sam, Mia, Leo). Where a task
  needs a fifth, the e2e test adds one through `POST /api/members` (`chores.spec.ts:85-89` is the
  precedent). Don't change the seed.
- Measure before you trust a width budget in this file: the numbers are estimates from Lexend's
  average glyph width. The 1920×1080 Standard screenshot with the Today panel open is the judge.

## The owner's notes, mapped to tasks

| Note | Task |
|---|---|
| The status icon only when reconnecting, disconnected or not receiving updates | T1 |
| On a paired screen the mouse pointer disappears after a few seconds idle | T2 |
| The view, filters and zoom someone was on come back after a refresh, an update or a restart; a Display setting like Chrome's "Continue where you left off"; remembering is the default | T3 |
| "Your Town" → "Your City", with autocomplete as you type | T4 |
| Pairing a screen leaves the setup wizard; what happens when setup is done on the Pi itself | T4 and "Answers" below |
| The rail folds with the Today panel's animation | T5 |
| The rail: the logo centred like the room icons, no "Sunroom" word, as tall as the header; Settings as tall as the Tips bar; the fold button in the header, left of the date, mirroring the Today panel's | T5 |
| Folded, the Add button is too big | T5 |
| The header: the bar everywhere, its contents per page; the Calendar shows today, a gap, the arrows; no month/year and no second line; a Filter button first on the right with the people; Agenda/Hours beside the arrows on Week; sizes and spacing audited, perhaps larger type | T6 |
| The city search finds nothing in dev but works in Docker | "Answers" below, and T4 (the test server's places) |
| The Settings navigation a little wider: "Calendars & Accounts" on one line | T7 |
| Why is "Sign in with Google" its own option on Features? | "Answers" below, and T7 |
| Audit the UI for clutter and flow (saved meals vs a new meal in two boxes; the Add panel's spacing; the time chips plus "Pick a time") | "The audit" below, T8, T9 |
| After the plan is built, audit again and fix what was missed | T9 |

## Answers to the owner's questions

**Why the city search finds nothing in `just dev` but works in Docker.** It isn't the proxy and
it isn't a bug in the search. `just setup` copies `.env.example` to `.env`, and that file sets
`SUNROOM_TEST_MODE=1` so the test endpoints exist for `just seed` and the e2e tests. In test mode
the weather plugin never touches the network: `plugins/weather/service.py:421-422` answers the
search from `plugins/weather/fake.py:47-50`, which knows exactly two made-up places, "Sample
Town, Sample State, United States" and "Sample Harbour, Sample County, United Kingdom", matched by
substring. Any real city returns an empty list, which the page shows as "Nothing by that name."
The container refuses test mode (`core/config.py:175-176`), so Docker asks Open-Meteo for real.
Typing "Sample" in dev proves it. T4 makes the fake answer any name, so dev feels like the real
thing and the e2e tests keep their "Sample Town".

**Does a Pi that runs first-run setup itself become a paired screen?** No. The kiosk browser
can't start setup: before the household exists `/display` shows "Set Up Sunroom on Your Phone"
with a QR code (`features/display/DisplayEntry.tsx:119-141`), with no way into the wizard and no
address bar in kiosk mode. If someone did run the wizard in another browser on the Pi, `POST
/api/setup` signs that browser in as a **parent phone** (`meta/setup.py:116-125`:
`kind=DeviceKind.PHONE, paired_via=PairedVia.SETUP`), and a device's kind never changes
(`auth/models.py:32`). Opening `/display` with that session skips the pair code and shows the
board, but as a phone: Settings open without the PIN, a tapped avatar is ignored so everything
is credited to the person who ran setup, the Pi's helper can't wake the screen (403
`not_a_screen`), countdowns ignore "Show on the kitchen screen", and any room switch drops it into
laptop mode with home `/`. The way back is Settings → Phones & Screens → sign out that phone,
then pair the screen properly. What the design already does right: the moment setup completes on
a phone, the wall (polling `/api/setup/status` every 5 s) shows **Pair This Screen** with its code
and "Type the household password here instead", so no wizard step is needed to pair it. T4
removes the wizard's pair step and has the "You're Set" page say where the code is.

**Why "Sign in with Google" is its own row on Features.** Batch 2 (ADR 0029, T9) moved Google's
client ID and secret out of the Features form into a row with a sheet, to declutter the form. The
owner's instinct is right that they belong to the one flow that uses them: Calendars & Accounts →
Add an account → Google → Sign in with Google is the only path that needs the keys (the secret
address and the helper key file don't; `google_accounts.py:69-75` refuses the start without them).
T7 moves the keys into that step and removes the row from Features.

## The audit: what's cluttered today, from reading the code and the 0.8.0 screenshots

Each line says where it is and which task fixes it; the last few are left for later.

1. **The header holds too much.** Today (date, time, weather), a rule, the room's title over a
   subtitle, its controls, the Today panel's button and an always-on Wifi icon
   (`shell/Header.tsx`). On the Calendar the title ("October 2026" over "Oct 5–11") says what the
   day heads already say. → T1, T6.
2. **A second bar under the header on the Calendar**: "Show" with the avatars, the sync pill,
   the zoom and Agenda/Hours (`features/calendar/BoardControls.tsx:72-130`, `WeekTools.tsx`). → T6.
3. **The rail's top is crowded**: a 40 px mark over the word "Sunroom" squeezed beside a 56 px
   fold button in 192 px (`shell/Rail.tsx:96-115`). Folded, Add stays a 64 px circle in a 72 px
   rail with 4 px to spare (`:148`), and Settings is a 96 px block (72 folded) while the Tips
   strip beside it is 56 px. → T5.
4. **The rail's fold snaps instead of easing.** `:root[data-motion-ready] [data-surface]`
   (`styles/motion.css:30-35`, specificity 0,3,0) resets `transition` to background and color on
   every surface, the rail's `<nav data-surface>` included, so `nav[data-rail-motion]` (0,1,1,
   `:52-54`) loses its `width` transition a moment after first paint. The Today panel animates
   because its eased wrapper (`DisplayShell.tsx:383-388`) carries no `data-surface`. And the
   rail's words vanish at once when it folds. → T5.
5. **The Add panel is a wall of chips.** The event form (`features/calendar/EventEditor.tsx`)
   stacks ten rows 24 px apart with no section breaks: Time is six chips over two lines (All day,
   four times, Pick a time), Repeats is nine presets plus Custom… over three or four lines, How
   long's five chips wrap in the 592 px panel, then Calendar, Color and More…. The owner's words:
   "confusing to see all the buttons with specific times and then another one with a Custom or
   Pick a time". → T8.
6. **A meal is two text boxes**: "Find a saved meal" with its chips, then "Or type a new meal"
   (`features/meals/MealEditor.tsx:127-177`); after a chip is tapped its name sits in a field
   still labelled "Or type a new meal", and the Groceries switch appears only for a tapped chip,
   not for the same name typed. **New List** has the same split (the usual names as chips, then
   "Or name it", `ListsRoom.tsx:143-197`). → T8.
6a. **Labels look like chips.** Every row label is `text-d-body font-semibold`, the same as the
   chip text under it, with nothing else separating rows; and a chip that opens something ("Pick
   a time", "Pick a date", "Custom…", "More…", "Another day", "Earlier hours") is drawn pressed
   while open (`Chip on={open}`), so in the 0.8.0 `add-time` shot four chips are ink-filled for
   one time. → T8.
6b. **Small flow faults in the forms**: the row of kinds is cut off under the panel's header after
   switching kinds (the panel scrolls to the top only when it opens or its title changes,
   `ui/SidePanel.tsx:46-48`); an item's sheet picks a day with its own chips (No day · Today ·
   Tomorrow · five weekdays, `lists/ListItems.tsx:401-429`) instead of the Day strip; a routine's
   Starts is a fixed chip row with no way to pick another time (`SettingsChores.tsx:290-318`); the
   wall keyboard reserves an empty 56 px row above the keys for accents and suggestions that were
   never built (`ui/Keyboard.tsx:281`); a meal's Who cooks starts on "Everyone". → T8, T9.
7. **The Settings navigation wraps "Calendars & Accounts"** at 320 px (`w-80`,
   `features/settings/SettingsScreens.tsx:132`). → T7.
8. **Setup asks for a town with a Search button** and searches only on submit
   (`features/weather/PlaceSearch.tsx:22-48`); Settings → Household → Location needs "Set the
   town", then the field, then Search. The wizard has a pairing step the wall already handles. → T4.
9. **The Today panel's button draws `PanelRightClose` even when the panel is on the left**
   (`Header.tsx:95-99`, a mirrored shell). → T5 (the header's two toggles each face their panel).
10. **The Day view's "today" subtitle and the Photos count** live in the header as a second line.
    → T6 (captions move into the rooms that need them).
11. *Later:* the phone shell's headers are untouched by all of this (batch 2's follow-up still
    stands); per-screen calendar visibility; the week swipe following the finger.

## Decisions (decided here, with the reason; the owner can overturn any at review)

| Question | Decision |
|---|---|
| The live icon | Drawn only while something is wrong: reconnecting, checking every 30 s, or offline. Connected draws nothing, on the wall's header and the phone's Calendar header alike. About → Connection keeps the icon with its words in every state, so "is it connected?" still has an answer. The 2-second settle stays, so a room switch on the kiosk never flashes it |
| The pointer | The page hides it, not the Pi: after 3 s without the mouse moving, on the kiosk shell and the screens before pairing (`/display`); a mouse move brings it back; a touch hides it at once. labwc's rule (`kiosk/labwc-rule.py`) stays for labwc ≥ 0.8.4; this works on every Pi, X11 included, and on the preview of `/display` in a laptop's browser (moving the mouse shows it, as a video player does) |
| Remembering the view | Per screen, in localStorage (the view, which week, day or month, the people filter, the Week layout and zoom, the Today panel and the rail), plus the room the screen was in. A household setting **When it starts**: **Where it left off** (the default) · **The home view**. The 2-minute and 5-minute idle rules are untouched: a screen that sat idle comes back to the home view because that's what it was showing; a screen refreshed mid-use comes back where it was. Nothing in the Add panel or an event sheet is remembered (drafts are a separate idea, UX §1) and Settings is never restored (its PIN grant may be gone) |
| The city search | Autocomplete from 2 characters, 350 ms after the last key, results listed under the field (never a floating list: the wall's keyboard and a phone sheet both need the list in the page's flow); no Search button. The backend's limit rises from 10 to 30 searches a minute per device (an autocomplete sends a few per name). Open-Meteo matches exactly at 2 characters and fuzzily from 3, so the empty line reads "Keep typing…" under 3 characters and "Nothing by that name. Try the nearest city." from 3 |
| The wizard's pair step | Removed. The steps renumber (1 of 6 … 6 of 6); "You're Set" says: "To put Sunroom on a kitchen screen, open More, then Pair a Display, when the screen shows its code." The phone's More → Pair a Display and the wall's "Type the household password here instead" are the two ways, as before |
| The rail's top | The mark alone, centred, in a block exactly `--header-h` tall with the same bottom rule as the header, so the rail's rule and the header's rule meet. The word "Sunroom" leaves the rail (the mark keeps "Sunroom" as its name for screen readers). The fold button leaves the rail for the header |
| The rail's bottom | Settings is one `--tap` row (56 px): the gear (or padlock) with "Settings" beside it in the full rail, the gear alone folded, with a top rule; it lines up with the Tips strip when tips are on. Add is a 64 px circle with "Add" under it in the full rail and a 56 px circle folded, like a room's icon |
| The fold's motion | The width eases as now (fixed so it actually does), the rooms' height eases with it, and the words fade over the same 220 ms instead of vanishing; the mark and the icons stay centred so they glide. Instant under Reduce motion |
| The header's toggles | **Hide the rail** / **Show the rail** at the header's start, before today; **Hide the Today panel** / **Show the Today panel** at its end. Each sits at the edge nearest its panel and its icon faces that panel: in a mirrored shell (rail on the right) the rail's button is last and the panel's first. Both `portrait:hidden` as the panel's is today |
| The header's middle | No titles for rooms the rail already names (Calendar, Lists, Tasks, Meals, Countdowns, Photos, Settings) and no second line anywhere. A page the rail can't name keeps a one-line title with its way back: a list ("‹ Lists  Groceries"), Saved Meals, Stars & Rewards. Counts and spans that were subtitles move into the page ("4 to get" beside the list's title, "8 photos" above the grid) or go (the Meals week span: the day rows carry their dates). An sr-only h1 keeps every room's name for screen readers, so the tests that find a room by its heading keep passing. **This is the one decision most worth a second look at review**: the owner may prefer every room to keep its name in the header |
| The Calendar's header | Left, after today and a rule: ‹ · **This Week** (Today, This Month) · › then, on the Week view, **Agenda · Hours** as two icon cells. Right: **Filter**, the view switch (Week · Day · Month · People), the Today panel's button, the live icon when it has something to say. No month or span: the day heads carry the dates. The Month view gets its month's name as a caption over its weekday row and the Day view its day's name over the timeline (the only two views that would otherwise show bare numbers); Week and People need none |
| Filter | One button for the people (and later calendars, kinds): a funnel icon, the word "Filter" beside it when the header has 112rem of its own width (the rail folded or the panel hidden; at 1920 Standard with both open there's no room), and, while people are chosen, their small avatars after the icon. It opens a menu under itself: **Everyone**, then each person with a check; several at once; the menu stays open while choosing and closes on Everyone, a tap outside (which does nothing else: a backdrop takes it, so a board tap never also opens Add), Escape or the button. The filter still clears after 2 minutes idle. Hidden on the People and Today views, which don't filter |
| The Hours zoom | Leaves the toolbar for the grid itself: **Zoom out · Fit the day · Zoom in** stacked at the grid's bottom-right corner like a map's, over the last column's late evening, outside the scroller so it never scrolls away. The header has no room for three more buttons on one row at 1920 Standard with the panel open, and the zoom belongs to the thing it zooms |
| The header's type and spacing | The date 24 px bold on the time's baseline, the time 40 px, the temperature 32 px; 24 px between today's three items, a 2 px rule with 24 px either side, 16 px between control groups, 12 px inside the end zone, 24 px side padding; everything centred in 80 px. The date doesn't grow: the one-row budget at 1920 Standard with the panel open is spent (see T6) |
| Settings navigation | `w-96` (384 px, 24rem): "Calendars & Accounts" fits with room at every text size |
| Google's keys | Live in the **Sign in with Google** step of Add an account: with no keys the step shows the two fields and **Save keys and continue**; with keys, "Keys saved" with **Change keys** and **Remove keys**, then **Sign in with Google**. The Features row and its sheet go; the generic form still skips the group. The export keeps masking the secret |
| The Add panel's shape | Three visible sections 32 px apart (UX §1's section gap): **What and Who** (the field, Who), **When** (Day, Time, How long, Repeats), **Details** (Calendar, Color, then More…). Time, How long, Repeats, Calendar and Remind become **value rows**: the label at the left, the current choice as one button at the right ("2:30 PM ▾", "1 hour", "Every week on Thu"), tapping opens the picker in place under the row, as Pick a date does today. Chips stay where a row of a few fits one line: Who, the Day strip, Last day, Which list, Which meal, Stars, Color's dots. The likely-time chips go; the picker's hours and minutes are two taps. Labels get their own quieter style (20 px, soft ink) so they stop looking like chips, and a chip that opens something is outlined with a chevron, never filled like a choice. ADR 0029's "nothing behind a chip that has to be opened first" is narrowed to "nothing behind a chip that *looks like a choice*": a value row says what's chosen on its face |
| A meal | One field, "What's cooking" (phone: the same), with the saved meals as a one-line row of chips under it that filters as you type (most made first; the row scrolls); tapping one fills the field and keeps its emoji, recipe and ingredients; editing the words after that unlinks it, as today. No "Saved Meals" heading, no second box |
| Database | One migration: `household.display_start` (`"last"` / `"home"`, default `last`). The 0.8.0 fixture (`tests/fixtures/db/202610121749.sql`) exists, so the migration test has its baseline |

## Before the first task

1. `just check` must be green at `65d1bc9` (confirm, don't assume).
2. `backend/released.lock` ends with `202610121749` (0.8.0) and `backend/tests/fixtures/db/202610121749.sql` exists, so T3's migration has its upgrade test. If either is missing, build the fixture first as M6-batch-2.md "Before the first task" describes.
3. `just screenshots` once at `65d1bc9`, so T9 has a before to compare against (keep the folder;
   `.screenshots/` is gitignored).

## Tasks

### T1 The live icon only when something's wrong

- [x] Done (commit: "frontend: the live-updates icon only while something's wrong")

**Owner's note.** "Remove the status icon from the main view when everything is connected and
working. Only show when it is reconnecting/disconnected or not receiving updates for some reason."

**What exists.** `ui/LiveStatus.tsx`: five states (`live`, `reconnecting`, `polling`, `offline`,
`hidden`), one icon each (Wifi, RefreshCw turning, Clock, WifiOff), the `SETTLE_MS = 2_000` rule
so a kiosk room switch never blinks it, `LiveStatusIcon` (About → Connection) and
`LiveStatusButton` (the wall's header `shell/Header.tsx:102`, the phone's Calendar header
`features/phone/CalendarScreen.tsx:227`), whose tap toasts the state. "Not receiving updates" is
the `polling` state (the stream can't be held open; the page refetches every 30 s) and the
40-second watchdog, which reconnects (`lib/events.ts:48`).

**Build.** `LiveStatusButton` returns null when the state is `live` (and `hidden`, as today);
`LiveStatusIcon` is unchanged, so About keeps "Live updates: connected". No layout reserves the
corner: the end zone is just the Today panel's button until the icon is needed. The header's
comment and `docs/UX.md` §3 (the header paragraph: "the live-updates icon, which stays the
screen's top-right corner" → "the live-updates icon, only while it has something to say:
reconnecting, checking every 30 seconds, or offline; connected shows nothing"), §8 (the quiet
pills), and the ADR 0028 corner rule gets "superseded by 0030: the corner is empty while connected".

**Tests.** `ui/LiveStatus.test.tsx`: the button renders nothing while live and the icon while
reconnecting. e2e `shell.spec.ts:226-263` becomes "shows nothing in its corner while it hears live
updates, and says so when it can't": the banner has no `[data-live]` while live; after
`/api/_test/drop-streams` it still has none through the 15 samples (the reconnect is quicker than
the settle); then `page.route("**/api/events", route => route.abort())` keeps the stream down and
within 15 s the banner shows `img "Live updates: reconnecting"` or `"…checking every 30 seconds"`
in the corner (the 80 px rule from the old test); `page.unroute` and it leaves within 10 s. The
phone's Calendar header: `getByRole("img", { name: /^Live updates/ })` has count 0.

**CHANGELOG.** "The live-updates icon shows only while the screen is reconnecting, checking every
30 seconds, or can't reach Sunroom. Connected, the corner is clear."

**As built.** Four other end-to-end tests waited on the icon's `data-live="live"` to know the
screen's stream was open, and the icon said "live" from the first paint (it only ever shows another
state after 2 s), so they weren't waiting for anything. `lib/live` now marks the page's root with
the stream's raw status (`html[data-stream]`) and the tests wait for that (`hearsLive`). With
`/api/events` aborted the client gives up on the stream after three failures and checks every
30 seconds, retrying the stream once a minute, so the test clears the corner the way the wall
does: a room switch opens a new stream.

### T2 The kiosk hides the pointer when idle

- [x] Done (commit: "frontend: the wall hides a resting pointer")

**Owner's note.** "When using a paired screen (i.e. raspberry pi), can you default the mouse to
disappear if it is not moving on the screen? Perhaps after a few seconds of being idle."

**What exists.** Nothing in the frontend touches the cursor. The Pi relies on labwc's
`WarpCursor` + `HideCursor` window rule (`kiosk/labwc-rule.py:280-298`, labwc ≥ 0.8.4) and on
`unclutter` under X11 (`kiosk/sunroom-kiosk:150-154`); labwc hides the pointer when the window
opens, but any mouse movement after that shows it for good (`docs/KIOSK.md:212-213`).

**Build.** `lib/pointer.ts`: `watchPointer(root: HTMLElement, idleMs = 3_000): () => void`
listens on `window` (capture) for `pointermove` with `pointerType === "mouse"` (clear
`data-pointer`, re-arm the timer), `pointerdown` with `pointerType` `touch` or `pen` (set
`data-pointer="hidden"` at once) and the timer (set it). `tokens.css`, by the `[data-shell]`
rules: `[data-pointer="hidden"], [data-pointer="hidden"] * { cursor: none !important; }`. Mount it
in `shell/DisplayShell.tsx` inside the `kiosk` effect (`:147-157`, beside `watchKeyboardFields`)
on the shell's root `div[data-shell="display"]` (a ref), and in `features/display/DisplayEntry.tsx`
`Frame` (`:96-103`) on its `<main>`, so the pair-code screen hides it too. Laptops in the display
shell (`home === "/"`) don't: they have a real pointer and a person behind it.

**Tests.** Vitest `pointer.test.ts` with fake timers (a mouse move shows, 3 s hides, a touch hides
at once, the stop function removes the listeners). e2e `shell.spec.ts` (the wall screen): "hides
the pointer three seconds after the mouse stops": `page.mouse.move(600, 400)` → the shell has no
`data-pointer`; `page.waitForTimeout(3_500)` → `[data-shell][data-pointer="hidden"]`; a move
clears it. (Playwright's `mouse.move` sends `pointerType: "mouse"`.) The laptop project: the
attribute never appears.

**Docs.** `docs/KIOSK.md:212` (the pointer paragraph: "Sunroom's page hides the pointer itself
three seconds after the mouse stops; labwc 0.8.4 and `unclutter` keep it hidden before the page
loads"); PLAN §13.2 one line. CHANGELOG: "On a paired screen the mouse pointer disappears a few
seconds after it stops moving."

**As built.** The mark is on the page's root (`html[data-pointer="hidden"]`), not the shell's
`div`: the Add panel, the PIN pad, the toasts and the keyboard are drawn beside the shell, and the
pointer would have shown over them. `watchPointer(root = document.documentElement)` keeps the
parameter for the tests. Two things the plan didn't foresee: the kiosk remounts its shell on a
room switch, which would have shown the pointer for three seconds after every tap on the rail, so
a root remembers that it was hidden (a `WeakSet`); and Chromium sends a pointermove of its own when
the page changes under a resting pointer, so a move to the same place is ignored. PLAN's line is
in §13.10's table ("A visible cursor"), where the cursor already was.

### T3 Remember the view: the migration, the setting, the per-screen memory

- [x] Done (commits: "household: the When it starts setting", "display: the screen remembers
  its view")

**Owner's note.** "Whatever view the user is currently on should be the 'default' when the app is
updated or refreshed. This includes any filters or zoom levels. That way during a force refresh,
or app being closed and re-opened will show them whatever view they were on last. This could be a
setting in 'Display' where they can choose the default view or use the last view (similar to
Chrome settings for tabs (continue where I left off, etc). The default on an installation should
be to remember their view."

**What exists.** The wall's view state is memory only (`lib/displayState.ts:30-63`): `view`,
`weekOffset`, `day`, `monthOffset`, `panelShown`, `railCollapsed`, `weekLayout`, `hoursZoom`,
`people`, `panel`; `resetBoard()` (`:91-106`) puts it back after 2 minutes idle (10 with an editor
open; `DisplayShell.tsx:159-168`). A reload keeps the URL (`/lists` stays `/lists`:
`lib/update.ts:46-68` reloads in place) but loses the store; the kiosk launcher and its nightly
restart (`kiosk/sunroom-kiosk:256`, `kiosk/systemd/sunroom-kiosk-restart.timer`) always open
`/display`. The phone already remembers its own view and filter in localStorage
(`features/phone/CalendarScreen.tsx:45-75`, `remembered`/`remember`: the pattern to copy, with
its try/catch). The household's defaults are `display_home_view`, `display_week_layout`,
`display_show_today_panel`, `display_rail_compact` (`household/schemas.py:57-71`).

**Build, in two commits.**

*a. `household: the When it starts setting`.* `just db-revision "household: display start"`
modelled on `migrations/versions/202610121749_*.py`: `display_start String(8) NOT NULL
server_default 'last'`. `household/models.py`: `class DisplayStart(StrEnum): LAST = "last"; HOME =
"home"` and the column; `household/schemas.py` `SettingsOut.display_start: DisplayStartName`
(`Literal["last", "home"]`), `SettingsUpdate.display_start: … | None`; `household/service.py
settings_out`; `just api-types`; `backend/tests/test_household.py` (the default is `last`, a
PATCH of each value, a 422 for `"never"`); the migration test passes against the 0.8.0 fixture.
Settings → Display → Layout, after Home view (`features/settings/DisplayPage.tsx:101-114`):
`<Row label="When it starts" hint="What the screen shows after a refresh, an update or a restart.">`
with a `Segmented` **Where it left off** · **The home view**.

*b. `display: the screen remembers its view`.* `lib/displayState.ts`:
- `const MEMORY_KEY = "sunroom.display.view"`; `type Remembered = Omit<DisplayState, "panel"> & {
  v: 1 }`; `remembered(): Partial<DisplayState> | null` (parse, validate every field's shape, else
  null) and `remember(state)`, both wrapped in try/catch like the phone's.
- The store starts from `{ ...INITIAL, ...remembered() }`; a `displayState.subscribe` at module
  load writes the store minus `panel` on every change (synchronous `localStorage.setItem` is
  cheap; debounce only if the Hours scroll ever writes per frame, which it shouldn't: zoom
  changes, not scroll, are in the store). `resetBoard()` therefore remembers home, which is the
  point: an idle screen refreshed at 3 AM comes back home.
- `forgetView()`: clears the key and resets, for "The home view".
- The room: `lib/displayState.ts` also keeps `const ROOM_KEY = "sunroom.display.room"`.
  `shell/DisplayShell.tsx` writes `pathname` there on every change when it is a room or home
  (`/`, `/display`, `/$room`, `/$room/$`), never `/settings…`. On the **first mount per page
  load** (a module-level `let restored = false`; the kiosk remounts the shell between `/display`
  and the rooms, `shell/ShellLayout.tsx`, so an effect alone would re-run): once `settings` are
  known, if `display_start === "home"` → `forgetView()` and, if not already home, `navigate({ to:
  home })`; if `"last"` and the page opened at home (`pathname` is `/` or `/display`) and the
  remembered room is another room → `navigate` there. Nothing when the URL already is a room (a
  reload in place). Never navigate into Settings.
- Laptops in the display shell share all of this (same store, same keys); phones are untouched
  (their own keys).

**Tests.** Vitest `displayState.test.ts`: the store restores a valid memory, ignores a malformed
one, writes on `updateDisplay` and on `resetBoard`, and `forgetView` clears. e2e `shell.spec.ts`
(the wall): "comes back where it was after a refresh, unless the household says the home view":
Month view, Hours layout on the Week (then back to Month), two people filtered, the rail folded,
the panel hidden → `page.reload()` → the same (the view switch's pressed cell, `[data-rail]`,
the panel hidden, the Filter button named for the two people); open `/lists`, go to `/display`
by `page.goto` (a launcher restart) → it lands on `/lists`; PATCH `display_start: "home"` from
`request`, reload → the home view, this week, nobody filtered, `/display`; put the setting back
in `finally` (the test server keeps settings between tests only for plugins, but be safe).
`screenshots.spec.ts`: `settings-display` already covers the page.

**Docs.** UX §1 "Idle, wake and reset" (a sentence: "A refresh, an update or a restart brings a
screen back to what it was showing, the room included, unless Settings → Display → When it starts
says the home view."), §4 Settings table (Display row: "When it starts Where it left off / The home
view"), §10 checklist. PLAN §10.1 (`display_start`), §12.3. CHANGELOG: "A kitchen screen comes
back to what it was showing after a refresh, an update or a restart: the room, the view, who's
filtered, the Week layout and zoom, the panel and the rail. Settings → Display → When it starts
can make it open on the home view instead."

**As built.** The migration is `202610131907_household_display_start`. Three differences from
the plan. With **The home view** a screen keeps nothing (`setRemembering(false)` clears both
keys and stops the writes) instead of keeping the view and dropping it at the next start: the
store starts from the memory before the settings are known, so anything kept would be drawn for
a moment first. `forgetView()` is still there for the one start after the setting changed while
the screen was off. The room is read once as the module loads (`roomAtStart()`), because the
shell writes the room from its first render and would have overwritten it before the settings
arrived. And the room isn't written while the plugins' rooms are still loading: `/lists` isn't
known to be a room until then, and writing "home" for it would lose the memory on a quick second
refresh. The end-to-end test drives the "Show" avatars for the people filter; T6 moves it to the
Filter button.

### T4 Setup: the city, the search as you type, no pairing step, the test server's places

- [x] Done (commits: "weather: the city search as you type", "weather: the test server's places
  answer any name", "onboarding: pairing a screen leaves the wizard")

**Owner's notes.** "During setup, change 'Your Town' to 'Your City'. And have it autocomplete as
the user types in the input." "Pairing a screen should not be part of the setup process, rather
just something the user can do later after initial setup." "Searching for my city in dev shows
nothing, but on the docker container with the reverse proxy it does."

**What exists.** `features/weather/PlaceSearch.tsx`: a form with `TextField label="Your town"`
and a **Search** button, the query set on submit, `usePlaces(q)` (`features/weather/data.ts:39-51`:
`enabled` from 2 characters, `staleTime: Infinity`, `retry: false`, parent-only through
`asParent`), the results as a `<ul aria-label="Places">` of row buttons, "Nothing by that name.
Try the nearest town."; `PlaceOnboarding` (the wizard's step, with **Later**) and
`LocationSettings` (Settings → Household: the label, **Change** / **Set the town** / **Remove**).
The wizard: `router.tsx:103-113` `STEPS`, `SetupWizard.tsx:21-23` `SIGNED_IN_STEPS`, the `pair`
case (`:155-162`), `PairStep` (`:527-570`, "Pair the Kitchen Screen", "6 of 7"), `CalendarsStep`
"7 of 7" (`:515`), the step counters `1 of 7` … (`PasswordStep`, `HouseholdStep`, `PlaceStep`
`:498`, `PeopleStep`, `PinStep` `:458`), the "You're Set" page (`:171-187`). Backend:
`plugins/weather/router.py:41-47` (`q` 2–80 characters), `service.py:52` `SEARCHES = 10`,
`service.py:390-413` `SearchLimit`, `fake.py:31-50`.

**Build, in three commits.**

*a. `weather: the city search as you type`.*
- `PlaceSearch`: the label **Your city** (sentence case, a field label), `autoComplete="off"` (the
  browser's own address suggestions would fight the list), the lead "Sunroom shows your weather
  and turns dark at sunset. Type your city, or one nearby."; no form, no Search button. A
  `useDebounced(words, 350)` (new, `lib/useDebounced.ts`, trivial) feeds `usePlaces`. Under the
  field: while fetching, a quiet "Searching…" line (`aria-live="polite"`); under 3 characters with
  no results, "Keep typing…"; from 3 with none, "Nothing by that name. Try the nearest city."; else
  the list as today (`ul "Places"`, row buttons). The field is `role="combobox"` with
  `aria-autocomplete="list"`, `aria-expanded` and `aria-controls` the list's id (the list is
  `role="listbox"` with `option` rows, `aria-selected` none); on laptops ArrowDown moves into the
  list and Enter picks (cheap; skip arrow handling if `TextField` can't take the role without a
  fight: a list of buttons under a labelled field is fine for a11y too). Picking sets the place
  (toast "Home is …") as today. `LocationSettings`: **Change** / **Set the city**, "Not set yet.
  Until it is, it gets dark at 7 PM." unchanged; the field opens with focus (`data-autofocus`).
- `data.ts` `usePlaces`: `placeholderData: keepPreviousData` so the list doesn't blink between
  keystrokes; `staleTime` stays.
- Backend: `SEARCHES = 30` (`service.py:52`); PLAN §12.7's "ten searches a minute" → thirty. The
  Open-Meteo note in `open_meteo.py:61-69` says 2 characters match exactly, 3+ fuzzily (it does).
- e2e: `first-run.spec.ts:35-39`, `a11y.spec.ts:198-200`, `screenshots.spec.ts:377-379` type into
  `getByLabel("Your city")` and wait for `list "Places"` (no Search click).

*b. `weather: the test server's places answer any name`.* `fake.py` `places(name)`: the two
sample places that match, plus, for any `name` of 2+ characters, `"{Name}, Sample State, United
States"` (title-cased words, a fixed latitude/longitude per sample, a deterministic small offset
from the name's hash so two cities differ) first. `backend/tests/weather/test_fake.py` (or where
the fake's tests are): "Sample" still gives the two, "Springfield" gives one named Springfield.
`docs/PLAN.md` §14.2 or `docs/DEPLOY.md` wherever `SUNROOM_TEST_MODE` is explained gets a
sentence: in test mode the weather and the city search are made up. `.env.example:21-23` gets
the same sentence.

*c. `onboarding: pairing a screen leaves the wizard`.* Remove `"pair"` from `STEPS`,
`SIGNED_IN_STEPS` and `SetupStep`, the `pair` case and `PairStep`; `PinStep` goes to
`calendars`; the counters become `1 of 6` … `6 of 6`. "You're Set" (`:171-187`): a second
paragraph, "To put Sunroom on a kitchen screen, open More, then Pair a Display, when the screen
shows its code. Or type the household password on the screen itself." `router.tsx` `STEPS`.
`features/phone/PairDisplayScreen.tsx` is unchanged (the toast "Kitchen screen paired" is there).
e2e `first-run.spec.ts:61-70`: after the PIN, expect the calendars step; pair the wall from
`phonePage.goto("/pair")` (as `shell.spec.ts:160` does) and keep the rest. Docs: UX §6 "First
run" (step 6 goes; "7." → "6."; the "You're set" line), UX §4 "Welcome and Pair this screen"
(unchanged), PLAN §12.1 (the sentence "ends on 'Pair the kitchen screen' (skippable)" → "ends on
Bring in your calendars; the kitchen screen is paired from a phone's More → Pair a Display, or
with the household password on the screen, whenever it shows its code"), README.md:44 (check its
wording still holds).

**CHANGELOG.** "Setup asks for your city and finds it as you type." "Setup no longer stops to pair
the kitchen screen: pair it whenever it shows its code, from More → Pair a Display." Under
Fixed: "In development the city search answers any name (it made up only two)."

**As built.** *a.* A plain labelled field over a list of buttons, with a live status line, not
an ARIA combobox (the plan allowed either): the rows stay ordinary buttons for the tests and a
screen reader, and ArrowDown and ArrowUp still walk between the field and the list. The status
line is always in the page so its changes are announced, and drops out of the flow (`sr-only`,
"3 places") once the list shows. `autoFocus` on the Settings field, as the other forms do. A
`useDebounced` test. *b.* The fake makes up a place only when no sample place matches, so
"Sample" still gives exactly the two, and a name starting with "Nowhere" still finds nothing: the
"Nothing by that name" line would otherwise be unreachable in development and in tests. The
offset is from `zlib.crc32` (Python's `hash()` changes per process). *c.* README's step 4 already
said More → Pair a display; unchanged. The first-run test finishes the wizard, then pairs from
More.

### T5 The rail: the mark, one height with the header, the fold that eases, the toggle in the header

- [x] Done (commit: "frontend: the rail's mark, its fold that eases, and the toggles in the
  header")

**Owner's notes.** "Add the same animation when expanding/collapsing the 'Today' panel to the
navigation panel." "The navigation panel should have the app logo centered, similar to the other
navigation icons. Do not show the 'Sunroom' text, only use the logo. The logo in the navigation
should be the same height as the header. Similar in the footer area, the settings icon area
should be the same height as the 'Tips' bar. The expand/collapse icon should be in the main
header, to the left of 'Tue, Oct. 13'. That way the header has the expand/collapse icons on both
sides for the 2 panels." "When the navigation is collapsed, the 'Add' icon/button is a little big
in the main navigation, resize it like you do with the other items."

**What exists.** `shell/Rail.tsx`: the top block (`:96-115`, `Brand size="rail"` beside the fold
button), the rooms (`ROOM_LINK` `:24-25`, `ROOM_ITEM` `:28-29`, 6rem tall, 4.5rem folded, words
`landscape:sr-only` when folded `:86`), the spacer, Add (`:142-153`, `size-16` always), Settings
(`:154-172`, `landscape:h-24`, `h-18` folded). `ui/Brand.tsx` (`rail` size: a `size-10` mark over
the word). `styles/motion.css:52-54` `nav[data-rail-motion]` and the cascade bug in the audit
(item 4). `styles/tokens.css:397-401` `--rail-w: 4.5rem` when compact; `:66-69` `--rail-w`,
`--header-h: 5rem`. `shell/Header.tsx:86-103` the end zone. `DisplayShell.tsx:250-274` the Rail's
props (`compact`, `side`, `settled`, `onFold`). The Today side's motion: `DisplayShell.tsx:353-401`.

**Build** (one commit).
- **The top block**: `<div className="flex h-[var(--header-h)] shrink-0 items-center justify-center
  border-b border-line portrait:hidden"><Brand size="rail" markOnly /></div>`: the mark alone
  (`size-12`, 48 px; `SunMark` keeps `role="img" aria-label="Sunroom"`), centred in both states.
  `Brand`'s `rail` size becomes `{ mark: "size-12" }` and is only ever `markOnly` (drop the word
  variant; the three phone lockups stay). The rooms' list loses its `landscape:border-t` (the
  block's own rule serves).
- **The fold button** moves to `shell/Header.tsx`: a `Button variant="quiet" icon` named **Hide
  the rail** / **Show the rail**, `aria-expanded`, `PanelLeftClose` / `PanelLeftOpen` (the
  `PanelRight*` pair when the rail is on the right), at the header's start before `HeaderToday`,
  `portrait:hidden`. `Header` takes `railCompact`, `railSide`, `onFoldRail` from `DisplayShell`.
  The Today panel's button at the end keeps its names and takes the icon that faces its panel
  (`PanelRightClose`/`Open` with the panel on the right, `PanelLeft*` on the left: audit item 9).
  In a mirrored shell (`railSide === "right"`) the two swap ends: the panel's first, the rail's
  last. `Rail` loses `onFold`, `side` and `settled`... keep `settled` and `side` if the motion
  guard still needs them (it does: `moves`).
- **Add**: full rail as today (a 64 px circle, "Add" under it); folded, a `size-tap` circle
  (56 px) with the plus at `size-8`, no word (`sr-only` stays), `py-3`.
- **Settings**: one row `h-tap` (`--tap`, 56 px) with a top rule: full rail `flex-row gap-2
  justify-center px-3` (the gear `size-8` then "Settings"/"Unlocked" at `text-d-secondary
  font-semibold`); folded, the gear alone centred. `aria-current`, `data-icon`, the padlock rule:
  unchanged. It now lines up with the Tips strip's `h-tap` row.
- **The fold's motion** (the audit's item 4): in `motion.css`, right after the `[data-surface]`
  crossfade rule, `:root[data-motion-ready] nav[data-rail-motion] { transition: width
  var(--motion-enter) var(--ease-standard), background-color var(--motion-daylight) linear, color
  var(--motion-crossfade) linear; }` (specificity 0,3,1 wins and keeps the crossfade). The words
  stay in the DOM in both states: `.rail-word { transition: opacity var(--motion-quick), max-height
  var(--motion-enter) }`, folded `max-h-0 opacity-0 overflow-hidden` (and `landscape:sr-only`'s
  job is done by `aria-hidden`-free text that's merely 0 px tall: links keep their names), full
  `max-h-8 opacity-100`; each room `transition: flex-basis var(--motion-enter)` between 6rem and
  4.5rem (`landscape:flex-[0_1_6rem]` ↔ `[0_1_4.5rem]` already; the transition property is the
  only addition). The mark, the icons and the gear are centred in whatever width the rail has, so
  they glide; nothing pops. The Reduce motion blocks (`motion.css:455-495`) already make every
  transition 0.01 ms. Check `data-rail-motion` still arrives a frame after settings
  (`Rail.tsx:66-76`) so a cold load draws its folded state at once.
- **Widths**: `--rail-w` stays 12rem / 4.5rem; the e2e numbers (192 / 72) hold.

**Tests.** e2e `shell.spec.ts:185-223` (the rail's geometry: add "the mark's block is as tall as
the banner" `img "Sunroom"` inside `nav "Rooms"` with its parent's height ≈ the banner's), `:336-380`
("Hide the rail" is now inside the banner: `page.getByRole("banner").getByRole("button", { name:
"Hide the rail" })`; folded, `button "Add"` inside the nav is ≈ 56 px square and `button
"Settings"` ≈ 56 px tall; add "the words fade: `link "Lists"` keeps its name while folded"),
`:408-427` (the padlock: unchanged names). `screenshots.spec.ts` `rail-compact` keeps its name.
a11y: the folded rail's cells (56 px, `data-segmented`).

**Docs.** UX §3 (the rail paragraph: "the mark, in a block as tall as the header; the rooms; Add;
Settings as one 56 px row that lines up with the tips strip"; the mini rail paragraph: "72 px of
icons: the mark, each room, a 56 px Add, the gear"; the header paragraph: "Hide the rail at its
start, the Today panel's button at its end, each at the edge nearest its panel"; the landscape
wireframe `:100-130`), §9 (the Rail fold row: "the width, each room's height and the words' fade
ease together"), §10 (the rail line). CHANGELOG: "The rail shows the Sunroom mark alone at its
top, as tall as the header; Hide the rail moved into the header beside the date, across from the
Today panel's button; folded, Add is the size of a room's icon and the rail eases shut and open
instead of jumping."

**As built.** Both toggles are the same bordered square (`PanelToggle` in `shell/Header`), not a
quiet button for the rail's and a bordered one for the panel's: the owner asked for "the
expand/collapse icons on both sides", and they read as a pair only when they look alike. Both
say `aria-expanded` (the panel's said `aria-pressed`). `ui/Brand` lost its `rail` size and its
`markOnly` form: the rail draws `SunMark` itself. The words use a margin, not a `gap`, so a
folded icon is exactly centred; Settings' word folds by `max-width` beside its gear. `Rail` lost
`side` and `onFold` and kept `settled`. Measured: the rail goes 192 → 149 → 98 → 85 → 75 → 72 px
over the 220 ms where it used to jump. Seen in the mirrored shot and left for T9: with the rail
on the right its rule is still on its right edge (`landscape:border-r`), the screen's edge, so
nothing separates it from the board.

### T6 The header: the Calendar's part, Filter, no titles, the spacing audit

- [x] Done (commit: "frontend: the header's room part: Filter, the layout and the views; titles
  leave it; the zoom on the grid")

**Owner's note.** "The main header needs more changes. I think my last request was
misinterpreted. The header should be unique for each page/view you are on, just the header itself
should be included in all pages. On the calendar view is where you show the date, time, month,
previous/next arrows etc. The right side of the header seems to be working as intended. When on
the Calendar view, show the date/time/weather followed by a gap then the previous/next arrows on
the left side of the header. I don't think we need to show the month/year or the second line
underneath it. The right side is good, except I want to try to remove the second row where 'Show'
and the People icons are listed, and Agenda/Hours on Week view. Can we add a 'Filter' button as
the first item in the right side header with a list of the people to filter by? (And other filter
options can be added as needed). Then the Agenda/Hours button group can be shown next to the
previous/next arrows whenever the 'Week' view is active. Also, audit the size and position of
items in the header. It should be spaced better with perhaps a larger font size."

**What exists.** `shell/Header.tsx` (today `:18-40`; the room zone `:65-85` with `back`, the
`h1` title over the subtitle, `controls`; the end zone `:86-103`); `shell/roomHeader.ts`
(`RoomHeaderSpec { title, subtitle?, counts?, notice?, back?, controls? }`);
`features/calendar/CalendarRoom.tsx:139-205` (titles, subtitles, home labels per view;
`useRoomHeader`) and `:213-236` (`BoardToolbar` with `WeekTools` on the Week view);
`BoardControls.tsx` (`BoardControls`: arrows + home + `ViewSwitch`; `BoardToolbar`: "Show" +
avatars + Everyone, the pills, the tools); `WeekTools.tsx` (the zoom group, the layout
`Segmented`/`IconSegmented` at 56rem of the board); `ViewSwitch.tsx` (`IconSegmented` with
`showChosen` at ≥ 64rem of header, else `ViewMenu`, a hand-rolled `role="menu"` with focus and
outside-press handling: the pattern for Filter); `HoursGrid.tsx:185-188` (the scroller,
`relative … overflow-y-auto`) and its parent; `MonthView.tsx:36-45` (the weekday row), `DayView.tsx`
(the timeline); `features/calendar/layout.ts:160-164` `shownFor`; the other rooms' headers:
`ListsRoom.tsx:41-55, 227-256`, `ChoresRoom.tsx:45-71`, `RewardsPage.tsx:42-49`,
`MealsRoom.tsx:85-141`, `SavedMeals.tsx:106-114`, `PhotosRoom.tsx:41-69`,
`CountdownsRoom.tsx:186-200`, `SettingsScreens.tsx:113-128`.

**The width budget at 1920×1080 Standard**, the Today panel open, the rail full (the header is
1728 px wide; Lexend at ~0.6 em a character), worst case (Wed, Sep 30 · 12:30 PM · Month view ·
Agenda): 24 padding + 56 Hide the rail + 20 + 150 date + 16 + 180 time + 16 + 168 weather = 630;
the rule with 20 either side 42 → 672; ‹ 56 + 8 + This Week ~186 + 8 + › 56 = 314 → 986; 16 +
Agenda·Hours icons 120 → 1122. Right: Filter icon-only 56 + 12 + the views (three 56 px cells, the
chosen one with its word ~152, 8 px gaps) 344 + 12 + the panel's button 56 + 24 padding = 504.
Total **1626 of 1728**: ~100 px spare for the live icon (68) when it has something to say and for
estimate error. With "Filter" written out (+96) it no longer fits: hence the word only from
112rem of header width. If the 1920 Standard shot still wraps, drop the gaps 16 → 12 before
anything else; the chosen view's word is the last thing to give (ADR 0029 keeps it readable).

**Build, in three commits.**

*a. `calendar: the header is today, the arrows, the layout, Filter and the views`.*
- `shell/roomHeader.ts`: `RoomHeaderSpec` loses `subtitle` and `counts`; `title` stays (an sr-only
  h1, and the visible title for pages with `back`); a new `visibleTitle?: boolean` (default false:
  the title is sr-only; true for a list, Saved Meals, Stars & Rewards) and `notice` draws as a
  quiet pill in the room zone (`rounded-full border-2 border-line px-5 text-d-secondary
  font-semibold`) when set.
- `shell/Header.tsx`: the room zone becomes `flex min-w-0 grow items-center gap-4` (one row from
  104rem as today; the rule stays): `back`, the title (sr-only unless `visibleTitle`), the pill,
  `controls`. The end zone: `gap-3`. Today's block: `gap-x-6`, the date `text-d-body font-bold`
  with `self-baseline`-aligned time (`items-baseline` on the block, the weather `self-center`).
- `features/calendar/BoardControls.tsx`: `BoardControls` draws ‹ · home · › (`gap-2`) then, when
  `view === "week"`, `<IconSegmented label="Week layout" options={LAYOUTS} …/>` (moved from
  `WeekTools`; icons only, 16 px after the arrows), then in `ml-auto`: `<FilterButton>` (hidden
  on People and Today), `<ViewSwitch>` (hidden on Today). `BoardToolbar` becomes `BoardPills`:
  only the plugins' pills, in a `px-6 pt-3` row, null when there are none. The "Show" group is
  deleted.
- `features/calendar/FilterButton.tsx` + `ui/Menu.tsx`: lift `ViewMenu`'s mechanics
  (`ViewSwitch.tsx:43-150`) into `ui/Menu`: `<MenuButton>` (any `Button`, with `aria-haspopup`,
  `aria-expanded`, `aria-controls`) and `<Menu>` (`role="menu"`, `rise-in`, `absolute top-full
  right-0 z-50 mt-2 min-w-72 rounded-panel border-2 border-line bg-surface p-2 shadow`, a
  transparent `fixed inset-0 z-40` backdrop that closes it and swallows the tap, Escape and Tab
  close and refocus, arrows and Home/End move, opening focuses the checked item), rows as
  `MenuRadio` (`menuitemradio`) and `MenuCheck` (`menuitemcheckbox`, 56 px, `press-row`,
  `aria-checked:bg-ink aria-checked:text-on-ink`). `ViewMenu` is rebuilt on it (same names, same
  tests). `FilterButton`: `Button variant="secondary"` named **Filter** (aria-label "Filter"; with
  people chosen "Filter: Mia, Leo"), `aria-pressed={people.length > 0}`, a `ListFilter` icon
  (lucide) at `size-8`, the word in `hidden @min-[112rem]/header:inline`, and after the icon the
  chosen people's `Avatar size="xs"` in a `-space-x-2` stack (three at most, then "+2" in
  `text-d-caption`). The menu: a `text-d-caption font-semibold text-ink-soft px-4 pt-2` heading
  "People", `MenuRadio` **Everyone** (checked when nobody is chosen; choosing it clears and
  closes), then a `MenuCheck` per member in household order (`Avatar size="sm"` + name;
  toggling keeps the menu open). The members come from `useMembers()`; `people` and `onPeople`
  from `CalendarRoom` through the header's controls (the toolbar's `toggle` logic moves here).
- `features/calendar/CalendarRoom.tsx`: `useRoomHeader({ title: header.title, notice, controls })`
  where `header.title` is the sr-only name ("This Week" at home, else the span; "Wed, Oct 14"; the
  month; "People"; "Today"); the `aria-label` on the section follows. `WeekTools` is deleted; its
  zoom group becomes `features/calendar/ZoomControl.tsx` (next part).
- The Month caption: `MonthView.tsx:36` gains, above the weekday row, `<p aria-hidden className="px-3
  pt-3 pb-1 text-d-title font-bold">{monthYear(grid.first)}</p>` (the room's sr-only h1 says it
  for readers). The Day caption: `DayView.tsx` gets `<p aria-hidden className="px-6 pt-4 text-d-title
  font-bold">{longDate(day)}{isToday ? " · today" : ""}</p>` (a `longDate` in `lib/dates` if there
  isn't one: "Wednesday, October 14", UX §2's "full weekday names only in the Day view title").
- Tests: `calendar.spec.ts:138-184` (the views: `button "Month"` etc. unchanged; the h1 is sr-only
  but `getByRole("heading")` still finds it), `:41-136` (quick add: the "Show" group is gone; where
  a test filtered by a person, open `button "Filter"` and check `menuitemcheckbox "Mia"`; the
  menu closes on `Escape`), `shell.spec.ts:294-311` (paging, unchanged names), `hours.spec.ts`
  (the layout switch is `button "Hours"` in the banner now; the zoom buttons by name, wherever
  they are), `a11y.spec.ts:428-441, 555-558` (Hours/Agenda) plus a run with the Filter menu open
  (`check(page, "display: the Filter menu")`), `screenshots.spec.ts` (`filter-menu` at 1920 and
  portrait; `view-menu` stays). Vitest `Menu.test.tsx` (arrows, Escape, the backdrop closes,
  a checkbox row stays open), `FilterButton.test.tsx` (names).

*b. `calendar: the zoom sits on the Hours grid`.* `features/calendar/ZoomControl.tsx`: the three
`secondary` icon buttons (Zoom out · Fit the day · Zoom in, `role="group" aria-label="Zoom"
data-segmented`) stacked in a `flex flex-col gap-2 rounded-panel border-2 border-line bg-surface
p-2`, placed `absolute bottom-4 right-6 z-10` inside the `relative` box that holds the scroller
(`HoursGrid.tsx:185-188`'s parent, or wrap the scroller in one), outside the scroller, so it never
scrolls and the overlay scrollbar passes beside it. Only while Hours is on (the Week view). Its
disabled states as today (`hoursLimit.ts`). Tips, when on, sit under the board, so the control
stays above the strip. e2e `hours.spec.ts:49-150`: the same names ("Zoom in", "Fit the day",
"Zoom out"), found inside `region "This Week"`; add "the zoom control stays put while the grid
scrolls" (its `boundingBox().y` is the same before and after `mouse.wheel`). `a11y.spec.ts`: the
group's cells are 56 px with 8 px gaps. `screenshots.spec.ts`: `board-hours-zoomed` and the three
`board-hours-24h-*` shots show it.

*c. `rooms: titles leave the header where the rail already says it`.*
- `ListsRoom.tsx:41-55` → `<RoomHeader title="Lists" controls={New list}/>` (sr-only title);
  `:227-256` the list's own: `visibleTitle`, `back` ‹ Lists, the title the list's name, and the
  count "4 to get" beside the title as a `Pop` in `text-d-secondary text-ink-soft` inside the
  page (a line over the items), not the header.
- `ChoresRoom.tsx:45-71`: sr-only "Tasks"; the Show segmented and the Stars & Rewards link stay as
  controls. `RewardsPage.tsx:42-49`: `visibleTitle` with ‹ Tasks.
- `MealsRoom.tsx:85-141`: sr-only "Meals"; arrows, This Week, Copy last week, Saved Meals stay;
  the week span goes (the day rows carry dates: check they do in both layouts; if a row shows
  only the weekday, add the day's number). `SavedMeals.tsx:106-114`: `visibleTitle` with ‹ Meals.
- `CountdownsRoom.tsx:186-200`: sr-only. `PhotosRoom.tsx:41-69`: sr-only; "8 photos" becomes a
  caption above the grid (`text-d-secondary text-ink-soft`). `SettingsScreens.tsx:113-128`:
  sr-only "Settings", Lock stays.
- Tests: `a11y.spec.ts` heading regexes (`/^Tasks/`, `/^Meals/`) still match the sr-only h1;
  `lists.spec.ts`, `meals.spec.ts`, `chores.spec.ts`, `countdowns.spec.ts` where they read the
  header's subtitle ("4 to get", the week span) read the page instead. `roomHeader.test.tsx`.

**Docs.** UX §3 (rewrite the header paragraph and the Calendar's paragraph; delete "The board's
toolbar" paragraph or reduce it to the pills; redraw the landscape and portrait wireframes'
header rows: `[⇤] Tue, Oct 7  9:41 AM  ☼ 64° 72°/55° │ [<] [This Week] [>] [☰][⏱]      [⛛] [▦ Week][1][▤][☺] [⇥]`),
§4 (the Week board, Hours, Month and Day paragraphs: the caption, the zoom's place; the Lists,
Tasks, Meals, Photos room paragraphs: no title in the header), §10 (the header checklist line:
one row at 1920 Standard with the panel open, in late September, Month view, Agenda; the Filter
menu; the zoom on the grid). PLAN §11 if it names the toolbar. ADR 0030 rows. CHANGELOG: "The
kitchen screen's header is lighter: today at the left, then the week's arrows (and Agenda or
Hours on the Week view); at the right a Filter button with the people, the views and the Today
panel's button. The month's name and the week's dates left it (the days say when they are; the
Month view says its month). The Hours zoom sits on the grid's corner." "Rooms the rail already
names no longer repeat their name in the header."

**As built.** One commit, not three. Parts a and c can't be split: taking `subtitle` and `counts`
out of `RoomHeaderSpec` doesn't compile until every room stops passing them. And part b can't
follow part a: the zoom's buttons lived in the toolbar that part a removes, so a commit between
them would have an Hours board with no way to zoom.
- **Measured at 1920×1080 Standard, the rail whole, the panel open, Wed Sep 30 12:30 PM**: the
  room's part of the header is 1035 px; on the Week view it has 162 px to spare with nobody
  filtered, 102 with two people and 58 with four (three avatars and "+1"). The live icon is 68,
  so with four people filtered *and* the stream down the room's part wraps; with two it fits.
  No gap had to shrink.
- **The header is exactly 80 px in every room.** The Tasks room's Today · This Week group is a
  bordered `Segmented`, 68 px tall, and with the header's 10 px padding it made the header 89 px,
  9 px lower than the rule under the rail's mark (new in T5). As one row the header now pads 4 px,
  and `--header-h` is `max(5rem, var(--tap) + 1.5rem)`: at Small, where a tap target doesn't
  shrink, 5rem alone was 70 px and the header was already taller than it.
- **Filter is its own `<button>`**, not `ui/Button` (whose padding is fixed and can't be
  overridden by a class): it is a 56 px square until it has avatars or the word. It has no
  `aria-pressed`: a menu button that is also a toggle is two roles, and its name ("Filter: Mia,
  Leo") says the state. A darker border marks a filter that's on. The chosen people are kept in
  the household's order.
- **The menu has no backdrop.** The header is a size container, which contains `fixed` boxes, so
  a backdrop inside it would cover only the header, and one outside it would sit over the menu.
  A press outside closes the menu and its click is swallowed (`lib/idle`'s
  `swallowFollowingClick`), which does what the backdrop was for. `MenuRadio` closes the menu
  itself through a context: a render prop that hands out `close` trips the React compiler's
  refs rule. The "People" heading is a named `role="group"`, which a `role="menu"` may hold.
  Everyone and the people rows show a check at their end (a filled row for each of several
  people was heavy beside their avatars); the View menu keeps its filled row.
- **The zoom is a row, not a stack.** Stacked it was 204 px tall, and at the fitted zoom it
  covered the last column from 6:30 PM. As a row it covers 10 PM to midnight, the plan's own
  budget. `hoursLimit.ts` and `WeekTools.tsx` are gone: the grid hands the control its limit.
- **The Day caption** writes "today" as its own quiet word beside the date, not after a "·".
- **The section's name** stays "This Week" on the Week view whichever week is showing (as it
  was): the tests find the board by it. The sr-only h1 is "This Week" at home and the span
  otherwise.
- **Tests.** The a11y run checks the Filter menu with nobody chosen: a filter fades the other
  people's chips to 30% on purpose (UX §10), which axe's contrast rule fails, and the old "Show"
  row was never part of that run either. It closes the menu with its button, not Escape: a key
  press keeps the wall's own keyboard down for five seconds, and the run opens Add next. The
  tap-target check looks only at an open menu and its button, as it already does for a sheet:
  a tap elsewhere only closes the menu, so what's under it isn't its neighbour (at Extra large
  in portrait the wider menu overlapped the Today band's rows by 21 px). `just screenshots`
  now clears a page's remembered view before every load: T3's memory would otherwise carry one
  shot's zoom or fold into the next.

### T7 Settings: the navigation's width; Google's keys where they're used

- [ ] Done (commits: )

**Owner's notes.** "The Settings screen navigation items should be a little wider. 'Calendars &
Accounts' should fit on one line." "In Features, why is 'Sign in with Google' its own option?
Wouldn't this be configured when they are adding a Google Account and choosing the option(s) that
need this info?"

**What exists.** `SettingsScreens.tsx:130-149` (`nav … w-80`, rows `min-h-16 px-4 text-d-body`).
`features/sync/GoogleKeys.tsx` (`GoogleKeysRow`: "Sign in with Google" · "Not set up"/"Keys
saved" · **Set up**/**Change**; the sheet **Google App Keys** with the two fields, **Save keys**,
**Remove keys**; `GOOGLE_GROUP`), `features/sync/index.ts` (`settings.features: GoogleKeysRow`,
`ownSettingGroups`), `FeaturesPage.tsx:20-47` (`Own`), `AddAccount.tsx:146-151` (the "Sign in
with Google" choice: "Needs Sunroom at an https:// address on the internet and your own Google app
keys."), `:787-854` `SignInFlow` (the four steps, step 4 "Paste the client ID and secret under
Settings → Features → …", **Sign in with Google** → `POST /api/calendar-sync/accounts/google/start`,
which answers 422 `needs_keys` without them). e2e `sync.spec.ts` (the keys sheet saves and masks;
Remove keys clears). The export masks the secret (`db/export.py`, `test_export.py`).

**Build, in two commits.**

*a. `settings: a wider navigation`.* `w-80` → `w-96`; rows `whitespace-nowrap`. Check the 1920
Standard, Extra large and portrait shots: at XL the column is 499 px and the page beside it keeps
its `max-w-4xl` reading width; portrait's list-and-detail (if it is one) still fits. e2e
`a11y.spec.ts` Settings runs unchanged.

*b. `sync: Google's keys live in the Sign in with Google step`.* `SignInFlow` becomes: the four
steps as today (step 4 reads "Paste the client ID and secret below."), then **`GoogleKeysFields`**
(moved from `GoogleKeys.tsx`: the two `TextField`s, the secret `layout="password"`, the hint "Only
for Sign in with Google."), then: without saved keys, **Save keys and continue** (PUTs the plugin
settings as the sheet did, then enables the sign-in button); with saved keys, a line "Keys saved"
with **Change keys** (shows the fields filled with the ID and an empty secret, **Save keys**) and
**Remove keys** (quiet-danger; the existing confirmation words), and **Sign in with Google**.
`GoogleKeysRow` and the sheet are deleted; `sync/index.ts` drops `settings.features` and keeps
`ownSettingGroups` (the generic Features form must still skip the group); `FeaturesPage` keeps its
`Own` slot (nothing uses it now; leave the mechanism). The account sheet of a Google sign-in
account (`AccountSheet.tsx`) gets one row under its status, **Google app keys · Keys saved**, that
opens the same fields in place (so keys can be rotated without starting a new account). On the
kiosk the step still says "From a phone" (`:837-841`) unchanged. e2e `sync.spec.ts`: the keys are
saved and masked from the Sign in with Google step (`settings-add-google` shots), Remove keys
clears; the Features page no longer has the row (`getByText("Sign in with Google")` count 0 there).
`screenshots.spec.ts` `settings-add-google` / `settings-add-google-phone`.

**Docs.** UX §4 Settings table (Features: delete the "Under Synced Calendars, Sign in with Google
is one row…" sentence; Calendars & Accounts: "Sign in with Google asks for the app's client ID and
secret the first time, and keeps them"), UX §6 if it walks the Google flow, `docs/SYNC.md` wherever
it points at Features → Sign in with Google, `AddAccount.tsx:830-833`'s step text, ADR 0030 row
("supersedes 0029's Features row"). CHANGELOG: "Settings' list is wider, so every page's name fits
on one line." "Google's app keys are asked for inside Sign in with Google, where they're used,
instead of on Features."

### T8 Add: sections, value rows, one field for a meal

- [ ] Done (commits: )

**Owner's notes.** "The 'Add' panel not having proper spacing in between sections, or just being
confusing to see all the buttons with specific times and then another one with a 'Custom' or 'Pick
a time'. This needs to be cleaned up." "Several areas are cluttered, don't flow properly (i.e.
searching saved meals vs. adding new ones in separate text boxes)."

**What exists.** `features/calendar/AddPanel.tsx` (the `Segmented stacked` row of kinds in
`mb-5`, then the kind's editor), `EventEditor.tsx` (`flex flex-col gap-6`: the field with its hint
`:290-307`, Who `:308-319`, Day + Last day `:320-367`, Time `:368-377` = `TimeField` with
`EVENT_TIMES` and **Pick a time**, How long `:378-394` = `LENGTHS` chips, Repeats `:395-404` =
`RepeatField` (presets as chips + **Custom…**), Calendar `:405-421`, Color `:422-448`, More…
`:449-499` (Where, Notes, Remind chips), `PanelActions` `:500-504`), `ui/TimeField.tsx` (the chips
and the in-place hour/minute picker), `features/calendar/RepeatField.tsx`, `ui/Chip.tsx`
(`ChipRow` wraps, `gap-3`), `ui/DayField.tsx`, `ui/Stepper.tsx`, `ui/ScrollRow.tsx`,
`lib/reveal.ts` (scrolls an opened picker into view), `features/meals/MealEditor.tsx:127-177`
(the two boxes), `features/lists/AddItem.tsx`, `features/chores/ChoreEditor.tsx` (Due =
`TimeField` with "by 5:00 PM" words and `TIMES`; Repeats = `RepeatField presetKeys`),
`features/countdowns/CountdownEditor.tsx`. The 0.8.0 shots `add-event`, `add-time`,
`add-custom-repeat`, `add-task` in `.screenshots/` show the walls of chips.

**Build, in three commits.**

*a. `ui: value rows and in-place pickers`.*
- `ui/Field.tsx` `{ label, hint?, children }`: the one label line for every row in every form
  (today hand-written 23 times in 19 files as `text-d-body font-semibold`): the label at
  `text-d-secondary font-semibold text-ink-soft` (20 px, soft: a label now reads as a label, not
  as another chip; phones `text-caption`), `gap-2` to its control, the hint under it in
  `text-d-caption text-ink-soft`. `ui/FormSection.tsx` `{ title, children }`: a `<section
  aria-labelledby>` with its title at `text-d-body font-bold` and `flex flex-col gap-4` inside.
  Primitives that draw their own label (`TextField`, `DayField`, `TimeField`, `RepeatField`,
  `ColorPicker`) take the same style from `Field`.
- `ui/Chip.tsx`: an `opener` prop for a chip that opens something in place ("Pick a date", "More…",
  "Another day", "Earlier hours"): outlined, never ink-filled, a `ChevronDown` after its word that
  turns while `aria-expanded`; `on` keeps meaning "chosen". Every `on={open}` in the forms becomes
  `opener expanded={open}`.
- `ui/ValueRow.tsx` `{ label, value, hint?, expanded, onToggle, children }`: a `Field` whose
  control is one `Button variant="secondary"` showing `value` with a `ChevronDown` that turns while
  `expanded` (`aria-expanded`, `aria-controls`); below it, when expanded, `children` in a
  `rounded-panel border-2 border-line p-3` box revealed with `useReveal`. Phones: the same at
  phone sizes. The button's accessible name is "Time: 2:30 PM".
- `ui/TimeField.tsx` is rebuilt on `ValueRow`: `none` draws as a chip **before** the value button
  (`[All day] [ 2:30 PM ▾ ]`; the chip pressed when `value === null`, and then the button reads
  "Pick a time"); no suggestion chips; the picker as today (hours 6 AM–11 PM with Earlier hours,
  minutes :00 :15 :30 :45; an hour tap with no value sets `HH:00`), plus a **Done** chip that
  closes it (a tap outside the panel doesn't). `words` stays for Task ("by 5:00 PM").
  `lib/times.ts` `timeChips`/`EVENT_TIMES`/`TIMES` go if nothing else uses them.
- `ui/LengthField.tsx` (How long): a `ValueRow` whose button opens a one-line `ChipRow` of 30 min
  · 1 hour · 1½ hours · 2 hours · 3 hours · a `Stepper` "Other" in 15-minute steps (an odd parsed
  length shows in the button as is: "45 min").
- `features/calendar/RepeatField.tsx`: a `ValueRow` ("Repeats" · the rule in words, "Doesn't
  repeat") opening the presets as a `role="radiogroup"` list of 56 px rows (one per line, a check
  on the chosen: easier to scan than nine chips), **Custom…** as the last row expanding the
  existing custom panel (Every N · Day/Week/Month/Year · the weekdays · Ends) under the list; the
  "As it is" kept rule as the first row when present.
- `ui/Segmented` stacked row: unchanged; `AddPanel.tsx` gives it `mb-8` and, on a kind change,
  puts the panel's scroller back to the top (`ui/SidePanel` takes a `scrollKey` prop that joins
  `title` in its effect at `:46-48`), so the row of kinds is never cut off under the header.
- `ui/Keyboard.tsx:281`: the 56 px row above the keys renders only while it has content (held
  accents); `--osk-h` follows the keyboard's measured height, so the panels' padding follows. If
  the height is a constant somewhere, make it follow; `shell.spec.ts:429-457` and
  `GOTCHAS.md`'s keyboard lines say what must keep working.
- Tests: `Field.test.tsx`, `Chip.test.tsx` (an opener is never `aria-pressed`), `ValueRow.test.tsx`,
  `TimeField.test.tsx` (the All day chip, the button's words, an hour tap, Done closes),
  `LengthField.test.tsx`, `RepeatField.test.tsx` (the rows, Custom… expands, the kept rule first),
  `Keyboard.test.tsx` if one exists (no empty row).

*b. `calendar, lists, chores, countdowns: the forms in sections`.*
- `EventEditor.tsx`: the form is `flex flex-col gap-8` (phones `gap-6`); three `FormSection`s
  titled **What and Who**, **When**, **Details** (Title Case: they are section headings, UX §2)
  with `flex flex-col gap-4` inside: **What and Who** = the field + Who; **When** = Day (+ Last
  day), Time, How long (hidden all day), Repeats; **Details** = Calendar (2+ writable), Color as
  a row of dots (`size-tap` round cells, the person's first, named "Red"…; no words), then
  **More…** (an opener chip; Where, Notes, Remind as a `ValueRow` over its four chips).
  `PanelActions` unchanged.
- `ChoreEditor.tsx`: the same sections (What and who = What, Who + Each/Turns; When = Day, Due
  (`TimeField none={{ label: "Any time" }}`), Repeats; Details = Stars). `AddItem.tsx`: What and
  who = What, Which list, Who; When = Day. `CountdownEditor.tsx`: What and who = What, Whose; When
  = Day (grid open); Details = Emoji, Color, Every year, Show on the kitchen screen.
- The same pickers everywhere a form asks the same thing: an item's sheet (`lists/ListItems.tsx:401-429`)
  uses `DayField optional={{ label: "No day" }}` instead of its own chips; a routine's Starts
  (`chores/SettingsChores.tsx:290-318`) becomes a `TimeField` (no `none`) with the "for 30 min ·
  1 hour · 2 hours" row as a `LengthField`.
- Spacing inside a row: label → control 8 px (`gap-2`), between rows 16 px, between sections 32 px.
- e2e: `calendar.spec.ts:62` (the pressed chips inside "Day", "Who" stay; Time is now `button
  "Time: 2:30 PM"` or the `All day` chip; "How long" is `button "How long: 1 hour"`),
  `hours.spec.ts:114-116`, `a11y.spec.ts:373-376` (open each picker: "Time", "Repeats", "Pick a
  date", "Custom…" and run the check), `chores.spec.ts` (Custom… is now a row inside Repeats),
  `screenshots.spec.ts:170-175` (`add-event`, `add-time` → the Time picker open, `add-custom-repeat`,
  `add-pick-a-date`, `add-task`).

*c. `meals: one field, the saved meals under it`.* `MealEditor.tsx`: delete the "Saved Meals"
heading and the search field; one `TextField label="What's cooking"` (editing: "What") whose value
is both the search (`useSaved(text)` when nothing is picked) and the new meal's name; under it a
`ScrollRow label="Saved meals"` of chips (most made first when the field is empty; filtered as
typed; up to 12; the picked one pressed; nothing when there's no match and the field has text:
the typed words are the meal); `pick(meal)` fills the field and remembers the pick; typing after a
pick that changes the words drops it (`sameAsPicked` as today), and words that exactly match a
saved meal's name link it too, so the Groceries switch appears whether the meal was tapped or
typed. "Meals you add are kept here for next time." as the row's caption when the library is
empty. Then Day, Which meal, Who cooks (its first cell **Anyone**, as a task's: nobody in
particular), the Groceries switch, in the same sections (What and who / When / Details). Opened
from a day's cell, Day and Which meal are already decided: they draw as `ValueRow`s ("Day: Wed,
Oct 7", "Dinner") that open their pickers only when tapped. The phone's sheet (`MealsTab`) uses
the same editor. **New List** (`ListsRoom.tsx:143-197`) gets the same shape: one field "Name" with
the usual names (Groceries, To do, Packing, Costco, Pharmacy) as chips under it that fill the
field. e2e `meals.spec.ts:31-45, 71-82` (type "Taco" → the chip → Add dinner; the ingredients go
to Groceries; typing "Tacos" exactly also offers Groceries), `lists.spec.ts` (New List by a chip),
`screenshots.spec.ts` `board-dinners` (and add `add-meal`). UX §4 "The other forms" (Meal), the
Lists room's New list line, and §5 Meals.

**Docs.** UX §4: redraw the Add wireframe (the three sections; `Time  [All day] [ 2:30 PM ▾ ]`;
`How long  [ 1 hour ▾ ]`; `Repeats  [ Every week on Thu ▾ ]`), rewrite "The event form" bullets
(Time: the All day chip and one button that opens the hours and minutes; How long: a button with
the lengths and Other; Repeats: a button with the presets as a list and Custom… at its end; Color
as dots), "The other forms"; §1 "Button groups" unchanged; §10 (the Add panel line: "the sections
are 32 px apart; no row of chips wraps"). ADR 0030 rows (value rows over chip walls; the likely
times go; one field for a meal). CHANGELOG: "Add is in three parts, What and who, When and
Details, with room between them. Time, How long and Repeats each show your choice on one button
and open their picker under it; the row of suggested times is gone." "A meal is one box: type it,
or tap a saved meal under it as you type."

### T9 The audit, again: the second pass

- [ ] Done (commit: )

**Owner's note.** "After the plan is executed perform the same UI/UX audit and make changes that
further cleanup things that were missed during implementation."

**Build.** `just screenshots`; review every shot at 1920×1080, 1080×1920 and 390×844, light and
dark, Standard, Small and Extra large, against UX §10 and against the "before" folder from
"Before the first task". Then walk the wall by hand in `just display` (and `--portrait`) and a
phone in `just dev`, room by room, looking for: a row of chips that wraps; two controls under
8 px apart; a title repeated in the header and the page; a second line under a header; a control
that moved under the finger (the header's one row must not jump when the live icon appears or the
Filter shows avatars: reserve nothing, but check); the fold's words fading; the Filter menu over
the Today panel; the zoom over a Saturday evening chip (nudge the control's bottom offset if a
chip at 11 PM is covered: 10 PM–midnight is the budget); the Month and Day captions; the sr-only
h1 read by VoiceOver on the laptop; the Meal field's chips with an empty library; the setup
wizard end to end with the city search; Settings at XL with the wider nav. Also the smaller
inconsistencies the planning read turned up, each a one-line fix if cheap: the sheets whose
primary button sits inline rather than pinned (the saved-meal form, New List, Change list, an
item's sheet, a reward, a routine: pass the button as the `Sheet`'s `footer` or use
`PanelActions`); a task's sheet draws **Change** as the primary button while an event's, a meal's
and a countdown's draw it secondary (`chores/ChoreBoard.tsx:582-649`: make it secondary); the
`add-event` screenshot is taken within the keyboard's 400 ms padding grace
(`screenshots.spec.ts:202-206`: wait 500 ms after Done so the shot shows the real panel); a
meal's "Emoji (optional)" is a free field the wall keyboard can't fill (use the countdown's
emoji row). Fix each in this commit (or its own if large), list every fix in this task's "As
built", and add a CLAUDE.md or GOTCHAS.md line for anything that cost time.

**Done when** every item in UX §10's checklist (updated by the tasks above) passes at the three
sizes, and the "As built" list is written.

### T10 Wrap up the batch

- [ ] Done (commit: `docs: M6 batch 3 wrapped up`)

1. ADR 0030 ("M6 batch 3: the owner's third notes": Status, Date, Context, a Decision table with
   one row per decision above, Consequences) is complete and listed in `docs/adr/README.md`; ADR
   0028's corner row and ADR 0029's rows on the header's title line, the toolbar, the Features
   Google row, the likely-time chips and the wizard's pair step each gain "superseded by 0030".
2. PLAN §15 M6: "Batch 3 (the owner's notes of 2026-10-13) is in `docs/M6-batch-3.md`, built in
   0.9.0 (ADR 0030): …"; CLAUDE.md's status paragraph says so (keep it under 15 KB; move gotchas
   to `docs/GOTCHAS.md` if needed).
3. `just check`, `just e2e`, `just scan`: all green.
4. Report to the owner, without deploying: what changed (the CHANGELOG lines), that the database
   changes (one migration), the three answers above (the dev city search, the Pi's first run,
   Google's keys), and the owner's checklist on the wall and a phone:
   - the corner is empty while connected; unplug the network and the icon appears;
   - the mouse disappears after three seconds on the Pi;
   - Month view, two people filtered, the rail folded, refresh: all back; Settings → Display →
     When it starts → The home view, refresh: home;
   - setup on a throwaway instance (`just dev`): "Your city" finds a city as you type; the wizard
     has no pairing step; the wall shows its code once setup ends and pairs from More;
   - the rail's mark level with the header, Hide the rail beside the date, the fold easing, the
     small Add when folded, Settings level with the tips strip;
   - the Calendar's header on one row at Standard with the panel open; Filter with two people;
     Agenda/Hours beside the arrows; the zoom on the grid's corner; the month's name in Month;
   - Settings' list on one line each; Add an account → Google → Sign in with Google asks for the
     keys there, and Features has no Google row;
   - Add: the three sections; Time, How long and Repeats as one button each; a meal from one box.

## Follow-ups noticed but not in this batch

- The phone shell's headers are unchanged by all of this (batch 2's follow-up still stands).
- A Filter by calendar or by kind (events, tasks, meals): the Filter menu has the room for it.
- The Add panel's drafts surviving a refresh (UX §1's "Continue: Dentist Thu…" chip is not built).
- Per-screen calendar visibility and the week swipe following the finger (batch 2's list).
- `display_orientation` and `display_controls_bottom` are still stored but unread.
- The Hours pinch on the kiosk's touch panel (batch 2, T6).
