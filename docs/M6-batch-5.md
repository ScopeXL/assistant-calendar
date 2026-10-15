# M6, batch 5: the owner's fifth notes, as tasks

Sunroom 0.10.0 is on the owner's wall and phones. The fifth set of notes is about the wall's
header and the Hours grid: a scrollbar that flickers while a zoomed grid follows the minute, the
weather sheet's words and its title, the header's date, time and weather block (its alignment,
its crowding, and nothing saying the weather can be tapped), and a question: a "rolling week"
option for the Week view. This file turns them into tasks for the Opus 5.5 session that builds
them (PLAN §15, M6 → **0.11.0**). It was written on 2026-10-15 from a read of the code at
`6443855` (v0.10.0); line numbers are from that commit and may have drifted a little.

The owner answered two questions while this was planned, and those answers are decisions here:
the rolling week is built, with the window **yesterday, today and the five days after** (today
in the second column), and the header's weather pill shows **the sky and the temperature**, with
the day's high and low in the forecast sheet's first line. (T3 and T4 still say what would change
for the alternatives, in case the owner overturns either at review.)

**Where this file lives.** `docs/M6-batch-5.md`, beside `docs/M6-batch-4.md` and the earlier
batches, committed as `docs: M6 batch 5, the owner's fifth notes as tasks`.

## How to work through this file

- Read `CLAUDE.md` first: the priorities, the hard rules, the gotchas (and `docs/GOTCHAS.md`:
  "Layout and CSS", "Time and live updates" and "End-to-end tests"). Then UX §1, §2, §3 (the
  header), §4 (the Week board and its Hours layout), §7, §9, §10 (`docs/UX.md`), PLAN §14.7
  and §15, and `docs/M6-batch-4.md` (the same shape as this file; its "As built" notes say what
  surprised the last session, and its T4 is the last change to the header).
- Do the tasks in order. T1, T2 and T3 are independent of each other; T4 adds a migration and
  comes last so the others are never blocked on it; T5 wraps up.
- **The gate is in two tiers** (CLAUDE.md "Definition of done", PLAN §14.7). Each task ends with
  the *quick gate*: `just quick`, the unit tests of what it touched (`just test-fe …`,
  `just test-py …`), its end-to-end spec on one project (`just e2e e2e/<spec> --project=<name>`),
  then docs, a CHANGELOG line under `[Unreleased]`, `just scan` (the hook runs it), one commit
  per task (or per lettered part), subject `area: summary` plus the `Co-Authored-By` trailer.
  Tick the task's box here and note the commit, so a session that stops early can be resumed.
  The *full gate* (`just check`, the whole `just e2e`, `just screenshots` with the review) runs
  once, in T5, and before anything is called done.
- Read test output only when it fails: the recipes use the terse reporters. Review the
  screenshots from the list in T5, not all of them.
- Never deploy, bump, tag or push: the owner does that with the deploy skill when they ask. The
  release will be 0.11.0 (minor: the family sees the header); the skill decides.
- When something here turns out to be wrong about the code, fix the task in the smallest way that
  keeps its intent, say so in the commit message and in the final report. Don't stop to ask unless
  the owner's intent is genuinely unclear.
- Never skip a failing check. Stop and report.
- Seed and fixtures stay synthetic (Ana, Sam, Mia, Leo; Sample Town). Nothing private, ever.

## The owner's notes, mapped to tasks

| Note | Task |
|---|---|
| Remove the scrollbar on the calendar view: zoomed in, the app scrolls to keep the current time in view, and the scrollbar flickers when it updates | T1, and "Answers" |
| The weather sheet: "The Next Hours" should say "Today", "The Week" should say "Forecast"; the country goes from its title; the title must not wrap to two lines | T2 |
| A more polished design for the header's date, time and weather: the alignment feels off, it feels scrunched, and nothing says the weather opens a sheet | T3, and "Answers" |
| A "rolling week" setting for the Week view (today as the centre column, the three days before and the three after): an honest opinion on its usefulness, and how it would work | T4, and "Answers" |

## Answers to the owner's questions

**Why the scrollbar flickers, and what replaces it.** The Hours grid scrolls inside one box
(`features/calendar/HoursGrid.tsx:186-191`: `overflow-y-auto` with `scrollbar-gutter: stable`,
chosen in batch 1 so a visible bar would say "this scrolls", `docs/M6.md:340`). The kitchen
screen's Chromium runs with overlay scrollbars (`kiosk/sunroom-kiosk:242`,
`--enable-features=OverlayScrollbar`): a bar that appears while something scrolls and fades out
after. From the moment the idle timer brings the board back to now until the next touch, the
screen is *resting* (ADR 0031), and the grid's layout effect (`HoursGrid.tsx:157-174`) sets the
box's `scrollTop` once a minute so that now stays a third of the way down the view. To the
browser every one of those sets is a scroll, so the overlay bar appears and fades, once a minute:
the flicker. The now line isn't the cause (it glides on a 60 s transition,
`styles/motion.css:488`), and the step itself is small: under a pixel a minute at one tap of
zoom, about five at the deepest, which the eye doesn't catch without a bar to announce it. The
fix is to draw no bar on that box at all (`scrollbar-width: none`, the way the sideways rows
already hide theirs, `ui/ScrollRow.tsx:56`) and to drop the gutter reserved for it. The kiosk
flag stays for the rest of the wall, whose bars only ever show under a finger. What says "this
scrolls" without a bar: the hour cut off at the grid's bottom edge, the hours moving under a
finger, and **Fit the day**, which always shows the whole day; UX §4 named the bar as the sign,
and that sentence changes. Not chosen: hiding every scrollbar on the wall (the Day view, the
rooms, sheets: none of them scrolls by itself, so none flickers, and a laptop with a mouse keeps
a bar where it helps), and easing the minute's step (`scrollTo({ behavior: "smooth" })`: a few
pixels once a minute need no animation, and Reduce Motion would have to be honoured by hand).

**What's off in the header, and the design.** What's there (`shell/Header.tsx:19-43`,
`features/weather/WeatherBlock.tsx:38-79`): the date at 24 px bold; the time at 40 px, weight
800, in digit boxes, with AM or PM at 20 px on its baseline; then the weather as a bare button:
the sky's icon at 32 px, the temperature at 32 px bold, and the day's high stacked over its low
at 18 px; the three centred on the header's middle line (ADR 0032), 24 px apart. Three things
feel off, with three causes:

1. *The alignment.* Three sizes of text centred on one line put their baselines at three
   heights (at Standard the date's sits about 6 px above the time's, the temperature's between),
   and the eye reads text by its baseline, not by the middle of its box: "Wed, Oct 7" floats
   above the line "9:40" stands on. Centring was right for the weather, which is a box, and
   wrong for the date, which is text. ADR 0030 had the date on the time's baseline and the
   weather centred, and that looked wrong the other way round, because the weather's own text
   brought a fourth baseline.
2. *The crowding.* Two lines of 18 px stacked beside a 32 px number is a fraction squeezed into
   45 of the bar's 80 px; it is the smallest text on the wall (UX §1 keeps nothing under 18),
   and on the portrait wall it is also why the header's first row grows 8 px when the weather
   arrives (`docs/GOTCHAS.md:87-91`, open since 0.9.0).
3. *The affordance.* Every control to the weather's right is bordered or filled (the arrows,
   This Week, Agenda · Hours, Filter, the views); the weather is the only thing in the header
   with no border, fill, chevron or underline, so it reads as a label. The one hint that it
   opens anything is a tip ("Tap the weather to see the forecast").

The design: **text on one baseline, the weather as an object.**

```
[⇤]  Wed, Oct 7  9:40 AM   ( ☼ 54° ⌄ )   │  [<] [This Week] [>] [☰][⏱]          [⛛] [▦ Week][1][▤][☺]  [⇥]
```

- *The date and the time are text and share one baseline.* "Wed, Oct 7" at 24 px, semi-bold
  (600: one step quieter than it was, so the time is the one heavy thing in the block), then
  "9:40" at 40/800 as before, and "AM" at 20 px on the same baseline in `ink-soft`, so the hour
  and the minute are what the eye lands on. Two sizes of type on one baseline is how a line is
  set; it is the rule the chips already follow for a time beside a title.
- *The weather is an object, centred on the time's digits.* A round outlined pill, the shape of
  the openers in Add ("Pick a date ⌄", `ui/Chip`'s `opener`) with the same 2 px `line` border as
  This Week and Filter beside it: 56 px tall, the sky's icon at 28 px, the temperature at 24 px
  semi-bold, and a chevron in `ink-soft` that says it opens something. Objects align by their
  centre and text by its baseline, and a box with a border is read as an object, so its own
  baseline stops mattering. The day's high and low leave the header: they were the squeeze, the
  sheet now opens with them (T2), the day heads already carry each day's sky, and the pill's
  spoken name keeps them for a screen reader. When the forecast is old, "as of 9:10" takes the
  temperature's place inside the pill (a three-hour-old number shouldn't read as now), and the
  sheet's Today line says the same.
- *The spacing stays 24 px*, the block is never under 56 px tall (so portrait's first row no
  longer grows when the weather arrives), and the pill is a little narrower than the block it
  replaces (about 149 px against 158 at Standard), so the header's one-row promise at 1920
  Standard with both panels open (about 58 px to spare in the worst case, UX §3) holds.

