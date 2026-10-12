# M6, batch 2: the owner's second notes, as tasks

Sunroom 0.7.0 is on the owner's wall and phones. After a few more days they sent a second set of
notes. This file turns them into tasks for the Opus 5.5 session that builds them (PLAN §15, M6 →
**0.8.0**). It was written on 2026-10-12 from a read of the code at `add8c80` (v0.7.0); line
numbers are from that commit and may have drifted a little.

**Where this file lives.** `docs/M6-batch-2.md`, beside `docs/M6.md` (batch 1), committed as
`docs: M6 batch 2, the owner's second notes as tasks`.

## How to work through this file

- Read `CLAUDE.md` first: the priorities, the hard rules, the definition of done, the gotchas.
  Then UX §1, §2, §3, §4 (`docs/UX.md`), PLAN §10.1, §11.5, §15, `docs/M6.md` (batch 1, the
  same shape as this file; its "As built" notes say what surprised the last session) and
  `docs/PLUGINS.md` for how a plugin contributes rooms, Add types and Settings pages.
- Do the tasks in order. Each one ends with the definition of done (CLAUDE.md): `just check`
  green, `just e2e` green for what it touched, screenshots reviewed when it changed a screen, docs
  updated, a CHANGELOG line under `[Unreleased]`, `just scan` clean, one commit per task (or per
  lettered part where a task has them), subject `area: summary` plus the `Co-Authored-By` trailer.
  Tick the task's box here and note the commit, so a session that stops early can be resumed.
- Never deploy, bump, tag or push: the owner does that with the deploy skill when they ask. The
  release will be 0.8.0 (minor: the family sees every one of these); the skill decides.
- When something here turns out to be wrong about the code, fix the task in the smallest way that
  keeps its intent, say so in the commit message and in the final report. Don't stop to ask unless
  the owner's intent is genuinely unclear.
- Never skip a failing check. Stop and report.
- The owner's household has **five people**. The seed (`meta/testing.py`) has four (Ana, Sam,
  Mia, Leo). Where a task says "with a fifth person", the e2e test adds one through
  `POST /api/members` from a parent phone (`backend/src/sunroom/household/router.py:113-127`;
  precedent for signing in with `request`: `frontend/e2e/chores.spec.ts:85-89`). Don't change the
  seed: `backend/tests/test_sample_family.py` and many screenshots pin it.

## The owner's notes, mapped to tasks

| Note | Task |
|---|---|
| A global header: today's date, time and weather at the left; each page's controls at the right (Calendar: arrows, This Week, the views as icons or under a View button); the Today panel button always there | T4 |
| The rail shifts up; the Sunroom logo at its top; a way to hide the navigation for a full-screen view, never fully hidden (a mini navigation or a small arrow) | T5 |
| Rename Chores to Tasks | T1 |
| Redesign Add: one row of types; a form per type built for touch (who, when, repeats and how often, color); Who in one row with five people; suggestions plus a way to set a time (Due, Repeats); a Sun–Sat (or Mon–Sun) day picker; uncluttered | T7, T8 |
| The Settings icon is a gear; the padlock only when a paired display is locked | T5 |
| Animations: was `motion` ever used, and where? Plan some | "Motion today" below, and T14 |
| Hours: a zoom control instead of 24h · 12h · 1h · 15m; no zoom shows the full day | T6 |
| Button groups feel tight: more left and right padding | T3 |
| Another title for Who's Doing What | T1 (People) |
| A setting to reset the app: confirmation, a backup first, never on a connected screen | T12 |
| A Small text size for 1920×1080 screens | T2, T10 |
| Theme hint: drop "(7 PM until a location is set)" once a location is set | T10 |
| Accounts: a calendar assigned to Everyone shows unused colors first | T11 |
| Features: Google's client ID and secret behind a Google button or area | T9 |
| Remove every Save changes button; save as the user changes things | T9 |
| Family: Change → Edit with an icon, or tap the row | T11 |
| Lists: "Clear completed items after" with Never · 1 day · 3 days · 1 week | T10 |
| Photos & Screensaver: Start after Never · 5 · 15 · 30 min · 1 hour; Change photo every 15 s · 30 s · 1 · 2 · 5 min; no Shuffle hint; the same on both pages | T9 (one page), T10 |
| Weather: "Temperature unit", Auto · °F · °C | T10 |
| Calendars: tap the row to edit, the same pattern everywhere | T11 |
| Accounts: edit them like calendars; a way to remove; a Sync subsection with switches; "Show on the <screen>" switches under it | T11 |
| Tasks settings: "Give or Take Stars" → "Stars" | T10 |
| Meals: a "Show <meal> on the calendar" switch per enabled meal | T10 |
| Display: a better Daylight tint hint; Return to the calendar after Never · 2 · 5 · 10 min; How dim in percentages | T10 |
| Household: Recently Removed belongs somewhere else | T11 |
| Settings changes reach every paired screen at once; if a refresh is ever needed, say why | T13 |

## Decisions (made with the owner on 2026-10-12; the rest decided here, with the reason)

