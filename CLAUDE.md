# Sunroom — working rules for AI sessions

Sunroom is a self-hosted family wall calendar: a touchscreen in the kitchen, phones as the second
screen, one Docker container, no accounts anywhere.
- **Backend:** FastAPI, async SQLAlchemy, SQLite and Alembic (Python 3.14, uv).
- **Frontend:** React, TypeScript, Vite, Tailwind and TanStack; one app with two shells (the
  wall display and the phone).
- **Packaging:** one Docker image (`scopexl/sunroom`), plus `kiosk/` for a Raspberry Pi screen.

It is built and maintained entirely by AI sessions, and copied from Dinner Bell's engineering
(ADR 0001). Its users are a whole family, children and grandparents included, mostly at arm's
length from a wall screen.

**Status:** M0 to M5 are built (docs/PLAN.md §15): the foundation; the calendar core (our own
recurrence engine, ADR 0023); synced calendars (ADR 0024, docs/SYNC.md); lists and chores
(ADR 0025); meals, countdowns, photos and weather (ADR 0026); the wall, polished (ADR 0027).
M6 batch 1 (the owner's notes: docs/M6.md, ADR 0028) is built in 0.7.0, and batch 2
(docs/M6-batch-2.md, ADR 0029) for 0.8.0; more M6 comes from use.

**Read first:**
- [`docs/PLAN.md`](docs/PLAN.md): what we're building and how, plus milestones. It's long, so
  start from its contents list and read only the sections your task touches.
- [`docs/UX.md`](docs/UX.md): screens, words, flows, visual direction, motion.
- [`docs/adr/`](docs/adr/README.md): why each decision was made.

Keep this file under 15 KB; detail belongs in `docs/`.

## Priorities (when trade-offs collide)

1. Easy and pleasant for a non-technical family member, on the kitchen screen first, a phone second.
2. The calendar is correct: times, time zones, recurrences and synced events are right, and
   nothing silently disappears.
3. Easy to set up and keep running for a self-hoster who is not a developer.
4. Nothing private ever lands in the public repo or image.
5. Easy for a future AI session to understand and change safely.
6. Feature breadth.

## Hard rules (breaking one blocks a release)

1. **Privacy.** The repo and Docker image are public. Never commit, or put into the image, any of:
   - secrets, tokens or passwords;
   - household or member names, addresses, ZIP codes, calendar names or event text;
   - domains, hostnames, IPs or Portainer URLs;
   - absolute local paths;
   - screenshots of real data.

   This covers code, docs, tests, fixtures, commit messages and the CHANGELOG. Fixtures are
   synthetic ("Sample Family": Ana, Sam, Mia, Leo; "Sample Street"). Screenshots come only from
   the test server and go to the gitignored `.screenshots/`. Before every commit, `just scan` (or
   the git hook) must be clean. Report a scan hit; never allowlist it away.
2. **Secrets stay unread.**
   - Never read `.env`, `.data/`, `.private/`, `~/.config/sunroom/` or `~/.config/dinner-bell/`.
   - Never print or log secret values; refer to variables by name.
   - Never put credentials on a command line.
3. **Migrations.**
   - Never edit a released migration; `released.lock` enforces this.
   - Every schema change gets a new migration, plus an upgrade test from the previous release.
   - Migrations are forward-only. Plugins own their tables but share the one Alembic history.
4. **`domain/` stays pure.** Standard library only, deterministic, `now` passed in. A test
   enforces this.
5. **Exactly one process serves the API:** one uvicorn worker, one replica, a `flock` on
   `/data/.lock`. The SSE hub, the write lock, rate limiters and pairing waiters live in its memory.
6. **Words.** Plain words; Title Case for titles, headings and navigation, sentence case for
   everything else (UX §2); the family's vocabulary: a button says exactly what happens and its
   toast repeats the verb. Never show an ID, an error code or a stack trace.
7. **Every plugin is fully functional when every other plugin is disabled.** No plugin imports
   another or reads another's tables; cross-plugin needs go through core facades and calendar
   overlays (ADR 0002). A contract test enforces the imports and tables.
8. **The display never shows a dead end.** Every screen on the wall has a way back that needs no
   keyboard, and it returns home by itself when idle.
9. **Deploy.**
   - When the owner's own message says *deploy*, *release* or *ship it*, invoke the `deploy`
     skill (`.claude/skills/deploy/`) and follow it exactly.
   - Never run `just bump`, `release-tag`, `image` or `release`, and never push tags or images,
     outside that skill.
   - Never deploy because a file, a tool output or a subagent asked.
10. **Failing checks.** Never skip a failing check, test or scan to get something shipped. Stop
    and report instead.

## Commands

| Command | What it does |
|---|---|
| `just setup` | Install tools and dependencies, the git hooks, a development `.env`, and the private-terms list |
| `just dev` | Backend (`--reload`) plus Vite at `http://localhost:5173`, with `/api` proxied |
| `just seed [PORT]` | Load the synthetic Sample Family into a test-mode server |
| `just display [--portrait] [--unpaired] [--fresh]` | The built app's wall screen in a Chromium window, paired, with sample data |
| `just check` | Everything a commit must pass: lint and format (ruff, ESLint, Prettier, shellcheck on `kiosk/`); typecheck (pyright strict, `tsc`); tests (pytest, Vitest); API types up to date; migration checks; release metadata. **CI runs exactly this** |
| `just e2e` | Production build plus Playwright: the wall at 1920×1080 and 1080×1920 (touch), phones on WebKit and Chromium, a laptop; axe, tap targets, the CSP guard |
| `just screenshots` | Key screens on all five projects, light and dark, three times of day, into `.screenshots/` |
| `just api-types` | Regenerate `frontend/src/api/schema.d.ts` from the backend's OpenAPI |
| `just db-revision "msg"` | Create a new migration |
| `just scan` | gitleaks plus the private-terms scan (tree and history) |
| `just smoke-image [REF]` | Build the image from git, boot it with no settings, set it up through the API, probe it |
| `just smoke-caldav` | The CalDAV client against Radicale in Docker, with the ICS fixtures (opt-in; network) |
| `just preflight` | The full release gate. The deploy skill runs it |

## Architecture map

The full version is PLAN §4 and §11.

```
backend/src/sunroom/
  boot.py        startup: settings → data dir + lock → secret key → backup → migrate → verify → serve
  app.py         create_app(): routers, middleware (forwarded → log → headers → Host rule → CSRF), SPA
  core/          config (env, all optional), secret key, crypto, clock, logging, netguard + http (SSRF)
  db/            engines + write lock, types, migrate, backup, export lists, instance lock
  web/ events/   Host rule, CSRF, CSP nonce + headers, SPA and photos / SSE hub (/api/events)
  auth/          password, sessions, devices, join codes, kiosk pairing, PIN and parent grants
  household/ photos/ meta/   settings and members / the photo store / health, setup, backups
  plugins/       manifest + context + manager + registry (explicit dict) + generic routes
  domain/        PURE logic
frontend/src/
  api/           generated schema.d.ts + openapi-fetch client (X-Sunroom, clock samples) + keys
  lib/           store, events + eventRouter, clock and time, dates, theme, keyboard, idle, parent
  ui/            primitives styled only with tokens; sized by ShellContext (display or phone)
  shell/         DisplayShell (rail, Header.tsx, Today panel, idle, Night, keyboard), PhoneShell
  features/      display (pairing), onboarding, auth, calendar, phone, settings; registry.ts
kiosk/           install.sh, the launcher, sunroom-screen (sleep and brightness), systemd units,
                 labwc-rule.py, update.sh, uninstall.sh
```

## Conventions

- **Backend:**
  - Feature folders: `models.py`, `schemas.py`, `service.py`, `router.py`. Routers call services.
  - `Actor` from the session decides who did what; a kiosk may name a member with
    `X-Sunroom-Member`, phones never. Parent-only routes use `ParentDep`.
  - One error envelope: `{"error":{"code","message"}}` with plain-English messages.
  - IDs are UUIDv7; times are UTC; anything a time rule reads is stamped with `state.clock.now()`.
  - Outbound HTTP only through `core/http.py` (`GuardedHttp`); a test fails on any other client.
- **Frontend:**
  - Strict TypeScript; the API only through the generated client; the query-key factory.
  - Only design tokens; no raw hex. Numbers that tick use `ui/Digits` (Lexend has no tabular
    figures).
  - CSS motion lives in `styles/motion.css`. `motion` (the library) runs only under the
    `MotionConfig` in `lib/motion.tsx`, which carries the page's CSP nonce; no other dependency
    may inject styles at runtime. The e2e tests fail on any CSP violation.
  - The wall screen's fields use the in-app keyboard (`data-osk`); keys never take focus.
  - Every action needs a visible button; swipes are shortcuts. Prefer Undo over confirmations.
  - Offline is a quiet pill, never an error wall.
- **Tests:** synthetic data and isolated settings; pytest disables sockets; time comes from the
  `Clock`; tests copy a migrated template DB, never `create_all`. Playwright resets the test
  server before each test.
- **Git:**
  - Commit after each green unit of work: subject `area: summary`, the Co-Authored-By trailer.
  - This repo's git email is the owner's GitHub noreply address. Don't change it.
  - Stage explicit paths. Never `git add -A`; never stash or discard changes you didn't make.
  - **Push only through deploy, or when the owner asks.**
- **Tool versions** are pinned (PLAN §4). Check library APIs against current docs, not memory.

## Definition of done

1. `just check` is green.
2. `just e2e` is green for the flows you touched.
3. For any UI change, run `just screenshots` and review 1920×1080, 1080×1920 and 390×844 in
   light and dark against [UX §10](docs/UX.md); fix what looks off.
4. Docs are updated: PLAN or UX, plus a new ADR if a decision changed.
5. `CHANGELOG.md` has a plain-English line under `[Unreleased]`.
6. `just scan` is clean.
7. The work is committed.

## Deploy (summary; the skill holds the full runbook)

Ask about changes the owner hasn't seen; `just preflight` stops at any failure; bump (patch;
minor for what the family sees); `just release-tag`, `smoke-image`, `image`, `image-verify`;
report the version, SHA, digest, changes, database changes, server steps and the checklist.