Weighed and not chosen: all three on one baseline, the temperature included (the pill's box then
sits 5 px below the digits' middle, which looks dropped); the time first, before the date (it
reads less naturally and costs every header test); a filled pill (filled means "chosen" in this
header); the high and low on one line beside the temperature, "65° / 50°" (about 90 px wider: the
Calendar's controls would wrap to a second row at 1920 Standard whenever both panels are open,
and a slash between numbers is what UX §2 avoids); the high and low stacked inside the pill (it
fits, but keeps the fraction: the owner's alternative, see "Decisions"); the border alone with no
chevron (says "button", not "opens"); and dropping AM or PM (UX §2 keeps the 12-hour marker; it
stays, quieter).

**The rolling week: how it would work, and whether it's worth it.**

*How it would work.* A household setting, Settings → Display → Layout, right after Week layout:
**Rolling week**, a switch, off by default. With it on, the Week view's seven columns are a
window around today instead of the calendar week, and today keeps the same column whatever the
weekday. Everything else is as it is: the day heads name their days ("Thu 8"), today's disc and
lit column, Agenda and Hours both (the Hours grid's "now a third of the way down on this week,
7 AM on another" rule needs no change), portrait's rows (today's row sits near the top of the
board instead of walking down it); the arrows and a swipe page seven days at a time ("Oct 15–21",
a window with no today in it, titled with its span as now), and **This Week** and the idle
return come back to the window around today. "This Week" keeps its name: it is what the family
says, calendar week or not. At midnight the window moves on a day: today's column stays lit
where it is and the days shift one column left, with no animation (nothing animates on a data
change; the lit fill's midnight crossfade runs as it does today). Only the Week view takes the
window: Month, People, Today (already today and the next six days), the Meals and Tasks weeks,
the phone's week strip and the Day strip in Add keep the calendar week, and "next week" typed
into Add still means the calendar's next week. The cost is one helper of three lines beside
`weekOf` (`lib/dates.ts:108-113`), one line in `features/calendar/CalendarRoom.tsx:69`, a
household column with a migration, a settings row, and an end-to-end test (T4).

*Why in Settings and not in the header.* The note says a setting "in the header". The header's
Calendar part has about 58 px to spare at 1920 Standard with the rail and the Today panel open
(UX §3), and T3 spends none of it; a fifth control there wraps the Calendar's controls onto a
second row on exactly the owner's screen. It is also a household choice like Week starts on and
Week layout, not something anyone changes during the day, so it belongs in Settings → Display
beside Week layout. A per-screen version (a screen's own choice that the household's can
overrule, ADR 0031's `HouseholdChoices`) is a follow-up if a hallway screen ever wants its own.

*An honest opinion.* What it buys: today's column stops walking across the board through the
week (Sunday at the left edge, Saturday at the right), so from the doorway the eye learns where
to look, which is the glance rule UX §1 is built on; the board never spends Friday and Saturday
on five or six past days with nothing ahead; and the past is capped. What it costs: the week
loses its shape. The weekend is a different pair of columns each day, Monday to Friday no longer
reads as the school week, and the first column is a different weekday every morning, so the
spatial memory a fixed week builds ("Friday is at the right") is traded for a fixed today. And
with today in the middle, three days ahead is short: on Monday and Tuesday the coming weekend
isn't on the board at all (the fixed week always shows it, and on Monday shows the whole week
ahead), while the three past columns show days nobody acts on; for a family that plans around
the weekend, that is the wrong trade on two days in seven. The Today panel (Up Next, Later Today,
Tomorrow) and the Today view (today big, then the next six days: already a rolling strip) answer
"what's next"; the Week view's job is the week's shape, and a centred window keeps the shape of
neither. Verdict: worth having as an option, because it is cheap, some screens are better served
by a fixed today (a hallway screen; a household that lives day to day rather than week to week),
and off by default it costs the fixed week nothing; but not centred. The better window is
**yesterday, today, and the five days after** (today in the second column): still one fixed
place for today, one day of what just happened, and five days ahead so the weekend is on the
board from Monday. The split is one constant in the helper, so the owner's choice is a number;
this plan builds the recommended one.

## Decisions (decided here, with the reason; the owner can overturn any at review)

| Question | Decision |
|---|---|
| The Hours scrollbar | **Hidden on the Hours grid's scroller only** (`scrollbar-width: none`; the reserved gutter goes). What says it scrolls: the hour cut off at the bottom edge, the hours under a finger, and Fit the day. The kiosk's overlay flag stays and every other scroller keeps its bar. The minute's step is not eased |
| The forecast's title | **The place without its country**, on one line, cut with an ellipsis only if it must be: "Sample Town, Sample State" for "Sample Town, Sample State, United States", "Sampleton" for "Sampleton, United Kingdom", "Sample Town" as it is. A frontend helper beside the sky's words (the label's shape is Sunroom's own: `place_label` joins the town, the region and the country with commas, the country last when there is one), so no API or schema change. Settings → Household keeps showing the full label, which is where the country helps. `ui/Sheet` gains `oneLineTitle`, so an event's long title can still wrap in its own sheet |
| The forecast's sections | **Today**: a soft line first, "Partly cloudy, 64° now. High 72°, low 55°." (", as of 9:10" after "now" when the forecast is old), then the next twelve hours as now; **Forecast**: the days as now, today's row included; "Weather by Open-Meteo" stays. The twelve hours still run past midnight in the evening (the owner chose "Today"; a heading that becomes "Tonight" is a follow-up if it bothers anyone) |
| The header's today block | The date and the time share **one baseline** (`items-baseline` for the two of them), the date at weight 600 and AM or PM in `ink-soft` on the time's baseline; the weather is a **round outlined pill** (2 px `line` on `surface`, 56 px tall): the sky's icon at 28 px, the temperature at 24/600, a chevron in `ink-soft`; the pill is centred on the time's digits (the row stays `items-center`, and the time's line box is symmetric about its digits); the block is `min-h-tap`, so portrait's first row is 56 px with or without the weather. **The high and low leave the header** and open the sheet's Today line; the pill's spoken name keeps them. The owner's alternative, if they want them in the header: the stack inside the pill, between the temperature and the chevron (about 30 px wider; still within the one-row budget) |
| An old forecast | "as of 9:10" takes the **temperature's** place in the pill (caption size, `ink-soft`), and the sheet's Today line says it too. The stack it used to replace is gone, and the pill with both the number and the words would wrap the Calendar's controls at 1920 Standard |
| The rolling week | A household setting, **`display_rolling_week`**, off by default; Settings → Display → Layout, a switch **Rolling week** right after Week layout; the Week view only (Agenda and Hours); the window is **yesterday, today, five after** (`ROLLING_BEFORE = 1`); "This Week" at home and the span elsewhere; the arrows page seven days; This Week and the idle return come back to the window around today; no per-screen override. (The owner's "three before, three after" is `ROLLING_BEFORE = 3`, and T4 says what else moves with it) |
| Verification | Two tiers (above). Each task names its spec and project; T5 runs the full gate once. The release is **0.11.0** (minor: the family sees the header); the deploy skill decides |
| Database | **One migration** (T4, `display_rolling_week`), with the new revision's fixture database built in T4 as `docs/RELEASING.md` asks. The 0.10.0 fixture, `backend/tests/fixtures/db/202610141930.sql`, **exists** (checked on 2026-10-15), so the upgrade test has what it needs |

## Before the first task

1. `just check` must be green at the commit this file landed on (one after `6443855`; confirm,
   don't assume). `CHANGELOG.md`'s `[Unreleased]` is empty there.
2. `backend/src/sunroom/migrations/released.lock` ends with `202610141930`, and
   `backend/tests/fixtures/db/202610141930.sql` exists. Nothing to build before T4.
3. `just screenshots` once, before any task, into `.screenshots/before-0.10.0/` (gitignored),
   the "before" for T5's review.

## Tasks

### T1 The Hours grid loses its scrollbar

- [x] Done (commit: "calendar: no scrollbar on the Hours grid")

**Owner's note.** "Remove the scrollbar on the calendar view. When zoomed in, the app
automatically scrolls to keep the current time in view. When it does, the scrollbar flickers when
it updates."

**What exists.** The scroller, `features/calendar/HoursGrid.tsx:186-191`:
`relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain border-t border-line [scrollbar-gutter:stable] [touch-action:pan-y]`.
The follow effect at `:157-174` sets `node.scrollTop = initialScrollTop(…)` whenever `rest` is
true and any of its inputs change (`now` changes each minute), and `days` is a new array on every
`CalendarRoom` render (`CalendarRoom.tsx:69`), so it also re-runs on each render while resting
(it writes the same value then, which does nothing). The docstring at `:84-90` says "zoomed in
it scrolls, with a visible scrollbar". `ZoomControl` (`ZoomControl.tsx:31`, `absolute right-6
bottom-4`) floats outside the scroller and is unaffected. Nothing reads the gutter's width: the
grid measures its day columns live (`HoursGrid.tsx:101-106`), `hours.ts` never touches the DOM,
and neither `e2e/hours.spec.ts` nor `e2e/shell.spec.ts` asserts a gutter or a column width. The
three sideways rows that already hide their bar use `[scrollbar-width:none]` alone
(`ui/ScrollRow.tsx:56`, `ui/Segmented.tsx:42`, `ui/WhoPicker.tsx:93`), so the wall already
relies on Chromium 121 or later (which honours `scrollbar-width` and ignores
`::-webkit-scrollbar` once it is set); no WebKit fallback is needed, the phone never shows this
grid.

**Build.** `HoursGrid.tsx:190`: `[scrollbar-gutter:stable]` → `[scrollbar-width:none]`. The
docstring: "zoomed in it scrolls with no scrollbar: the hour cut off at the bottom edge, the
hours under a finger and the zoom's buttons say so, and Fit the day always shows the whole day
(ADR 0033; the overlay bar flashed once a minute while the grid followed now)". While there,
`CalendarRoom.tsx:69`: wrap `week` in `useMemo` (T4 edits the same line; do it here so the
follow effect stops re-running on every render). On the laptop and in headless Chromium the
fitted columns gain the gutter's few pixels; on the kiosk an overlay bar reserved nothing, so
nothing moves.

**Tests.** `just test-fe src/features/calendar`;
`just e2e e2e/hours.spec.ts --project=display-1080p` (the whole spec: fit, zoom, the follow
after two idle minutes at `:195-219`). Then by hand in `just display`: Hours, Zoom in twice,
scroll: no bar; Fit the day: nothing to scroll.

**Docs.** `UX.md:228`: "Zoomed in, the grid scrolls with a visible scrollbar, starting with now a
third of the way down" → "Zoomed in, the grid scrolls, with no scrollbar (ADR 0033: the kitchen
screen's overlay bar flashed once a minute while a resting grid followed now; the hour cut off at
the bottom edge, the hours under a finger and Fit the day say it scrolls), starting with now a
third of the way down"; `UX.md:853`'s Hours checklist line gets "no scrollbar". `docs/adr/0030`
line 35 (the zoom "outside the scroller"): append "(the scrollbar is hidden since ADR 0033)".
`docs/GOTCHAS.md`, "Layout and CSS": "The Hours grid's scrollbar flickered once a minute on the
kitchen screen: Chromium's overlay bar shows on every scroll, and a resting grid sets `scrollTop`
each minute to follow now. That scroller is `scrollbar-width: none`."

**CHANGELOG** (Fixed). "On the Hours grid, zoomed in, the scrollbar no longer flickers every
minute: there is no scrollbar. The hours still scroll under a finger, and Fit the day shows the
whole day."

**As built.** As planned, and `hours.spec.ts` now checks it: zoomed in, the scroller's
`scrollbar-width` is `none` and no width is kept for a bar. One thing here was wrong: on this
Mac, headless Chromium draws overlay scrollbars too (it follows macOS), so the old gutter kept
no width there and the fitted columns don't move; the width check only bites where bars are
classic (Linux, CI), which is why the test reads the computed style as well (it failed with
`auto` on the old class). ADR 0033 was started here, its rows added task by task.

### T2 The forecast sheet: Today, Forecast, and the place on one line

- [x] Done (commit: "weather: the forecast says Today and Forecast, its place on one line")

**Owner's note.** "When tapping the weather in the header the modal has some phrasing that needs
polishing. 'The Next Hours' should simply say 'Today'. 'The Week' should say 'Forecast'. Remove
the country from the header as that's not needed. And we don't want it to wrap to 2 lines if
it's too long."

**What exists.** `features/weather/WeatherBlock.tsx:91-161` `Forecast`: a `ui/Sheet` titled
`weather.location_label ?? "The Weather"` (`:106`); "The Next Hours" (`:108-109`, the section's
`aria-label` and its h3): the first twelve of the API's twenty-four hours in a grid of six on the
wall (`:110-128`); "The Week" (`:130-131`): up to seven rows, "Today" then "Thu", "Fri" …, each
with the sky, the words, the chance of rain, and the high in ink beside the low in ink-soft
(`:132-155`); "Weather by Open-Meteo" (`:157`). The sheet never says what the weather is *now*.
Its title is `household.location_label`, one string composed at search time by
`place_label(name, admin1, country)` (`backend/src/sunroom/plugins/weather/open_meteo.py:190-198`)
and stored by `useSetPlace` (`features/weather/data.ts:56-80`): "Springfield, Illinois, United
States", "Sampleton, United Kingdom", or "Singapore" alone; there is no country field. The seed
stores "Sample Town" (`meta/testing.py:147`), which is why no screenshot showed the problem, and
the test server's fake finder answers "Sample Town, Sample State, United States"
(`plugins/weather/fake.py:32-45`). `ui/Sheet.tsx:148-162`: the h2 (`text-d-title font-bold`,
32 px on the wall) sits in a flex header beside the quiet Close button, with no `min-w-0` and no
truncation, so a long label wraps and the sheet's header grows; `title` is a string, and
`aria-labelledby` names the dialog by it (`:133`). Helpers in `features/weather/sky.ts`:
`sky(code, isDay)` (the icon and the words), `degrees()`, `highLow()` ("High 70°, low 52°"),
`rainChance()`; `staleText()` in `WeatherBlock.tsx:12-16` ("as of 9:10").

**Build.**

(a) `features/weather/sky.ts`: `placeWithoutCountry(label: string | null): string | null`: split
on commas, trim, drop empty parts; two or more parts → every part but the last, joined with
", "; one part, or null, → as it is. Document why the last part is the country (`place_label`'s
order, and that a region without a country is a Open-Meteo gap worth losing the region for).
Cases in `sky.test.ts`: the three shapes, "Sample Town", null, and "  Sample Town ,  Sample
State , United States " (trimmed).

(b) `ui/Sheet.tsx`: a `oneLineTitle?: boolean` prop; when set, the h2 gets `min-w-0 truncate`
(the h2 is the flex item that must shrink, which is why a node passed as `title` couldn't do
this on its own; Close's min-content is its one word, so the title gives way first). A case in
`src/ui/Sheet.test.tsx` if that file exists (check); otherwise none.

(c) `WeatherBlock.tsx` `Forecast`:
- `title={placeWithoutCountry(weather.location_label) ?? "The Weather"}` and `oneLineTitle`.
- "The Next Hours" → **Today** (the h3 and the section's `aria-label`); "The Week" →
  **Forecast** (both). Under the Today heading, before the hours, one soft line (`soft`), built
  from `sky(weather.current.code, weather.current.is_day)`, `degrees()`, `staleText()` and
  `highLow(daily[0])`, only when `weather.current` is there:
  "Partly cloudy, 64° now. High 72°, low 55°." and, old, "Partly cloudy, 64° now, as of 9:10.
  High 72°, low 55°." (The `highLow` part only when `daily[0]` exists.)
- The twelve hours and the rows are unchanged.

The design-rules test (`styles/designRules.test.ts:153-168, 234-238`) checks h1–h3 text and
`title="…"` literals for Title Case: "Today" and "Forecast" pass; a `<p>` and an `aria-label`
aren't checked. The screenshot spec opens the sheet by the button's name
(`e2e/screenshots.spec.ts:853-860`, `/^The weather:/`), which T3 keeps.

**Tests.** `just test-fe src/features/weather src/ui src/styles`. A new
`frontend/e2e/weather.spec.ts` (wall projects only, `test.skip` on the others as
`hours.spec.ts:11-22` does; the clock at Wed 2026-10-07 10 AM; `seed`): sign in as a parent on
the test's `request` (the pattern at `shell.spec.ts:282-289`: `POST /api/auth/login` with
`PASSWORD` and the `X-Sunroom` header) and `PATCH /api/settings` with
`{ "location_label": "Sample Town, Sample State, United States" }` (the seed's coordinates
stay, so the fake forecast still answers); `pairWall`, open `/display`, tap the banner's
`/^The weather/` button; in the dialog expect the heading "Sample Town, Sample State" (exact),
its box no taller than one line (under 60 px at Standard), the headings **Today** and
**Forecast**, a line matching `/now\. High \d+°, low \d+°\./`, and the hours grid's first cell
"10 AM"; Close. Run `just e2e e2e/weather.spec.ts --project=display-1080p`. By hand in
`just display`: the sheet in light and dark; Settings → Household still says the full place.

**Docs.** `UX.md:134`, "a tap opens the day's hours and the week" → "a tap opens the forecast
sheet: the place without its country as its one-line title, **Today** (a line on the weather
now with the day's high and low, then the next twelve hours) and **Forecast** (the days ahead),
and Weather by Open-Meteo at the foot"; no other doc names the old headings. ADR 0033 row.

**CHANGELOG** (Changed). "The weather's sheet says Today and Forecast, names your town without
its country on one line, and opens with what the weather is now and today's high and low."

**As built.** As planned, with three small differences. The Today line's high and low come from
today's own forecast (`useWeatherDay(today)`, which the header's spoken name already used, handed
to the sheet), not `daily[0]`; `highLow` takes the two numbers. `placeWithoutCountry` also
answers null for an empty label, so the sheet still falls back to "The Weather". And
`weather.spec.ts` goes one step further than planned: with the sheet open, a parent changes the
place to a name too long for the line, and the title follows at once (`settings.changed`
refreshes the forecast), stays one line, is cut (`scrollWidth > clientWidth`) and still names the
dialog. It passes on both wall projects. `Sheet.test.tsx` has a case each way (one line when
asked; wrapping by default).

### T3 The header's today block: one baseline, and the weather as a pill

- [ ] Done (commit: )

**Owner's note.** "Can you propose a more polished design for the 'Date, Time, Weather' piece of
the header. The alignment feels off. It feels a bit scrunched, and there is nothing visually
indicating that the weather area is tappable to open a modal."

**What exists.** `shell/Header.tsx:19-43` `HeaderToday`:
`<div className="mr-3 flex shrink-0 items-center gap-x-6 landscape:ml-3">`, the date `<p
className="text-d-body font-bold whitespace-nowrap">` (24/32, 700), the time `<p
className="text-d-glance font-extrabold whitespace-nowrap">` (40/48, 800) holding `ui/Digits`
and, inside the same `<p>`, the AM/PM `<span aria-hidden className="ml-1.5 text-d-secondary
font-bold">` (so it sits on the time's baseline; none in 24-hour time), then
`<div className="flex items-center gap-x-6 empty:hidden">` with the plugins' blocks
(`place="header"`). The weather's header branch, `features/weather/WeatherBlock.tsx:38-79`: a
`<button>` `press flex min-h-tap shrink-0 items-center gap-3 rounded-chip-d px-2 text-left`
named `The weather: Partly cloudy, 54°. High 65°, low 50°. Open the forecast.` (`:31-37, :46`),
the icon `size-8`, the temperature `text-d-title font-bold` (32 px), and either the stack (the
high over the low, `text-d-caption leading-tight font-semibold text-ink-soft`, `:61-70`) or
"as of 9:10" in its place. No border, fill, chevron or underline; `.press` only. The phone branch
(`place="phone"`, `:41, :72-78`) is a separate layout and is not touched. The header
(`Header.tsx:137-173`) is a `@container/header`, `min-h-[var(--header-h)]` (80 px at Standard,
`styles/tokens.css:68-71`), one row from 104rem with `py-1`; the rail's mark block matches its
height (`shell/Rail.tsx:83`). Conventions to copy: `ui/Chip.tsx:45-60` (`rounded-full border-2
border-line bg-surface font-semibold`, `min-h-tap text-d-body`, and for an opener a
`ChevronDown` `shrink-0 text-ink-soft size-7`); `ui/Button` secondary (`border-2 border-line
bg-surface`). `ui/Chip` itself can't be the pill: its padding is fixed at `px-6` (which puts the
pill over the width budget), and its `opener` means "opens in place" with `aria-expanded`, while
the forecast is a modal sheet. Constraints from the tests: the date and the time must stay the
banner's first two `<p>` elements (`e2e/shell.spec.ts:227-228, 269`); `steadyDigits` (`:37-46`)
wants every `.digit` in the banner one width, so no `ui/Digits` in the pill; the button's name
must start with "The weather" (and "The weather:" for the screenshot spec); the header must stay
within 84 px at 1920 (`:254`) with the rail's block equal to it (`:262`); the one-row budget is
about 58 px (ADR 0030:36); tap targets 56 px and 8 px apart (`e2e/a11y.spec.ts:71-135`).

**Build.**

(a) `Header.tsx` `HeaderToday`:

```tsx
<div className="mr-3 flex min-h-tap shrink-0 items-center gap-x-6 landscape:ml-3">
  <div className="flex items-baseline gap-x-6">
    <p className="text-d-body font-semibold whitespace-nowrap">{shortDate(day)}</p>
    <p className="text-d-glance font-extrabold whitespace-nowrap">
      <Digits value={time} spoken={suffix ? `${time} ${suffix}` : time} />
      {suffix ? (
        <span aria-hidden="true" className="ml-1.5 text-d-secondary font-bold text-ink-soft">
          {suffix}
        </span>
      ) : null}
    </p>
  </div>
  <div className="flex items-center gap-x-6 empty:hidden">…the blocks as now…</div>
</div>
```

The docstring (`:12-18`): the date and the time are text and share a baseline; a plugin's block
is an object centred on the time's line box, which is symmetric about its digits; the block is a
tap target tall so portrait's first row never grows (ADR 0033; ADR 0032 centred all three and
the date floated 6 px above the time's line).

(b) `WeatherBlock.tsx`, the header branch only. The button:
`press inline-flex min-h-tap shrink-0 items-center gap-2 rounded-full border-2 border-line bg-surface px-4 whitespace-nowrap`.
Inside, in order: the icon `<Icon aria-hidden className="size-7 shrink-0" strokeWidth={2} />`;
then either the temperature `<span className="text-d-body font-semibold">{degrees(…)}</span>` or,
when `stale`, `<span className="text-d-caption font-semibold text-ink-soft">{stale}</span>` in
its place; then `<ChevronDown aria-hidden className="size-7 shrink-0 text-ink-soft" />`
(`lucide-react`; no `turn`, nothing turns back under a modal). The high and low are no longer
drawn in the header; the `aria-label` (`:31-37`) keeps `highLow` and the stale text as now. Width
at Standard: 16 + 28 + 8 + about 45 + 8 + 28 + 16 ≈ 149 px (the block it replaces is about 158);
stale, about 190, still inside the one-row budget. *If the owner asked to keep the high and low
in the header:* put the stack back between the temperature and the chevron
(`flex flex-col text-d-caption leading-tight font-semibold text-ink-soft`, as `:65-69`), about
30 px more, still inside the budget; "as of" then replaces the stack as it did, not the
temperature.

(c) Measure in `just display` (Standard, Small, Extra large; light and dark; `--portrait`):
the date's and the time's glyphs sit on one line; the pill's middle is the digits' middle; the
header is 80 px at Standard and the rail's mark block meets it; the portrait header's first row
is 56 px with the weather and, with Features → Weather off, still 56 px without it. In the dark
theme the pill's border is `line` on `surface`, like This Week beside it.

**Tests.** `e2e/shell.spec.ts:222-235` ("lays out its rail or bottom bar, the board and
Today"): keep `steadyDigits` (`:221`) and replace the three-middles measure with two checks:

```ts
const bar = page.getByRole("banner");
const pill = bar.getByRole("button", { name: /^The weather/ });
const middle = async (part: Locator) => {
  const box = await part.boundingBox();
  return (box?.y ?? 0) + (box?.height ?? 0) / 2;
};
// The weather pill is centred on the clock's digits (ADR 0033).
expect(
  Math.abs((await middle(pill)) - (await middle(bar.locator(".digit").first()))),
).toBeLessThanOrEqual(2);
// The date and the time share a baseline: an empty inline-block's baseline is its bottom edge.
const baseline = (part: Locator) =>
  part.evaluate((node) => {
    const probe = document.createElement("span");
    probe.style.display = "inline-block";
    probe.style.width = "0";
    probe.style.height = "0";
    probe.style.verticalAlign = "baseline";
    node.append(probe);
    const y = probe.getBoundingClientRect().bottom;
    probe.remove();
    return y;
  });
expect(
  Math.abs((await baseline(bar.locator("p").nth(0))) - (await baseline(bar.locator("p").nth(1)))),
).toBeLessThanOrEqual(1);
```

Both `<p>`s are `whitespace-nowrap`, so the probe shares their one line; CSSOM assignments don't
trip the CSP guard (the app's own `style={{…}}` is the same mechanism); no font metrics, so it
holds at every text size and on both wall projects. `:269-271` (the date 24 px after the fold
button) stays as it is. Run `just e2e e2e/shell.spec.ts --project=display-1080p -g "lays out"`
and the same on `display-portrait`; `just test-fe src/styles` (no new button words, but the
rules test reads the header). Then `just e2e e2e/a11y.spec.ts --project=display-1080p -g "tap"`
if a test by that name exists (the tap-target check must see the pill as 56 px and 24 px from
its neighbours).

**Docs.** `UX.md:38` (the type table's "Header clock" row: "AM or PM at 20 beside it, in
ink-soft, on its baseline; the date at 24, weight 600, on the same baseline"); `:102` and `:166`
(the diagrams: `☼ 64° 72°/55°` → `(☼ 64° ⌄)`); `:134` (the today sentence: the date "24 px,
semi-bold", the time, "AM or PM at 20 px in ink-soft on its baseline", "and the weather as a
round outlined pill: the sky's icon, the temperature at 24 px and a chevron, which opens the
forecast; 'as of 9:10' in the temperature's place when the forecast is old. The date and the
time share one baseline; the pill is centred on the time's digits; the block is a tap target
tall (ADR 0033; ADR 0032 centred all three, and the date floated; ADR 0030 …)"); `:699` (weight
600 "emphasis, times, the header's date"); `:849` (the checklist: "today's date and time on one
baseline and the weather pill centred on the digits"). `docs/adr/0032` line 24, the header row:
append "(changed by ADR 0033: the date and the time share a baseline, the weather is a pill
centred on the digits, the high and low moved into the sheet, and the block is a tap target
tall)"; `docs/adr/0030` line 36: "the temperature 32 px" → "(24 px in a pill since ADR 0033)".
`docs/GOTCHAS.md:87-91`: the last sentence → "Since 0.11.0 the today block is `min-h-tap`, so
the row no longer grows; the test still waits for the weather button, which it measures."
ADR 0033 row.

**CHANGELOG** (Changed). "In the header the date and the time sit on one line, and the weather
is a round button with a chevron that opens the forecast; the day's high and low moved into the
forecast's first line." (Fixed) "On a tall screen the header no longer grows when the weather
arrives."

**As built.**

### T4 Rolling week

- [ ] Done (commits: )

**Owner's note.** "I've been thinking of adding a setting to the header for a 'rolling week' when
the app is in Week view. Explore this feature and give an honest opinion on usefulness, and how
it would work. If enabled, the week view would keep 'Today' as the center column, and show the
previous 3 days, and the next 3 days of events." The opinion and the design are in "Answers";
the owner chose to build it with **yesterday, today and the five days after**.

**What exists.** `features/calendar/CalendarRoom.tsx:69`:
`const week = weekOf(addDays(today, state.weekOffset * 7), weekStartsOn);` (`weekOf` at
`lib/dates.ts:108-113`; `weekStartsOn` from `settings.week_starts_on`, 6 = Sunday). Everything
else follows from `week`: the range it fetches (`:81`), the title ("This Week" at offset 0, else
`weekSpan(week)`, `:141-149`), `days={week}` to `WeekView` (`:227`), which hands them to the
Agenda columns or `HoursGrid`; paging by ±1 week (`:132-137`) and the swipe
(`WeekView.tsx:103-115`); today's column by `data-today` and `aria-current="date"`
(`HoursGrid.tsx:290-304`, `WeekView.tsx:233-238`). `PeopleView` gets only `today` and `now`
(`:276-283`), `TodayView` builds its own seven days from today (`TodayView.tsx:29`), the Month
view uses `monthGrid`; the other `weekOf` callers (Meals, Tasks, the phone's week strip
`features/phone/CalendarScreen.tsx:107`, Add's Day strip, quick add's "next week"
`quickAdd.ts:395`) keep the calendar week. The Hours grid's first scroll
(`hours.ts:220-241`) checks `days.includes(today)`: now a third down when the window holds
today, 7 AM otherwise. The lit fill's midnight crossfade (`styles/motion.css:56-61`) is a 600 ms
`background-color` transition on the day columns: with a rolling window the keys shift at
midnight (the first section unmounts, a new one mounts at the end, the rest move one slot), and
the two fades run on the moved elements; nothing to add. `backToNow()`
(`lib/displayState.ts:293-303`) zeroes `weekOffset`; no per-screen state is needed, so
`displayState.ts` doesn't change (and its strict `remembered()` isn't touched: a new field there
would wipe every screen's memory once). `settings.changed` already refreshes the settings query
(`lib/eventRouter.ts:71-78`), so the board follows a change at once. A household boolean end to
end, to copy: `display_rail_compact` (`household/models.py:92-93`, `schemas.py:65, :102`,
`service.py:77`, migration `202610121749_household_compact_rail.py:23-25`, the row at
`settings/DisplayPage.tsx:93-100`, `tests/test_household.py:24, 57-77`, the fixture seed in
`tests/fixtures/db/build.py`). `/api/_test/reset` re-inserts the household row with its defaults
before every end-to-end test (`meta/testing.py:50-60`, `meta/erase.py:52-60`; only
`plugin_state` survives), so a test that turns the setting on needs no `finally`.

**Build.**

(a) Backend, in order: `household/models.py` (after `display_week_layout`):
`display_rolling_week: Mapped[bool] = mapped_column(Boolean, default=False)` with a one-line
comment ("Settings → Display: the Week view shows yesterday, today and five days after instead
of the calendar week"); `household/schemas.py`: `SettingsOut.display_rolling_week: bool` and
`SettingsUpdate.display_rolling_week: bool | None = None`; `household/service.py` `settings_out`:
the field; the router applies any set field generically (`router.py:84-97`), nothing to add.
`just db-revision "household: rolling week"`, then shape the file like
`202610121749_household_compact_rail.py` (`batch_alter_table("household")`, `sa.Boolean()`,
`nullable=False`, `server_default=sa.false()`, `downgrade` raises). The fixture:
`tests/fixtures/db/build.py`: a `_v0_11_0()` seed (everything before it plus
`UPDATE household SET display_rolling_week = 1`), registered in `SEEDS` under the new revision;
`cd backend && uv run python -m tests.fixtures.db.build <revision>`; commit the SQL with the
migration. `tests/test_household.py`: the default is `False` (`:24`) and a
`{"display_rolling_week": true}` round trip (`:57-66`). `just api-types`.

(b) `lib/dates.ts`, after `weekOf`:

```ts
/** A rolling week (Settings → Display, ADR 0033): seven days with `day` in a fixed column.
 * The split lives here: ROLLING_BEFORE days before it, the rest after. */
const ROLLING_BEFORE = 1;
export function rollingWeek(day: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(day, index - ROLLING_BEFORE));
}
```

`dates.test.ts`: `rollingWeek("2026-10-09")` is Oct 8…14; `rollingWeek(addDays("2026-10-09",
7))[0]` is "2026-10-15"; `weekSpan(rollingWeek("2026-10-09"))` is "Oct 8–14"; across a month
end, `rollingWeek("2026-10-31")` is Oct 30 … Nov 5.

(c) `CalendarRoom.tsx:69` (already a `useMemo` after T1):

```ts
const rolling = settings?.display_rolling_week ?? false;
const week = useMemo(() => {
  const anchor = addDays(today, state.weekOffset * 7);
  return rolling ? rollingWeek(anchor) : weekOf(anchor, weekStartsOn);
}, [today, state.weekOffset, rolling, weekStartsOn]);
```

The range, the title (`weekSpan`), `days={week}`, paging and `aria-current` follow.

(d) `settings/DisplayPage.tsx`, in the Layout group right after the Week layout row
(`:131-146`): `<Switch label="Rolling week" hint="The Week view keeps today in the same column:
yesterday, today and the five days after. Off, it shows the calendar week."
checked={settings.display_rolling_week} onChange={(display_rolling_week) => {
update.mutate({ display_rolling_week }); }} />`. `DisplayPage.test.tsx` renders from a partial
literal; add a case that flips the switch and expects the PATCH body if it is a two-line
addition, else leave it.

(e) The owner's centred window instead, if chosen at review: `ROLLING_BEFORE = 3`, the hint
"The Week view keeps today in the middle: the three days before it, today and the three after.
Off, it shows the calendar week.", the model comment, the unit cases (Oct 6…12; "2026-10-13";
"Oct 6–12") and the end-to-end columns below (first `2026-10-06`, today the fourth, Next week
`2026-10-13`).

**Tests.** `just test-py tests/test_household.py tests/test_migrations.py`;
`just test-fe src/lib/dates.test.ts src/features/settings`. End to end, in
`e2e/calendar.spec.ts` (its `beforeEach` sets Wed 2026-10-07 and seeds; `display-1080p`):
"a rolling week keeps today in the same column": move the clock to Friday
(`POST /api/_test/clock` `{ set: "2026-10-09T14:00:00Z" }`, so the calendar week Oct 4–10 and
the rolling window Oct 8–14 differ); `pairWall`, open `/display`; in the region "This Week" the
`[data-day]` heads start at `2026-10-04` and `[aria-current=date]` is the sixth; sign in as a
parent on `request` (`shell.spec.ts:282-289`) and `PATCH /api/settings`
`{ display_rolling_week: true }`; within a few seconds the heads start at `2026-10-08`,
`[aria-current=date]` is the **second** and reads "Fri"; **Next week** → the first head is
`2026-10-15` and no head is current; **This Week** → the first head is `2026-10-08` again and
the This Week button is disabled (`docs/GOTCHAS.md`: the region is named "This Week" on every
week; wait for the button). Run
`just e2e e2e/calendar.spec.ts --project=display-1080p -g "rolling week"`. By hand in
`just display`: Settings → Display → Rolling week on, the board follows at once; Hours with a
zoom starts at now; portrait rows; Month and People unchanged.

**Docs.** `UX.md:226` (the Week board): after "Weekend first or last follows Household → Week
starts on." add "With Settings → Display → **Rolling week** on (ADR 0033), the Week view shows
yesterday, today and the five days after instead, so today keeps the second column whatever the
weekday; the arrows still page seven days, This Week and the idle return come back to the window
around today, and the title stays This Week there; at midnight the days move one column left.
Only the Week view rolls: Month, People, Today, the Meals and Tasks weeks, a phone's week strip
and Add's Day strip keep the calendar week, and 'next week' in Add means the calendar's."
`UX.md:445` (the Display settings row): "Rolling week" after Week layout. `UX.md:136` (the
Calendar's header): "This Week (the calendar week, or the window around today with Rolling week
on)". `PLAN.md:411` (the household's columns): add `display_rolling_week`. ADR 0033 row.

**CHANGELOG** (Added). "Settings → Display → Rolling week: the Week view shows yesterday, today
and the five days after, so today always sits in the same column. Off, as before, it shows the
calendar week."

**As built.**

### T5 Wrap up the batch

- [ ] Done (commit: )

1. **The full gate.** `just check`; the whole `just e2e`; `just screenshots`. Review, against
   UX §10 and `.screenshots/before-0.10.0/`, on `display-1080p` and `display-portrait`:
   `board-standard-{light,dark}-{0940,1610,2130}` (the header: one baseline, the pill, the
   rule meeting the rail's), `board-xl-light-1610` and `board-small-light-1610` (two rows and
   one row; the pill 64 and 56 px), `board-hours-zoomed-{light,dark}` (no scrollbar),
   `weather-{light,dark}` (the sheet: Today, its line, Forecast), `settings-display` (the new
   row), `view-today`; on `desktop`: `board-light-0940`; on the phones: `today-light` (the
   phone's weather block is unchanged: confirm). A failure in the full gate is traced by running
   the failing spec at each task's commit.
2. **ADR 0033**, `docs/adr/0033-m6-batch-5-the-owners-fifth-notes.md`, in ADR 0032's shape
   (Status, Date, Context: the fifth notes and this file; a Decision table with the rows of
   "Decisions" above as built; Consequences: the new `oneLineTitle`, `placeWithoutCountry`,
   `rollingWeek`, the `display_rolling_week` column and its migration, the end-to-end weather
   spec, what wasn't built and why). Add its row to `docs/adr/README.md`, and the annotations in
   ADR 0030 (lines 35 and 36) and ADR 0032 (line 24) from T1 and T3.
3. **PLAN §15.** The M6 heading at `PLAN.md:774` still reads "→ 0.7.0, 0.8.0, 0.9.0": make it
   "→ 0.7.0 … 0.11.0", and add the batch 5 paragraph after batch 4's (`:784`): "Batch 5 (the
   owner's notes of 2026-10-15) is in `docs/M6-batch-5.md`, built in 0.11.0 (ADR 0033): no
   scrollbar on the Hours grid; the weather sheet's Today and Forecast, its town without the
   country on one line, and a line on the weather now; the header's date and time on one
   baseline with the weather as a pill that opens the forecast; and Rolling week in Settings →
   Display." `PLAN.md:411` from T4.
4. **UX.** Every line the tasks name; read §3's header paragraph and §4's Week paragraphs once
   more as a whole so they still read as one description.
5. **CLAUDE.md.** The status line: "batch 5 (docs/M6-batch-5.md, ADR 0033) for 0.11.0". The
   file must stay under 15 KB; if a gotcha has to move, it goes to `docs/GOTCHAS.md`.
6. **GOTCHAS.** T1's line and T3's change are in; add anything that cost time in this batch.
7. **CHANGELOG.** `[Unreleased]` reads as one list in plain English: Added (Rolling week),
   Changed (the header, the sheet), Fixed (the scrollbar, the portrait header). No version
   heading: the deploy skill writes it.
8. **This file.** Every task's box ticked with its commit, and "As built" filled in where the
   build differed from the plan.
9. **The report to the owner.** What was built and what differs, in a few lines each; the
   database change (one migration, forward-only, its fixture built); the things to look at on
   the wall: the header at a glance, a tap on the weather, Hours zoomed in and left alone for
   three minutes, Settings → Display → Rolling week on and off. The owner deploys.

## Follow-ups noticed but not in this batch

- The hourly icons in the forecast sheet always use the day's variant (`sky(hour.code)` defaults
  `isDay` to true; `ForecastHourOut` has no `is_day`), so "12 AM" shows a sun behind a cloud.
  A backend field from Open-Meteo's hourly `is_day`, then `sky(code, is_day)`.
- "Today" over twelve hours runs into tomorrow's small hours after midday; a heading that becomes
  "Tonight" after 6 PM, or hours capped at midnight, if anyone minds.
- Sunrise and sunset are fetched and never shown; ADR 0026 line 26 says the forecast shows
  sunrise.
- Doc drift found while planning: the city search allows 30 lookups a minute (`PLAN.md:493`,
  ADR 0010 line 18, ADR 0026 line 28 and `plugins/weather/router.py`'s docstring say 10);
  `PLAN.md:509` says "The rail shows 'as of 9:10'" (the header does); ADR 0010 line 25 lists
  the rail and the Today panel among where the weather shows; `UX.md:715` says the now line moves
  "once a minute with a 500 ms ease" while `:822` has the 60 s creep that was built.
- The phone's weather block (`place="phone"`, the top of a phone's Today) keeps "65° / 50°"; it
  could say what the sheet's Today line says.
- A per-screen Rolling week (ADR 0031's `HouseholdChoices`), if a hallway screen ever wants its
  own.
- The stale pill: "as of 9:10" replaces the temperature; if the family would rather keep the
  number, the pill without its chevron fits both.
- Still open from batch 4: the `/display` pair screen's theme on a brand-new Pi guesses from the
  device clock; Setup's step list could reopen a done step; the squeekboard experiment; a toast
  under the PIN dialog; and batch 3's list (the phone shell's headers, Filter by calendar or
  kind, drafts that survive a refresh, the week swipe following the finger, the Hours pinch, the
  filter's 30% fade).
