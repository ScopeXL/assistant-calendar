# M6, batch 4: the owner's fourth notes, as tasks

Sunroom 0.9.1 is on the owner's wall and phones. The fourth set of notes is about polish (the
header, the theme, toasts, empty rooms, words), three questions (Coming Up, the update check, the
e2e job on GitHub), the setup wizard, the wall's keyboard, and the time a batch takes to build.
This file turns them into tasks for the Opus 5.5 session that builds them (PLAN §15, M6 →
**0.10.0**). It was written on 2026-10-14 from a read of the code at `cc2f06b` (two commits after
v0.9.1); line numbers are from that commit and may have drifted a little.

The owner answered four questions while this was planned, and those answers are decisions here:
every button is Title Case; the wall keeps Sunroom's own keyboard, redesigned; Coming Up limits
birthdays and never the countdowns the family added; and this batch verifies each task with quick
checks and runs the full gate once at the end.

**Where this file lives.** `docs/M6-batch-4.md`, beside `docs/M6-batch-3.md` (batch 3),
`docs/M6-batch-2.md` and `docs/M6.md`, committed as `docs: M6 batch 4, the owner's fourth notes
as tasks`.

## How to work through this file

- Read `CLAUDE.md` first: the priorities, the hard rules, the gotchas (and `docs/GOTCHAS.md` for
  the wall's keyboard, sheets and panels, and the end-to-end tests). Then UX §1, §2, §3, §4, §8,
  §9 (`docs/UX.md`), PLAN §12.1, §13.6, §14.7, §15, and `docs/M6-batch-3.md` (the same shape as
  this file; its "As built" notes say what surprised the last session).
- Do the tasks in order. **T0 first**: it adds the recipes the rest of the batch verifies with.
- **The gate is in two tiers (decided with the owner; T0 writes it into CLAUDE.md).** Each task
  ends with the *quick gate*: `just quick` (lint and typecheck), the unit tests of what it touched
  (`just test-fe …`, `just test-py …`), and, where the task names one, its end-to-end spec on one
  project (`just e2e e2e/<spec> --project=<name>`); then docs, a CHANGELOG line under
  `[Unreleased]`, `just scan` (the hook runs it), one commit per task (or per lettered part),
  subject `area: summary` plus the `Co-Authored-By` trailer. Tick the task's box here and note
  the commit, so a session that stops early can be resumed. The *full gate* (`just check`, the
  whole `just e2e`, `just screenshots` with the review) runs once, in T15, and before anything is
  called done.
- Read test output only when it fails: the recipes use the terse reporters. Review screenshots
  from the list in T15, not all 544 of them.
- Never deploy, bump, tag or push: the owner does that with the deploy skill when they ask. The
  release will be 0.10.0 (minor: the family sees most of this); the skill decides.
- When something here turns out to be wrong about the code, fix the task in the smallest way that
  keeps its intent, say so in the commit message and in the final report. Don't stop to ask unless
  the owner's intent is genuinely unclear.
- Never skip a failing check. Stop and report.
- Seed and fixtures stay synthetic (Ana, Sam, Mia, Leo; Sample Street). Nothing private, ever.

## The owner's notes, mapped to tasks

| Note | Task |
|---|---|
| Re-order the zoom buttons on the Week view to Full · Zoom out · Zoom in | T2 |
| Redesign Setup: the steps are good, the space isn't used; Pair This Screen is the model | T12 |
| On a refresh or a theme change, Light flickers and slowly fades (the header, the rails, icons, buttons, Today's column); Dark doesn't flicker and has no animation | T5, and "Answers" |
| The header's time isn't aligned with the date or the weather | T4 |
| "Nothing on today" → "Nothing today"; the People view needs another way to say a clear day | T3 |
| A sheet shifts when a toast fades; a toast jumps into a sheet that opens over it | T6 |
| Coming Up shows birthdays far out: when does it show things, should there be a setting, an override for countdowns, an opinion | T7, and "Answers" |
| The e2e job in GitHub Actions always fails: why, and a fix | T14, and "Answers" |
| Phones & Screens → Devices; a computer is listed as a phone; Add a phone → Add a Device; Screens stays on top, perhaps Paired Screens | T8 |
| Lists, Tasks and Photos: an empty room shows an icon, a line, and a big New List / New Task / Add Photos button | T9 |
| Photos' header buttons capitalized | T1 (every button) |
| Check now says "GitHub's answer wasn't one Sunroom could read" | T10, and "Answers" |
| Why a custom keyboard and not the system's; if it stays, redesign it (centred, not right-aligned); ideas | T13, and "Answers" |
| An account's sheet lists the calendars that sync first | T11 |
| Add an account: iCloud → Apple; the order Apple, Google, Holidays, Another calendar, A calendar server | T11 |
| Plans take hours, mostly testing: build everything and test at the end? | T0, and "Answers" |

## Answers to the owner's questions

**When Coming Up shows things, and whether to change it.** Today the Today panel's Coming Up is
the countdowns plugin's block (`features/countdowns/ComingUp.tsx:18,65`): it asks
`GET /api/countdowns/upcoming?limit=3` (one in the portrait band), and the server
(`plugins/countdowns/service.py:215-238`) takes every countdown that isn't a surprise and every
member's birthday (while Features → Countdowns → Count down to birthdays is on), sorts them by
date, and returns the first three. **There is no limit on how far out**, so with few countdowns a
birthday eleven months away fills a line. UX §4 says "the two nearest countdowns"; the code and
PLAN say three. My opinion: change it, with one rule and one setting, no per-item override. A
countdown is something the family chose to count down to, so it belongs in Coming Up from the day
it's added, however far out ("Beach trip · 142 days" is the point of it). Birthdays come for free
for everyone in the house, and those are the ones that feel far. So: **countdowns always show;
birthdays show within a window**, a Countdowns setting in Features: **Birthdays in Coming Up**:
1 week · 2 weeks · 1 month · 3 months · Any time, **1 month by default**. A birthday further out
still shows on the board on its day, and the Countdowns room always lists everything. The owner
chose this over a per-countdown "show it anyway" switch (a migration and a form row for a case the
rule already covers) and over one window for both kinds (which would hide a trip until it came
within range). It's a plugin setting (`plugin_state`), so no migration: T7.

**Why Check now says GitHub's answer couldn't be read.** `core/updates.py:21` asks
`https://api.github.com/repos/ScopeXL/assistant-calendar/releases/latest`. That repository is
public and has every tag (v0.1.0 … v0.9.1), but **no GitHub Releases**: the deploy skill tags
and pushes the image, and never publishes a Release (`docs/RELEASING.md`,
`scripts/release.py:129-153`). GitHub answers 404; a 404 is "not ok" (`core/http.py:44-46`), so
`check()` falls to the "wasn't one Sunroom could read" line (`updates.py:88-91`), which is true
in the narrowest sense and misleading in every other. The fix reads the tags
(`/repos/…/tags?per_page=100`), which exist by construction, and picks the highest version: T10.
Publishing a GitHub Release per tag is listed under follow-ups; the check must not depend on it.

**Why the e2e job on GitHub always fails.** It has failed on every release since 0.5.0, and
nobody saw it because the release gate is local (`just preflight` runs `just e2e` on the Mac) and
CI only runs on a push, which happens at release. The same tests fail every time: the two
accessibility *journeys*, `e2e/a11y.spec.ts:228` "a phone, signed in" (phone-webkit,
phone-chromium) and `:333` "the wall screen, from first light to Settings" (both display
projects), each once in light and once in dark. Each runs `check()` 22 to 36 times (an axe scan,
two whole-page DOM sweeps and a settle each), finishes in under 30 s on the Mac and takes longer
than that on the 4-CPU runner; nothing raises Playwright's default 30 s test timeout for them
(`first-run.spec.ts:18` and the screenshot spec do raise theirs), so every attempt dies at 30 s,
and `retries: 1` runs each doomed attempt twice: about 9 of the job's 18 minutes. Not browser
deps, not the server, not fonts, not the time of day (the failures repeat at four times of day).
A second, smaller fault: the "flaky" ones ("Test ended." after 70 ms, on `shell.spec.ts:508`,
`countdowns.spec.ts:24` and others) are tests that `test.skip()` themselves for a project right
away, after the `guard` fixture has fired `void page.addInitScript(…)` without awaiting it
(`e2e/fixtures.ts:34`); the skip ends the test under the pending call. The fix: give the two
journeys the time they need (`test.slow()`, with a 60 s base), await the init script, cache the
browsers, put a `timeout-minutes` on the job, and have the deploy skill report the CI result
after it pushes: T14.

**Why Sunroom draws its own keyboard, and whether the Pi has one.** The Pi does: Raspberry Pi OS
ships squeekboard, a Wayland on-screen keyboard, turned on from Raspberry Pi Configuration →
Display (on Trixie, Control Centre → Display), and the kiosk's Chromium already runs on Wayland
with the text-input flags (`kiosk/sunroom-kiosk:249-251`: `--enable-wayland-ime
--wayland-text-input-version=3`), so it *could* pop up for a field. Sunroom's fields ask it not
to (`inputMode="none"`, `ui/TextField.tsx:61`) and draw their own (ADR 0022), because: squeekboard
covers roughly half the screen in landscape and can't be told to keep the field and the panel's
primary button in view, which Sunroom's does (the panel scrolls, the button pins above the keys);
it has no PIN pad, numeric or pair-code layout and no automatic capital for a title; it looks
like a phone keyboard, not the wall's type and colors; it exists only under Wayland on the Pi,
not in the `just display` preview, not under the X11 fallback, and Chromium's Wayland text-input
is young (PLAN §17 risk 5; `docs/HARDWARE.md:155` says it was never tested on the kiosk). It's a
fair trade for one component of a few hundred lines that the end-to-end suite types on. So the
keyboard stays and gets the redesign the owner asked for (T13). What it looks like today: 960 px
wide, docked bottom-**right** under the side panel (bottom-left with the rail on the right),
rounded top corners, rows centred inside its own box (`ui/Keyboard.tsx:164-172`,
`tokens.css:73`); it was placed under the panel so the hand stays near the field. Ideas weighed:
(1) **a full-width dock, keys centred** (chosen): the keyboard spans from the rail to the screen's
edge like a tablet's, with the same 80 × 64 keys centred in it, so it reads as *the screen's*
keyboard rather than a panel's, and nothing is half-covered; (2) the same 960 px box simply
centred: less change, but a floating box over the middle of the board looks like a dialog;
(3) full-width keys (150 px wide at 1920): too wide to type on; (4) a split or floating keyboard:
complexity nobody asked for. Also chosen: **a number row above the letters**, the one thing
people reach for on an iPad and miss here (times, addresses, passwords); the 123 page keeps the
symbols. Not chosen: a system-keyboard setting; if the owner ever wants to try squeekboard, the
experiment is one line (drop `inputMode="none"` on the kiosk) and a HARDWARE.md test.

**Why Light flickers and Dark "has no animation".** Nothing sets the theme before the first
paint: `index.html` has no boot script (the CSP allows only same-origin script files), and the
shell applies the household's theme only once `/api/settings` answers
(`shell/DisplayShell.tsx:141-155`). Until then the tokens follow the browser's own light-or-dark
preference (`tokens.css:16-79`, `light-dark()`), or on `/display` the pair screen's own guess
(`features/display/DisplayEntry.tsx:82-97`: Auto on the device's clock, dark from 7 PM). The
guard that is supposed to stop fades on first paint, `data-motion-ready`, is armed two frames
after the shell mounts (`DisplayShell.tsx:157-159`), almost always *before* the settings arrive.
So when Light arrives on a screen that painted dark (a browser that prefers dark, or the pair
screen after 7 PM), the board's wall snaps while the header, the rail and the Today panel
(`[data-surface]`, `motion.css:30-35`) fade their background over **2 s** and their text over
600 ms, today's column fades over 600 ms, and every button and icon over 90 ms (`.press`): the
flicker-then-fade the owner sees. Dark "has no animation" because on the owner's screens the
first paint is already dark, so nothing changes; a Dark household on a browser that prefers light
would fade the same way in reverse. The fix is three things (T5): remember the last appearance
and apply it from a tiny boot script in `<head>` before anything paints; arm the fades only after
the first appearance from settings; and make a theme change crossfade *everything* together over
the 600 ms UX §9 specifies, instead of some things snapping and some easing over 2 s.

**How plan execution spends its time, and what changes.** Batch 3's sixteen commits took about
1 h 50 min for ten tasks, and its rule was the full definition of done per task: `just check`,
`just e2e` "for what it touched" and screenshots. In practice "what it touched" was the whole
suite, because `just e2e` takes no arguments, `just test` runs everything, and the command
allowlist (`.claude/settings.json`) admits only exact `just …` commands, so any subset would have
asked for permission. What the full gate costs at CI speed: `just check` 4–5 min (pytest alone
2.6 min, one test at a time), `just e2e` about 9 min of real tests plus a build (serial by
design: one shared test server), `just screenshots` 544 images, a few minutes to take and far
more to look at. Reading the output of all of that into the session is the token cost. The
change (T0, decided with the owner): a **quick gate per task** (`just quick`: lint and typecheck,
about a minute; the touched unit tests by path; the one e2e spec on one project where a task
names one) and the **full gate once** at the end of the batch (T15) and always before a release
(the deploy skill's `just preflight` already runs it). New recipes take arguments (`just e2e
e2e/hours.spec.ts --project=display-1080p`, `just test-fe src/ui/Sheet.test.tsx`, `just test-py
tests/countdowns`) and use terse reporters, and the allowlist admits them. The risks and what
holds them: a failure found at the end has to be attributed, which the per-task spec runs and
the per-task commits make easy (run the failing spec against the task's commit); commits land on
`main` before the full gate, which is fine because nothing is pushed before a release and the
release gate is unchanged; a session that stops early leaves ticked boxes and a note. Expected
saving for a batch this size: roughly an hour of wall time and the tokens of eight full test
reports and one screenshot review. CLAUDE.md's definition of done is rewritten in those terms so
future batches inherit it.

## Decisions (decided here, with the reason; the owner can overturn any at review)

| Question | Decision |
|---|---|
| Button case | **Every button is Title Case** (the owner's choice): "Add Photos", "Save Changes", "Check Now", "New List", "Add a Device", up to five words; a button of six words or more reads as a sentence and stays sentence case ("Type the household password here instead", "Use a code from another device"). The small words stay lowercase as in titles. Toasts, hints, labels, chips, segmented options, menu items, empty-state copy and errors stay sentence case; icon-only buttons keep their screen-reader names as they are. ADR 0028's rule is narrowed to those |
| The zoom's order | **Fit the day · Zoom out · Zoom in**, left to right, the owner's "Full" being Fit the day (its name stays: it says what happens) |
| The header's today block | The date, the time and the weather are each **centred on the header's middle line** (`items-center`), AM/PM still on the time's baseline. ADR 0030 put the date on the time's baseline; against the centred 56 px weather button the time rode high and the date low |
| "Nothing on" | "Nothing today." and "Nothing else today." on the Today panel, the Today view and the phone; "Nothing planned yet. Tap a time to add." on the Day view; "Nothing planned" in the phone's day list. The People view shows a **Free day** pill (the person's 12% tint, their color's ink; neutral for Everyone) under the name: a positive word for a clear calendar, and a pill because it is a state, not an error. "Nothing on Groceries yet" is another sense and stays |
| Toasts and sheets | **A toast stays where it was raised.** One raised on the page stays on the page when a sheet opens over it (dimmed under the backdrop, timing out as usual); one raised while a sheet is open shows in the sheet. Inside a sheet the toast **floats over the bottom of the sheet's body, above its footer**, taking no layout space, so the sheet never resizes when it comes or goes. UX §4's "over a panel they sit at the panel's bottom" already says so |
| Coming Up | Countdowns always; birthdays within **Birthdays in Coming Up** (Features → Countdowns): 1 week · 2 weeks · 1 month · 3 months · Any time, default 1 month. A plugin setting, no migration. Still three lines (one in the portrait band) |
| Devices | The page is **Devices**. Two groups: **Paired Screens** on top, then **Phones & Computers**. Each row's icon says what it is (a screen, a phone, a tablet, a computer), from a `form` the server derives from the label it wrote at sign-in. **Add a Device** opens the same one-time code and QR (the sheet is "Add a Device"). "Phone" leaves the page's words where a computer could be meant |
| Empty rooms | `ui/EmptyState` becomes **centred: an icon in a soft circle, a short line, a note, and one large primary button**, and every room that uses it gets an icon, not only Lists, Tasks and Photos. The kitchen screen's Photos keeps its QR in the button's place (it has no file picker) |
| The update check | Reads the repository's **tags**, picks the highest version. A 404 says "GitHub couldn't find Sunroom's versions. It will try again tomorrow." |
| An account's calendars | **Synced first, then by name**, in the Sync and Show on sections, **ordered once when the sheet opens** so a row never moves under a finger that just switched it on |
| Apple | The chooser reads **Apple · Google · Holidays · Another calendar · A calendar server**. The account, its toasts, its sheet, the source line on events and the CalDAV error copy all say **Apple**; existing accounts named "iCloud" are renamed by a data migration (forward-only), so the family never sees two names. `docs/SYNC.md` keeps "iCloud" as the technical name of Apple's CalDAV |
| Setup's layout | From 1024 px: a centred card, **the six steps listed at the left** (done, current, upcoming) beside **the step's form at the right**, vertically centred, with the wall's title and lead sizes; Welcome and You're Set as one centred column with the brand lockup, like Pair This Screen. On a phone: one column with a six-segment progress bar. The steps and their order are unchanged |
| The keyboard | Stays Sunroom's. **A full-width dock** from the rail to the screen's edge (full width before pairing and in portrait), **keys centred**, the same 80 × 64 keys (88 × 72 portrait), and **a number row** above the letters on the letters and password layouts. Rail side no longer mirrors a dock; the dock spans whatever isn't rail |
| The e2e job | Playwright's base timeout 60 s; the two journeys `test.slow()`; the init script awaited; browsers cached; `timeout-minutes: 45`; CI's `retries: 1` kept. **The deploy skill waits for the push's CI run and reports it** (a red run is reported, never fixed silently) |
| The theme | A **boot script** (`frontend/public/theme-boot.js`, same origin, classic script in `<head>`) applies the appearance remembered in `localStorage` before first paint; the shell arms the fades only after its first apply from settings; a theme change sets `data-theme-switching` for 600 ms, under which every color property crossfades together; the 2 s daylight ease stays for the wall tint only |
| Verification | Two tiers (above). `just quick`, `just test-fe *ARGS`, `just test-py *ARGS`, `just e2e *ARGS`; terse reporters; the allowlist gains them; CLAUDE.md and PLAN §14.7 say so |
| Database | One data migration (the Apple rename). The 0.9.0 fixture, `backend/tests/fixtures/db/202610131907.sql`, **does not exist yet**, so "Before the first task" builds it |

## Before the first task

1. `just check` must be green at `cc2f06b` (confirm, don't assume).
2. **The migration fixture, again.** `backend/src/sunroom/migrations/released.lock` ends with
   `202610131907` (0.9.0) but `backend/tests/fixtures/db/` has no `202610131907.sql`, so T11's
   migration would fail `test_unreleased_migrations_are_tested_against_the_last_release`. Add
   `_v0_9_0()` to `backend/tests/fixtures/db/build.py` (as the previous seeds: everything before
   it plus a row exercising `household.display_start`), register it in `SEEDS` under
   `"202610131907"`, run `cd backend && uv run python -m tests.fixtures.db.build 202610131907`,
   commit the SQL (`tests: the 0.9.0 fixture database`). While there, add to
   `docs/RELEASING.md` and the deploy skill's checklist the line "build the fixture for the
   released revision", which batch 2 asked for and which still bites.
3. `just screenshots` once at `cc2f06b` into `.screenshots/before-0.9.1/` (gitignored), the
   "before" for T15.

## Tasks

### T0 The quick gate: recipes, the allowlist, the rule

- [x] Done (commit: "tooling: a quick gate per task, the full gate per batch")

**Owner's note.** "Most of the time it takes hours and I suspect a large chunk is due to testing.
Is there a way to build a plan and run tests at the end? Propose a solution to save some time and
hopefully tokens for future plan execution."

**What exists.** `justfile`: `lint` (`:60`, kiosk-lint, ruff, eslint, prettier), `typecheck`
(`:70`, pyright, `tsc -b`), `test` (`:75`, all of pytest and Vitest), `check` (`:110`), `build`
(`:115`), `e2e: build` (`:119`, no arguments), `screenshots: build` (`:123`).
`.claude/settings.json:4-17`: the exact-`just` allowlist (`just smoke-image *` is the one
wildcard). `frontend/playwright.config.ts:20`: the `list` reporter locally. `CLAUDE.md`
"Definition of done" and `docs/PLAN.md` §14.7 (`:726-728`): the seven steps, per unit of work.
`CLAUDE.md:89` says "CI runs exactly this" of `just check`; CI runs the same steps split into
jobs plus `just e2e` and the secrets scan (`.github/workflows/ci.yml`).

**Build.**
- `justfile`: `quick: lint typecheck` (a comment: the per-task gate); `test-fe *ARGS`:
  `cd frontend && pnpm exec vitest run --reporter=dot {{ARGS}}` (a file, a folder, or
  `related src/ui/Sheet.tsx`); `test-py *ARGS`: `cd backend && uv run pytest -q {{ARGS}}`;
  `e2e *ARGS: build` → `cd frontend && pnpm exec playwright test {{ARGS}}` (no arguments runs
  everything, as before). The table of commands in `CLAUDE.md` gains the four.
- `playwright.config.ts:20`: the local reporter becomes `"line"` (CI keeps list + html).
- `.claude/settings.json`: `Bash(just quick)`, `Bash(just test-fe *)`, `Bash(just test-py *)`,
  `Bash(just e2e *)`.
- `CLAUDE.md` "Definition of done" becomes two tiers: per unit of work, `just quick`, the touched
  unit tests, the touched e2e spec on one project, docs, CHANGELOG, scan, commit; at the end of a
  batch and before any release, `just check`, `just e2e`, `just screenshots` reviewed against UX
  §10, `just scan`. "Commit after each green unit of work" says green means the quick gate. Fix
  the CI sentence. Keep the file under 15 KB (it is 14.5 KB: move a gotcha line or two to
  `docs/GOTCHAS.md` if needed). PLAN §14.7 says the same in a paragraph.

**Tests.** None of its own. Prove the recipes: `just quick`; `just test-fe src/lib/toast.test.ts`;
`just test-py tests/test_updates.py`; `just e2e e2e/hours.spec.ts --project=display-1080p`.

**CHANGELOG.** Nothing the family sees; under Fixed, "Behind the scenes: checks can run for one
test file or one screen at a time."

### T1 Every button in Title Case

- [x] Done (commit: "frontend: every button in Title Case")

**Owner's note.** "Photos view the buttons in the header should be capitalized." (And, in other
notes, "Add a Device", "New List", "New Task", "Add Photos".) The owner chose Title Case for every
button.

**What exists.** UX §2 (`docs/UX.md:86`, ADR 0028 row 18): action buttons are sentence case.
About 210 `<Button` tags in `frontend/src`; the two-plus-word ones are the work ("Add photos",
"Start screensaver" in `features/screensaver/PhotosRoom.tsx:46-70`; "New list" in
`lists/ListsRoom.tsx:42-56` and `ListsTab.tsx:29-41`; "Clear done", "Change list"; "Add task";
"Copy last week" in `meals/MealsRoom.tsx:116-125`; "Add countdown" in
`countdowns/CountdownsRoom.tsx:189-198`; "Save changes", "Check now", "Back up now", "Pair a
display", "Add a phone", "Make a new code", "Sign out of this phone", "Child's phone", "Take it
back" on a toast, and the rest). `styles/designRules.test.ts:19-34, 131-135` checks only
`title="…"` literals, h1–h3 text and the Settings page names. Locators: 84 Vitest role-name
locators with sentence-case names (Testing Library matches case), 224 in e2e, of which only the
`exact: true` ones (141 in all, some of them these) match case: Playwright's plain string names
are case-insensitive.

**Build** (one commit; the mechanical part is a grep-driven sweep, `>[A-Z][a-z]+( [a-z]+)+<`
across `*.tsx`, plus `label=`/`actionLabel`/`primary` props and template strings).
- The rule, in `docs/UX.md` §2's Case paragraph: buttons join titles and navigation in Title
  Case, up to five words; six or more stays a sentence; the same small words; what stays sentence
  case, listed. The "Buttons and their toasts" list is recased (the toasts stay as they are). The
  Button column of UX §8's table.
- `lib/words.ts` (or wherever `isTitleCase` lives for the design-rules test): a `titleCase(s)`
  helper if the test needs it; the test gains a scan of every literal child of `<Button …>…
  </Button>` (multi-line too), of `actionLabel:` strings and `label=` props on `ActionBar`,
  `PanelActions` and `Button`, failing on a two-to-five-word label that isn't Title Case.
- Every label, every Vitest locator (`getByRole("button", { name: "Save Changes" })`), every
  `exact: true` e2e locator. Icon-only buttons' `aria-label`s are untouched (they are names, not
  words on screen).
- T8 and T9 add their buttons already in Title Case.

**Tests.** The design-rules test is the test. `just quick`, `just test-fe` (all of it: this
touches everything), then `just e2e e2e/lists.spec.ts --project=display-1080p` and
`e2e/sync.spec.ts --project=phone-webkit` as spot checks.

**CHANGELOG.** "Buttons are written the way titles are: Add Photos, Save Changes, Check Now."

**As built.** Two words the plan's rule didn't settle: **"from"** joins the small words ("Hide
from Screensaver"; the plan's own "Code from Another Device" assumed it), and the "in" of
signing in may keep its capital ("Sign In Again", "Sign In on This Phone"), since "Sign in
Again" reads as a mistake; Google's Sign in with Google stays as Google writes it. The check
reads the JSX through the TypeScript parser rather than a regex (an attribute's `=>` ends a
regex's tag), every way a conditional or template can come out, plus header links, `action`
and `submit` props and toast actions; labels a function returns (Unpair This Screen, the
scope chooser's Just This One · This and the Ones After · All of Them, a meal's Add Dinner)
were cased by hand. Also recased: links that look like buttons (Download Backup, Download
Everything), the file pickers (Add a Photo, Upload the Key File), the tips and docs that name a
button in a sentence ("tap Add a Countdown"), and every bolded button name in UX, PLAN, SYNC,
DEPLOY and RESTORE. Only nine unit-test locators failed (most match by regex), and
`e2e/sync.spec.ts` runs on `desktop` and `display-1080p`, not `phone-webkit`, where every test
skips itself. ADR 0032 is started here and grows a row per task.

### T2 The zoom's order

- [x] Done (commit: "calendar: the zoom reads Fit the day, Zoom out, Zoom in")

**Owner's note.** "Re-order the zoom icons in Week view to 'Full | Zoom Out | Zoom In'."

**What exists.** `features/calendar/ZoomControl.tsx:27-65`: a `role="group"` named Zoom at the
grid's bottom-right with three icon buttons, **Zoom out** (`:33-43`), **Fit the day**
(`Maximize2`, `:44-54`), **Zoom in** (`:55-65`). "Full" is Fit the day. Named in
`e2e/hours.spec.ts:57-73, 110-137`, `shell.spec.ts:571-593`, `screenshots.spec.ts:148-159`,
`a11y.spec.ts:457-466`; `docs/UX.md:228, 850`; `features/tips/tips.ts:27`.

**Build.** Move Fit the day first: Fit the day · Zoom out · Zoom in. Names, icons and disabled
rules unchanged. `UX.md:228` and `:850` read in the new order; the tip too if it names them.

**Tests.** `just e2e e2e/hours.spec.ts --project=display-1080p` (if `:57-73` asserts an order,
update it; add "Fit the day is the first button in the group").

**CHANGELOG.** "On the Hours grid the zoom's buttons read Fit the day, Zoom out, Zoom in."

### T3 "Nothing today", and a free day on the People view

- [x] Done (commit: "calendar: Nothing today, and a Free day on the People view")

**Owner's note.** "'Nothing on today' should be 'Nothing today'. Also, the People view shouldn't
say 'Nothing on'. Can you come up with a different idea to indicate that person has a clear day?"

**What exists.** `features/calendar/TodayPanel.tsx:140` ("Nothing else on today." /
"Nothing on today."), `TodayView.tsx:37`, `phone/TodayScreen.tsx:150`, `DayView.tsx:142`
("Nothing on this day yet. Tap to add."), `PhoneLists.tsx:184` ("Nothing on this day").
`PeopleView.tsx:31-79`: one column per person (Everyone first), avatar, name, and at `:71` a
small grey "Nothing on"; the chores plugin adds the person's tasks under it when they have any.
`docs/UX.md:735-737` (the §8 rows), `:252`.

**Build.**
- The words: "Nothing today." and "Nothing else today."; the Day view "Nothing planned yet. Tap a
  time to add."; the phone's day list "Nothing planned".
- The People view: in place of `:71`, a `<p>` styled as a pill, `rounded-full px-5 py-2
  text-d-secondary font-semibold` with the person's 12% tint and their color's ink (the same
  tokens an event chip of theirs uses; neutral for Everyone), reading **Free day**, centred under
  the name. It stays when tasks follow (free of events is what a calendar column can say).
- UX §8 rows 736–737 and the People paragraph.

**Tests.** None assert these words today. Add to `e2e/calendar.spec.ts` (People view): a member
with no events shows "Free day". `just e2e e2e/calendar.spec.ts --project=display-1080p`.

**CHANGELOG.** "The Today panel says 'Nothing today'; on the People view a clear day reads
'Free day'."

**As built.** The pill's words are the event chips' ink on the person's tint, not the person's
own color (`text-p-text`): in the dark theme that color on its own 24% tint is 3.4:1, under AA
for 20 px text. Everyone's neutral pill (ink on `--line`) is 11:1 light and dark. UX §8 gains a
row for the Day view's empty day.

### T4 The header: today's three things on one line

- [x] Done (commit: "shell: the header's date, time and weather on one middle line")

**Owner's note.** "The time in the header isn't aligned with the date or weather text."

**What exists.** `shell/Header.tsx:17-42` `HeaderToday`: `flex items-baseline gap-x-6`, the date
(`text-d-body font-bold`, 24/32) on the time's baseline (`text-d-glance font-extrabold`, 40/48,
`ui/Digits` boxes, AM/PM at 20 beside it), then the weather block `self-center`
(`features/weather/WeatherBlock.tsx:38-75`: a 56 px `min-h-tap` button with the icon, the
temperature at 32 and the high over the low at 18). The header is 80 px (`--header-h`,
`tokens.css:71`). The baseline pair sits flush with the top of the flex line while the 56 px
weather is centred, so the time rides above the weather's middle and the date sits low. Specified
that way by ADR 0030 (`docs/UX.md:134`, `:846`).

**Build.** `items-center` on the block; the date and the time blocks `self-center`; AM/PM stays
on the time's baseline inside its `<p>`. Measure at 1920 Standard, Small and Extra large and in
portrait that the row is still one line and 80 px (`e2e/shell.spec.ts:230` keeps its ≤ 84 px).
Docs: `UX.md:134` ("the date in bold on the time's baseline" → "the date, the time and the
weather centred on the header's middle line"), `:846`; ADR 0030's header row gets "changed by
0032: centred".

**Tests.** `just e2e e2e/shell.spec.ts --project=display-1080p -g "header"`; the 1920 and portrait
header shots in T15.

**CHANGELOG.** "In the header the date, the time and the weather line up."

**As built.** There is no test named "header" in `shell.spec.ts`; the header's geometry is in
"lays out its rail or bottom bar, the board and Today", which now measures the date's, the
time's and the weather's middles within 2 px on both wall projects. With the old baseline
layout it measured 7 px.

### T5 The theme: right from the first paint, and one crossfade

- [x] Done (commits: "theme: the first paint is the remembered one", "theme: a change crossfades
  everything together")

**Owner's note.** "Look at the animation when the page is refreshed or the theme is changed.
Several areas flicker with a different color and slowly fade to the chosen theme. It seems to be
only when the theme is set to 'Light'. Dark mode doesn't have the flicker but also it doesn't
have any animations. It is mainly the header, left and right rails, icons, buttons, and 'Todays'
column that I noticed, but check everywhere."

**What exists.** The mechanism is in "Answers" above. The pieces: `lib/theme.ts:58-77`
`applyAppearance` (sets `data-theme`, `data-daypart`, `data-text-size`, `data-reduce-motion`),
`:79-86` `allowAppearanceMotion` (sets `data-motion-ready` after two frames);
`shell/DisplayShell.tsx:141-159` (apply once settings exist; arm motion on mount);
`features/display/DisplayEntry.tsx:82-97` `Frame` (Auto on the device clock before pairing);
`lib/quietTheme.ts:16-33` (Auto's sunrise and sunset wait for 10 s idle); `styles/motion.css:30-35`
(`body`, `[data-surface]`: background 2000 ms, color 600 ms, gated on `data-motion-ready`),
`:40-42` (`.day-column`, 600 ms), `:55-61` (`nav[data-rail-motion]`: background 2000 ms and color
600 ms with no gate, plus width), `:88-92` `.press` (90 ms), `:98-100`, `:111-117`, `:324-328`,
`tokens.css:324-347` (switches); `tokens.css:16-100` (the tokens; `--wall` by daypart, `:88-100`;
`html`/`body` backgrounds `:242-267`); the shell root `bg-wall` (`DisplayShell.tsx:299-303`, no
transition: it snaps at a daypart step too). `index.html:6-10` (`color-scheme`, `theme-color`).
The CSP: `script-src 'self'` (`web/headers.py:19-23`); `vite.config.ts:26` precaches
`**/*.{js,css,html,…}` so a file in `frontend/public/` is served and cached. UX §9: theme switch
600 ms crossfade, daylight 2000 ms for the wall tint; `UX.md:715` says 500 ms (wrong).

**Build, in two commits.**

*a. `theme: the first paint is the remembered one`.*
- `lib/theme.ts`: `applyAppearance` also writes what it resolved (`{ v: 1, theme: "light" |
  "dark", daypart, textSize, reduceMotion }`) to `localStorage["sunroom.appearance"]` (try/catch);
  `rememberedAppearance()` reads and validates it.
- `frontend/public/theme-boot.js`: a classic script, no module, a dozen lines in a try/catch: read
  the key, set the same four `data-*` attributes on `document.documentElement`. Loaded from
  `index.html` `<head>` as `<script src="/theme-boot.js"></script>` before Vite's tags. It is
  precached by the glob; confirm it is in `dist/` after `just build` and that the service worker's
  manifest lists it.
- `DisplayShell.tsx`: `allowAppearanceMotion()` leaves the mount effect and runs once, after the
  first `applyAppearance` with real settings (a ref). `PhoneShell`: the same if it arms motion.
  `DisplayEntry.tsx` `Frame`: prefer `rememberedAppearance()` when there is one; guess only when
  there isn't.
- Vitest `theme.test.ts`: the memory is written and read back, malformed is ignored; `theme-boot`
  loaded as text and run in jsdom with a seeded `localStorage` sets `data-theme`.

*b. `theme: a change crossfades everything together`.*
- `applyAppearance`: when `data-theme` changes and motion is armed, set `data-theme-switching`
  on `<html>` and clear it after 600 ms (at once under Reduce motion).
- `motion.css`: `:root[data-motion-ready][data-theme-switching] *,
  :root[data-motion-ready][data-theme-switching] *::before, …::after { transition: background-color
  var(--motion-crossfade) linear, color …, border-color …, fill …, stroke …, box-shadow …; }`.
  The `[data-surface]` rule drops its 2 s background (a surface's background changes only with
  the theme; the switching rule now carries it) and keeps nothing else; the daylight 2 s ease
  moves to what draws the wall: `body` and `[data-shell]` (and the pair screen's `<main>`), so a
  tint step eases as UX §9 says. `nav[data-rail-motion]` keeps width and flex-basis only. Check
  the Reduce motion block (`motion.css:455-495`) covers the new selector (0.01 ms).
- `UX.md:715` → 600 ms; UX §9's Theme switch row says "every color at once"; GOTCHAS gets the
  line "a fade that only Light showed: the theme arrived after the fades were armed".

**Tests.** e2e `shell.spec.ts` (the wall): "paints its theme before anything else and never fades
it in": seed, PATCH `theme: "dark"`, open the paired wall, wait for `html[data-theme="dark"]`,
then `page.addInitScript` recording `document.documentElement.dataset.theme` on
`DOMContentLoaded` into `window.__themeAtLoad`, reload, assert `__themeAtLoad === "dark"` and
that `data-motion-ready` appears only after `data-theme`; then PATCH `theme: "light"` and assert
`html[data-theme-switching]` shows within 2 s and is gone within 2 s more. Put the theme back.
`just e2e e2e/shell.spec.ts --project=display-1080p -g "theme"`. By hand in `just display` with
the Mac in Dark appearance and a Light household: a refresh shows no fade; Settings → Display →
Theme switches crossfade the whole screen once, both ways.

**CHANGELOG.** "A refresh paints the screen in its theme straight away: the header, the rails,
the buttons and today's column no longer show another color and fade. Changing the theme
crossfades everything together."

**As built.** `applyAppearance` returns what it put on `<html>` and the shells call
`rememberAppearance` with the household's choices (theme choice, daylight tint, sun times), so
the pre-pairing `Frame`, which renders while a paired wall finds out that it is, can keep a
memory under five minutes old exactly (`showAppearance`) and otherwise follow the remembered
choices by its clock; it never writes the memory itself, or an unpaired screen's 6 PM guess
would stick past 7 PM. The boot script is linted as a browser script (`eslint.config.js`). The
e2e test runs on a browser that prefers light with a Dark household and checks the theme when
the page has loaded and when the fades are armed, with no memory, with the right one and with a
wrong one; with the fades armed on mount (the old code) it reads "light". The `data-surface`
markers went with the rule that used them. Not done here: Auto across a sunrise or sunset while
the screen is off paints the remembered theme, then snaps (no fade) when the settings arrive.

### T6 Toasts stay put, and float inside a sheet

- [x] Done (commit: "frontend: a toast stays where it was raised, and floats in a sheet")

**Owner's note.** "When a modal is already open when a toast notification is visible, the modal
shifts when it disappears. Also, if you open a modal when a toast is visible, it moves the toast
inside the modal (i.e. Edit a Person in the settings to see)."

**What exists.** `lib/toast.ts:16-26, 56-74` (the store; anchors are a stack, the newest wins);
`ui/ToastAnchor.tsx:13-25` (a `role=status` div, default `absolute inset-x-0 bottom-full mb-2`,
registered by `ui/ActionBar.tsx:9` and `ui/Sheet.tsx:158`); `ui/StatusLayer.tsx:117-182`
`ToastRegion` (`AnimatePresence mode="popLayout"`; `:168` portals *every* toast into the anchor
when there is one, else the fixed region). `ui/Sheet.tsx:155-158`: the anchor sits in the
dialog's flex column between the body and the footer, `not-empty:pb-3`, "in the layout, not over
it, so they never cover the sheet's buttons". So: a toast on the page jumps into a sheet that
opens; inside, it adds its height plus 12 px; when it leaves, `popLayout` yanks it out of flow and
the sheet shrinks twice. `ui/PinDialog.tsx` has no anchor (a toast under it sits under the
backdrop; left as is).

**Build.**
- `lib/toast.ts`: a toast records `anchor: currentAnchorId()` when raised (null on the page).
  `ToastRegion` renders two `AnimatePresence` groups: toasts whose anchor is the live one go
  through the portal; every other toast draws in the fixed region (under a sheet's backdrop if
  one is open: it is already on its way out). When an anchor unregisters, its toasts fall back
  to the region, as today.
- `ui/Sheet.tsx`: wrap the body region in `relative flex min-h-0 flex-1 flex-col`; the anchor
  becomes `absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-3
  pointer-events-none` inside it (the toasts are `pointer-events-auto`), so it floats over the
  last few lines of the body and never over the footer; `not-empty:pb-3` goes. The display sheet
  the same.
- `docs/UX.md` §4 toasts line: "inside a sheet a toast floats over the bottom of its body, above
  the buttons, and never moves the sheet; a toast that was on the page stays on the page".

**Tests.** Vitest `StatusLayer.test.tsx`: raised before an anchor registers → stays in the
region after it registers; raised after → in the anchor; anchor gone → back in the region.
`Sheet.test.tsx`: the anchor is absolutely positioned and the dialog's box doesn't change when a
toast is added and removed. e2e `shell.spec.ts` (the wall): Settings → Family → Edit Mia → Save
Changes (toast "Changes saved"), reopen Edit Mia while it shows: `dialog` holds no `[data-toast]`,
and the dialog's bounding box is the same before and after the toast is gone; then from inside
the sheet, something that toasts (if nothing in Edit Mia does, use an account's Refresh Now in
`sync.spec.ts`) shows inside the dialog and the dialog's box doesn't change.
`just e2e e2e/shell.spec.ts --project=display-1080p -g "toast"`.

**CHANGELOG.** "A sheet no longer shifts when a toast fades, and a toast no longer jumps into a
sheet that opens over it."

**As built.** The anchor a toast was raised in is kept on the toast itself (the element), and
`lib/toast` keeps every anchor on screen with a stable key, so `ToastRegion` draws one group
per anchor plus the fixed region. Two things the plan missed: **sheets that pin their primary
button in the body** (`ui/PanelActions`: a task's, a reward's, a routine's, an item's, a saved
meal's) would have had the toast float over that button, so in a sheet a pinned bar takes the
toasts just above itself (`ui/sheetToasts`, a small context; a side panel's bar doesn't);
and nothing in Edit Mia, or an account's Refresh Now, raises a toast while the sheet stays open,
so the end-to-end test raises one with the update notice (the wall waits to refresh while a
sheet is open). In Edit a person, whose buttons sit at the end of its body, a toast raised in
it covers the last lines (Remove Mia) for its 8 seconds, as the plan chose.

### T7 Coming Up: birthdays within a window

- [x] Done (commit: "countdowns: Coming Up shows birthdays within a window")

**Owner's note.** "Some 'Coming Up' items (i.e. birthdays) seem pretty far out. When do 'Coming
Up' items get shown now? Can there be a setting to limit the 'time until' …? Also think about
adding an override to countdowns … Keep in mind to not make it overly complicated." The answer
and the chosen rule are in "Answers".

**What exists.** `plugins/countdowns/plugin.py:30-38` (`settings_spec`: one `ParamField
("birthdays", …, "bool", default=True)`); `plugins/spec.py:40-76` (`ParamField`, `"choice"` with
`choices` and `choice_labels`); `plugins/lists/plugin.py:27-35` (`auto_clear_days`, the pattern:
choices `("never","1","3","7")`, labels `("Never","1 day","3 days","1 week")`);
`features/settings/PluginSettingsForm.tsx:233-257` (a choice of at most six options and 40
letters draws as a `Segmented`); `plugins/countdowns/service.py:215-238` `upcoming()` (`_shown_to`
`:92-94`, `_soonest` `:161-163`), `router.py:40-49`; `domain/countdowns.py:28-36` (next dates);
`backend/tests/countdowns/test_upcoming.py`; `features/countdowns/ComingUp.tsx:18, 65, 108-110`;
`docs/UX.md:146` ("the two nearest countdowns"), `:443` (the Features row), `docs/PLAN.md:397`.

**Build.**
- `countdowns/plugin.py`: after `birthdays`, `ParamField("birthdays_within", "Birthdays in Coming
  Up", "choice", default="30", choices=("7", "14", "30", "90", "any"), choice_labels=("1 week",
  "2 weeks", "1 month", "3 months", "Any time"))` with the hint "Countdowns you add always show
  in Coming Up. Birthdays further out still show on the board on their day." (if `ParamField`
  has no hint, add one to the spec and the form: `PluginSettingsForm` draws it under the control
  in `text-ink-soft`, as `Row hint` does).
- `service.py upcoming()`: read `birthdays_within` through `ctx.settings()`; keep a birthday only
  when its next date is within that many days of today (today is 0; `"any"` keeps all);
  countdowns are not filtered. Sort and `limit` as today.
- `UX.md:146` → "the three nearest countdowns, and birthdays within the Birthdays in Coming Up
  window"; `:443` names the setting and its default; PLAN §13 (countdowns) one line.

**Tests.** `test_upcoming.py`: the default hides a birthday 45 days out and shows one 20 days out;
`"7"` hides one 10 days out; `"any"` keeps all; a countdown 200 days out shows under every
setting; the three-line cap still holds with mixed kinds. `just test-py tests/countdowns`. e2e
`countdowns.spec.ts`: Features → Countdowns shows the Segmented "Birthdays in Coming Up" and
choosing "1 week" saves (then put it back in `finally`: the test server keeps plugin settings).
`just e2e e2e/countdowns.spec.ts --project=display-1080p`.

**CHANGELOG.** "Coming Up on the Today panel shows birthdays only within a window (a month by
default; Settings → Features → Countdowns → Birthdays in Coming Up). Countdowns you add always
show."

**As built.** The Countdowns room lists from the same `GET /api/countdowns/upcoming` (with no
limit), so filtering birthdays there would have hidden them from the room that "always lists
everything". The window applies only when the Today panel's block asks with `coming_up=true`
(`useComingUp` on the frontend; `useUpcoming` lost its unused `limit`). `ParamField` already had
`help`, which the form draws under a choice. The plugin's version stays 1.0.0: a new key with a
default is read as its default from stored settings (PLUGINS.md bumps only for a rename or a
reshape).

### T8 Devices

- [x] Done (commit: "settings: Devices, with Paired Screens and Phones & Computers")

**Owner's note.** "Rename 'Phones & Screens' to 'Devices'. Currently it lists my desktop under the
'Phones' section. Computers/Phones can be in the same group, and instead of 'Add a phone' it
should be 'Add a Device'. 'Screens' should remain a separate group at the top like it is now.
Perhaps even renamed to 'Paired Screens'."

**What exists.** `features/settings/pages.ts:9` (`devices: "Phones & Screens"`),
`SettingsScreens.tsx:31`; `features/settings/DevicesPage.tsx` (groups "Screens" `:138-160` with
"Pair a display", "Phones" `:161-176` with "Add a phone"; rows `:87-134`: `Monitor` for a kiosk,
`Smartphone` for everything else; `signOutLabel` `:27-30`; "Child's phone" `:122`; "a child's
phone" `:107`); `AddPhoneSheet.tsx` (title "Add a Phone", the copy at `:49-51`);
`features/auth/SignInScreen.tsx:85, 108` and `JoinScreen.tsx:79` ("Use a code from another
phone"); `features/onboarding/SetupWizard.tsx:168-169` ("then Phones & Screens"). Backend:
`auth/password.py:103-132` `device_label` (the vocabulary: iPhone, iPad, Android phone, Android
tablet, Chromebook, Mac, Windows PC, Linux computer, Device, plus the browser); `auth/schemas.py:
41-49` `DeviceOut`; `auth/models.py:15-41` (`DeviceKind` PHONE or KIOSK, no form column); only
the kiosk renames its label (`DisplayEntry.tsx:323`), so a phone's or computer's label is always
one `device_label` wrote. Docs: `UX.md:449, 602, 604, 751`, `PLAN.md:414, 468, 529, 533`; tests:
`a11y.spec.ts:32, 321-323, 628-629`, `first-run.spec.ts:122-125`, `screenshots.spec.ts:39,
453-459, 805-810`, `shell.spec.ts:63, 904`, `styles/designRules.test.ts:131-135` (the page names).

**Build.**
- Backend: `device_form(kind, label) -> Literal["screen","phone","tablet","computer"]` beside
  `device_label` (kiosk → screen; iPad and Android tablet → tablet; Chromebook, Mac, Windows PC
  and Linux computer → computer; the rest → phone); `DeviceOut.form` filled where devices are
  listed (`auth/router.py:214`); `just api-types`; a test per word in `backend/tests/` beside
  `device_label`'s.
- `pages.ts`: **Devices**. `DevicesPage.tsx`: groups **Paired Screens** and **Phones &
  Computers**; the row's icon by `form` (`Monitor`, `Smartphone`, `Tablet`, `Laptop`); the
  current device's sign-out reads "Sign Out of This Phone / Tablet / Computer" by its form,
  others "Sign Out", screens "Unpair This Screen" / "Unpair"; "Child's Device" / "Not a Child's
  Device", the subtitle "a child's device", the note "Set a parent PIN in Family to mark a
  child's device."; the button **Add a Device**; the empty line for screens unchanged.
- `AddPhoneSheet.tsx` → `AddDeviceSheet.tsx`, title "Add a Device": "On the new phone or tablet,
  open the camera and point it at this code. On a computer, open {the address under the code}."
  then "Or, on the new device's sign-in screen, tap **Use a code from another device** and
  type:"; the rest as is. `SignInScreen.tsx:85` "Use a code from another device", `:108` "Code
  from Another Device"; `JoinScreen.tsx:79`. The wizard's You're Set: "then Devices".
- Docs: `UX.md:449` (the row: Devices; Paired Screens with This screen, Pair a Display; Phones &
  Computers with the form icons, Add a Device, Sign Out), `:602, 604, 751`; `PLAN.md:414, 468,
  529, 533`; the two Unreleased CHANGELOG lines that say Phones & Screens say Devices.

**Tests.** The specs above (`"Devices"`, `"Add a Device"`, `"Paired Screens"`), the design-rules
page list; Vitest for `DevicesPage` if one exists (icons by form). `just test-py tests/test_auth*`;
`just e2e e2e/shell.spec.ts --project=desktop -g "Devices"` (a computer sees a laptop icon).

**CHANGELOG.** "Settings → Phones & Screens is now Devices: Paired Screens on top, then Phones &
Computers, each with the right icon (a computer was listed as a phone). Add a Device replaces Add
a phone."

**As built.** `DeviceFormName` lives beside `DeviceKindName` in `auth/schemas.py`, and
`device_form` beside `device_label`. "Code from another device" is the sign-in field's label, so
it stays sentence case (the plan wrote it as a title). Add a Device writes the code's address
under the QR for a computer. The end-to-end fixture's extra phone (`phone()` in
`e2e/fixtures.ts`) now sends the Pixel 7's user agent: it was Chromium's desktop one at phone
size, so the first-run test's phone became "This Computer". There is no Vitest for
`DevicesPage`; the laptop test checks the groups, the icons by form and Add a Device.

### T9 Empty rooms: an icon, a line, one big button

- [ ] Done (commit: )

**Owner's note.** "In the Lists, Tasks, Photos views, redesign the 'empty' view to show an icon,
a message indicating that nothing was found, and a large button to add a new one (i.e. 'New
List', 'New Task', and 'Add Photos')."

**What exists.** `ui/EmptyState.tsx:8-28` (`message`, `note?`, `action?`; left-aligned, no icon,
`py-6`/`py-4`). Lists: `lists/ListsRoom.tsx:58-70` ("Lists live here: groceries, to-dos, packing.
Everyone sees them, on the wall and on their phone." with New list), `ListsTab.tsx:43-44` (no
button). Tasks: `chores/ChoresRoom.tsx:76-82` ("Tasks live here. Give each person a few, and watch
them get stamped." with Add task), `ChoresTab.tsx:76-77`. Photos: `screensaver/PhotosRoom.tsx:
72-85` (the kiosk's QR box "Add photos from a phone: open Sunroom, then More, then Photos.", the
line "Photos added from a phone or a computer show here and on the screensaver.", no button;
`AddPhotosButton.tsx:24` hidden on the kiosk), `PhotosTab.tsx:28, 49`. The other rooms' empty
states (Countdowns, Saved Meals, Rewards, Routines, Meals) are in UX §8's table (`UX.md:731-754`);
grep `<EmptyState` for which use the primitive.

**Build.**
- `ui/EmptyState`: props `icon: LucideIcon`, `title`, `note?`, `action?: ReactNode` (the one
  button, already a primary `Button`). Centred column, `text-center`: the icon inside a circle of
  `bg-lit` (112 px with a 56 px icon on the wall, 80 and 40 on phones), the title (`text-d-title
  font-bold` / `text-row font-bold`), the note (`text-d-secondary text-ink-soft`, `max-w-prose`),
  the button (wall: `min-h-tap-primary px-10 text-d-body`; phone: 48 px). On the wall the section
  takes the room's height and centres (`flex-1 grid place-items-center py-12`); on a phone it
  starts a third of the way down (`pt-12`) so it never fights the bottom bar.
- Lists: `ListChecks`, "No lists yet", note "Groceries, to-dos, packing: everyone sees them on
  the wall and on their phones.", **New List** (opens New List as the header's does; the phone's
  bottom bar keeps its own). Tasks: `ListTodo`, "No tasks yet", "Give each person a few, and
  watch them get stamped.", **Add Task** (the room's add path; the phone's add sheet). Photos:
  `Images`, "No photos yet", "Photos added from a phone or a computer show here and on the
  screensaver.", **Add Photos** (the picker, as `AddPhotosButton`); on the kitchen screen the
  QR box and its sentence sit where the button would. Countdowns `Hourglass` with **Add
  Countdown**; Saved Meals `BookOpen`; Rewards `Star`; Routines `ListOrdered`; each keeps its
  sentence as the note under a short title ("No countdowns yet", …). A list with no items keeps
  its quiet line and focused field (it is not an empty room).
- `docs/UX.md` §8: the table's copy column becomes title + note; a sentence above it describes
  the shape.

**Tests.** Vitest `EmptyState.test.tsx` (icon, title, note, the button). e2e `lists.spec.ts`,
`chores.spec.ts` (the empty room shows **New List** / **Add Task** and tapping opens the add);
`screenshots.spec.ts` gains `lists-empty`, `tasks-empty`, `photos-empty` on the 1920 and phone
projects if they aren't there; the tap check (the button ≥ 64 px on the wall).
`just e2e e2e/lists.spec.ts --project=display-1080p`, `e2e/chores.spec.ts --project=phone-webkit`.

**CHANGELOG.** "An empty room (Lists, Tasks, Photos, Countdowns and the rest) shows an icon, what
goes there, and one big button to add the first thing."

### T10 The update check reads the tags

- [ ] Done (commit: )

**Owner's note.** "When I click 'Check now' in 'Check for new versions daily' it shows the text
'GitHub's answer wasn't one Sunroom could read. It will try again tomorrow.'" The cause is in
"Answers".

**What exists.** `core/updates.py:21` `RELEASES_URL`, `:72-93` `check()`, `:96-105` `_tag_of`;
`meta/updates.py:73-91` (the routes; Check now is parent-only, 409 when off, 429 within a
minute); `settings/AboutPage.tsx:93-172`; `backend/tests/test_updates.py:138-156`; PLAN §13.6.

**Build.** `TAGS_URL = "https://api.github.com/repos/ScopeXL/assistant-calendar/tags?per_page=100"`;
`_latest_of(content)`: the highest `parse`-able `name` in the list (`0.10.0` sorts above `0.9.1`
as tuples); `check()`: not ok → "GitHub couldn't find Sunroom's versions. It will try again
tomorrow."; ok but unreadable or empty → the existing line; the docstring and PLAN §13.6 say
tags. Headers and the 256 KB cap unchanged; `made_up` unchanged.

**Tests.** `test_updates.py`: a tags payload with v0.9.1, v0.10.0 and a stray tag picks 0.10.0;
`[]` and a non-list are unreadable; a 404 gives the new line. `just test-py
tests/test_updates.py`. By hand: `curl -s "$TAGS_URL" | head -c 300` on the Mac shows tag names
(not run by the app in test mode; `made_up` answers there).

**CHANGELOG.** Under Fixed: "Check now in About found no versions: Sunroom's versions on GitHub are
tags, not releases. It reads them now."

### T11 Accounts: synced first, Apple, the order

- [ ] Done (commit: )

**Owner's notes.** "When editing a connected calendar, show the sync'd calendars at the top of
the list." "When adding an account, rename iCloud to Apple, and change the order to: 'Apple,
Google, Holidays, Another calendar, A calendar server'."

**What exists.** `features/sync/AccountSheet.tsx:234-268` (Sync and Show on map
`account.calendars` as they come: the server orders by `created_at`, which is the same for every
calendar of a new account, so it's discovery order; `plugins/calendar_sync/service.py:63-83`).
`features/sync/AddAccount.tsx:34-57` (the step keys and `TITLES`, `icloud: "iCloud"`),
`:114-128` (the chooser: Google, iCloud, Another calendar, Holidays, A calendar server),
`:536-545` (iCloud posts to `/accounts/caldav` with `https://caldav.icloud.com`; there is no
`icloud` provider id: `schemas.py:15`). Where "iCloud" is a word the family sees: the stored
account name (`service.py:606-608`, `name = "iCloud" if icloud else host`), `source_label`
(`:194-195`), `caldav.py:82-86, 346, 363, 409` (error copy), `plugin.py:33`,
`features/sync/data.ts:43, 48`, `AccountSheet.tsx:505`, `AccountsSection.tsx:88`,
`SetupCalendars.tsx:7, 15`, `drawings.tsx:5, 187-188, 204-205, 233-234`,
`calendar/EventSheet.tsx:69`; tests `AccountSheet.test.tsx`, `SyncPill.test.ts`,
`EventSheet.test.ts`, `drawings.test.tsx`, `designRules.test.ts:39, 116`,
`e2e/sync.spec.ts:187, 339-343, 355-356`, `screenshots.spec.ts:349-363, 538-583`,
`fixtures.ts:170`, `backend/tests/sync/test_caldav.py` (hosts mostly). Docs: `UX.md:78, 92, 94,
269, 444, 521, 602, 625, 635, 750, 770`; `SYNC.md:3, 17, 77-123` (technical; stays);
`README.md:13`.

**Build, in two commits.**

*a. `sync: an account's sheet lists the calendars that sync first`.* `AccountSheet`: when the
sheet opens, take `account.calendars`, order synced first then by name (`localeCompare`), and
keep that order in state until it closes; Sync and Show on both use it. Vitest: the order, and a
switch toggled doesn't move its row until the sheet reopens. `UX.md:444` ("Sync, a switch for
each calendar, the ones that sync first").

*b. `sync: Apple, first in the list`.*
- The chooser: Apple ("Your iPhone's and Mac's calendars, both ways."), Google, Holidays, Another
  calendar, A calendar server; the step key `icloud` → `apple`, `TITLES.apple = "Apple"`; the
  illustrated steps keep their drawings; check that appleid.apple.com still opens Apple's
  sign-in (Apple moved it to account.apple.com; update the words if it no longer does).
  `SetupCalendars` (the wizard's step) shows the same five in the same order.
- New accounts are named "Apple" (`service.py:606-608`); `source_label` "Apple"; the CalDAV error
  copy ("Apple said that password isn't right. Make a new app-specific password and try again.",
  "Apple didn't answer. …"); `plugin.py:33`; `data.ts`, `EventSheet.tsx:69` ("From Apple · Work.
  Change it in the Calendar app."), the pill, the toasts ("Connected Apple · 3 calendars").
- `just db-revision "sync: accounts named iCloud become Apple"`: `UPDATE` the accounts table's
  `name` from `'iCloud'` to `'Apple'` where the provider is `caldav` (no downgrade; forward-only);
  the migration test passes against the 0.9.0 fixture built before the first task.
- Docs: `UX.md:78` ("users see 'Apple'"), `:92, :94` (the toast and error lines), `:269, :444,
  :521, :602, :625, :635` ("Connect an Apple calendar … Add an account → Apple"), `:750, :770`;
  `docs/SYNC.md` gets one line under its iCloud heading: "the app calls it Apple (0.10.0)";
  `README.md:13`.

**Tests.** The Vitest files above, `e2e/sync.spec.ts:339-356` (`{ name: /^Apple/ }`, the dialog
"Apple"), the screenshot names; `backend/tests/sync/` for the names and the error copy;
`tests/test_migrations.py`. `just test-py tests/sync tests/test_migrations.py`; `just test-fe
src/features/sync`; `just e2e e2e/sync.spec.ts --project=phone-webkit`.

**CHANGELOG.** "Add an account starts with Apple (it said iCloud), then Google, Holidays, Another
calendar and A calendar server; an account's sheet lists the calendars that sync first."

### T12 Setup: the six steps beside the form

- [ ] Done (commit: )

**Owner's note.** "Redesign the 'Setup' workflow. Mostly the UI/UX. The steps are good, but there
is a lot of unused space so perhaps it can be designed more user friendly for first time use. The
'Pair This Screen' view when a raspberry pi is connected is a good example of a layout."

**What exists.** `features/onboarding/SetupWizard.tsx:51-77` `Page`: a `max-w-md` (448 px;
`max-w-lg` for People) column at the top of the viewport, `Brand size="line"` with "N of 6" at
the right, an h1 at `text-title` (24 px), the step's content; the steps `:87-186` (welcome,
password `:188-249`, household `:251-382`, place `:492-505`, people `:384-443`, pin `:445-488`,
calendars `:509-522`, done `:164-184`); `router.tsx:88-131` (`PublicLayout`, `PhoneShell
tabs={false}` on every device; `STEPS`). The model, `features/display/DisplayEntry.tsx:82-120,
205-240`: a `<main>` centred both ways (`items-center justify-center gap-8`), `Brand
size="entry"` (a 64 px mark and the name at 32 px), the h1 at `text-d-glance` (40 px), the code
at 160 px, then a row of the QR beside two lines of text, then one quiet button. Phones are the
primary setup device (UX §6); computers see the same 448 px column in a 1440 px window: the
owner's "unused space". Tests: `e2e/first-run.spec.ts:12-110`, `a11y.spec.ts` ("setup: …"
checks), `screenshots.spec.ts:377-379` (setup shots).

**Build** (one commit, maybe two: the frame, then the two end pages).
- `features/onboarding/SetupFrame.tsx` replaces `Page`. `<main class="min-h-dvh bg-wall">` with a
  centred card: `mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 py-8
  lg:py-12`; from `lg` a two-column grid, `lg:grid-cols-[20rem_1fr] lg:gap-12`, both columns
  `self-center`.
  - **The left column** (lg): `Brand size="entry"`, then "About three minutes. Everything can be
    changed later in Settings." (`text-secondary text-ink-soft`), then `<ol aria-label="Setup
    steps">` with six rows, 48 px each: a 32 px circle and the name: **Household password** ·
    **Your household** · **Where's home** · **Who lives here** · **A parent PIN** · **Your
    calendars**. Done: a check on an ink-filled circle, the name in ink-soft. Current: the number
    in an ink-filled circle, the name bold, `aria-current="step"`. Upcoming: the number in an
    outlined circle, the name in ink-soft. Not tappable: it shows the way, the Back buttons walk
    it.
  - **On a phone** (below lg): the brand row (`line`) with "2 of 6" at its right, and under it a
    six-segment progress bar (`role="progressbar"`, `aria-valuenow`, `aria-valuemax=6`; done
    segments in ink, the rest in `--line`), 6 px tall with 4 px gaps. No step list.
  - **The right column**: the h1 (`text-title` on a phone, `lg:text-d-title`), a lead paragraph
    where a step has one (`text-body lg:text-d-secondary text-ink-soft`), the fields
    (`max-w-xl`), and the buttons on one row at the bottom: Back (quiet) at the left when the step
    has it, the primary at the right (`block` on a phone, auto width from lg). A step change
    plays `rise-in` on the right column (never on first paint).
  - Welcome and You're Set use the frame with no left column: one centred column,
    `max-w-2xl text-center`: `Brand size="entry"`, the h1 at `lg:text-d-glance`, the lead at
    `lg:text-d-body`, one primary button (Start; Open Sunroom); You're Set gets a 64 px
    `CircleCheck` in `sun` above its title.
- The steps' internals are unchanged; `wide` goes (the column is wide enough); the "N of 6"
  strings move into the frame. The wizard still renders in `PhoneShell tabs={false}` through
  `PublicLayout` (no on-screen keyboard: setup never runs on the wall).
- `docs/UX.md` §6 "First run": a sentence on the layout at each width; §10 adds "Setup at
  1440×900 and 390×844: the step list beside the form, the progress bar on a phone".

**Tests.** `first-run.spec.ts` keeps its headings and buttons; add on `desktop`: the `list "Setup
steps"` has six items and the current one has `aria-current="step"`; on `phone-webkit` the
progressbar's `aria-valuenow` grows. a11y's "setup: …" checks run on every project already.
`screenshots.spec.ts`: `setup-household` and `setup-done` on the `desktop` project too, if they
aren't. `just e2e e2e/first-run.spec.ts --project=desktop` and `--project=phone-webkit`.

**CHANGELOG.** "Setup fills a computer's screen: the six steps are listed at the left with the
current one marked, and each step's form sits beside them. On a phone a progress bar shows how
far along you are."

### T13 The keyboard: a centred dock with a number row

- [ ] Done (commit: )

**Owner's note.** "Why is the app using a custom keyboard instead of a default one provided by
the system for touch screens? … If the answer is to keep the custom one, redesign the view for
it. Right now it is right aligned, but people may be more accustomed to centered keyboards.
Propose some ideas on keyboard layout, placement, etc." The answer and the ideas are in
"Answers"; the owner chose to keep it, centred, with a number row.

**What exists.** `ui/Keyboard.tsx:164-172` (the dock: `fixed bottom-0 z-50 rounded-t-panel
bg-wall`, `inset-x-0` in portrait, `w-[var(--keyboard-w)]` and `right-0` or `left-0` by rail
side in landscape; rows `justify-center` inside, `:101-103`); `:23-24` (the letter and symbol
rows), `:196-231` (the bottom row), `:233-284` (the numeric pad), `:26-37, 290-307` (accents
while held); `:126-152` (`--osk-h`, `scrollIntoView`); `:154-178` (keys portaled into an open
dialog); `tokens.css:73` (`--keyboard-w: 960px`), `:373-399` (key sizes), `:421-433` (scroll
margins); `DisplayShell.tsx:350, 374`, `ui/SidePanel.tsx:106-117`, `DisplayEntry.tsx:112, 116`,
`Sheet.tsx:127` (what pads by `--osk-h`); `lib/keyboard.ts`; `ui/Keyboard.test.tsx`;
`e2e/shell.spec.ts:655-681` (the keyboard inside a sheet) and the keyboard's other geometry
tests (grep `osk`); `docs/UX.md:42, 57, 68, 162, 837, 855, 860, 873`; ADR 0022.

**Build.**
- **The dock.** Landscape: `fixed bottom-0 z-50 border-t border-line bg-wall`, `left-[var(--rail-w)]
  right-0` with the rail on the left and `left-0 right-[var(--rail-w)]` on the right; before
  pairing (no rail) and in portrait, `inset-x-0`. No rounded corners: it is a dock, not a card.
  Inside, the keys block `mx-auto w-[var(--keyboard-w)]`, so the keys are centred whatever the
  dock's width; `--keyboard-w` stays 960 px (ten keys of 80 plus nine gaps of 8, plus padding).
  Padding 12 px top, 16 px bottom (the portrait values as today).
- **The number row.** On the `text` and `password` layouts a first row `1 2 3 4 5 6 7 8 9 0` above
  `q … p`, the same key size; the 123 page keeps its symbols; the numeric pad is unchanged. The
  dock grows by one row (72 px landscape, 80 portrait): `--osk-h` follows by measurement as
  today. Check the Add panel at 1920×1080 (the field 16 px above the keys, the primary button
  pinned), a sheet at the same (`Sheet.tsx:127`'s max height), the pair screen's password field,
  and portrait.
- Accents, Shift, Done, Enter, the 400 ms padding grace: unchanged.
- Docs: `UX.md:68` (the paragraph: "a dock across the bottom from the rail to the screen's edge,
  the keys centred in it; a number row above the letters; full width before pairing and in
  portrait"), `:162`, `:837` (Rail side: the dock spans whatever isn't rail), `:855, :860, :873`;
  ADR 0022's context line about where it docks gets "changed by 0032: centred, with a number
  row"; `docs/GOTCHAS.md` if anything bites.

**Tests.** `ui/Keyboard.test.tsx`: the number row types digits on the text layout and is absent
from the numeric pad. e2e `shell.spec.ts`: the dock's left edge is the rail's right edge and its
right edge the viewport's (and the mirror with Rail side right); the keys block's centre is
within 2 px of the dock's centre; the field stays above the keys; `:655-681` unchanged; the
tap-target check over the keys (80 × 64, 8 px apart). `just e2e e2e/shell.spec.ts
--project=display-1080p -g "keyboard"` and `--project=display-portrait`.

**CHANGELOG.** "The kitchen screen's keyboard sits centred across the bottom of the screen, with a
row of numbers above the letters."

### T14 The e2e job on GitHub

- [ ] Done (commit: )

**Owner's note.** "The 'e2e' job in GitHub actions seems to always fail. Can you dig into why and
propose a fix?" The why is in "Answers".

**What exists.** `.github/workflows/ci.yml:80-105` (ubuntu-24.04, no `timeout-minutes`,
`playwright install --with-deps chromium webkit` every run, `just e2e`, the report uploaded on
failure); `frontend/playwright.config.ts:16-20` (`workers: 1`, `retries: ci ? 1 : 0`, no test
timeout); `e2e/a11y.spec.ts:228-229` and `:333-334` (the journeys, each starting with a
`test.skip` for the other projects); `e2e/fixtures.ts:28-54` (`watch` fires `void
page.addInitScript(…)`; `guard` resets the server then calls it); `first-run.spec.ts:18`
(`test.setTimeout(60_000)`, the precedent); `.claude/skills/deploy/SKILL.md` (pushes, never
looks at CI); `CLAUDE.md:89`.

**Build.**
- `playwright.config.ts`: `timeout: 60_000` (a slow runner; the Mac never needs it). The two
  journeys: `test.slow()` right after their `test.skip`, with a one-line comment (three minutes
  on CI's runner for forty axe scans).
- `fixtures.ts`: `watch` becomes async and awaits `page.addInitScript`; `guard` awaits `watch`.
- `ci.yml`: `timeout-minutes: 45` on the e2e job; `actions/cache` on `~/.cache/ms-playwright`
  keyed on the Playwright version from `frontend/pnpm-lock.yaml`; on a hit, `playwright
  install-deps chromium webkit` only; on a miss, `install --with-deps`.
- The deploy skill: after the push, `gh run watch --exit-status` on the run the push started
  (or `gh run list` and `gh run view`), and the release report says whether CI is green; a red
  run is reported with the failing job's name, never fixed in the deploy. `docs/RELEASING.md`
  says the same.
- `CLAUDE.md:89`: "CI runs the same checks as jobs, plus `just e2e` and the secrets scan".

**Tests.** The suite itself: `just e2e e2e/a11y.spec.ts --project=display-1080p` and
`--project=phone-webkit` pass; a test that skips itself (`e2e/countdowns.spec.ts:24` on
`desktop`) reports skipped, not "Test ended.". CI is proved by the next release's run, which the
deploy skill now reports.

**CHANGELOG.** Under Fixed: "Behind the scenes: the end-to-end checks on GitHub timed out on two
long accessibility runs; they have the time they need, and the release reports the result."

### T15 Wrap up the batch

- [ ] Done (commit: )

1. **The full gate.** `just check`; the whole `just e2e` (five projects); `just screenshots`.
   Review, against UX §10 and `.screenshots/before-0.9.1/`, **only these** at 1920×1080,
   1080×1920 and 390×844, light and dark, Standard (plus Small and Extra large for the header):
   the header (every room's first row; late September isn't needed); the Today panel and the
   People view (Free day, Coming Up); Lists, Tasks and Photos empty; Settings → Devices, About,
   Features → Countdowns; Add an account's chooser and an account's sheet; Edit Mia with a toast;
   the Add panel with the keyboard up (landscape and portrait) and the pair screen's password;
   Setup's Welcome, Household, People and You're Set at 1440×900 and 390×844; a dark and a light
   refresh of the wall (by hand in `just display`: no fade). Fix what looks off in one commit
   (`frontend: batch 4 polish`), listing every fix in this task's "As built".
2. ADR 0032 ("M6 batch 4: the owner's fourth notes": Status, Date, Context, a Decision table with
   one row per decision above, Consequences) is complete and in `docs/adr/README.md`; ADR 0028
   row 18 gains "narrowed by 0032: buttons are Title Case"; ADR 0030's rows on the header's
   baseline and the zoom's order gain "changed by 0032"; ADR 0022's context gains the dock's new
   place; ADR 0031 is untouched.
3. PLAN §15 M6: "Batch 4 (the owner's notes of 2026-10-14) is in `docs/M6-batch-4.md`, built in
   0.10.0 (ADR 0032): …"; §14.7 (T0); §13.6 (T10); `CLAUDE.md`'s status paragraph and definition
   of done (T0); UX §10's checklist updated by the tasks above; a GOTCHAS line for anything that
   cost time.
4. `just scan` clean; the CHANGELOG's `[Unreleased]` holds one line per task.
5. Report to the owner, without deploying: what changed (the CHANGELOG lines), the one data
   migration, the six answers above, and the owner's checklist on the wall and a phone:
   - Fit the day, Zoom out, Zoom in on the Hours grid;
   - a refresh of the wall in Light shows no flash and no fade; Theme → Dark and back crossfades
     once, everything together;
   - the date, the time and the weather on one line;
   - "Nothing today" on the Today panel; "Free day" under a person on the People view;
   - Settings → Family → Edit a person with a toast showing: the sheet doesn't move, the toast
     doesn't jump in;
   - Features → Countdowns → Birthdays in Coming Up at 1 week hides a far birthday; a countdown
     far out still shows;
   - Devices: Paired Screens, then Phones & Computers with a laptop icon for the Mac; Add a Device;
   - an empty Lists, Tasks and Photos room; the big button opens the add;
   - About → Check Now says the latest version (0.10.0 once released) or "up to date";
   - Add an account: Apple first; an existing Apple account's sheet says Apple and lists synced
     calendars first;
   - setup on a throwaway instance (`just dev`, a browser at 1440 px): the step list beside the
     form; on a phone the progress bar;
   - the keyboard centred across the bottom with a number row, in landscape and portrait, in the
     Add panel and in a sheet;
   - buttons in Title Case everywhere (Photos: Settings, Start Screensaver, Add Photos).

## Follow-ups noticed but not in this batch

- Publishing a GitHub Release per tag from the deploy skill (`gh release create` with the
  CHANGELOG section), so About can link the notes one day; the check no longer needs it.
- The two accessibility journeys split into rooms, Settings and sheets, so a failure names a
  screen; and project gating by tags instead of `test.skip` in the body, which would spare
  about 270 wasted test setups per run.
- A toast raised under the PIN dialog sits under its backdrop.
- The portrait header still grows 8 px when the weather arrives (GOTCHAS).
- The `/display` pair screen's theme before anything is remembered (a brand-new Pi) still guesses
  from the device clock.
- Setup's step list could let a done step be reopened; today only Back walks it.
- A system-keyboard experiment on the Pi (squeekboard under labwc), if the owner ever wants one:
  one line on the kiosk's fields, one HARDWARE.md test.
- The rest of batch 3's list: the phone shell's headers, Filter by calendar or kind, drafts that
  survive a refresh, the week swipe following the finger, the Hours pinch, the filter's 30% fade.