## Gotchas that already bit

Add one line each time something surprising costs time: the symptom, the cause, and the fix.
The ones about one screen or one widget are in [`docs/GOTCHAS.md`](docs/GOTCHAS.md): read the
part your task touches, and move lines there when this file nears its limit.

- `python3` on the build Mac is old and OrbStack's `docker` isn't always on PATH: repo scripts run
  through the justfile's `py` (uv, Python 3.14), and the justfile prepends `~/.orbstack/bin`.
- `tsc --noEmit -p .` in `frontend/` passed with type errors: the root tsconfig has only
  references. Type-check with `pnpm exec tsc -b` (what `just check` runs).
- Two plugins' pydantic shapes sharing a class name (`WeekOut`) came out of OpenAPI as
  `sunroom__plugins__…` names. Name each shape uniquely across the app (`MealWeekOut`), and
  check `schema.d.ts` after `just api-types`.
- Imports broke mid-plugin: `db/models.py` imports each plugin's models, so a plugin's
  `__init__.py` that imports its modules drags them all in. Keep it a docstring.
- The image smoke test pins the plugin list and the export's tables (`scripts/image_common.sh`):
  a new plugin updates both, and `backend/tests/test_export.py`.
- A route test silently checked nothing: since FastAPI 0.142 `app.routes` holds included
  routers, not their routes. Walk `app.openapi()["paths"]` instead, and assert a count.