| Question | Decision |
|---|---|
| The name of the people view | **People** (owner). One word beside Week · Day · Month; the code already calls it the people view. "Who's Doing What" goes from the view switch, the Home view setting, tips and the docs |
| What "Erase everything" wipes | **Everything, back to first run** (owner): people, calendars, events, lists, tasks, meals, countdowns, photos, settings, paired screens and phones. It asks for the household password, offers Download everything first, and keeps one copy of the database in `backups/pre-erase/`. Photos are deleted (the sheet says so); the `photos/inbox` folder is left alone (the app didn't make those files). Only from a phone or computer (the device kind, never the shell) |
| The hidden rail | **An icon-only mini rail** (owner): room icons, Add and Settings without labels, about 4.5rem wide, with an arrow to expand it. A per-screen override that resets after 2 minutes idle like the Today panel, over a household setting **Compact rail** for a lasting choice |
| The Hours zoom | **Zoom out · Fit the day · Zoom in** buttons (owner), each tap ×1.5, Fit back to the whole day; pinch on the grid and ctrl + wheel on a laptop as shortcuts, only if the first is cheap on the kiosk's touch panel |
| "Tasks" | Labels only, as Kid → Child (ADR 0028): the plugin id `chores`, its routes, tables, query keys and the room's address `/chores` stay. No migration, no API break |
| The header | The rail stays full height with the Sunroom brand at its top; the header spans the board **and** the Today panel in landscape, the full width in portrait (it replaces the portrait band's own clock strip). Zones: today (date, time, weather) · the page's title · the page's controls · the Today panel toggle · the live-updates icon at the far right (ADR 0028's corner holds). One row from 104rem of header width (1920 at Standard), two rows below it (the page's title and controls move to a second line; the live icon stays top-right). Rooms hand their title and controls to the header through a small store set in a layout effect, not portals, so the kiosk's shell remounts never blank it |
| The Today panel in Settings | Allowed now (the setting pages are capped at a reading width anyway), so the toggle works in every room, as the owner asked |
| The view switch | An icon group (Week · Day · Month · People) when the header has room, a **View** button with a menu when it doesn't; the active view's word is always readable (the group shows it beside the icon; the button shows it) |
| Time words in options | The owner's shorthand written in the app's own time words (UX §2): "5 min", "30 min", "1 hour", "15 s" |
| The case of options and row labels | Sentence case stays (ADR 0028): "Temperature unit", "1 week", "Extra large". Only titles and headings are Title Case |
| Screensaver "Start after" | Never · 5 min · 15 min · 30 min · 1 hour; the default becomes **15 min** (10 is no longer offered; a stored 10 falls back to the default by the spec rule, and the CHANGELOG says so) |
| "How dim" | Becomes **Brightness**: 60% · 40% · 20% (the same stored values 60/40/20; the Pi helper and the veil are unchanged) |
| The Features page | A plugin with its own Settings page (Tasks, Meals, Photos & Screensaver) shows only its On/Off switch and a row that opens that page; its fields live on its page only. Plugins without a page (Synced Calendars, Lists, Countdowns, Weather) keep their fields on Features. This ends the two copies of one form with separate unsaved edits |
| Google's keys | A row **Sign in with Google** on Features (under Synced Calendars) with "Not set up" / "Keys saved" and a **Set up** / **Change** button that opens a sheet **Google App Keys** (the two fields, **Save keys**, **Remove keys**). The export masks every `secret` plugin field (today the client secret leaves in plain text in Export everything) |
| Autosave | Cards save as you change them: switches, segments, chips and selects at once; text fields on blur or ↵, with a quiet "Saved" caption for two seconds. Sheets and dialogs (a person, a calendar, a routine, a reward, the PIN, the Google keys, an account) keep their Save and Cancel, because a half-edited sheet shouldn't save itself. An error toasts "Not saved — …" and the control goes back |
| Rows you tap | One pattern across Settings: the row is the button (a chevron at its right, 64 px on the wall, 56 on phones), its accessible name "Edit Mia"; the sheet's title is "Edit Mia" / "Edit Kids' activities" / "Edit iCloud". The calendar's own event sheet keeps **Change** (UX §4, not in the owner's note) |
| The account sheet | Tap an account → its sheet: the status line and **Refresh now** (or **Connect again** / **Sign in again**); **Sync**: a row per calendar with a switch, the row's name opening the calendar's own sheet (Whose, Color with unused colors first and "Mia's" hints); **Show on Kitchen** (the paired screen's name; "Show on the Screens" with several; absent with none): a switch per synced calendar; **Remove account** at the bottom with the existing confirmation. One `visible_on_display` boolean per calendar still covers every screen; per-screen visibility is a follow-up (PLAN §19 per-display layouts) |
| Recently Removed | Its own Settings page, after Phones & Screens. Family keeps Removed People and Calendars keeps Removed Calendars |
| Small text | A fourth size: root 87.5% (14 px). The display's floor becomes 16 px at Small (18 at Standard stays the rule); the Hours grid and the keyboard scale with rem as they do at Large |
| Meals on the calendar | `calendar_slots` (a multichoice) replaces `show_on_calendar`; a plugin-version upgrade hook carries "on" over as `["dinner"]`, so nothing disappears from a board |
| Motion | `motion` stays the layer for exits and moves between layouts (toasts today; the done row's fold, chips leaving, the Agenda now line, routine steps in this batch); CSS for arrivals, slides, pops, fades; the canvas for bursts. Reduce motion (the setting and the OS) turns every new one off |
| Live updates | `plugins.changed` refreshes the plugin's own queries; the wall's stream keeps its position across the kiosk's shell remounts; the plugin-modules list keeps its previous value while a plugin is switched. After T13 no setting needs a refresh; the only reload left is the version update built in 0.7.0 |
| Database | One migration for the batch: `household.display_rail_compact`. `text_size` gains `small` without a migration (a `String` column, the `Literal` widens). The fixture gotcha below comes first |

## Motion today (the owner's question)

Yes: ADR 0007 chose the `motion` library behind a per-request CSP nonce, and M0 wired it
(`frontend/src/lib/motion.tsx` reads the nonce from `<meta name="csp-nonce">` and wraps each
shell in `<MotionConfig>`; the e2e CSP guard proves a `motion` animation passes). But the library
is used in exactly one place: the toasts (`ui/StatusLayer.tsx:104-160`, `AnimatePresence` +
`motion.div` so a toast rises, and the others close the gap). Everything else that moves is CSS
in `frontend/src/styles/motion.css` (press dip, row shade, selection fill, sheet and panel slides,
the keyboard, the PIN shake, the tick fill and check draw, the stamp, the strike, "+N" floating,
the routine step entering, the screensaver fades, Night's fade in, the live icon's turn, the
Hours now line's 60-second creep, and the two-second wall-tint and theme crossfades), plus the
canvas burst (`ui/Celebration.tsx`) and the Web Animations "+2" flight to the avatar
(`lib/fly.ts`). Against UX §9, these are **not built**: chips arriving and leaving on the board,
the week's slide when paging, the done row folding into Done (it jumps), the list row folding
into Done, the Agenda now line's 400 ms drop (it re-renders in place), the Day view's creeping
now line, the lit column crossfading at midnight, Night fading out, the skeleton shimmer, the
countdown's number rolling over at midnight, the routine's old step leaving, and count pops
outside the Tasks board. T14 builds the ones that answer what someone did.

## Before the first task

1. `just check` must be green at `add8c80` (confirm, don't assume).
2. **The migration fixture gotcha, again.** `released.lock` ends with `202610091752` (0.7.0) but
   `backend/tests/fixtures/db/` has no `202610091752.sql`, so the first new migration fails
   `test_unreleased_migrations_are_tested_against_the_last_release`
   (`backend/tests/test_migrations.py:68-77`). Add `_v0_7_0()` to
   `backend/tests/fixtures/db/build.py` (as `_v0_6_0`: everything before it plus
   `UPDATE household SET display_week_layout = 'hours', show_tips = 1`), register it in `SEEDS`
   under `"202610091752"`, run `cd backend && uv run python -m tests.fixtures.db.build
   202610091752`, commit the SQL (`tests: the 0.7.0 fixture database`). Consider adding to
   `docs/RELEASING.md` (and the deploy skill's checklist) a line that the release step builds the
   fixture, so this stops biting.

## Tasks

### T1 Words: Tasks for Chores, People for Who's Doing What

- [x] Done (commit: "words: Tasks for Chores, People for Who's Doing What")

**Owner's notes.** "Rename Chores to Tasks." "Think of another title for the Who's Doing What
view. It doesn't quite flow with Week | Day | Month."

**Tasks (labels only; the id `chores` stays everywhere a computer reads it).** The strings, by
place (the explorer's list; grep `[Cc]hore` in `frontend/src`, `backend/src/sunroom/plugins/chores`
and the docs to catch the rest):
- Backend manifest `plugins/chores/plugin.py`: `name="Tasks"` (25), the description ("Tasks for
  each person or anyone, with stars, rewards and routines."), the help strings (32, 51, 53),
  `DisplayPanel("today", "Tasks Today")` (60), `DisplayRoom`/`PhoneTab`/`SettingsSection` labels
  (61-63). `chores/router.py:60` "Tasks are still starting. Try again." `service.py:157,488,569,574`
  and `common.py:53` (`gone("task")`). The "{name} is turned off" message follows the manifest
  (`tests/chores/test_plugin.py:66` asserts it: update).
- Frontend: `chores/index.ts:18` room label "Tasks", `:26` Add type "Task", `:29` settings page
  "Tasks". `ChoresRoom.tsx:46` "Tasks · Today" / "Tasks · This Week", `:76-77` empty state ("Tasks
  live here. Give each person a few, and watch them get stamped.") and "Add task".
  `ChoreEditor.tsx:296` "Add task". `TodayBlocks.tsx:60` "Tasks Today", `:123` "Tasks", `:140`
  "See tasks". `ChoresTab.tsx:46,77`. `RewardsPage.tsx:47` back-link "Tasks".
  `RoutineRunner.tsx:82,154` "Back to Tasks". `SettingsChores.tsx:64` "What Tasks Include".
  `ChoreBoard.tsx:107` "`${name}'s tasks`". `Removed.tsx:19` "A task". `chores/data.ts:37` (the
  PIN reason). `tips.ts:44` ("Tasks: a tap on the box is all it takes…"). `FeaturesPage.tsx:57`
  and `SetupWizard.tsx:462` (the sentences that list the features). Toasts that say "chore".
- The Add panel's type is "Task" (T7 draws it with an icon).
- Docs: UX (every "chore"/"Chores" in copy and headings; the glossary line reads "**Task**
  (stored as `chore`)"), PLAN §2 glossary and the plugin table's room name, README.md and
  PRIVACY.md where they say "chores" to the family, `docs/PLUGINS.md:167` ("Chores 30" → "Tasks
  30"). ADRs and old CHANGELOG entries stay (history). Add one comment at
  `plugins/chores/plugin.py` top: "shown to the family as Tasks (M6 batch 2)".
- Tests with the word: `frontend/e2e/a11y.spec.ts:27,270-272,397-398,442-446`,
  `chores.spec.ts:22-23,133-134`, `screensaver.spec.ts:55,66`,
  `screenshots.spec.ts:34,102,494,510,621-622`, `tips.test.ts`. Keep the spec file names
  (`chores.spec.ts`) and screenshot names: they're ids.

**People.** `BoardHeader.tsx:11-16` `VIEWS` label "People"; `CalendarRoom.tsx:114-158` the people
view's title "People"; `DisplayPage.tsx` Home view option "People"; `tips.ts` tip 6 ("People
gives each person their own column."); phone copy if any names the view. Tests: `calendar.spec.ts:131-165`
(view names), `a11y.spec.ts`, `screenshots.spec.ts` (the views loop). Docs: UX §3 (the header
line and the layout table's column C), §4 ("**People**: one column per person…"), §8, §10; PLAN
§15 and §18 where they say "Who's doing what"; ADR 0028 keeps its text (history).

**Guard.** `designRules.test.ts` already checks Title Case; nothing to add. CHANGELOG: "Chores are
now Tasks everywhere you read it, and Who's Doing What is now People."

**Done when** `just screenshots` shows no "Chore" or "Who's Doing What" on any screen, and
`grep -rn "Chore" frontend/src --include=*.tsx | grep -v "chores/"` finds only ids.

### T2 The migration and the two new settings

- [x] Done (commit: "household: the compact rail setting and Small text")

**Build.** After the fixture gotcha, `just db-revision "household: compact rail"` modelled on
`migrations/versions/202610091752_household_week_layout_and_tips.py`: `display_rail_compact
Boolean NOT NULL server_default false`. Then `household/models.py`, `household/schemas.py`
(`SettingsOut`, `SettingsUpdate`: `display_rail_compact: bool | None`; `text_size:
Literal["small", "standard", "large", "xl"]`; the column is `String(10)`, so "small" fits with no
migration; `TextSize` in `models.py` gains `SMALL`),
`household/service.py settings_out`, `just api-types`, `backend/tests/test_household.py` (the
default, a PATCH of each, a 422 for `text_size: "tiny"`).

Frontend: `styles/tokens.css:227-244` gains `html[data-text-size="small"] { font-size: 87.5% }`;
`lib/theme.ts:73-74` already sets the attribute for any non-standard value (check `theme.test.ts`).
Settings → Display → Text size: Small · Standard · Large · Extra large (T10 touches the same row;
do the option here). The Compact rail switch comes with T5 (the backend column is here so the
batch has one migration). Lower the display floors that assume 18 px where they are hard-coded:
`.now-label` and `.day-head` clamps (`tokens.css:412-417`) scale in rem already; `Avatar xs`
(`ui/Avatar.tsx:8`, 0.8rem) stays.

**Tap targets at Small.** A 3.5rem target is 49 px at 87.5%, under the 56 px rule, and a
smaller screen meets the same finger. So targets don't shrink: two tokens in `tokens.css`,
`--tap: max(3.5rem, 56px)` and `--tap-primary: max(4rem, 64px)` (phones keep 44/48), exposed as
`min-h-tap` / `size-tap` / `min-h-tap-primary` utilities (`@utility`), used by `ui/Button`,
`Chip`, `Segmented`, `TickBox`, `WhoPicker`, the rail's rooms and the keyboard's keys in place of
`min-h-14` / `size-14` / `min-h-16`. Small shrinks text and spacing, never a target.

**As built.** The tokens are in the theme's spacing scale (`--spacing-tap`, `--spacing-tap-primary`),
so `min-h-tap`, `size-tap`, `h-tap` and `min-w-tap` all exist with no `@utility`. The 8 px between
two targets shrank to 7 at Small and failed the a11y check, so `--spacing-2` is `max(0.5rem, 8px)`:
every `*-2` utility keeps 8 px. The Hours grid sizes its chips in JS from the root size, so
`hours.ts` got `tapPx(rem)`. The caption token stops at 16 px. The revision's fixture database
(`202610121749.sql`, `_v0_8_0`) is built here, so the next batch's first migration has its test.

**Tests.** Vitest `theme.test.ts` (small sets the attribute). e2e `shell.spec.ts`: PATCH
`text_size: "small"` from a phone and the wall's root font size is 14 px within 3 s;
`a11y.spec.ts` runs the wall's board and the Add panel at Small too (the 56 px rule holds through
the tokens).

**Docs.** UX §1 (the type table gains a Small column: ×0.875, floor 16 px), §7 type sizes, §10
(Text size); PLAN §10.1. CHANGELOG: "Settings → Display → Text size has a Small choice for
screens around 1920×1080." and the Compact rail line comes with T5.

### T3 Primitives: roomier button groups, the brand, rows you tap, one-line rows

- [x] Done (commit: "ui: roomier button groups, the brand, rows you tap, one-line rows")

**Owner's note.** "Most button groups seem spaced a little close. Adding a little more left/right
padding might help."

**Build.**
- `ui/Segmented.tsx`: cells `px-5` on the display (was `px-3`), `px-4` on phones; keep `gap-1`.
  When the options can't fit one line (five time words on a phone), the group **wraps** into two
  rows instead of overflowing: `flex-wrap`, cells `flex-auto`, the container radius a fixed
  `rounded-[1.75rem]` so two rows still look like one control. A second export `IconSegmented`
  (`role="group"`, `data-segmented`, `flex gap-2`, cells `press select-fill size-14 rounded-full
  aria-pressed:bg-ink aria-pressed:text-on-ink` with an `aria-label` each, no border or padding)
  for icon groups: 56 px tall, so it matches the icon buttons beside it in the header (T4's view
  switch) and in `WeekTools.tsx:42-65`, which drops its hand-rolled group for it. (T7 adds the
  `stacked` form for the Add panel's type row.) `data-segmented` stays on every group (the
  tap-target rule treats it as one control).
- `features/settings/PluginSettingsForm.tsx:159-202`: a `choice` renders as a Segmented up to
  **6** options and 40 label characters (was 4 / 24), else chips; T10's relabels rely on it.
- `ui/Brand.tsx`: the mark (`ui/SunMark`) plus the "Sunroom" wordmark (Lexend 800), props
  `{ size, markOnly }`. Replace the three inline lockups (`SetupWizard.tsx:70-73`,
  `DisplayEntry.tsx:119-126`, `SignInScreen.tsx:146-149`); T5 puts it on the rail.
- `ui/ListRow.tsx`: the one pattern for "tap the row to open it": a full-width `<button>` (or
  `<Link>`) with a leading slot (avatar, color dot or icon), a title, a subtitle, an optional
  trailing value and a `ChevronRight`; `press-row`, 64 px on the wall and 56 on phones, the row's
  accessible name from `label` ("Edit Mia"). T11 uses it everywhere in Settings.
- `ui/ScrollRow.tsx`: a one-line horizontal row (`flex-nowrap overflow-x-auto snap-x
  [scrollbar-width:none]`) with a soft edge fade (a mask image, tokens only) that T7's Who row,
  the type row and the emoji row use; `role="group"` with the row's label.
- `lib/savedFlash.ts` + `ui/SavedMark.tsx`: a two-second "Saved" caption (`aria-live="polite"`,
  `text-d-caption text-ink-soft`) that T9's text fields show after a blur-save.

**Tests.** Vitest: `Segmented` carries the wrap classes and `IconSegmented` renders 56 px cells
with their names (jsdom can't measure widths); `ListRow` renders the name and chevron;
`PluginSettingsForm.test.tsx` (a 5-option choice renders as a Segmented). e2e: the a11y tap-target check still passes on the
Display settings page (the wrapped group's cells keep 56/44 px).

**As built.** The wall's group radius is `calc(var(--tap)/2 + 6px)` (a cell's own radius plus
the padding and border), so it follows the tap token; phones use the fixed 1.75rem. `IconSegmented`
has `showChosen` (the chosen option's word beside its icon) for T4's view switch. `ListRow` has a
twin, `ListRowLink`, made with the router's `createLink`, for rows that open a page; its subtitle
is the row's `aria-describedby`, so "Edit Mia" is followed by "Child · Pink". `Brand` takes
`size: "line" | "stacked" | "entry"` (T5 adds `rail`) and `heading` for sign-in's h1; the mark is
`decorative` beside the name. `ScrollRow`'s `.fade-x` is in `tokens.css`.

**Docs.** UX §1 (segmented padding; the wrap rule), §7. CHANGELOG: "Button groups have more room
around each word."

### T4 The global header

- [x] Done (commits: "frontend: the room header slot and the rail's state", "frontend: the global
  header", "frontend: every room's title and controls in the header")

**Owner's note.** "Make the header global. Reorganize the components so the top bar of the app
shows today's information horizontally. Example: Fri, Oct 8 9:00 AM <Weather>. Then the right
side of the header is customizable to whatever page the user is on (i.e. Calendar shows the
arrows and 'This Week' button, the 'Week | Day | Month | Who's doing what' button group becomes
icons to save space, or perhaps under a 'Filter' or 'View' button that shows the different views
to choose from when pressed). The 'Today Panel' button should be visible on the header at all
times as well, in case they want to toggle it from another page."

**What exists.** The rail (`shell/Rail.tsx:71-155`) holds the clock and date (`ClockBlock`
22-51), the plugins' rail blocks (the weather, `WeatherBlock.tsx:23-85` with `place` rail / band
/ phone), the rooms, Add and the lock. The board's header (`features/calendar/BoardHeader.tsx`)
has two rows: the title, arrows and This Week, the view `Segmented` (at `@min-[70rem]` of the
board's container, else on row 2), the Today-panel toggle and the live icon; then Show, pills and
the Week tools. Every other room rolls its own `<header>` (`ListsRoom.tsx:38-51,221-256`,
`ChoresRoom.tsx:44-67`, `RewardsPage.tsx:40-52`, `MealsRoom.tsx:82-133`, `SavedMeals.tsx:90-115`,
`CountdownsRoom.tsx:184-197`, `PhotosRoom.tsx:40-73`, Settings `SettingsScreens.tsx:109-155`).
The shell tree is `DisplayShell.tsx:237-290`; the panel is hidden in Settings (233-234); the
portrait band carries its own clock strip (267-277). The kiosk remounts `DisplayShell` between
`/display` and the rooms (`ShellLayout.tsx:15-36`, `DisplayEntry.tsx:73-77`).

**The width budget** (the header's width in the display's rem: 1920 minus the rail): Standard
108rem (115.5 with the compact rail), Large 92.3, Extra large 80.3; a 1440 laptop 78; 1024
laptop 52; portrait 67.5 (XL 51.9). The full set (the today block ~29rem, "September 2026 ·
Sep 27–Oct 3" ~25, arrows + This Week 18.5, four view icons 15.5, toggle + live 7, gaps ~9) is
about 104rem. So the header is **one row at 104rem and up** (1920 at Standard) and **two rows
below**: row 1 the today block with the toggle and the live icon at the right, row 2 the page's
title and controls. The live icon stays the top-right corner at every width (ADR 0028; the e2e
80 px rule holds). No fixed height beyond a minimum.

**Build, in the order the shell design gave (one commit each, `just check` green after each).**

*a. `frontend: the room header slot and the rail's state`.* `shell/roomHeader.ts` (not
`header.ts`: it would collide with `Header.tsx` on a case-insensitive disk): a store, not
portals (portals need the header's node before the room's first render and would blank on every
kiosk remount; a store set in `useLayoutEffect` commits before paint, lives outside React, and
the Header is its only subscriber):
```ts
export interface RoomHeaderSpec { title: string; subtitle?: string; notice?: string | null;
  back?: ReactNode; controls?: ReactNode }
export const roomHeader = createStore<RoomHeaderSpec | null>(null);
export function useRoomHeader(spec: RoomHeaderSpec) {
  useLayoutEffect(() => { roomHeader.set(spec); });                 // every render: fresh closures
  useLayoutEffect(() => () => roomHeader.set(null), []);            // cleanup before the next room's set
}
export function RoomHeader(spec: RoomHeaderSpec) { useRoomHeader(spec); return null; }
```
Rooms with a literal title use `<RoomHeader title="Lists" …/>` (the design-rules test already
checks `title="…"` literals for Title Case); CalendarRoom uses the hook. `lib/displayState.ts`:
`railCollapsed: boolean | null` (`INITIAL` null; `resetBoard()` counts it as initial when null);
a new `displayState.test.ts`.

*b. `frontend: the global header`.* `shell/Header.tsx`: `<header data-header
className="@container/header flex min-h-[var(--header-h)] shrink-0 flex-wrap items-center gap-x-6
gap-y-2 border-b border-line bg-surface px-6 py-3">` with three zones in DOM order:
1. `TodayBlock`: the date `shortDate(day)` ("Fri, Oct 8", `text-d-body font-semibold
   whitespace-nowrap`), the time at `text-d-glance font-extrabold` in `<Digits>` with the AM/PM
   as a `text-d-secondary` suffix (the `useMinute`/`formatClock`/`clockSuffix` pieces move from
   `ClockBlock`, which is deleted), then the plugins' blocks with `place="header"`
   (`RailPlace` in `registry.ts:72` becomes `"header" | "phone"`; `WeatherBlock` draws a
   `press min-h-14` row: icon `size-8`, the temperature at `text-d-title`, the high over the low
   at `text-d-caption`; stale → "as of 9:10"; the tap still opens the forecast sheet).
2. The room zone: `min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 basis-full grow-0
   order-last @min-[104rem]/header:order-none @min-[104rem]/header:basis-0
   @min-[104rem]/header:grow`; inside, the room's `back` link, `<h1 aria-live="polite"
   className="min-w-0 truncate text-d-title font-bold">` with `notice ?? title` and the subtitle
   in `font-semibold text-ink-soft @max-[64rem]/header:hidden`, then `controls` (a room puts
   `ml-auto` on what belongs at the right).
3. The end zone `ml-auto flex shrink-0 items-center gap-3`: the Today-panel toggle (moved from
   `BoardHeader.tsx:113-127`, still `portrait:hidden`, in every room, Settings included) and
   `<LiveStatusButton/>`.
Tokens: `--header-h: 5rem`; `--band-h` 28rem → 24rem (the band loses its strip; check the
portrait XL screenshots and go back if blocks clip). The DisplayShell tree becomes:
```
<div data-shell="display" data-rail={railCompact ? "compact" : "full"} …landscape:flex-row…>
  <div className="contents portrait:order-last portrait:block"><Rail …/></div>
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <Header panelShown={showPanel} onTogglePanel={…}/>          ← board + panel; full width in portrait
    {showPanel && <div className="hidden portrait:flex portrait:h-[var(--band-h)] …"><TodayPanel band/></div>}
    <div className="flex min-h-0 min-w-0 flex-1 landscape:flex-row portrait:flex-col [+ row-reverse for a right rail]">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-[var(--osk-h,0px)]">{children}<TipsBar/></main>
      {showPanel && <div data-surface className="flex w-[var(--panel-w)] shrink-0 … portrait:hidden"><TodayPanel/></div>}
    </div>
  </div>
</div>
```
`showPanel` drops `room !== "settings"`. The keyboard padding stays on `main` and the tips strip
its last child, so `--osk-h`, `--tips-h` and the toast offsets are untouched; `ui/SidePanel.tsx:76`
keeps `landscape:inset-y-0` (an open panel covers the header's end zone, never the clock);
`ui/Keyboard.tsx:161-163` unchanged. `CalendarRoom.tsx:114-203`: the hook with
`header.title`/`subtitle`/`notice` and `controls = <BoardControls>` (the arrows and the home
button from `BoardHeader.tsx:75-105`, then `<ViewSwitch>` in `ml-auto`, hidden in the Today
view); the body gets `<BoardToolbar>` (`BoardHeader.tsx:131-172`: Show, pills, the Week tools in
`ml-auto`; null when there's one member and nothing else). Delete `BoardHeader.tsx`; the
section keeps its `@container` for WeekTools. `features/calendar/ViewSwitch.tsx`: `VIEWS` with
icons (Week `CalendarRange`, Day `Calendar1`, Month `CalendarDays`, People `Users`); two forms,
one hidden by the header's container: the `IconSegmented` (T3) at `@min-[64rem]/header`, below
it a **View** menu: a `Button variant="secondary"` named "View: Week" (`aria-haspopup="menu"
aria-expanded aria-controls`, the icon, the word, a `ChevronDown`), opening a `role="menu"`
(`data-segmented`, `rise-in`, `absolute right-0 top-full z-50 mt-2 min-w-64 rounded-panel
border-2 border-line bg-surface p-2`, a soft shadow) of four `role="menuitemradio"
aria-checked` rows (icon + word, 56 px): opening focuses the checked one, arrows move, Escape
and Tab close and return focus, an outside `pointerdown` closes, a choice calls `onView`. No
library, no `<dialog>`. Playwright ignores `display:none`, so `button "Day"` resolves to the
visible form, as with today's two copies.

*c. `frontend: every room's title and controls in the header`* (the header rows go from the
room bodies):

| Room | title · subtitle · back · controls |
|---|---|
| Calendar | the board's title · the span · — · arrows, This Week (or Today / This Month), the view switch; `notice` "Drop on a day" |
| Lists | "Lists" · — · — · New list |
| A list | the list's name · "4 to get" · ‹ Lists · Clear done, Change list |
| Tasks | "Tasks" · "Today" / "This Week" · — · the Show segmented, Stars & Rewards (`ml-auto`) |
| Stars & Rewards | "Stars & Rewards" · — · ‹ Tasks · — |
| Meals | "Meals" · the week's span · — · arrows, This Week, Copy last week, Saved Meals |
| Saved Meals | "Saved Meals" · — · ‹ Meals · New saved meal |
| Countdowns | "Countdowns" · — · — · Add countdown |
| Photos | "Photos" · "8 photos" · — · Settings, Start screensaver, Add photos |
| Settings | "Settings" · — · — · Lock (while a grant is open); the nav's h1 goes, the page's h2 stays |

`SavedMeals.tsx` and `RewardsPage.tsx` serve both shells (they branch on `useShell()`), so they
mount `<RoomHeader>` only on the display branch. Meals' and Tasks' links (`min-h-16
rounded-button`, `MealsRoom.tsx:125`) become `min-h-14 rounded-button-d` so the row is one height.

**As built.** The plan's width budget assumed four bare icons (15.5rem) for the view switch, but
the decision table asks for the chosen view's word beside its icon (about 22rem). With the title
and the week's span side by side that no longer fit one row at 1920 px Standard, and in portrait
the switch dropped to a third line. So the title's quiet line sits **under** the title (32 px over
18 px, 57 px tall): the worst case measured (late September, "12:30 PM", Month) fits with room to
spare, the subtitle never hides, and the plan's "hide it below 64rem" rule wasn't needed. The
header pads 10 px top and bottom so it is 80 px with or without a subtitle. A thin rule separates
today from the room in the one-row form. `HeaderBack` and `HeaderLink` (`shell/HeaderLinks`) are
the header's links, made with the router's `createLink`; a `createLink` component must merge the
`className` the router hands it after its own, or its styles vanish (a CLAUDE.md gotcha now).
The Photos room's Start screensaver became an ordinary button on the kiosk so the row is one
height. With the Today panel beside Settings, tests that find a Settings page by its h2 need
`exact: true` ("Tasks" also matched the panel's "Tasks Today").

**Tests.** e2e `shell.spec.ts:22-31` (`steadyDigits` inside `getByRole("banner")`); `:110-139`
(keep the 192 px rail and the panel checks; add `banner.x ≈ 192`, `banner.width ≈ viewport −
192` in landscape, and `x = 0, y = 0, width = viewport` in portrait); `:141-161` (`header =
page.getByRole("banner")`, the 80 px rule stays); `:209-223` (the h1 and the week buttons from
the banner). New: "toggles the Today panel from Settings" (`/settings/display` on the kiosk with
no PIN: "Hide the Today panel" → `complementary "Today"` hidden, Show → back). `calendar.spec.ts`,
`a11y.spec.ts` (heading regexes `/^Tasks/`, `/^Meals/`; a portrait-XL or 1024 step that opens
`button "View: Week"` and runs `check(page, "display: the View menu")`),
`screenshots.spec.ts` (`view-menu` at portrait XL). The `<header>` must not sit under `main`,
`section`, `aside` or `nav`, or Playwright's `banner` role disappears (the tree above keeps it
under plain divs).

**Risks and checks.** Measure the one-row header with the longest title (set the test clock to
late September) in the 1920 Standard shot; if it truncates, hide the subtitle below 108rem
instead of 64. The room zone wraps rather than clips (Meals at portrait XL). `aria-live` on the
h1 announces room switches as the board's did; if a reader double-announces with the menu, move
`aria-live` to an `sr-only` span carrying only `notice`. Focus order: rail (brand, Hide the
rail, rooms, Add, Settings) → header (weather, back, controls, toggle, live) → board → panel.
Nothing animates on first paint: the header has no entry motion; `settled()` after `goto` sees
no running animation.

**Docs.** UX §1 (the type table's "Rail clock 56" → "Header clock 40, weight 800, AM/PM at 20"),
§3 (the shell paragraph and the landscape and portrait wireframes: the header row above board
and panel, the brand at the rail's top, the view icons or the View menu, Show and the Week tools
as the board's toolbar; the room wireframes at :220, :286, :306, :325, :363), §4 (the Settings
display paragraph: the panel stays; the Display row), §10. PLAN §6.5 (`railBlock` now draws in
the header), §11. ADR 0029 rows (the header's zones and the 104/64rem rule; the slot store; the
view switch). CHANGELOG: "The top of the kitchen screen is one bar: the date, time and weather at
the left, the page's buttons at the right, and the Today panel's button in every room."

### T5 The rail: the brand, the mini rail, the gear

- [x] Done (commit: "frontend: the rail folds to its icons")

**Owner's notes.** "After the header is changed the left navigation area would shift everything
up. Include at the top the Sunroom logo. Also add a way to 'hide' the navigation for a true full
screen view. Different from the 'Today panel' that it is never fully hidden. There is always
either a mini-navigation, or small arrow to expand the navigation back out." "The 'Settings' icon
should be a standard gear or something to identify Settings. Only use the padlock if it's locked
on a paired display."

**Build** (one commit: `frontend: the rail folds to its icons`).
- **The top block** (replaces `Rail.tsx:96-101`, still `portrait:hidden`): `flex items-start
  justify-between gap-2 px-4 pt-4 pb-3`; left `<Brand size="rail"/>` (the mark `size-9` over the
  "Sunroom" wordmark at `text-d-secondary font-bold`, stacked so it fits beside a 56 px button in
  192 px); right a `Button variant="quiet" icon` **Hide the rail** (`PanelLeftClose`;
  `PanelRightClose` when the rail is on the right; `aria-expanded`). Compact: `<Brand size="rail"
  markOnly/>` (`size-10`, keeps its "Sunroom" label) above **Show the rail** (`PanelLeftOpen`),
  `px-2`. `ui/SunMark` gains `decorative` (`aria-hidden`) so the lockup isn't read "Sunroom
  Sunroom"; `ui/Brand` (T3) gets `size: "entry" | "rail"` (entry replaces `DisplayEntry.tsx:119-126`;
  the two phone lockups stay).
- **The mini rail** (`compact` prop): the nav keeps `landscape:w-[var(--rail-w)]`; the width comes
  from a root rule beside `:root:has([data-tips])` (`tokens.css:380-383`): `:root:has([data-rail=
  "compact"]) { --rail-w: 4.5rem }`, so everything that reads `--rail-w` (the toasts) follows.
  Rooms keep `ROOM_LINK` with the label `sr-only` (links keep their names; `landscape:min-h-14`
  cells); Add is the `size-16` circle alone (`aria-label="Add"`); Settings icon only (it already
  has `aria-label="Settings"`).
- **State.** `railCompact = railCollapsed ?? settings?.display_rail_compact ?? false`; the buttons
  call `updateDisplay({ railCollapsed: !railCompact })`; `resetBoard()` clears it after 2
  minutes idle (T4a). Portrait ignores it. Settings → Display → Layout: `Switch label="Compact
  rail"` with the hint "Only the rooms' icons, so the board gets more room. Anyone can open it
  back out from the rail." after Rail side, whose hint becomes "Where the rooms and Add sit, for
  a screen hung to one side." (the clock moved).
- **The width motion** (`styles/motion.css`, by the `[data-surface]` rule): `nav[data-rail-motion]
  { transition: width var(--motion-enter) var(--ease-standard) }`; the attribute arrives only
  once settings are known (`requestAnimationFrame` after `settings` resolves), so a cold load
  never animates its first compact paint; on a kiosk room switch the store persists and the
  width doesn't change. The reduce-motion blocks (`motion.css:342-375`) make it instant.
- **Toast offsets** (`ui/StatusLayer.tsx:153`): `ToastRegion({ display, railSide = "left",
  panelShown = true })` with four static class sets (left/shown `left-[var(--rail-w)]
  right-[var(--panel-w)]`, left/hidden `… right-0`, right/shown `left-[var(--panel-w)]
  right-[var(--rail-w)]`, right/hidden `left-0 right-[var(--rail-w)]`; portrait as today);
  DisplayShell passes `railSide` and `showPanel`. `StatusLayer.test.tsx:62` still passes; add one
  right-rail assertion. (M6.md's follow-up, closed here.)
- **The gear.** `Rail.tsx:147-152`: `lock === "locked" ? <Lock/> : <Settings/>` with
  `data-icon="lock" | "gear"` on the button (lucide 1.52 puts no class on its SVGs, so e2e needs
  the hook); the word under it stays ("Unlocked" while a grant is open, else "Settings").
  `DisplayShell.tsx:251-257` already yields `locked` only with a PIN and no grant, `open` for a
  laptop parent or no PIN: unchanged. The Settings header's **Lock** button keeps its padlock.

**As built.** The `--rail-w` rule sits inside `@media (orientation: landscape)`, and the folded
form's `sr-only` words are `landscape:sr-only`, so portrait's bar never changes. A folded room is
a 4.5rem square (`flex-[0_1_4.5rem]`), not 6rem tall. The Compact rail switch moves when the
server answers (settings aren't optimistic), so the e2e clicks it and waits rather than
`check()`.

**Tests.** e2e `shell.spec.ts`, new: "folds its rail to icons and opens it again after two
minutes idle" (`page.clock.install()` before `goto("/display")`, since `whenIdle` uses
`setTimeout` + `Date.now()`, `lib/idle.ts:45-56`; click Hide the rail → the nav is ≈ 72 px and
`link "Lists"` is still there; Show the rail; hide again; `fastForward(121_000)` → 192 px);
"toggles the Compact rail setting" (`switch "Compact rail"` → ≈ 72 px and it stays after the
idle reset); "shows a padlock only while Settings are locked on a paired screen" (seed with a
PIN as `first-run.spec.ts:125`: `button "Settings"` has `data-icon="lock"`; after the PIN,
`"gear"`; the desktop project sees `"gear"` from the start). `screenshots.spec.ts`: `rail-compact`.
`first-run.spec.ts:89-107` keeps working (`button "Lock"` is in the header; the rail's is
"Settings"). The a11y tap-target check covers the mini rail (56 px cells, `data-segmented`).

**Docs.** UX §3 (the rail's contents: "the brand, Hide the rail, the rooms, Add, the Settings
gear (a padlock while Settings are locked on a paired screen)"; the mini rail), §4 Display row
(Compact rail), §9 (a row "Rail fold: the width eases over `--motion-enter`; instant under
Reduce motion"), §10 (the rail paragraph, the gear). PLAN §10.1 (`display_rail_compact`, T2).
ADR 0029 rows (the mini rail, its override and setting; gear versus padlock). CHANGELOG: "Hide
the rail from its arrow for a wider board; it comes back after two minutes, or stays small with
Settings → Display → Compact rail." "Settings is a gear now; the padlock shows only while a
paired screen's Settings are locked."

### T6 The Hours zoom: buttons instead of a ladder

- [x] Done (commit: "calendar: the Hours zoom is Zoom out, Fit the day and Zoom in")

**Owner's note.** "The Hours view when viewing weekly data shows the button group of 24h | 12h |
1h | 15m. Instead of a grouping explore the ability to add a zoom control so the user can change
the view to a size they prefer instead of a pre-defined one. No zoom is the default, showing the
full 24h."

**Build.**
- `lib/displayState.ts:13`: `hoursZoom: number` (1 = the whole day fits; `INITIAL` 1;
  `resetBoard()` still returns it). `features/calendar/hours.ts`: `ZOOM_STEP = 1.5`;
  `pixelsPerHour(zoom, gridHeight, rem) = zoom * gridHeight / 24`; `maxZoom(gridHeight, rem)` =
  the first power of 1.5 whose pixels per hour reach `4 * FULL_CHIP_REM * rem` (the old 15m
  level: a 15-minute event gets a full chip); `zoomIn(z, max)`, `zoomOut(z)` (clamped to 1);
  `gutterHours(pph, rem)` labels every hour once an hour is at least 3rem tall, every other hour
  below; `gridStepMinutes(pph, rem)`: 60 under 6rem an hour, 30 under 12rem, else 15;
  `initialScrollTop` keeps returning 0 at zoom 1; `rescaledScrollTop` is unchanged (it keeps the
  minute in the middle). Remove `ZOOMS`/`HoursZoom`.
- `features/calendar/WeekTools.tsx:31-38`: the zoom group becomes three `Button variant="secondary"
  icon` in one `role="group" data-segmented` row (`gap-2`, like `IconSegmented` but these are
  plain buttons, not a choice): **Zoom out** (lucide `ZoomOut`, disabled at 1),
  **Fit the day** (`Maximize2` or `Scan`; disabled at 1), **Zoom in** (`ZoomIn`, disabled at the
  max). Only while Hours is on. The layout switch stays rightmost (nothing moves under the finger).
- `HoursGrid.tsx:106,115`: compute `pph` from the number; the `key={zoom:pph}` remount of the
  now line keeps working; a `fit` change (keyboard up, tips strip) keeps zoom 1 fitting.
- Shortcuts, only if cheap: a two-finger pinch on the grid's scroller (pointer events; `touch-action:
  pan-y pinch-zoom` conflicts with dnd-kit's long press: measure two active pointers' distance and
  map ×1.5 per 25 % change, snapped to the step ladder; skip if it fights the long-press sensor)
  and ctrl + wheel on laptops. The buttons are the real control; the shortcuts have button twins.
- Tips: tip 7 stays ("Zoom in when it's busy.").

**As built.** `pixelsPerHour(zoom, gridHeight)` needs no rem. The limit depends on the grid's
height, which only `HoursGrid` measures, so it publishes `maxZoom` in a small store
(`hoursLimit.ts`) for the Zoom in button, and clamps a zoom the grid can no longer hold (the
keyboard up) when it draws, not in the state. `zoomIn`/`zoomOut` snap to powers of 1.5, so
floating-point drift can't creep in. Ctrl + wheel is built and tested (Chromium sends a trackpad
pinch the same way). The touch-panel pinch is **not** built: with `touch-action: pan-y` and
dnd-kit's long-press sensor on the same surface it can't be judged without the kiosk's panel, and
the plan asked for it only if cheap there.

**Tests.** Vitest `hours.test.ts:36-52,165-189`: the ladder values become 720 → 30, 45, 67.5,
101.25…; `maxZoom(720, 16)` → the first step with pph ≥ 288 (1.5⁶ = 11.39 → 341.7; 1.5⁵ = 7.59 →
227.8, so 6); `gutterHours`/`gridStepMinutes` by pixels. e2e `hours.spec.ts:49-150`: the buttons
by name ("Zoom in" twice → the body is 2.25 × fit and the block 2.25 × fit/24; "Fit the day" →
back, no scroll; "Zoom out" disabled at fit; the 2-minute reset returns to fit).
`a11y.spec.ts:388`, `screenshots.spec.ts:129,132` (`board-hours-15m` becomes `board-hours-zoomed`
at four taps in).

**Docs.** UX §3 (the header's tools: "the zoom (Zoom out · Fit the day · Zoom in, while Hours is
on)"), §4 (the Hours paragraph: "Fit shows the whole day with nothing to scroll; each Zoom in
makes an hour half again as tall, up to a 15-minute event filling a chip; the minute in the middle
stays put"), §10 checklist; ADR 0029 row (supersedes ADR 0028's ladder). CHANGELOG: "Hours zooms
with Zoom in and Zoom out buttons, as far in as you like; Fit the day shows the whole day again."

### T7 Add: the fields built for touch

- [x] Done (commits: "dates: ordered weekdays and the month grid in lib", "calendar: custom repeats
  round-trip, and a rule we can't read is kept", "ui: touch primitives for the editors", "ui: the
  Who picker is one row", "calendar: the Repeats field, with Custom…")

**Owner's note.** "Redesign the 'Add' workflow. Ensure each item they can choose is a single row
(perhaps a button group). The textbox that parses into the correct what, when, who is nice to
have, but we need a better UI/UX to manually select as well. Each type of item added should have
its own form (built for touch)… Also ensure the 'Who' section renders as one row. Currently my
household has 5 members, and including 'Everyone' as an option, the 5th member gets pushed to a
new line. The suggestion buttons are nice, but should include a way to set a time as well (i.e.
for Due, Repeats, etc). The 'day' section should show a standard Sun-Sat selection (or Mon-Sun
depending on their setting)… Pay special attention to the UI/UX. Ideally it isn't too cluttered,
easy to tap items and change things, and build for touch (tablets, paired screens, phones, etc)."

**What exists.** `AddPanel.tsx:88-131` draws the types as a wrapping `ChipRow` (Countdown
lands on a second line in the 640 px panel). `EventEditor.tsx` parses the field live (218-227),
shows an "Understood as" sentence (278-284, 319-322) and one row of chips that open one picker
at a time (323-335; Day 458-524 is seven days from the panel's day plus a native date input;
Time 526-582; Repeats 584-657 are presets only, and a rule the presets can't read shows as
"Doesn't repeat" and would be cleared on save: 151, 167, `AddPanel.tsx:52-53,62-63`).
`ui/WhoPicker.tsx:38-42` wraps (`flex flex-wrap`, 96 px cells with 64 px avatars: Everyone plus
four people fit 592 px, a fifth wraps). `ChoreEditor.tsx:218-244` has Due chips with no picker,
no Day row, and presets only. The only weekday multi-select (`SettingsChores.tsx:295-312`) is
fixed Mon–Sun. Only `EventEditor.tsx:443-453` pins its button above the keyboard. Found on the
way: a board tap while Add is open replaces the panel and drops its `type`/`title`
(`CalendarRoom.tsx:92-94`); `AddItem.tsx:35`, `MealEditor.tsx:68` and `CountdownEditor.tsx:46-48`
read the board's day once, so a later tap doesn't move them; the engine honours `WKST`
(`domain/recurrence.py:44,244`) but `repeat.ts:85-103` never writes it and `rruleToRepeat` rejects
`WKST≠MO` (196).

**Build, in four commits.**

*a. `dates: ordered weekdays and the month grid in lib`.* `lib/dates.ts`: `orderedWeekdays(weekStartsOn)`
(6 → `[6,0,1,2,3,4,5]`, 0 → `[0…6]`); `WEEKDAY_SHORT` + `weekdayShort(weekday)` (so `repeat.ts:31`
and `SettingsChores.tsx:36` stop owning copies); move `MonthGrid`/`monthGrid(today, offset,
weekStartsOn)` from `features/calendar/MonthView.tsx:7-26` into lib (a `ui/` primitive can't
import from `features/`; fix the four importers). `weekOf` (83-88) is the week strip's days; don't
add a twin. Tests in `dates.test.ts` (`orderedWeekdays`; `monthGrid("2026-10-07", 0, 6)` → first
cell 2026-09-27, five weeks; with 0 → 09-28; across a year boundary).

*b. `calendar: custom repeats round-trip, and a rule we can't read is kept`.* `repeat.ts`:
`CustomRepeat { freq, interval, weekdays, monthlyBy: "date" | "weekday" }`,
`customToRepeat(custom, startDay)`, `repeatToCustom(repeat | null, startDay)` (null → weekly on
the start day), `isPreset(repeat, startDay)` (via `sameRepeat` over `repeatPresets`),
`monthDateWords`/`monthWeekdayWords` extracted from `describeRepeat` (256-262); `weekStartsOn`
(default 0) on `repeatToRRule`, `rruleToRepeat`, `describeRepeat`: write `WKST=SU` only when
`weekStartsOn === 6 && interval > 1 && weekdays.length > 1`, accept it back under the same rule,
list weekdays in `orderedWeekdays` order ("Sun and Mon" for a Sunday-first household); line 4's
docstring finally true. `EventEditor.tsx` `Draft` gains `kept: { rrule, text } | null`
(`draftFromEvent`: an unreadable rule keeps `event.rrule` and `event.repeat_text`;
`draftToFields`: `rrule: repeat ? repeatToRRule(…) : kept?.rrule ?? null`, so `fieldsFor` never
clears a rule the editor didn't touch). Tests: `repeat.test.ts` round-trips (interval 1–3 × each
freq × weekday sets × `monthlyBy`, ends never/until/count; WKST only when it matters; the day
order); `EventEditor.test.ts` (`kept` survives `draftToFields`; `FREQ=MONTHLY;BYMONTHDAY=15` on
an event starting the 9th → `repeat: null`, `kept` set).

*c. `ui: touch primitives for the editors`* (all `frontend/src/ui/`, tokens only, sizes by
`useShell()`):
- `lib/fit.ts` (pure) `fitRow(width, count, cells, gap) → { cell, scroll }`: the largest cell
  size whose row fits, else the smallest with `scroll: true`; `lib/useWidth.ts` (a
  ResizeObserver hook, 0 until measured). `fit.test.ts` with the numbers below.
- `ui/ScrollRow.tsx` `{ label, children }`: `role="group"`, one line (`flex overflow-x-auto snap-x
  *:shrink-0`), `data-overflow="start|end|both|none"` kept by a scroll listener, and `.fade-x`
  in `tokens.css` (a `mask-image` gradient with CSS keywords; the design-rules test scans only
  `*.ts(x)`).
- `ui/Stepper.tsx` `{ label, value, min = 1, max, onChange }`: two `Button icon` (56 px on the
  wall) named "{label}: less" / "{label}: more" around an `<output>` in `ui/Digits`.
- `ui/Segmented.tsx`: `SegmentOption.icon?`, and `stacked` (icon over a short label; cells
  `min-h-[4.5rem] min-w-[6.5rem]`, the group one line with `overflow-x-auto snap-x fade-x`, never
  wrapping: at 592 px five cells are ~113 px; a 358 px phone shows four and a half with the fade
  saying "scroll"). `data-segmented` keeps the a11y gap exemption.
- `ui/Avatar.tsx`: a `tap` size (56 px, `size-14`).
- `ui/WeekStrip.tsx`: `WeekStrip { days (the 7 from weekOf), value, today, min?, onChange }`: a
  `grid grid-cols-7 gap-1` (`data-segmented`), each cell a button named "Thu, Oct 8" (", today"
  appended) with the weekday short name over the day number in a `size-9` disc (`bg-sun` for
  today), `min-h-[4.5rem]` (phone 14), `aria-pressed`; arrow keys move focus on laptops.
  `WeekdayPicker { label, weekStartsOn, value: number[], onChange, minOne = true }`: the same
  cells in `orderedWeekdays` order showing only the names, multi-select, cells named "Monday"…
- `ui/MonthGrid.tsx` `{ value, today, weekStartsOn, min?, onChange }`: a month heading
  (`aria-live`) with Previous/Next month icon buttons, an `aria-hidden` weekday row, a
  `grid-cols-7` of 56 px cells (phone 44) named "October 8" (distinct from the strip's "Thu, Oct
  8", so no two buttons share a name), out-of-month cells in `text-ink-soft`, before `min` disabled.
- `ui/DayField.tsx` (replaces `ui/DayChooser.tsx`, deleted in T8) `{ label = "Day", value,
  onChange, today, weekStartsOn, min?, optional?: { label } (Item: "No day"), grid?: "closed" |
  "open" (Countdown: open), anchor? (Meal: the board's week), hint? }`: a `role="group"` with the
  label line and the week's span, the `WeekStrip`, then a row of `Previous week` · **Today** ·
  `Next week` · **Pick a date** (`aria-expanded`; the `optional` chip first when given) and the
  `MonthGrid` when expanded. The strip re-anchors when `value` leaves the shown week (the parser,
  a board tap). The wall never uses the native date input again; phones use the same grid (one
  code path, one set of names; 7 × 44 px fit 358 px).
- `ui/TimeField.tsx` `{ label, value, onChange, none: { label: "All day" | "Any time" } | null,
  suggestions, words?, pickLabel = "Pick a time" }`: the `none` chip, `timeChips(suggestions,
  value)` (`lib/times.ts`: the sorted union, so an odd value such as "10:30 AM" from a grid tap
  shows as a pressed chip in clock order; `EVENT_TIMES = ["09:00","12:00","15:00","18:00"]`;
  Task keeps its `TIMES`), and **Pick a time** (`aria-expanded`) opening the hour/minute picker
  moved from `EventEditor.tsx:526-582` (6 AM–11 PM with Earlier/Later, `:00 :15 :30 :45`; an hour
  tap with no value sets `HH:00`).
- `ui/PanelActions.tsx` `{ children }`: the sticky box from `EventEditor.tsx:445-449` (`sticky
  bottom-0 z-10 border-t border-line bg-surface`, `-mx-6 px-6 py-4` on the wall, `-mx-4 px-4
  py-3` in a phone sheet), inside each editor's `<form>` so `type="submit"` and the keyboard's ↵
  keep working; `bottom-0` is what the CLAUDE.md gotcha prescribes.
- `features/calendar/useBoardDay.ts`: `useBoardDay(boardDay, onDay)`, the `EventEditor.tsx:230-234`
  trick as a hook, so every editor takes a later board tap. `CalendarRoom.tsx:92-94`: `add()`
  keeps an open panel's `type` and `title`.
- RTL tests (jsdom; `ui/Button.test.tsx` is the pattern): `WeekStrip.test.tsx` (Sunday order,
  today's and the pressed cell, `min`, the picker keeps its last day), `MonthGrid.test.tsx`
  (heading, paging, outside-month cells), `TimeField.test.tsx` (an odd value pressed in clock
  order; Pick a time expands; an hour tap sets `HH:00`), `Stepper.test.tsx` (bounds),
  `Segmented.test.tsx` (stacked cells carry `aria-pressed`, icons hidden).

*d. `ui: the Who picker is one row`.* `ui/WhoPicker.tsx`: `everyoneLabel` ("Everyone"; "Anyone"
for Task, so `ChoreEditor.tsx:146-203` drops its hand-rolled copy); measure with `useWidth`;
wall `fitRow(width, count, [80·s, 72·s], 8·s)` (s = the root font size ÷ 16), phone
`[56·s, 48·s]`: 80 px cells carry `Avatar lg` (64 px), 72 px cells `Avatar tap` (56 px); phones
`md`/`sm`. The numbers at 592 px: six 80 px cells fit (520 px; seven would be 608), seven 72 px
cells fit (552), eight scroll. So Everyone plus the owner's five people keep 64 px avatars, a
seventh cell shrinks everyone to 56 px, an eighth makes the row a `ScrollRow`. A 358 px phone
fits five 56 px cells, six at 48, the seventh scrolls. Cells `flex: 1 1 {cell}px` (`0 0` when
scrolling), `min-w-0`, the name `truncate` under the avatar, the full name as the button's
accessible name; `role="group"`, `aria-pressed`, `data-person` as today. Users unchanged
(`EventEditor.tsx:355-363`, `AddItem.tsx:106-113`, `MealEditor.tsx:197`, `CountdownEditor.tsx:121`,
`SettingsChores.tsx:284-293`, Who did it?).

*e. `calendar: the Repeats field, with Custom…`.* `features/calendar/RepeatField.tsx` `{ label =
"Repeats", day, value, repeatEnd, kept, weekStartsOn, presetKeys?, onChange }`: a `ChipRow` of
the kept chip ("As it is: every 2 weeks on Tue", pressed) when `kept`, the presets
(`repeatPresets(day)` filtered by `presetKeys`; Task passes `none, daily, weekdays, weekly,
biweekly, monthly-date`), and **Custom…** (`aria-expanded`, pressed when the value isn't a
preset). The custom panel: "Every" `Stepper` 1–99 beside `Segmented` Day · Week · Month · Year;
`WeekdayPicker label="On"` when weekly; `Segmented` "On the 9th · On the second Thursday" when
monthly. **Ends** (whenever the value repeats): Never · On a date (a `MonthGrid min={day}`
seeded at +90 days) · After N times (a `Stepper`, seeded 10). The sentence under it from
`describeRepeat` or "Doesn't repeat". Picking anything sets `kept: null`.

**Tests.** The vitest files above. e2e comes with T8.

**Docs.** With T8.

### T8 Add: one form per type

- [x] Done (commits: "calendar: the Add panel's type row and the event form as rows", "lists,
  meals, countdowns: their Add forms as touch rows", "chores: the Task form, with a day, a time
  picker and custom repeats")

**As built (T7 and T8).**
- `WKST`: written and read by `weekStartMatters` (the weekdays straddle the household's first
  day), not "two or more weekdays": the plan's rule would have made "every 2 weeks on Tue and Thu"
  unreadable in a Sunday-first household.
- `COLORS` is in `lib/colors.ts` (the plan named both `lib/` and `ui/`); every picker imports it.
- The Who picker keeps wrapping in one place, "Who did it?" on the Tasks board (`wrap`): in a
  board column a sideways row hid people. Its names are 18 px so "Everyone" fits a shared cell.
- `DayField`'s "No day" is `optional={{ label, onChoose }}`. The event sheet's Move uses it too.
- Ends reads "Never · On a date · After 10 times" (the count in the label, a stepper under it).
- Found by the screenshots and fixed in T8a: a field in the wall's panel counted the keyboard
  twice when scrolling into view (the row of kinds was pushed off the top on focus); the panel
  kept the scroll position of whatever it showed before; a sliver of form showed under the
  pinned button; a picker opened under the pinned button (`lib/reveal` scrolls it into view).
- A new task defaults to **Anyone** (the plan's "Anyone is a real default"); it needed a pick
  before. A task's rule and start day go back to the server only when touched.
- Native inputs left: a person's birthday (Family) and the sleep and dim times (Display).

**Build, in three commits.**

*a. `calendar: the Add panel's type row and the event form as rows`.*
- `features/registry.ts:49-57`: `AddType.icon: LucideIcon` (required); `lists/index.ts:24`
  `ListChecks`, `chores/index.ts:26` `SquareCheckBig`, `meals/index.ts:27` `Utensils`,
  `countdowns/index.ts:24-26` `Hourglass` (the rooms' own icons, so Add mirrors the rail); Event
  `CalendarDays`. `AddPanel.tsx:115-131`: the `ChipRow` becomes `<Segmented stacked label="What to
  add">` over `[Event, …types]`; cells are `aria-pressed` buttons named by their label, so
  `countdowns.spec.ts:55` and `a11y.spec.ts:427-458` keep working.
- `EventEditor.tsx`, the rows always visible, pickers and chips (49-50, 288-297, 323-442) gone:
  1. `TextField` "What, when, who" ("Title" when editing), `data-autofocus`; the hint is the
     example line, but once the parser has taken words out of the title it reads `Saved as
     "Dentist"`, so the result is visible without the "Understood as" block (deleted).
  2. `WhoPicker label="Who" multiple`.
  3. `DayField label="Day"`; when all-day, a small "Last day" row: **Same day** · **Another day**
     (a `MonthGrid min={day}` → `lastDay`), replacing the native input at 502-521.
  4. `TimeField label="Time" none={{ label: "All day" }} suggestions={EVENT_TIMES}` (`null` →
     all-day; a value → `allDay: false, start`).
  5. How long (hidden when all day): the `LENGTHS` chips as today (341-353).
  6. `RepeatField` with `repeat`, `repeatEnd`, `kept`.
  7. Calendar chips only with 2+ writable calendars (366-379).
  8. Color chips (380-404) from `lib/colors.ts` (T11 moves `COLORS` there; do it here if T11
     hasn't run, and T11 adopts it).
  9. **More…** (`aria-expanded`) revealing Where, Notes, Remind (405-441), open by default when
     editing an event that has any of them.
  10. `<PanelActions><Button type="submit" block>Add event | Save changes</Button></PanelActions>`.
  The draft already resolves `manual ?? parsed ?? default` per field (240-255) and `set()`
  writes `manual` (256-258): a row set by hand keeps winning over later typing, and anything the
  parser fills is one tap to change. A grid tap's `defaultMinute` (236-239) shows as "10:30 AM"
  pressed in clock order.
- e2e: `calendar.spec.ts:62` asserts the pressed chips inside the groups "Day", "Time", "How
  long", "Who" and the `Saved as "Dentist"` hint instead of the sentence; `hours.spec.ts:114-116`
  scopes "Fri, Oct 9" inside group "Day"; `a11y.spec.ts:373-376` adds the time picker ("Pick a
  time"), the custom repeat ("Custom…") and the month grid ("Pick a date") runs;
  `screenshots.spec.ts:170-175`: `add-quick` → `add-event`, keep `add-time`, add
  `add-custom-repeat` and `add-pick-a-date`.

*b. `lists, meals, countdowns: their Add forms as touch rows`.*
- `lists/AddItem.tsx`: What · Which list · Who (single) · `DayField optional={{ label: "No day"
  }}` (replacing 115-141 and `label()` 42-43) · `PanelActions` ("Add item" / "Add N items");
  `useBoardDay`.
- `meals/MealEditor.tsx`: Saved meals (a wrapping `ChipRow` with the search as today) · Or type a
  new meal · `DayField anchor={weekStart}` (replacing `DayChooser` at 172-176) · Which meal (2+
  slots) · Who cooks · the Groceries switch · `PanelActions` ("Add dinner" keeps
  `meals.spec.ts:40-42` green); `useBoardDay`.
- `countdowns/CountdownEditor.tsx`: What · `DayField grid="open" min={yearly ? undefined : today}` ·
  Whose · Emoji as a `ScrollRow` · Color · Every year · Show on the kitchen screen ·
  `PanelActions`; `useBoardDay`. (The API's countdown `time` stays unset; a time here is a
  follow-up.)
- Delete `ui/DayChooser.tsx`. Optional if time allows: `EventSheet.tsx:252-300` `MovePicker` →
  `DayField` (UX §4 promised "chips plus a month grid").

*c. `chores: the Task form, with a day, a time picker and custom repeats`.*
- `chores/ChoreEditor.tsx`: state `title`, `members` ([] = Anyone) + `turns`, `day` (seeded
  `startDay ?? today`, or `chore.start_date`), `time`, `repeat`, `repeatEnd`, `kept` (from
  `rruleToRepeat(chore.rrule, chore.start_date)`, else `{ rrule, text: chore.repeat_text }`;
  replaces `initialPreset`/`repeatKey` at 58-74), `points`. Rows: What · `WhoPicker label="Who"
  everyoneLabel="Anyone" multiple` + "Each does it / They take turns" with 2+ (204-216) · `DayField
  label="Day"` (new; `fields()` keeps `first = firstDayOf(repeat, day)`, 81) · `TimeField
  label="Due" none={{ label: "Any time" }} suggestions={TIMES} words={t => `by ${clockText(t)}`}`
  (replacing 218-244 and the inert odd chip 240-242) · `RepeatField presetKeys` with Custom ·
  Stars chips (271-289) · `PanelActions` "Add task" / "Save changes". `ready = title.trim() !==
  ""` (Anyone is a real default). `repeatChanged` (105) compares the RRULE strings.
- `SettingsChores.tsx:295-312`: the Routine "Days" chips → `WeekdayPicker label="Days"
  weekStartsOn` (values stay 0 Mon…6 Sun); delete the local `DAYS` (36).
- e2e: `screenshots.spec.ts:510-511` → "Task", shot `add-task`; `a11y.spec.ts:446-448` → "Task";
  a `chores.spec.ts` test: Add → Task → Custom… → every 2 weeks on Tue and Thu (the picker in
  Sunday order) → Add task → the week shows the row on both days (a custom rule reaches the
  server and back); the Who row with a fifth person added (`POST /api/members`) stays on one
  line: six cells' `boundingBox().y` are equal on display-1080p and the avatars are 64 px.

**Phones.** The same forms inside `ui/Sheet` (the sheet body scrolls, `Sheet.tsx:127,145-153`), the
button in the thumb zone through `PanelActions`, the phone's own keyboard; the `MonthGrid` on
phones too (no native date input left).

**Risks.** Extra large: the panel is 40rem so it scales (~832 px) and six Who cells still fit;
verify portrait's `h-[66dvh]` panel at XL with the keyboard up (scroll, the button visible). The
keys cover the Day strip while typing (the field and Who stay visible; the scroller's `pb` and
`scroll-pb` let a scroll reach it; don't auto-scroll on parse). Two buttons never share a name
("Thu, Oct 8" is the strip, "October 8" the grid). `useWidth` reads 0 inside a closed dialog:
`fitRow` treats 0 as "largest, no scroll" and re-measures on open. Panel titles stay Title Case;
chips and row labels sentence case ("Pick a date", "Which list", "Custom…").

**Docs.** UX §4: redraw the Add wireframe (the type row with icons, then What · Who · Day strip ·
Time · How long · Repeats · Calendar · Color · More… · the pinned button), replace the chips
paragraph (278) with the rows and the precedence rule, describe the Who row (one row, 64 → 56
px, then scroll), the Day strip (the household's order, ‹ ›, Today, Pick a date → the month
grid; the wall never uses the native date input), Time (chips plus Pick a time), Repeats
(presets, Custom…, Ends, "As it is" for a rule the presets can't read); rewrite "The Add panel
for other things" (280) per type; "The Who picker" (411). UX §5's phone editor wireframe (480-503).
UX §2 glossary **Task** and the toast line "Add task → Added Feed the dog"; §8 row 696; §10
("the Who row never wraps; the type row is one row; the Day strip starts on the household's
day"). ADR 0029 rows (the type row; one form per type; the Who row rule; the strip and grid over
the native input; the time field; Custom repeats, kept rules and `WKST`; the pinned button).
CHANGELOG: Added (custom repeats: every N days, weeks, months or years, on the days you pick,
ending when you say; a week strip and a month grid to pick a day; a time picker for a task's Due;
a start day for tasks), Changed (Add: one row of types with icons, a form per type with every
choice on its own row, Who always on one line, the button always above the keyboard).

### T9 Settings save themselves; Features declutters

- [x] Done (commit: "settings: they save themselves; Features declutters; Google's keys in a sheet")

**Owner's notes.** "Settings: Many cards have their own independent 'Save Changes' button. Can we
remove all the Save Changes buttons and save as the user is making changes to the app instantly?"
"Settings→Features: Synced Calendar's Google app's client ID/secret should be behind a Google
configuration button or area (in an attempt to declutter the main Features page)."

**What saves by button today** (the explorer's list): every plugin form ("Save changes",
`PluginSettingsForm.tsx:90-94`, shown on Features and again on the Tasks, Meals and Photos &
Screensaver pages, each copy with its own unsaved draft); Household "Save name" / "Save time
zone" (`HouseholdPage.tsx:64-70,96-98`); Display "Save times" / "Save time" for the sleep and dim
times (`DisplayPage.tsx:214-220,261-267`). Everything else on the core pages already saves on
change. Sheets keep their buttons (Decisions).

**Build.**
- `PluginSettingsForm.tsx`: no draft, no button. Controls bind to the server's values
  (`usePlugins()`); every change calls `PUT /api/plugins/{id}/settings` with the whole values
  object through a mutation that sets `qk.plugins()` optimistically and invalidates on settle
  (`asParent` as today). bool, choice, multichoice, color, member save at once; string, int,
  float, percent, text, json, time, date and secret fields keep a per-field draft and save on
  blur or ↵ when changed and valid, then show `SavedMark` (T3). A 422 lists its problems under
  the field as today; any other error toasts "Not saved — {message}" and the control reverts.
  Update `PluginSettingsForm.test.tsx` (a switch PUTs at once; a field PUTs on blur; a failure
  reverts).
- `FeaturesPage.tsx:66-104`: for a plugin whose module has `settingsPages` (chores, meals,
  screensaver), render the switch, the description, and a `ListRow` "Tasks settings" (the page's
  title) linking to its page instead of the form. The page itself keeps its form (now autosaving).
  `screensaver`'s page already has its photo sources; `meals` and `chores` pages become the only
  place for their fields.
- Google's keys: `FeaturesPage` special-cases nothing. The calendar_sync frontend module adds a
  `settings.features` slot (new in `registry.ts`, beside `settings.accounts`) that renders, under
  its switch, the row **Sign in with Google** ("Not set up" / "Keys saved", a **Set up** /
  **Change** button) and the sheet **Google App Keys**: the two fields, the hint "Only for Sign in
  with Google. Settings → Calendars & Accounts explains it.", **Save keys** (`PUT` the plugin
  settings) and **Remove keys**. A `secret` can't be cleared today (clearing sends `"***"`, which
  keeps the old value, `plugins/spec.py:94`): send `""` and have `spec.py` treat an empty string
  as "clear", with a test. The generic form skips the fields whose `group` ("Sign in with Google",
  already set in the spec) the module draws itself (`PluginSettingsForm` gets a `skipGroups`
  prop). `AddAccount.tsx:830` points at the row.
- The export leak: `backend/src/sunroom/db/export.py` masks `secret` fields of
  `plugin_state.settings_json` through each manifest's `masked()` (`plugins/spec.py:121-127`);
  `backend/tests/test_export.py` asserts the Google client secret never appears in the export.
- `HouseholdPage.tsx`: the Name field saves on blur or ↵ (unchanged or empty does nothing); the
  Time zone select saves on change; both show `SavedMark`. `DisplayPage.tsx` Sleep: "From" and
  "Until" save together when both hold valid times, on blur of either; with one empty, the hint
  reads "Set both times."; "Dim from" saves on blur. Remove the four buttons.

**As built.** The backend already cleared a secret sent as `""` (`coerce_params` turns an empty
value into null before the mask check); only the frontend kept it by sending the mask, so the
spec needed a test, not a change. Core settings are optimistic too (`useUpdateSettings`), so every
switch on every page moves at once and reverts with the same "Not saved — …" toast; the pages'
own error lines are gone. The module names the spec groups it draws (`ownSettingGroups`) beside
its `settings.features` slot. The export gives a plugin the build doesn't know empty settings.
Sleep's hint reads "Set both times." or "Pick two different times.".

**Tests.** e2e `shell.spec.ts` (a phone changes Lists' Clear completed items and the wall's
`GET /api/plugins` shows it within 3 s with no button; Household's name saved on blur);
`sync.spec.ts` (the Google keys sheet saves and masks; Remove keys clears);
`screenshots.spec.ts:594` (the meals PUT) and the Features/plugin page shots; backend
`test_export.py`, `tests/plugins/test_contract.py:67-105` (settings defaults still round-trip),
`tests/sync/test_google_accounts.py:105-156`.

**Docs.** UX §4 Settings table (Features row: "a row that opens the feature's own page"; the
Google keys sheet), UX §1 "Undo, drafts, confirmations" (settings save themselves; sheets keep
Save); PRIVACY.md if it describes the export. CHANGELOG: "Settings save as you change them; the
Save changes buttons are gone (a person's, a calendar's and an account's sheets still have Save)."
"Sign in with Google's keys live behind a Set up button on Features." "Export everything no longer
includes Google's client secret."

### T10 Settings: the words and the options

- [x] Done (commit: `settings: shorter words and options; a calendar switch per meal`)

**As built.** The Theme hint reads the household's latitude and longitude, the same test
`lib/sun` makes, rather than `location_label`. The calendar orders a day's all-day chips by name
(`occurrences.sort_key`), so the meals overlay keeps its plain order by day and position.
`Group`'s title became optional for the Meals page. The 0.8.0 fixture database carries Meals
1.1.0's settings and the 15-minute start, and a manager test boots 0.7.0's database under this
release's plugins. UX §4's Settings table gained rows for the Tasks and Meals pages.

**Owner's notes.** The Lists, Photos & Screensaver, Weather, Tasks, Meals and Display items in the
table above, plus "Settings->Display->Theme: Remove the '(7 PM until a location is set)' when a
location is set".

**Build** (every ParamField change is in the plugin's `plugin.py`; the generic form draws it):
- Lists `auto_clear_days` (`plugins/lists/plugin.py:27-35`): label "Clear completed items after",
  choices `never` "Never", `1` "1 day", `3` "3 days", `7` "1 week"; keep the help.
- Photos & Screensaver (`plugins/screensaver/plugin.py:28-57`): `start_after` choices `never`
  "Never", `5` "5 min", `15` "15 min", `30` "30 min", `60` "1 hour", default `"15"` (the 60
  value must reach the saver: `screensaver/service.py:89-100` already passes minutes through;
  check `Saver.tsx:49-59` for a cap); `every` choices `15` "15 s", `30` "30 s", `60` "1 min",
  `120` "2 min", `300` "5 min"; `shuffle` loses its help. `backend/tests/screensaver/test_api.py:71-105`.
- Weather `units` (`plugins/weather/plugin.py:26-34`): label "Temperature unit", choices `auto`
  "Auto", `fahrenheit` "°F", `celsius` "°C", help "Auto: °F in the United States, °C elsewhere,
  going by the household's time zone." `tests/weather/test_forecast.py:274-357`.
- Meals (`plugins/meals/plugin.py:32-48`): `calendar_slots` multichoice (breakfast, lunch, dinner,
  snack; default `[]`) replaces `show_on_calendar`; the overlay (`meals/service.py`) draws the
  chosen slots. A general hook: `PluginBase.upgrade_settings(self, raw: dict, from_version: str)
  -> dict` (`plugins/base.py`, a no-op by default) that the manager calls where it already
  notices a stored `plugin_version` behind the manifest's (`plugins/manager.py:251-252`), on the
  raw JSON before `_coerce_stored` (351-366) drops unknown keys; meals bumps to `1.1.0` and maps
  `show_on_calendar: true` to `calendar_slots: ["dinner"]`. `docs/PLUGINS.md`'s settings rule
  gains the sentence. `features/meals/SettingsMeals.tsx` becomes bespoke: the "Which meals" chips, then
  one `Switch` per **enabled** slot, "Show breakfast on the calendar" … (saving `calendar_slots`),
  and the first group heading goes (the page's title already says Meals: M6.md's follow-up).
  Tests: `tests/meals/test_entries.py:93`, `meals/helpers.py:160`, a manager test for the hook,
  e2e `meals.spec.ts` (two slots on → two switches; dinner's chip shows).
- Tasks: `SettingsChores.tsx:513` group title "Stars".
- Display (`DisplayPage.tsx`): the Theme hint is "Auto turns dark at sunset and light at sunrise."
  when `settings.location_label` is set, else "Auto turns dark at 7 PM until a location is set in
  Household."; Daylight tint hint "The background warms through the day: cool in the morning,
  golden in the afternoon, rosy at dusk. Off keeps the midday shade."; "Return to the calendar
  after" options Never · 2 min · 5 min · 10 min (Never first); the Sleep group's "How dim" row
  becomes "Brightness" with 60% · 40% · 20%; Text size Small (T2); "Rail side" hint "Where the
  rooms sit, for a screen hung to one side."

**Tests.** `screenshots.spec.ts` PAGES shots; `a11y.spec.ts` Settings loops; e2e assertions that
name the old labels (`screensaver.spec.ts:119-140`, `lists.spec.ts`).

**Docs.** UX §4 Settings table (every row named above), §4 Photos room ("start after 5, 15, 30
minutes, an hour or Never; change every 15 s … 5 min"), §1 "Idle, wake and reset" (default 15
minutes). CHANGELOG lines: one per visible change, family voice ("Photos start after 15 minutes
by default now; a screen set to 10 minutes starts after 15 until you pick another.").

### T11 Settings: rows you tap, the account sheet, Recently Removed's own page

- [x] Done (commit: `settings: rows you tap, an account's sheet, Recently Removed's page`)

**As built.** The account sheet is one sheet with pages (the account, a calendar, connect again,
the Remove question) through `Sheet`'s `step`, not a sheet over a sheet. `ColorPicker` writes
whose a taken color is under its word ("Mia's"), since the cells are narrow, and serves the three
sheets; `CountdownEditor` and the event form keep their one-row chips from T8, where a taken color
means nothing. Synced calendars were never listed under Calendars (only the household's own are),
so no "From iCloud" row was needed there. A helper account whose key stopped working says to
remove it and add it again: the server has no route to replace a key in place. `COLORS` stays in
`lib/colors.ts` (T8).

**Owner's notes.** "Settings->Family: Rename 'Change' to 'Edit' with an icon for the People. Or
remove the button and make the item clickable to edit them." "Settings->Calendar &
Accounts->Calendars: Same change as the People… It should be the same throughout the whole app."
"Settings->Calendar & Accounts->Accounts: Users should be able to edit the accounts like they can
with Calendars. If there are no settings for added accounts, there needs to be the option to
remove an account which I do not see on desktop. If the account has Calendar(s) to Sync, they
should be listed in a subsection labeled 'Sync' with the on/off toggle. If there are connected
displays the 'Show on the <display name>' toggle should be in another subsection underneath the
Sync list." "…Accounts: If an account is added (i.e. Holidays) and it shows a color picker (if it
is assigned to Everyone) show the unused colors first, and ones used by family members last."
"Settings->Household: The 'Recently removed' section should be somewhere else."

**Build.**
- Rows (`ui/ListRow`, T3): Family's people (`FamilyPage.tsx:45-81`: the row opens `MemberSheet`,
  titled "Edit Mia"; the "Change" button goes); local calendars (`CalendarsPage.tsx:87-93`: "Edit
  Kids' activities"; a synced calendar's row says "From iCloud" and opens the account sheet);
  accounts (`AccountsSection.tsx`: the row shows the label, the source and the status line);
  Rewards and Routines on the Tasks page (`SettingsChores.tsx`, `RewardsPage.tsx:413`); Phones &
  Screens stays (its rows carry actions, not an editor). Sheet titles: "Edit …".
- `ui/ColorPicker.tsx`: the radio grid used by `MemberSheet.tsx:183-216`, the calendar sheet
  (`CalendarsPage.tsx`), the account's calendar sheet and `CountdownEditor`: props `{ value,
  onChange, used: Record<color, string> }` (name by color); **unused colors first**, then the used
  ones each with "· Mia's" in `text-ink-soft`; a member's own color isn't "used" for themselves.
  `COLORS` lives once, in `ui/colors.ts` (today in `MemberSheet.tsx:21-30` and duplicated in
  `EventEditor.tsx:31-40`).
- `features/sync/AccountSheet.tsx` (replaces the inline `CalendarRow`s, `AccountsSection.tsx:273-365`):
  title "Edit iCloud" (the account's label); the status line; **Refresh now** (or **Connect
  again** / **Sign in again**: Google accounts that signed in or use the helper need `google/start`
  or a new key file rather than a password, M6.md's follow-up); **Sync**: one row per remote
  calendar: the name (a button that opens the calendar's sheet) and a `Switch` for `mapped`
  (read-only accounts: the hint "Shows events only"); **Show on Kitchen** (the paired screen's
  name from `GET /api/auth/devices` kinds `kiosk` not revoked; "Show on the Screens" with several;
  the group is absent with none): a `Switch` per synced calendar for `visible_on_display`;
  **Remove account** (danger, at the bottom) with today's confirmation sheet, reworded "Remove
  iCloud?" / "Remove iCloud" / "Keep it". The calendar's sheet ("Edit School"): **Whose** chips,
  **Color** (`ColorPicker` with unused first; only when Whose is Everyone, as today). Every
  switch saves at once (`PUT …/calendars/{rid}`); the sheet keeps no draft.
- Recently Removed: `pages.ts` adds `removed: "Recently Removed"` after `devices`;
  `SettingsScreens.tsx:23-32` maps it; `HouseholdPage.tsx:130` drops it; the page is
  `RecentlyRemoved.tsx` as is; `tips.ts` tip 9 reads "Settings → Recently Removed keeps it for 7
  days."; the phone's Settings index lists it.

**Tests.** e2e `a11y.spec.ts:23-34` (the SETTINGS list gains "Recently Removed"; the loops that
tap "Change Mia" / "Change Kids' activities" become "Edit …" rows), `calendar.spec.ts:156-161`
(Put back from the new page), `calendar.spec.ts:218-231` (the sheet's title), `sync.spec.ts:173-240`
(the account sheet: Sync switches, Whose, the color order with a fifth person added so "Red" is
used: the first chip is an unused color; Show on Kitchen appears once the wall is paired and
toggles `visible_on_display`; Remove account), `first-run.spec.ts:151-163`, `shell.spec.ts:51-58`,
`screenshots.spec.ts:30-42` (PAGES gains `removed`; `settings-calendars-account` shows the sheet).

**Docs.** UX §4 Settings table (Family, Calendars & Accounts, Household, the new Recently Removed
row), UX §6 "Connect an iCloud calendar" (the sheet), §8 (Recently Removed, empty). CHANGELOG
lines in the family voice.

### T12 Erase everything

- [ ] Done (commit: )

**Owner's note.** "Add a setting to 'reset' the app which would clear all data, settings, etc and
start fresh. Confirmation is required before it wipes the data, and asks if the user wants to
backup first. This should only be an option using a browser or phone. A connected screen
shouldn't have this option in case kids accidentally hit the button."

**What exists.** Only the test-mode `POST /api/_test/reset` (`meta/testing.py:52-114`), which
deletes every plugin table, events, calendars, members, devices, join codes, the allowlist, kiosk
panels, photos and the household, recreates "Home" and the household row, nulls the password,
bumps `auth_epoch`, clears the photo folder, in-memory auth, limiters, caches and streams, but
leaves `plugin_state` (M6.md's follow-up). Backups: `db/backup.py` (verified copies);
`GET /api/admin/backups/full.zip` (the Download everything zip); `docs/RESTORE.md`.

**Build.**
- Backend `meta/erase.py` (core): `erase_everything(state)` shared by the test reset (which keeps
  its seed and clock extras): 1. a verified backup to `backups/pre-erase/sunroom.<stamp>.db` (the
  nightly rotation never touches that folder); 2. under the write lock, every table emptied in
  dependency order, `plugin_state` included (then the manager re-inserts the defaults and
  restarts each plugin: `manager.py:234-259`, a new `reset()`), the household row recreated with
  defaults and `onboarded_at` NULL, "Home" recreated, `password_hash` NULL, `auth_epoch + 1`,
  `weather_cache` emptied; 3. the photo files under `photos/library`, `thumbs` and `avatars`
  deleted (`photos/inbox` untouched); 4. in memory: auth caches, limiters, the occurrence LRU,
  `setup_complete` false, every stream dropped with `session.expired`. The route
  `POST /api/admin/erase {password}`: `ParentDep`; 403 "Erase everything from a phone or
  computer." for a kiosk device; the password checked like login (the login limiter applies; a
  wrong one: "That password didn't match. Try again."); answers `{"ok": true}`. `sunroom erase`
  in the CLI is not needed (restore covers the server-side case).
- Frontend `features/settings/BackupPage.tsx`: a last group **Start Over**, note "Erase everything
  Sunroom knows and set it up again from the start. Only from a phone or computer.", button
  **Erase everything…** (`quiet-danger`), hidden when `session.device_kind === "kiosk"` (the
  device kind, not the shell: a laptop's browser shows it). Also decide the page's downloads by
  the device kind (today the shell: `BackupPage` hides Download backup / Download everything on
  laptops too; the explorer flagged it). The sheet **Erase Everything?** in two steps: 1. "Keep a
  copy first?" with the text "This removes every person, calendar, event, list, task, meal,
  countdown, photo and setting, and signs out every phone and screen. A copy of today's database
  stays on the server in backups/pre-erase, but photos are deleted for good." and the buttons
  **Download everything** (the zip, then "Downloaded. Continue once it's saved.") and **I have a
  copy**; 2. a field "Household password" (`layout="password"`) and the buttons **Erase
  everything** (danger) / **Keep everything**. After a 200: `reloadFresh()`; the phone lands on
  the setup wizard (`setup_complete: false` redirects there, `router.tsx:68-75`), and every wall
  shows the Welcome screen with its code.

**Tests.** Backend `tests/test_erase.py`: a kiosk gets 403; a wrong password 403 and the limiter
counts it; the right one empties every table except `household` (defaults, `onboarded_at` NULL),
`app_meta` (epoch bumped), `alembic_version` and `calendars` ("Home" only); `plugin_state` is
back to defaults and the plugins run; the pre-erase file exists and passes `inspect`; the photo
files are gone and `inbox/` is not; the old session is invalid; `GET /api/setup/status` says
not complete; the hub published `session.expired`. Frontend vitest for the two-step sheet. e2e
`first-run.spec.ts` (desktop): Settings → Backup → Erase everything… → I have a copy → the
password → the setup wizard appears; a second page on the wall shows "Set Up Sunroom on Your
Phone"; the kiosk project: the Start Over group is absent.

**Docs.** UX §1 (the confirmation list already names "erase all data"), §4 Backup row, §5;
`docs/RESTORE.md` (the `pre-erase` folder, and that a restore brings everything back);
PRIVACY.md ("Erase everything" under what you can delete). ADR 0029 row. CHANGELOG: "Settings →
Backup → Erase everything starts Sunroom over, after a backup and your household password. Not
from the kitchen screen."

### T13 Settings reach every screen at once

- [ ] Done (commit: )

**Owner's note.** "After settings have been changed, any paired screen should show the changes
immediately. A refresh shouldn't be required, if it is let me know why, and give some
recommendations."

**What's true today** (the explorer's trace). Every core setting reaches the wall through
`settings.changed` → `useSettings` refetch → render, with no reload: theme, text size, rail side,
home view, week layout, tips, dim, sleep, time format and zone, week start, location, return
minutes, sounds, dim past, child-safe editing. What lags: **plugin settings**. `plugins.changed`
invalidates only `["plugins"]` and `["occurrences"]` (`lib/eventRouter.ts:68-72`), so the
screensaver manifest (`start_after_minutes`, `every_seconds`, shuffle: `screensaver/data.ts:32-39`,
staleTime 5 min), the Tasks board's `stars_on`/`rewards_on`, Meals' slots and Countdowns'
birthdays catch up only when their query goes stale. Two more gaps: the kiosk remounts
`DisplayShell` between `/display` and the rooms, and each remount opens a new stream with no
position (`lib/events.ts:101`), so an event published in that gap is never replayed; and
switching a plugin on or off re-keys the `plugin-modules` query with no placeholder
(`usePluginModules.ts:23-43`), so rooms, Today blocks and Settings pages blink out and back.

**Build.**
- `lib/eventRouter.ts`: `plugins.changed {id}` also invalidates the plugin's own keys
  (`lists`, `chores`, `meals`, `countdowns`, `screensaver`, `weather`, `calendar-sync`; unknown id →
  everything). `eventRouter.test.ts:39-42`.
- `lib/events.ts`: the last position lives in a module-level store so a new `LiveUpdates` (a
  shell remount) reconnects with `?since=` and gets the replay (`events/hub.py:106-108` already
  serves it). `events.test.ts`: a second client after seq 5 asks for 5.
- `usePluginModules.ts`: `placeholderData: keepPreviousData`.
- `Saver.tsx:49-59`: confirm the idle timer re-arms when `start_after_minutes` changes (an effect
  keyed on it); `every_seconds` is already live.
- Settings pages re-read the server's values (T9 removed the drafts), so two phones never fight.
- Then the report for the owner (in the final report and in UX §1 "Speed, live, offline"): after
  this task no setting needs a refresh. The only reload is the version update, which the screen
  does by itself (0.7.0). The `?dimmer=` choice is the launcher's, not a setting.

**Tests.** e2e `shell.spec.ts`: a phone saves the screensaver's Start after and the wall's
`GET /api/screensaver/manifest` is refetched within 3 s (watch the request); a phone turns Meals
off and on while the wall is on Lists: the rail never loses its Meals room for a frame
(`page.locator` polling at 50 ms, or assert via the modules query's placeholder in vitest);
drop the streams while on a room, then PATCH a setting during the reconnect gap (`_test/drop-streams`
followed at once by a PATCH): the wall shows it within 3 s.

**Docs.** PLAN §11.5 (`plugins.changed` invalidations; the stream's position across remounts),
UX §1. CHANGELOG: "A setting changed on a phone shows on the kitchen screen at once, the
screensaver's timing and the Tasks board's stars included."

### T14 Motion: what moves, and why

- [ ] Done (commit: )

**Owner's note.** "Currently, the app has little to no animations/motion… Please take some time to
plan some animations for the user while using the app."

**The rule stays** (UX §7, §9): motion answers what someone did; nothing animates on first paint,
a room switch or a wall-tint change; `prefers-reduced-motion` and Settings → Display → Reduce
motion make everything instant; transforms and opacity only (a Pi 4 must keep up). Each item
below names its mechanism: CSS in `styles/motion.css` (tokens exist: `--motion-enter` 220,
`-exit` 180, `-glide` 400, `-celebrate` 600, `-crossfade` 600, easings `--ease-arrive`, `-leave`,
`-standard`, `-overshoot`), `motion` under the existing `MotionProvider` (exits and moves between
layouts), or the canvas.

**Build, in this order (one commit each where it's more than a class):**
1. **Chips arrive.** A chip whose key wasn't on the previous render fades and grows from 96 %
   (`--motion-enter`, `--ease-arrive`): a `useArrivals(keys)` hook (`lib/arrivals.ts`) returns
   the new keys, and `EventChip`/`HoursChip`/the Day and People chips get `data-arrive` → a
   `@starting-style` rule in motion.css. Nothing on mount (the hook starts with the first keys).
   Week, Day, Month, People, Agenda and Hours, the phone's lists.
2. **Chips leave.** Agenda and Hours columns wrap their chips in `<AnimatePresence
   mode="popLayout" initial={false}>` with `exit={{ opacity: 0, scale: 0.96 }}` (180 ms); the
   neighbours close the gap with `layout`. Check `FitList`'s measuring with popped chips; if it
   fights, keep arrivals only and say so.
3. **Paging slides.** The board's body (Week, Day, Month, People, Meals' week, the phone
   Calendar) gets `data-page="prev|next"` for the render after an arrow, This Week or a swipe,
   and a `.page-slide` keyframe (translateX ∓1.5rem → 0 and fade, `--motion-enter`). Not on mount,
   not on a view switch.
4. **Count pops.** `useChangeCount` + `.pop` (`ChoreBoard.tsx:124-125,142` is the model) on the
   Today panel's "2 of 3" lines, the Lists tiles' counts ("4 to get"), the Stars balances
   (Rewards strip and the Tasks columns), and the list detail's "12 to get". The countdown
   tiles' day number rolls vertically when it changes (`.roll`, 400 ms).
5. **The done row folds.** The Tasks board column and the list detail become `motion.ul` with
   `motion.li layout` rows under `AnimatePresence`, so a checked row glides into Done (UX §7's
   900 ms step; today `ChoreBoard.tsx:90-99` jumps after `FOLD_MS`, `ListItems.tsx:21,97` after
   600 ms). Undo glides it back. `layout` uses transforms only.
6. **Now lines.** Agenda's `NowLine` becomes `motion.div layout` (400 ms, `--ease-standard`) so
   it drops to the next slot when an event ends; the Day view's now line gets the Hours grid's
   `.now-minute` 60-second creep (`DayView.tsx:102-112`). `settled()` already ignores the minute
   glide.
7. **Quiet crossfades.** `.bg-lit` day columns and rows transition `background-color` over
   `--motion-crossfade` (midnight's lit column moves); Night fades out over `--motion-exit`
   (`shell/Night.tsx:33` holds the element like `Sheet`'s close); the skeleton gets a slow
   shimmer (`tokens.css:438-451`, 2 s, none under reduce motion).
8. **Routine steps.** `RoutineRunner.tsx:181`: the old step slides left while the new enters from
   the right (`AnimatePresence mode="popLayout"`).
9. **The shell.** The rail's width and the Today panel's width transition over `--motion-enter`
   (T5 does the rail; the panel toggle here); the keyboard already slides.

**Reduce motion.** The two CSS blocks (`motion.css:342-375`) already zero every transition and
animation; add `animation: none` for the shimmer and the roll; `MotionProvider` is `"always"` on
the wall when the setting is on; the `@starting-style` rules sit under `:root:not([data-reduce-motion])`
and `@media (prefers-reduced-motion: no-preference)`.

**Tests.** Vitest: `arrivals.test.ts` (first render → none; a new key → that key; a removed key →
nothing), `useChangeCount` users. e2e (`calendar.spec.ts`, display-1080p): with motion on, adding
an event from a phone gives the wall a chip with `data-arrive` and the a11y project (reduced
motion) never sees it; the CSP guard stays green with `AnimatePresence` on the board (the
first-run spec already proves a `motion` toast). `chores.spec.ts:44-104` (the burst and the
reduced-motion case) still passes; add "the done row moves under Done" by position. Performance:
on the owner's Pi, `just display` with 60 chips: no dropped frames on a drag; if it stutters,
Reduce motion is the fallback, and 2 is the first to drop.

**Docs.** UX §9's table gains a "Built" column with this batch's state; §7's self-critique row on
motion; ADR 0029 row ("`motion` for exits and layout moves; CSS arrivals"). CHANGELOG: "Things
move now: an event eases onto the board when it's added or moved, a finished task slides into
Done, the week slides when you page, counts pop. Reduce motion turns all of it off."

### T15 Wrap up the batch

- [ ] Done (commit: )

1. ADR 0029 ("M6 batch 2: the owner's second notes": Status, Date, Context, a Decision table with
   one row per decision above, Consequences) is complete and listed in `docs/adr/README.md`;
   ADR 0028's Hours ladder row gains "the ladder is superseded by 0029".
2. PLAN §15 M6: "Batch 2 (the owner's notes of 2026-10-12) is in `docs/M6-batch-2.md`, built in
   0.8.0"; CLAUDE.md's status paragraph says so, and its architecture map names `shell/Header.tsx`.
3. `just screenshots`: review 1920×1080, 1080×1920 and 390×844, light and dark, Standard, Small
   and Extra large, against UX §10 (which now includes the header, the mini rail, the Add forms,
   the account sheet and the motion items). Fix what's off.
4. `just check`, `just e2e`, `just scan`: all green. CLAUDE.md gotchas: one line per surprise met.
5. Report to the owner, without deploying: what changed (the CHANGELOG lines), that the database
   changes (one migration), the answer to the motion question (the section above, as built), the
   answer to the refresh question (T13), and the owner's checklist on the wall and a phone:
   - the header with today at the left and the view icons; the Today panel toggle from Lists;
   - the rail's brand, Hide the rail, the mini rail, and it coming back after two minutes;
   - the gear, and the padlock once a PIN is set;
   - Add from the rail: Event with a parsed line filling the rows; a Task with a picked time and a
     custom repeat on three weekdays; the Who row with all five people on one line;
   - Hours: Zoom in four times, Fit the day;
   - Settings: a toggle saved with no button; Features' Tasks row; the Google keys sheet; the
     account sheet with Sync and Show on Kitchen; Edit Mia from her row; Recently Removed's page;
     Text size Small on the 1080p screen;
   - Erase everything from a phone on a throwaway instance (the test server, `just dev`), never
     the real one unless they mean it.

## Follow-ups noticed but not in this batch

- Per-screen calendar visibility ("Show on Kitchen" and "Show on Hallway" separately): needs a
  per-device list on the calendar; PLAN §19's per-display layouts.
- The week swipe following the finger with inertia (UX §9): the paging slide in T14 is the
  button-twin version; the gesture version is its own task.
- The phone shell's headers and tab bar are unchanged by the global header.
- `display_orientation` and `display_controls_bottom` are still stored but unread.
- `/api/_test/reset` keeps `plugin_state`; T12's shared erase could make the test reset clear it
  too, but e2e tests that rely on carried-over plugin settings would need looking at first.
- Everything in `docs/M6.md`'s follow-ups that this batch didn't touch.
