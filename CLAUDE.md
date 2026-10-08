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

**Status:** M0 to M5 are built (docs/PLAN.md §15):
- M0 the foundation; M1 the calendar core (our own recurrence engine, ADR 0023).
- M2 synced calendars: `calendar_sync` on our own clients behind the guard (ADR 0024),
  docs/SYNC.md.
- M3 lists and chores (chores as rules, ADR 0025; the done moment's `ui/Celebration`).
- M4 meals, countdowns, photos and weather (ADR 0026).
- M5 the wall, polished (ADR 0027): the display state and the Pi's `kiosk/sunroom-screen`, the
  evening dim, the opt-in update check, Download everything and `sunroom restore`.

Next is M6: polish from the first weeks of use (docs/PLAN.md §15).

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
6. **Words.** Plain words, sentence case, the family's vocabulary (UX §2): a button says exactly
   what happens and its toast repeats the verb. Never show an ID, an error code or a stack trace.
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
| `just smoke-caldav` | The CalDAV client against a real Radicale server in Docker, with the ICS fixtures (opt-in; needs network) |
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
  shell/         DisplayShell (rail, Today panel, idle, Night, keyboard, PIN), PhoneShell
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

1. If the working tree has changes the owner hasn't seen, summarize them and ask.
2. `just preflight`: check → e2e → scan → smoke-test the image → Docker gate. Any failure stops.
3. Bump: patch by default, minor for something the family can see, major only if asked. The
   CHANGELOG entry is plain English. The bump also sets the Pi installer's `KIOSK_VERSION`.
4. `just release-tag "Co-Authored-By: …"`: commit, annotated tag `vX.Y.Z`, atomic push of branch
   and tag. If only the push fails, run it again: it resumes.
5. `just smoke-image vX.Y.Z` then `just image`: multi-arch from `git archive` of the tag, pushed
   as `X.Y.Z`, `X.Y` and `latest`.
6. `just image-verify`: both architectures, tags agree, probes and setup pass, private scan clean.
7. Report the version, SHA and digest, what changed, whether the database changed, the server
   steps (`docker compose pull && docker compose up -d`), and the phone and wall-screen checklist.

## Gotchas that already bit

Add one line each time something surprising costs time: the symptom, the cause, and the fix.

- A tap on a wall-screen button missed: the field lost focus, the keyboard lowered, and the page
  moved under the finger. The keyboard's padding (`--osk-h`) outlasts it by 400 ms.
- An e2e helper moved on before sign-in finished on a laptop: the Today panel's "Up next" shows
  beside Who's using this there. Wait for the URL, not a heading that two screens share.
- A select stayed 27 px tall in Safari: WebKit ignores `min-height` on a native select. Use
  `ui/Select` (appearance reset, its own chevron).
- The wall clock ignored the server's time until the next minute: the minute store didn't hear
  about new clock samples. `lib/clock` tells listeners when the offset moves (`onClockMoved`).
- Tap-target checks flagged the page behind an open sheet: a modal `<dialog>` makes the rest
  inert without an `inert` attribute. The check looks only inside `dialog:modal`.
- WebKit screenshot runs report inline-style CSP violations: Playwright's WebKit screenshot code
  injects a `<style>`. Only the screenshot spec turns `cspGuard` off.
- `python3` on the build Mac is old and OrbStack's `docker` isn't always on PATH: repo scripts run
  through the justfile's `py` (uv, Python 3.14), and the justfile prepends `~/.orbstack/bin`.
- A sticky Save bar in the wall's side panel covered the chips above the keyboard: a sticky box
  stops at its scroller's padding, which already holds `--osk-h`. Stick it at `bottom-0`.
- `tsc --noEmit -p .` in `frontend/` passed while the code had type errors: the root tsconfig has
  no files of its own, only references. Type-check with `pnpm exec tsc -b` (what `just check` runs).
- Two plugins' pydantic shapes with one class name (`WeekOut`, `RemovedOut`) came out of OpenAPI
  as `sunroom__plugins__…` names the frontend can't use. Give each shape a name unique across the
  app (`MealWeekOut`), and check `schema.d.ts` after `just api-types`.
- Imports broke while a plugin was half-written: `db/models.py` imports each plugin's models, so
  a plugin package's `__init__.py` that imports its modules drags them all in. Keep it a docstring.
- The image smoke test pins the plugin list and the export's tables (`scripts/image_common.sh`):
  a new plugin updates both, and `backend/tests/test_export.py`.
- A route test silently checked nothing: since FastAPI 0.142 `app.routes` holds included
  routers, not their routes. Walk `app.openapi()["paths"]` instead, and assert a count.
- An a11y check failed only in the evening: the unpaired wall starts on the browser's clock and
  flips to the test server's 10 AM, and headless Chromium draws no frame until asked, so Reduce
  Motion's 0.01 ms transitions held the old colors, one level of the page per frame. `settled()`
  asks for frames until nothing runs; set the server's clock in any test that needs "Up next".