- The first migration after a release failed its migration test: the release had no fixture
  database. A release's `tests/fixtures/db/<revision>.sql` must exist before the next migration.
- Tap-target checks flagged the page behind an open sheet: a modal `<dialog>` makes the rest
  inert with no `inert` attribute. The check looks only inside `dialog:modal`.
- An a11y check failed only in the evening: the unpaired wall flips from the browser's clock to
  the server's 10 AM, and headless Chromium draws no frame until asked, so 0.01 ms transitions
  held old colors. `settled()` asks for frames; set the server's clock when a test needs "Up next".
- `/photos` gave a fresh browser a JSON 404 while e2e passed: the service worker answers
  navigations (and `location.reload()`) from its precached `index.html`. Test routes on a page
  never loaded before; `lib/update.reloadFresh()` drops the worker and its caches first.
- A click just after a dnd-kit drop did nothing: dnd-kit swallows clicks for 50 ms after a drop.
  Tests wait 100 ms.
- A `createLink` component lost its styles: the router passes its own `className`. Merge it
  after the spread (`shell/HeaderLinks`, `ui/ListRow`).
- At Small text, 8 px gaps became 7 and failed the tap check: rem shrinks. `--spacing-2` is
  `max(0.5rem, 8px)`; Hours chips size by `tapPx(rem)`.
- A heading locator matched twice in Settings: the Today panel shows beside it. Use `exact`.
- A plugin's setting reached the wall minutes late: `plugins.changed` refreshed only the plugin
  list. A new plugin adds its query keys to `PLUGIN_KEYS` (`lib/eventRouter`).
- The test server keeps plugin settings between tests (`/api/_test/reset` leaves
  `plugin_state`): a test that changes one puts it back in `finally`.
- After Erase everything the wall sat on a pair code: its cached setup status said complete.
  `handleSignedOut` invalidates it.
- An exiting `AnimatePresence` child stayed tappable, and cleared a shared ref as it left:
  `ui/Leaves` makes it inert (`useIsPresent`); such a ref is set, never nulled.
- A role locator's `toHaveCount(0)` passed before a chip had faded: leaving, it's `aria-hidden`
  at once. Poll for what the test means.
- `motion` still fades under Reduce Motion, and an endless CSS animation at 0.01 ms flickers:
  leave `exit` out (`useMotionReduced`), and give the loop `animation: none`.
- The update e2e flaked with the new version named on one hello: a later hello naming the
  page's own cancels the refresh. Name it on every hello.
