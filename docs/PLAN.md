# Sunroom — plan

> **Name.** "Sunroom" was confirmed by the owner on 2026-10-07 (§20).
>
> **Where this file lives.** This is `docs/PLAN.md`, the single source for what is being built and how. UX lives in [`docs/UX.md`](UX.md) (split from §16 at the start of M0) and the decisions in [`docs/adr/`](adr/README.md) (seeded from §3). The owner cleared `docs` from `.gitignore` on 2026-10-07 (decision 0016), so this file is committable; private notes belong in a gitignored `.private/` instead.

**Status:** approved by the owner on 2026-10-07; M0 built on 2026-10-08, its release (0.1.0) waiting for the owner's word. Written to be executed by an AI engineer (Opus 5.5) milestone by milestone, with the owner reviewing at the end of each.

**Maintenance rule** (copied from Dinner Bell): when a milestone ships, shrink its section to a one-line summary pointing at the CHANGELOG and mark it with the date and version. Keep this file about what is true now and what is left to do. Decisions that change get a new ADR; never edit history.

## Contents

1. [Purpose, priorities and success test](#1-purpose-priorities-and-success-test)
2. [Glossary](#2-glossary)
3. [Decisions](#3-decisions)
4. [What this borrows from the owner's other apps](#4-what-this-borrows-from-the-owners-other-apps)
5. [Architecture](#5-architecture)
6. [The plugin system](#6-the-plugin-system)
7. [Calendar core](#7-calendar-core)
8. [Calendar sync (the `sync` plugin)](#8-calendar-sync-the-sync-plugin)
9. [The other plugins](#9-the-other-plugins)
10. [Data model](#10-data-model)
11. [API outline, jobs and live events](#11-api-outline-jobs-and-live-events)
12. [Access, devices, kiosk and security](#12-access-devices-kiosk-and-security)
13. [Setup, deployment and the Raspberry Pi kiosk](#13-setup-deployment-and-the-raspberry-pi-kiosk)
14. [Foundation, tooling and release](#14-foundation-tooling-and-release)
15. [Milestones](#15-milestones)
16. [UX (now docs/UX.md)](#16-ux)
17. [Risks and unknowns](#17-risks-and-unknowns)
18. [Where this plan departs from the brief, and suggestions](#18-where-this-plan-departs-from-the-brief-and-suggestions)
19. [Ideas beyond v1](#19-ideas-beyond-v1)
20. [Open questions for the owner](#20-open-questions-for-the-owner)

---

## 1. Purpose, priorities and success test

Sunroom is a self-hosted family calendar for a touchscreen in a shared living space, with phones as the second screen. It runs as one Docker container on a Raspberry Pi or any home server, stores everything in SQLite on one volume, and never needs an account with anyone. The calendar is built in; everything else (synced calendars, lists, chores, meals, countdowns, photos, weather) is a plugin a household turns on or off.

It is used mostly on a wall-mounted touchscreen of 15 inches or more, by every member of a household including children and guests, from arm's length and from across the room. Phones are for adding and editing on the go. It is published as open source for other families to run.

**When trade-offs collide, use this priority order:**

1. Easy and pleasant for a non-technical family member, on the kitchen screen first and on a phone second.
2. The calendar is correct: times, time zones, recurrences and synced events are right, and nothing silently disappears.
3. Easy to set up and keep running for a self-hoster who is not a developer.
4. Nothing private ever lands in the public repo or image.
5. Easy for a future AI session to understand and change safely.
6. Feature breadth.

**Success test:** a family who has never seen Sunroom installs it on a Pi from the README, pairs the kitchen screen from a phone, connects one Google or iCloud calendar, and within fifteen minutes a child checks off a chore on the wall and the whole family sees it on their phones. No one reads a manual.

## 2. Glossary

The app uses these words consistently in the UI, code and docs.

| User sees | Code name | Meaning |
|---|---|---|
| Household / family | `household` (single row) | One installation serves one household |
| Person | `Member` (`members`) | Someone in the household: name, color, avatar, role (parent or child; a child's role is stored as `kid`), optional birthday. "Everyone" is a built-in pseudo-person for shared things |
| The display, the kitchen screen | `Device` with `kind = kiosk` | A paired wall screen. Shows the kiosk layout, never expires, has no settings access without the parent PIN |
| Phone | `Device` with `kind = phone` (also laptops) | A device signed in with the household password |
| Calendar | `Calendar` (`calendars`) | A named, colored source of events: local (lives only in Sunroom) or synced from an account |
| Account | `Account` (`accounts`, plugin `sync`) | A connection to Google, iCloud or another CalDAV server, or an ICS subscription, holding credentials and one or more calendars |
| Event | `Event` (`events`) | A master event: one-off or recurring (RRULE). Synced events carry their remote ids |
| Occurrence | computed, never stored | One instance of an event on a date, as rendered in a view. Edits to one occurrence create an override row |
| Up next / Today | computed | The next things for the household or a person |
| List | `List`, `ListItem` (plugin `lists`) | A shared checklist: groceries, to-dos, packing. Items can have a person and a due date |
| Chore | `Chore`, `ChoreCompletion` (plugin `chores`) | A recurring responsibility assigned to people, with optional points. Completing one is the signature moment of the app |
| Routine | `Routine`, `RoutineStep` (plugin `chores`) | An ordered checklist a person runs through (morning, bedtime) |
| Reward | `Reward`, `Redemption` (plugin `chores`) | Something points can be spent on, approved by a parent |
| Meal | `MealEntry` (plugin `meals`) | What's for breakfast, lunch, dinner or snack on a day; free text or a saved meal |
| Countdown | `Countdown` (plugin `countdowns`) | "12 days until…", with an emoji or photo |
| Photos / screensaver | `Photo` (core store, also avatars); `PhotoSource` (plugin `screensaver`) | Pictures shown when the display is idle; the user sees one feature, "Photos & screensaver" |
| Weather | `weather` plugin | Current conditions and the week's forecast, from Open-Meteo |
| Plugin | `Plugin` | A feature package that can be turned on or off in Settings. The user sees "Features" |
| Parent PIN | `household.parent_pin_hash` | An optional 4–6 digit code that gates Settings and parent-only actions on the display |

## 3. Decisions

Each decision is an ADR in [`docs/adr/`](adr/README.md) (same format as Dinner Bell: Status, Date, Context, Decision, Consequences), seeded at the start of M0 with these numbers. 0018 to 0020 record the owner's answers in §20; 0021 onwards were decided while building.

| # | Decision | Why |
|---|---|---|
| 0001 | **Copy Dinner Bell's stack and skeleton**: Python 3.14, FastAPI, async SQLAlchemy 2.1 + aiosqlite, Alembic (forward-only, run at startup), pydantic-settings, structlog; React 19, TypeScript 6.0, Vite 8, Tailwind 4, TanStack Router + Query, openapi-fetch with generated types; one container, one uvicorn worker, SQLite WAL on `/data`; SSE for live updates; justfile; Playwright + Vitest + pytest; Docker Hub `scopexl/sunroom` built locally for amd64 + arm64 | It is the owner's newest app (finished 2026-10-07), already solved Docker, privacy scanning, migrations, backups, PWA, sessions and live updates, and its ADRs record why |
| 0002 | **Plugins are in-repo modules with runtime enable/disable**, registered in explicit registries (backend `plugins/registry.py`, frontend `features/registry.ts`). No importlib discovery, no runtime-loaded third-party code in v1 | An earlier project's strategy registry proved the shape; dynamic loading would need a frontend module loader, a security story and a versioned API before anyone needs it. §6 lists what third-party support would add later |
| 0003 | **Recurrence is expanded on the backend.** The frontend receives concrete occurrences for a date range | One implementation for local and synced events (its own rule walker, checked against python-dateutil and recurring-ical-events: ADR 0023); the JavaScript rrule ecosystem is thinly maintained; Pi-side CPU is fine for this |
| 0004 | **Google: three tiers.** (1) Secret iCal address (read-only, zero setup, the default suggestion). (2) Service account + "share this calendar with Sunroom" (two-way, works on a LAN, no consent screen, no 7-day token expiry). (3) Standard OAuth web flow only when Sunroom is reachable at a public HTTPS domain | Google rejects OAuth redirect URIs that are plain HTTP, raw IPs or non-public hostnames (localhost excepted), and the device-code flow does not allow Calendar scopes. Verified on 2026-10-07 against Google's docs |
| 0005 | **iCloud: CalDAV with an app-specific password**, two-way; generic CalDAV (Nextcloud, Fastmail, Radicale) shares the same adapter. ICS/webcal subscriptions are the read-only universal fallback | Apple has no OAuth for CalDAV; app-specific passwords are the only path and need no developer account |
| 0006 | **Household password set on first run in the browser**, with `APP_PASSWORD` as an optional env override; per-device signed cookie sessions; a paired **kiosk device** that never expires; an optional **parent PIN** gating Settings and parent-only actions on the display | Dinner Bell reads the password from env because its URL is public; a kitchen app's first run on a LAN should be a wizard, not a `.env` edit. The PIN exists because children use the wall screen |
| 0007 | **Motion is allowed to use JavaScript** (the `motion` library, the Web Animations API, and a canvas layer for celebrations), and the strict CSP stays, made compatible with a **per-request nonce**: the SPA route stamps a fresh nonce into `index.html` (`<meta name="csp-nonce">`) and into that response's `Content-Security-Policy: style-src 'self' 'nonce-…'`; the app passes it to `<MotionConfig nonce>`. No other dependency may inject styles, and the e2e CSP guard stays on | Rich, physical animation is a core requirement of this brief, and `motion` gives layout, exit, gesture and spring animation in a few lines. It does inject `<style>` blocks in some paths (that is what its `nonce` option exists for), so the nonce is required, not optional. This revisits Dinner Bell's ADR 0027 for this app only (the owner's answer to Q2) |
| 0008 | **Themes are a household setting, not only an OS preference**: Light, Dark, or Auto (sunrise to sunset at the household's location, from the weather plugin or a fixed schedule). Applied through `data-theme` on `<html>`; phones default to Auto = follow the phone | A wall display has no OS preference a family can see |
| 0009 | **Photos are files on `/data/photos`** with WebP thumbnails, indexed in SQLite; sources are upload, a watched inbox folder, and later Immich | Thousands of large images do not belong in SQLite (Dinner Bell's ADR 0020 was for a few meal photos) |
| 0010 | **Weather from Open-Meteo**, no API key, cached hourly | Any setup step that requires creating an API key is a step a non-technical self-hoster may not complete |
| 0011 | **Name: Sunroom** (the owner's answer to Q1) | A room in the home where light changes through the day, which is the visual concept (UX) |
| 0012 | **MIT license**, same as Dinner Bell | Maximum reuse; no copyleft surprises for people embedding it in home dashboards |
| 0013 | **Visual direction: "Sunroom"**: a calm wall whose light follows the time of day; one bold element, the person color | UX §7. Chosen to be distinct from Dinner Bell's "Fridge door" and from the generic family-app look (rounded pastel cards, playful script type) |
| 0014 | **Kiosk and phone are one responsive app**; the kiosk layout is chosen by device kind, not by screen size, and can be previewed on any browser at `/display` | One codebase, one set of components, one test suite |
| 0015 | **Quick add parses natural language locally** with `chrono-node` on the client ("Soccer Tue 4pm", "Dentist Oct 14 2:30"); no LLM in v1 | The best feature of Skylight's "Sidekick" without an API key or cloud dependency. LLM features are an opt-in idea in §19 |
| 0016 | **Docs are committed** (`docs/PLAN.md`, `docs/UX.md`, `docs/adr/`); the owner removed `docs` from `.gitignore` on 2026-10-07 | Contributors and the AI sessions need them in the repo |
| 0017 | **A Host rule instead of `APP_BASE_URL`** (§13.4): LAN names, IP literals, `localhost` and `.ts.net` are accepted by default, a public proxy name through `APP_ALLOWED_HOSTS`; CSRF compares `Origin` to `scheme://Host`; the cookie name depends on the scheme | A kitchen app is reached as `sunroom.local`, an IP, `localhost` on the Pi and maybe an HTTPS name at once; Dinner Bell's single base URL would force a non-technical self-hoster to configure one |
| 0018 | **Landscape first, portrait supported; the owner's container runs on the existing Portainer host behind the HTTPS reverse proxy, and the Pi is the display only** (`kiosk/install.sh --display-only`); the all-on-one-Pi path stays first-class for other households | The owner's answer to Q3 |
| 0019 | **Chores ship the full kids layer**: assignment and rotation, stars, rewards with parent approval, streaks, routines; each part switchable, all on by default | The owner's answer to Q4 |
| 0020 | **Calendar providers in this order**: ICS and holidays, then iCloud CalDAV, then Google by service account, then Google OAuth | Q6's default (not asked) |
| 0021 | **Changing numbers sit in fixed-width digit boxes** (`ui/Digits`), sized per weight, and Lexend stays | M0's `tnum` check: Lexend has no tabular figures |
| 0022 | **The wall screen's on-screen keyboard is Sunroom's own**, not `react-simple-keyboard` | Keys must never take focus from the field, typed text must reach React inputs as real input, and sizes and styling follow UX §1 and the tokens |

## 4. What this borrows from the owner's other apps

Read these before M0; they are the templates.

| From | Path | Borrow |
|---|---|---|
| Dinner Bell | its repo root | The whole skeleton: `Dockerfile` (multi-stage, digest-pinned, non-root `/data`, healthcheck, no `VOLUME`), `docker-compose.example.yml` (hardened Portainer stack), `.dockerignore` allowlist, `justfile` (recipes and `check` = CI), `.githooks/` (gitleaks + private-terms scan), `.github/workflows/ci.yml` (SHA-pinned, checks only), `dependabot.yml`, `VERSION` + `scripts/check_release_meta.py` + `scripts/release.py`, `CHANGELOG.md` (Keep a Changelog), `LICENSE` (MIT), `SECURITY.md`, `PRIVACY.md`, README shape |
| Dinner Bell backend | `backend/src/dinnerbell/` | `boot.py` (startup sequence and exit codes), `core/` (config, logging with redaction, crypto HKDF/Fernet, errors, clock, jobs, version), `db/` (two engines, write lock, pragmas, `UTCDateTime`, UUIDv7, migrate, backup, export, instance lock), `web/` (SPA serving, CSRF, security headers), `events/` (SSE hub with `epoch:seq` replay), `meta/` (health, version, export, backups, diagnostics), `auth/` (password, device sessions, join codes, rate limits), `household/`, the feature-package shape (`models.py`, `schemas.py`, `service.py`, `router.py`), `kroger/account.py` (OAuth state, encrypted tokens, single-flight refresh; reuse for Google OAuth tier 3), `tests/` (template DB fixture, `FakeClock`, SSE `StreamProbe`, socket-disabled pytest) |
| Dinner Bell frontend | `frontend/src/` | `api/client.ts` (openapi-fetch wrapper, CSRF header, clock samples, reachability), `api/keys.ts`, `lib/events.ts` + `lib/eventRouter.ts` (SSE with `?since=`, watchdog, polling fallback), `lib/store.ts`, `lib/toast.ts` (Undo toasts), `lib/wakeLock.ts`, `lib/platform.ts`, `ui/` primitives (native `<dialog>` sheets, Chip, Segmented, Skeleton after 300 ms, EmptyState), `styles/tokens.css` (`@theme inline`, role-named tokens, `tokens.test.ts` AA contrast test), `styles/motion.css` (timing tokens), `sw.ts` (never caches `/api`), `vite.config.ts` (PWA `injectManifest`, `registerType: "prompt"`, `__APP_VERSION__`), `e2e/` (projects per viewport, CSP guard, axe), `scripts/build-icons.mjs`, `designRules.test.ts` (adapted: it bans raw hex and runtime style injection, not `style={}`) |
| Dinner Bell docs | `docs/`, `CLAUDE.md` | `PLAN.md` and `UX.md` structure, ADR format and index, CLAUDE.md shape (priorities, hard rules, commands, architecture map, conventions, definition of done, gotchas), the deploy skill in `.claude/skills/deploy/`, `.claude/settings.json` (denies reading `.env`, `.data/`, `.private/`) |
| An earlier project | its strategy registry, base class and settings spec | The plugin shape: explicit registry dict, `Protocol` + context object, spec-driven settings forms (`ParamField` → generic form), one task per plugin so a failure is isolated with status `errored` |
| An earlier project | its tooltip rule | `title=` is banned: native tooltips never appear on touch. Any hint is visible text or a tap-to-reveal |
| An earlier project | its media-query hook and mobile components | One named breakpoint and a mobile tab bar component, as precedent (Dinner Bell's TabBar is the newer one) |
| An earlier Home Assistant add-on | its `config.yaml`, `build.yaml`, `Dockerfile`, `run.sh` and `repository.yaml` | Home Assistant add-on packaging, for the §19 idea; add `aarch64` when the time comes |

**Deliberately not borrowed:** older projects' Windows process formation and autostart, an MCP bundle, a zustand store, CDN fonts, a dark-only theme, 110 KB CLAUDE.md files (keep it under 15 KB), and Dinner Bell's env-only password (0006) and CSS-only motion rule (0007).

## 5. Architecture

### 5.1 Runtime

One Docker image runs one process, `sunroom serve`: uvicorn with exactly one worker, holding a `flock` on `/data/.lock`. It serves:

| Path | Response |
|---|---|
| `/api/*` | JSON, `Cache-Control: no-store`; one error envelope `{"error":{"code","message"}}` |
| `/api/events` | Server-sent events |
| `/photos/*` | Household photos and thumbnails from `/data/photos`, session-gated, `Cache-Control: private, max-age=31536000` keyed by content hash |
| `/assets/*` | Hashed build files, `max-age=31536000, immutable`; a missing asset is a 404, never `index.html` |
| Any other GET | `index.html` with `no-cache` (the SPA fallback); `/sw.js` and `/manifest.webmanifest` also `no-cache` |

- SQLite at `/data/sunroom.db` (WAL); backups in `/data/backups/`; photos in `/data/photos/{originals,thumbs,inbox}`.
- Default port 8080. The container binds `0.0.0.0` because the kiosk browser and phones are other devices on the LAN. Forwarded headers are trusted only from `TRUSTED_PROXIES` when the owner puts it behind a reverse proxy.
- Deployments supported: the container on any amd64 or arm64 host with a Raspberry Pi (or an old tablet) as the display only; or everything on one Pi 4 (4 GB) or Pi 5. **The owner's own setup is the first:** the container runs on the owner's existing Docker host, from a `docker-compose.yml` in a folder of its own started with `docker compose up -d` (Portainer there only shows logs and stops or starts containers), behind the owner's HTTPS reverse proxy, and a Pi drives a landscape touchscreen in the kitchen (Q3). A week view with 500 occurrences must respond in under 100 ms on a Pi 4 (§7.3), so the all-on-one-Pi path stays honest.

### 5.2 Versions

Pin at M0 to what Dinner Bell pinned on 2026-10-06 (its `docs/PLAN.md` §4.2), re-checked on PyPI and npm at M0. Additions for Sunroom:

| Side | Additions |
|---|---|
| Python | `icalendar` 7 (zoneinfo-native), `x-wr-timezone` (Google's non-standard feed header), `python-dateutil` and `recurring-ical-events` (dev only: the references the expansion engine is tested against, ADR 0023), `holidays` (offline public-holiday calendars), `httpx` (ICS, Open-Meteo, Immich; always through the SSRF guard), `Pillow` (thumbnails, EXIF orientation), `pillow-heif` (iPhone HEIC uploads), `zoneinfo` + `tzdata` |
| Frontend | `motion` 14 (animations and gestures; 13 when planned, 14 current at M0 with the same API and `nonce`), `@dnd-kit/core` + `@dnd-kit/sortable` (long-press drag with a delay constraint), `chrono-node` (quick-add parsing), the display's on-screen keyboard is Sunroom's own (ADR 0022; `react-simple-keyboard` was the plan), `canvas-confetti` or a 60-line in-house particle burst (celebrations; decide at M3 by bundle size), `date-fns` + `date-fns-tz` (formatting only; never recurrence math), `@fontsource-variable/lexend` (one family; M0 found no tabular figures (`tnum`), so changing numbers render each digit in a fixed-width box: ADR 0021), `lucide-react` |
| Not used | `caldav` and the Google client libraries (their own HTTP stacks would bypass the SSRF guard; Sunroom has small clients of its own, ADR 0024), FullCalendar, Schedule-X, react-big-calendar (the grid is custom so the design is ours and touch targets are right), rrule.js (0003), shadcn/Radix/vaul/sonner (inject styles; Dinner Bell ADR 0023), zustand (Dinner Bell's 25-line store suffices) |

### 5.3 Backend layout

```
backend/src/sunroom/
  __main__.py cli.py boot.py app.py state.py healthcheck.py devserver.py
  core/        config, logging, crypto, errors, clock, jobs, version, netguard + http (the outbound guard, §12.6), updates (the opt-in update check, §13.6)
  db/          engine, base, types, migrate, backup, full_backup (Download everything and its restore, §13.7), export, instance_lock, models (imports every model, plugins included)
  migrations/  one Alembic history for core and plugins; versions/YYYYMMDDHHMM_slug.py; released.lock
  web/         spa.py, csrf.py, headers.py, photos.py (session-gated static)
  events/      hub.py, router.py (SSE)
  meta/        health, version, diagnostics, backups, export, setup (first run), updates (§13.6), testing (/api/_test)
  auth/        password, sessions, devices, join codes, kiosk pairing, parent PIN
  household/   household row, members, theme and display settings, screen + screenwatch (the display state, §13.5)
  calendar/    calendars, events, overrides, occurrences + LRU, rrule_text (the core feature)
  photos/      CORE photo store: files on /data/photos, Pillow re-encode, thumbnails, sha256 dedupe, avatars
  domain/      PURE: recurrence (expand, split, exdate), timeparts, dates (week math, all-day rules), chores (due, rotation), points, countdowns, screen (the screen's wanted power and brightness)
  plugins/     base.py (Plugin protocol, manifest, contributions), context.py (PluginContext), spec.py (ParamField), registry.py (explicit dict), manager.py (runners), models.py (plugin_state), router.py, and one package per plugin:
    calendar_sync/  providers/{base,ics,caldav,google,fake}.py (google covers service-account and OAuth modes), ical.py, tzmap.py, accounts, remote calendars, engine, jobs
    lists/     lists, items
    chores/    chores, completions, routines, rewards, points
    meals/     entries, saved meals
    countdowns/
    screensaver/  sources/{inbox,immich,nextcloud,fake}.py, manifest, slideshow settings
    weather/   open_meteo client, cache, geocoding
```

### 5.4 Frontend layout

```
frontend/src/
  main.tsx router.tsx sw.ts
  api/         openapi.json, schema.d.ts (generated), client.ts, keys.ts
  lib/         events, eventRouter, store, toast, motion (helpers over `motion`), wakeLock, platform, idle (screensaver timer), theme (data-theme + auto schedule), keyboard (on-screen keyboard context), time (a ticking `now` store), night (sleep and the evening dim), dimmer (who dims: the page or the Pi's helper), fly ("+2" to the person's avatar), longPress
  ui/          Button, IconButton, Sheet (native dialog), Chip, PersonBadge, Avatar, Segmented, Skeleton, EmptyState, Toast, Keyboard, Celebration (canvas), ProgressRing, DatePicker, TimePicker, ColorPicker
  shell/       DisplayShell (kiosk: rail + board + today panel), PhoneShell (tab bar), nav.ts (built from the plugin registry), Screensaver
  features/
    registry.ts            the plugin registry: id → {rooms, today, add, personColumn, removed, settingsPages, …} (§6.5)
    calendar/              week/day/month/agenda views, event editor, quick add, occurrence sheet
    sync/ lists/ chores/ meals/ countdowns/ screensaver/ weather/
    settings/ onboarding/ auth/ display/ (pairing, the screensaver host, the on-screen keyboard host)
  styles/      tokens.css, motion.css, tokens.test.ts, designRules.test.ts
  e2e/         display-1080p, display-portrait, phone-webkit, phone-chromium, desktop
```

### 5.5 Conventions (as Dinner Bell, with Sunroom specifics)

- IDs are UUIDv7; timed instants are UTC; all-day dates are ISO `YYYY-MM-DD` strings; enums are StrEnum; soft deletes with `deleted_at` so Undo can restore.
- Routers call services; services call `domain/`; `domain/` is pure and receives `now`.
- Writes publish events inside the transaction; the hub delivers after commit. Event names are `area.verb`.
- Every mutation from a phone or the display is optimistic in the UI and reconciled by the SSE invalidation.
- Attribution ("Done by Mia") comes from the device's current member, never from the request body. On the display, the member is chosen per action by tapping an avatar when it matters (checking a chore), and defaults to Everyone.
- Frontend: strict TypeScript, generated API client only, tokens only (no raw hex), `title=` banned, every action has a visible button (swipes and long-presses are shortcuts), prefer Undo over confirmation, offline and sync trouble are quiet pills.

## 6. The plugin system

### 6.1 Shape

A plugin is one backend package under `plugins/<id>/` and one frontend folder under `features/<id>/`, each registered in an explicit registry. The backend registry is a dict (`plugins/registry.py`), the frontend registry a map of lazy imports (`features/registry.ts`). No importlib discovery, no runtime loading (decision 0002). The user sees plugins as **Features** in Settings, each with a switch and its own settings section.

Two hard rules go into CLAUDE.md: **every plugin must work with every other plugin disabled**, and **plugins never read another plugin's tables**. Cross-plugin needs go through core facades (members, calendar, photos) and through read-time overlays (§7.6).

### 6.2 The backend contract

```python
# plugins/base.py
class PluginStatus(StrEnum): DISABLED, STARTING, RUNNING, ERRORED, STOPPING

@dataclass(frozen=True, slots=True)
class DisplayPanel:      key: str; title: str; sizes: tuple[str, ...]; default_size: str; requires_member: bool = False
@dataclass(frozen=True, slots=True)
class DisplayRoom:       key: str; title: str; icon: str; order: int = 50          # a full-screen "room" on the display's rail
@dataclass(frozen=True, slots=True)
class PhoneTab:          key: str; title: str; icon: str; path: str; order: int = 50
@dataclass(frozen=True, slots=True)
class SettingsSection:   key: str; title: str; parent_only: bool = True
@dataclass(frozen=True, slots=True)
class Contributions:
    display_panels: tuple[DisplayPanel, ...] = ()      # blocks in the Today panel / board tiles
    display_rooms: tuple[DisplayRoom, ...] = ()        # rail entries
    phone_tabs: tuple[PhoneTab, ...] = ()
    settings_sections: tuple[SettingsSection, ...] = ()
    display_overlay: bool = False                      # the screensaver
    banners: tuple[str, ...] = ()                      # quiet-banner keys the shell may show ("sync_error")

@dataclass(frozen=True, slots=True)
class PluginManifest:
    id: str                      # ^[a-z][a-z0-9_]{1,30}$ ; URL prefix is the id with '-' for '_'
    version: str                 # semver of the plugin's API and settings shape
    name: str; description: str
    settings_spec: tuple[ParamField, ...]
    tables: tuple[str, ...]      # every table this plugin owns
    export_tables: tuple[str, ...]
    export_column_excluded: dict[str, frozenset[str]]   # {"sync_accounts": {"credentials_enc"}}
    contributes: Contributions
    default_enabled: bool = False
    subscribes: tuple[str, ...] = ()   # hub event prefixes delivered to on_event

@runtime_checkable
class Plugin(Protocol):
    manifest: PluginManifest
    def register_routes(self, router: APIRouter) -> None: ...       # router already prefixed and gated
    async def on_enable(self, ctx: PluginContext) -> None: ...      # register jobs here with ctx.every / ctx.spawn
    async def on_disable(self, ctx: PluginContext) -> None: ...     # 10 s budget; must not raise
    async def on_event(self, ctx: PluginContext, event: HubEvent) -> None: ...          # optional
    async def validate_settings(self, ctx: PluginContext, values: dict) -> list[str]: ...  # optional
    async def seed_sample(self, ctx: PluginContext, people: dict[str, str]) -> None: ...  # test mode's Sample Family
```

`PluginBase` gives every hook a no-op default. A plugin keeps its context when it stops (no `ctx = None` in `on_disable`): a job that raises marks it errored while its routes stay up (§11.4), and switched off, the framework's gate answers for them. The test server's `POST _test/seed` calls `seed_sample` on each enabled plugin; it adds its synthetic data only when its tables are empty.

`PluginContext` is the whole world a plugin sees: `now()`, `zone()`, `settings()` (coerced against the spec), `read()` / `write()` session managers (the write transaction carries `tx.publish`), read-only facades `household` (name, week start, child-safe editing), `members`, `calendar` (occurrences, calendars, `upsert_synced`, `register_overlay`), `photos` (ingest, list, remove), `publish()`, `http(allow_private=False)` (the SSRF-guarded client, §12.6), `encrypt()` / `decrypt()` (Fernet under the `plugin-secrets-v1` HKDF subkey), `every(name, seconds, job)`, `spawn(name, coro)` and `enabled(other_id)`. Plugins never see the engine. A contract test (`tests/plugins/test_contract.py`) enforces: no plugin imports the engine, another plugin, or state internals; plugin models only reference core tables or their own; every table in the metadata is owned by exactly one of core or a manifest; every `*_enc`, `*_hash`, `*_fp` column is in an export exclusion; every plugin route returns 404 `plugin_disabled` when disabled; spec defaults round-trip through `coerce_params`.

`ParamField` is the earlier project's (§4) with more types: `int, float, bool, string, text, secret, percent, choice, multichoice, time, date, color, member, calendar, latlon, json`. The frontend renders a settings form generically from the spec; `secret` values are write-only and read back as `***`.

### 6.3 Runner and isolation

One asyncio task and queue per enabled plugin (the earlier project's pattern, §4). `on_enable` runs in the task; job tickers enqueue ticks; hub events the plugin subscribed to are enqueued (queue max 1024, overflow marks the plugin errored rather than dropping silently). Callbacks never overlap within a plugin, so plugin code needs no locks; plugins run concurrently with each other. Any exception marks the plugin `errored` with a redacted message, cancels its tickers and publishes `plugins.changed`; its routes keep working (data is intact; only background work stopped). A parent sees a quiet banner ("Weather stopped working. Retry") that calls `POST /api/plugins/{id}/restart`. Boot starts every enabled plugin; one that fails to enable does not stop the server.

### 6.4 Enable, disable, settings, migrations

| Aspect | Behaviour |
|---|---|
| Storage | `plugin_state(plugin_id, enabled, settings_json, settings_version, plugin_version, enabled_at, disabled_at, updated_at)` |
| Boot | Insert a row per registered plugin if missing (`default_enabled`; `calendar_sync`, `lists`, `chores`, `weather` default on; `meals`, `countdowns`, `screensaver` default on too, since the wizard asks "Which features do you want?" and writes the answers) |
| Enable / disable | Parent-gated. Disable stops the runner (10 s budget) and **keeps all data**; routes answer 404 `plugin_disabled` ("Chores is turned off. A parent can turn it on in Settings."); the frontend hides the plugin's rooms, tabs and panels |
| Settings | `settings_json` is spec-typed JSON validated by `coerce_params` on every read and write (an earlier project's strategy-settings precedent; the one place Sunroom departs from "no key-value blobs", because a plugin setting must not require a core migration). `PUT /api/plugins/{id}/settings` bumps `settings_version`, publishes `plugins.changed`; plugins react in `on_event` |
| Migrations | **One Alembic history** for core and plugins; plugin tables are created regardless of enablement; slugs start with the plugin id (`202610151200_chores_routines.py`). Why not per-plugin branches: the single-head assert, exit 65, pre-migration backup naming, `released.lock` and the fixture-DB upgrade tests all key on one revision, and forward-only migrations mean a disabled plugin's schema can never be unapplied anyway |
| Third-party later | Would need: Python entry points, per-branch migrations with a core `depends_on`, a per-package `released.lock`, settings-shape migrations in `on_enable`, frontend chunks served same-origin (the strict `script-src 'self'` allows it) with a version handshake, and an API stability policy keyed on `manifest.version`. Not built; the contract above already avoids raw engine access and declares its tables, so the step stays incremental |

### 6.5 The manifest endpoint and the frontend registry

`GET /api/plugins` returns, per plugin: id, url prefix, version, name, description, enabled, status, error, `settings_spec`, `settings` (secrets masked), `contributes` (display panels, rooms, phone tabs, settings sections, overlay, banners) and `requires_parent_to_manage`. The shell builds the rail, the tab bar, the Today panel and Settings from the intersection of that list and `features/registry.ts`:

```ts
// features/registry.ts
export const plugins: Record<string, () => Promise<{ default: PluginModule }>> = {
  calendar_sync: () => import("./sync"), lists: () => import("./lists"), chores: () => import("./chores"),
  meals: () => import("./meals"), countdowns: () => import("./countdowns"),
  screensaver: () => import("./screensaver"), weather: () => import("./weather"),
};
export interface PluginModule {
  id: string;
  rooms?: PluginRoom[];            // {key, label, icon, order, Display, Phone}: a rail room and a phone tab at /<key>
  today?: TodayBlock[];            // {key, order, Display?, Phone?}: Today panel blocks and phone Today sections
  add?: AddType[];                 // {key, label, order, room?, Editor}: kinds Add makes beside Event
  personColumn?: ComponentType<{ memberId: string | null; day: string }>;   // under a person in Who's doing what
  removed?: ComponentType<{ onCount: (n: number) => void }>;                 // rows in Recently removed
  settingsPages?: SettingsPage[];  // whole pages in Settings, after Calendars & accounts
  settings?: Record<string, ComponentType>;  // sections inside core pages (accounts; household)
  overlay?: ComponentType<{ asleep: boolean; home: string }>;  // over the whole wall: the screensaver
  calendarOverlays?: { key: string; icon: LucideIcon; room: string }[];  // quiet chips on the board
  railBlock?: ComponentType<{ place: "rail" | "band" | "phone" }>;  // by the clock: the weather
  dayHeader?: ComponentType<{ day: string }>;  // a mark in a board day's header
  saverCorner?: ComponentType;     // beside the date on the screensaver
  eventAction?: ComponentType<{ occurrence: Occurrence; onDone: () => void }>;  // "Add a countdown"
  boardPill?: ComponentType;       // a quiet pill in the board header
  onboarding?: ComponentType<{ onDone: () => void }>;  // a first-run step
}
```

A plugin's room lives at its own address (`/lists`, `/chores/rewards`): the router's `/$room` and `/$room/$` routes render the module's `Display` on the wall and `Phone` on a phone, and an address whose plugin is off goes home. The rail lists Calendar, then each room by `order`; the tab bar has Today, Calendar, then rooms until four tabs are used, then More. Rooms return to the board after the household's idle minutes unless something holds the screen (`holdIdle`, the routine runner). Today blocks follow the calendar's sections by `order` (Chores today 10, Tonight 20, To do 30, Coming up 40). Rooms in order: Lists 20, Chores 30, Meals 40, Countdowns 50, Photos 60; on phones the first two are tabs and the rest are in More. On the wall, Add in a plugin room opens with that room's kind first; the shell hosts it outside the Calendar room.

The display's panel order lives in `kiosk_panels` rows (seeded with `calendar.week`), editable in Settings → Display with up/down buttons.

## 7. Calendar core

### 7.1 Model

- `calendars`: name, color (one of the eight person colors, or a person's own), `kind` local or sync, optional owner member, `read_only`, `visible_on_display`, `version` (bumped on every event write in that calendar; the occurrence cache key), `remote_ref` for synced ones.
- `events` are master rows: title, description, location; timed events store `start_utc`, `end_utc` and `tzid`; all-day events store `start_date`, `end_date` (exclusive, iCalendar semantics); `rrule` (RFC 5545 value), `rdates_json`, `exdates_json`, `recurrence_end_utc`; derived `window_start_utc`/`window_end_utc` for range queries; `status`; optional per-event `color`; `source` local or sync with `remote_uid`, `remote_id`, `etag`, `remote_updated_at`, `remote_sequence`, `pending_push`, `pending_delete`, and `raw_ical` (the original VEVENT text for synced rows, so a push edits the server's own component and keeps `X-APPLE-*` properties and alarms intact); `version` for optimistic concurrency. Overrides are rows with `parent_event_id` and `recurrence_id` (the original occurrence start as a naive local string, or a date). Members attach through `event_members` (no rows = Everyone). `event_reminders` hold minutes-before for the display's "starting in 15 min" toast. `event_revisions` snapshot every mutation for Undo (30 days).
- Constraints: `UNIQUE(calendar_id, remote_uid, recurrence_id)`; a check that exactly one of the timed or all-day column sets is filled; overrides always have a parent.

### 7.2 Time semantics

| Kind | Stored | Expanded | Shown |
|---|---|---|---|
| Timed | UTC instants + `tzid` | The rule runs on naive local datetimes in `tzid` (RFC 5545: "9:00 every day" stays 9:00 across DST); each occurrence is re-localized to UTC; the duration is an absolute delta | In the household zone |
| All-day | ISO dates, end exclusive | On dates, no zone | The same dates in any zone; multi-day spans never shift |
| Floating (from ICS) | `tzid` = the household zone at import, `floating = 1` | As timed | Re-imported on a full sync if the household zone changes |

Validation on write: end after start; `tzid` loads in `zoneinfo`; `rrule` parses strictly with `FREQ` in daily/weekly/monthly/yearly, `INTERVAL ≥ 1`, `COUNT ≤ 1000`, `UNTIL ≥ DTSTART`; secondly/minutely/hourly rules are refused (422 `rrule_unsupported`).

### 7.3 Occurrences

`GET /api/calendar/occurrences?from&to&calendar_ids&member_ids&overlays&include_cancelled` (half-open range in the household zone, max 93 days) returns concrete occurrences sorted by start, each with `key` (`event_id|recurrence_id`), UTC and local starts and ends, all-day dates, color, member ids, `is_recurring`, `is_override`, `read_only`, `source`, and `overlay` (null for real events). Expansion: resolve the zone → for each calendar and ISO-week bucket, look up an LRU cache keyed `(calendar_id, bucket_monday, calendar.version)` → on miss, three indexed queries (masters overlapping the bucket by `window_*`, their overrides, their members) → `domain.recurrence.expand(series, overrides, window)` (a `Series` carries the master's timing, zone, rule, RDATEs and EXDATEs) → cache (512 entries) → merge, filter precisely, serialize. Expansion caps at 1000 occurrences per master per bucket. A `sunroom bench occurrences --events 500 --recurring 100 --weeks 1` command prints cold and warm timings; the M1 verify line runs it on the Pi (budget: cold under 100 ms, warm under 10 ms).

`domain/recurrence.py` walks rules itself (ADR 0023) and imports only the standard library (`zoneinfo`, `calendar`); the purity test still bans clocks and randomness. `python-dateutil` and `recurring-ical-events` are dev dependencies used only as references: a Hypothesis property against `dateutil.rrule`, and the ICS fixtures' goldens against `recurring-ical-events`.

### 7.4 Editing a recurring event

Every mutation writes a revision first and runs in one write transaction. With M the master, S its start, T the occurrence's original start, R its rule:

- **This occurrence**: upsert an override row for T with the patch applied (a moved occurrence may land anywhere); remove T from exdates if present; members copied unless patched. Synced: mark the series `pending_push`.
- **This and following**: if T = S, treat as all. Otherwise truncate M (`UNTIL = T − 1 s`, or `COUNT' = occurrences in [S, T)`), drop exdates and overrides at or after T (reported as `dropped_overrides`), and create M2 as a copy of M starting at T with the patch, the remaining rule, no remote ids, `pending_push` if synced (the provider creates a new series).
- **All**: patch M in place. A time-of-day shift by δ shifts exdates and override ids by δ; a start-date or rule change clears exdates and overrides (reported).
- **Delete**: this → exdate (and drop the override); following → the truncation only; all → soft-delete M and overrides (`pending_delete` for synced, kept until the push succeeds).
- **Undo**: `POST /api/calendar/events/{id}/undo` restores the newest revision within 30 days (splits restore the truncated rule and soft-delete the sibling). The UI shows a 6-second toast for every destructive action, as Dinner Bell.

The phone and display editors offer "Repeat" presets (none, daily, weekly on these days, every 2 weeks, monthly on this date, monthly on the nth weekday, yearly, custom) that compile to RRULE; `GET /api/calendar/rrule/describe` returns the sentence ("Every 2 weeks on Tuesday until Dec 31") the editor shows.

### 7.5 Merging synced events

Identity is `(calendar_id, remote_uid, recurrence_id)`. The sync plugin converts each remote item into an `EventSpec` and calls `ctx.calendar.upsert_synced(calendar_id, specs, deletions)` in chunks of 200 per write transaction so the write lock stays short on a Pi. Per item: insert if unknown; skip if the etag matches; keep the local row if it has `pending_push` and is newer than the remote change (the push wins later); otherwise overwrite and write a revision. Remote deletions soft-delete. A VEVENT with RECURRENCE-ID upserts an override; a cancelled instance becomes an exdate. Ties go to the remote. Read-only calendars refuse edits with 409 `calendar_read_only` ("This calendar comes from iCloud and can't be changed here.").

### 7.6 Overlays

`ctx.calendar.register_overlay(provider, key)` lets a plugin add computed, read-only occurrences (meals on their day, countdowns) to `/occurrences?overlays=meals,countdowns` without rows in `events`. Overlay occurrences carry `overlay: "meals"`, `event_id: null`, `read_only: true`, and are not cached. The facade wraps each provider so a switched-off plugin answers nothing; the board asks for the overlays of the plugins that are on and draws them as quiet chips that open the plugin's room (ADR 0026).

## 8. Calendar sync (the `sync` plugin)

Plugin id `calendar_sync`, URL prefix `/api/calendar-sync`. One `CalendarProvider` protocol, four implementations, one sync engine.

### 8.1 Providers

| Provider | Auth | Direction | Setup burden for a family | Notes |
|---|---|---|---|---|
| `ics` | none (the URL is the secret) | read-only | Paste a link | Google "Secret address in iCal format", iCloud public calendar links (`webcal://` → `https://`), Outlook "Publish calendar", school and sports feeds. ETag / If-Modified-Since caching; minimum interval 5 min, default 30. Google's secret feed can lag by hours; the UI says "updates a few times a day" |
| `caldav` | server URL + username + app-specific password | two-way | iCloud: create an app-specific password at appleid.apple.com (illustrated steps on the phone), paste it; other servers: URL + login | Discovery: `.well-known/caldav` → current-user-principal → calendar-home-set → calendars (Nextcloud, Fastmail, Radicale, Baïkal, iCloud at `caldav.icloud.com`). Sync by `sync-collection` with a sync token when the server supports it, else ctag + etag diff; reads by `calendar-multiget` on hrefs (iCloud's `event_by_uid` does not work). Pushes `PUT` the whole VCALENDAR with `If-Match`, editing the stored `raw_ical` component rather than rebuilding it. iCloud specifics, verified 2026-10-07: never hard-code the `pNN-caldav.icloud.com` host (discover it); two-factor plus an app-specific password is the only auth (a 401 with the right password means the Apple ID password was used); changing the Apple ID password revokes every app-specific password (→ `needs_reconnect`); iCloud does not expand recurrences server-side (we never ask it to); undocumented 503 "rate limit" responses (→ backoff); the same UID cannot exist in two calendars; Reminders are not reachable over CalDAV. Everything learned goes in `docs/SYNC.md` |
| `google` (service account) | a service-account JSON key the family creates once, plus "share this calendar with …@…iam.gserviceaccount.com" | two-way | About seven guided steps with screenshots; no consent screen, no verification, no token expiry; works on a LAN | The app shows the service account's email with a copy button; the user shares each calendar with "Make changes to events"; the app adds the calendar by its ID (the Gmail address for the main calendar) via `calendarList.insert`, then syncs with `syncToken`. Cannot invite attendees (not needed) |
| `google` (OAuth) | client id and secret (Settings fields, env override) + sign-in | two-way | When Sunroom has a public HTTPS address (Tailscale Serve, a reverse proxy), or on the display itself when the Pi hosts both the server and the browser: Settings on the display offers "Connect Google on this screen" when `location.hostname` is `localhost`, because Google allows loopback redirects for Desktop clients | Google refuses plain-HTTP, raw-IP and non-public-host redirect URIs; the device-code flow excludes Calendar scopes (verified 2026-10-07). Settings shows the exact redirect URI to register. Kroger's PKCE + state + encrypted refresh-token pattern, single-flight refresh, `needs_reconnect` on `invalid_grant`. Apps left in "Testing" status get 7-day refresh tokens; the setup guide says to publish the app (no verification is needed for personal use with the warning screen) |
| `holidays` | none | read-only, offline | Pick a country (and state) | The `holidays` package generates a public-holidays calendar locally; no network, no feed. Enabled by the wizard from the detected region |
| `microsoft` | later | | | Graph supports the device-code flow even for personal accounts, but a self-hoster must first create a free Entra tenant to register an app; "Publish calendar" ICS covers read-only today |

Connect flows live on the phone (typing), never on the display, except the loopback Google sign-in above. Each account yields remote calendars; mapping one creates a `calendars` row with a color and an owner person ("Mia's school calendar"). Unmapping soft-deletes the calendar and keeps events restorable for 30 days. Default polling: 5 minutes for token-based providers (CalDAV `sync-collection`, Google `syncToken`; both are cheap and well inside quotas), 30 minutes for ICS feeds (minimum 5), with "Sync now" everywhere and "Updated 2 min ago" in Settings → Calendars. Google's `syncToken` cannot be combined with a time window, so masters are stored and expanded locally, which is what §7 does anyway.

### 8.2 The engine

- `calendar_sync:tick` every 60 s spawns one worker per due account (`next_sync_at`), at most two accounts concurrently; `push-sweep` every 60 s (and on `events.changed`) pushes `pending_push` / `pending_delete` items grouped by series with `If-Match`; a 412 pulls, re-merges and retries once; 401/403/`invalid_grant` marks the account `needs_reconnect` and stops; other failures keep the flags and back off (`interval × 2^failures`, max 60 min, ±20 % jitter).
- First sync of a big calendar imports in chunks and reports progress ("Importing… 1,200 of 2,000") through `sync.changed`.
- Status surfaces as a quiet banner, never an error wall: "iCloud hasn't synced since Tuesday. Fix" → the account's settings; events edited locally but not yet pushed show a small "Not synced yet" mark.
- Credentials (`credentials_enc`) are Fernet-encrypted under an HKDF subkey; a changed secret key wipes them at boot and marks accounts `needs_reconnect` (the reconcile step generalizes over every table with a `credentials_enc` column; a test enumerates them). Logs never contain tokens, URLs beyond the host, or event bodies.
- Tables: `sync_accounts`, `remote_calendars`, `sync_runs` (last 50 per account, 7 days), `oauth_states`. `credentials_enc` and `sync_runs` are excluded from export.

### 8.3 Fixtures and tests

Fourteen ICS fixtures with golden expected occurrences, cross-checked against `recurring-ical-events` (twelve from M1; M2 added an Outlook calendar with a Windows TZID and a Google feed with `X-WR-TIMEZONE`): weekly with EXDATEs, a RECURRENCE-ID override, an all-day span across both DST changes, floating time, UTC, an Outlook VTIMEZONE with a Windows TZID ("Eastern Standard Time", mapped by `tzmap.py`), monthly by last Friday with COUNT, a yearly birthday, a cancelled instance, a multi-day timed event over DST, RDATE, and an UNTIL in 2099 (capped). `FakeCalendarProvider` scripts remote state (calendars, items with etags, `fail_next`) for engine tests; an opt-in `just smoke-caldav` runs the real CalDAV adapter against a Radicale container with the fixtures imported, and checks every fixture's occurrences against its golden after the round trip.

## 9. The other plugins

| Plugin | Tables | What it does | Display | Phone |
|---|---|---|---|---|
| `lists` | `lists`, `list_items` | Shared checklists (grocery, to-do, packing, custom) with items that can carry a quantity, a note, a person and a due date; reorder; clear checked (with Undo); optional auto-clear after N days. Items with a due date appear in the `chores` overlay as tasks | Room "Lists"; Today panel block "Needs doing" (due or assigned items) | Tab "Lists" |
| `chores` | `chores`, `chore_completions`, `point_adjustments`, `rewards`, `redemptions`, `routines`, `routine_steps`, `routine_checks` | Recurring responsibilities (RRULE, due time, fixed / rotating / anyone assignment) computed into a due list per day; completion with attribution, optional parent approval, points, streaks (computed); rewards a person can request and a parent approves; routines (morning, bedtime) as step-by-step checklists per child that reset daily. All optional: points, rewards and routines each have a switch | Room "Chores" (today per person), Today panel blocks "Chores today" and "Points"; the routine runner is full-screen | Tab "Chores" |
| `meals` | `meal_entries`, `saved_meals` | A week grid of breakfast / lunch / dinner / snack entries (the household picks which; Dinner by default): free text with an optional emoji, link and the person cooking; every meal typed is kept as a saved meal for one-tap re-adding, with its ingredients for "Add ingredients to Groceries" while Lists is on; Swap days; copy last week. Dinner appears on the calendar as an all-day overlay chip when the household turns it on. `source_url` is reserved for a later Dinner Bell link (§19) | Room "Meals" (and Saved meals); Today panel block "Tonight" | In More |
| `countdowns` | `countdowns` | "12 days until the beach trip" with an emoji, optional person and color, yearly repeat, and "not on the kitchen screen" for a surprise; birthdays come from members automatically; "Add a countdown" from an event's sheet; the big celebration on the day | Room "Countdowns"; Today panel block "Coming up" (the nearest 3); a star on the board's day | In More |
| `screensaver` | `photo_sources` (+ core `photos`) | Photo slideshow when the display is idle (idle minutes, seconds per photo, shuffle, the clock and Up next); Night wins over it; sources: phone upload and the inbox folder on the volume, later Immich and Nextcloud | The overlay; room "Photos"; Settings → Photos & screensaver | Photos in More: add, remove, Start screensaver |
| `weather` | `weather_cache` | Open-Meteo current conditions, the next hours and a 7-day forecast for the household's place (searched by name at first run or in Settings → Household → Location); units (auto by the time zone); refreshed every 30 min; "as of 9:10" when stale | Rail block (in portrait's band) and day-header icons; the screensaver's date line | Today header |

Each plugin's full endpoint list is in §11.3.

## 10. Data model

Conventions: `String(36)` UUIDv7 ids; `UTCDateTime`; `IsoDate` (`YYYY-MM-DD`); StrEnum values in `String(n)`; JSON in `Text` columns named `*_json`; soft deletes via `deleted_at`; `version` integers where edits race.

### 10.1 Core

| Table | Columns | Notes |
|---|---|---|
| `household` (one row, `CheckConstraint("id = 1")`) | name; timezone (IANA; NULL → `TZ`); week_starts_on (0 Mon … 6 Sun; default 6); time_format (`12h`/`24h`); theme (`auto`/`light`/`dark`); daylight_tint (bool); text_size (`standard`/`large`/`xl`); default_calendar_id; display_home_view (`week`/`today`/`people`); display_return_minutes (2/5/10/0 = never); display_rail_side (`left`/`right`); display_controls_bottom (bool); display_show_today_panel (bool); display_orientation (`auto`/`landscape`/`portrait`); display_sounds (bool, default false); display_dim_past (bool); sleep_from, sleep_to (`HH:MM`, NULL = off); sleep_mode (`dim_clock`/`screen_off`); dim_from (`HH:MM`, NULL = off; only with a sleep time); dim_level (20/40/60, percent of full brightness; default 40); update_check (bool, default false; `SUNROOM_UPDATE_CHECK=0` pins it off); kid_safe_editing (bool, default true when a child exists); parent_pin_hash (PBKDF2-SHA256, 200k iterations, salted); pin_updated_at; onboarded_at; location_label, latitude, longitude (shared with weather and the sunrise schedule); updated_at | Typed single row; `onboarded_at` NULL means the setup wizard is open (§12.1). Screensaver timing lives in the `screensaver` plugin's settings |
| `app_meta` (one row) | auth_epoch; password_fp; secret_key_check; last_boot_version | As Dinner Bell |
| `members` | name (40); role (`parent`/`kid`); color (one of the eight names); avatar_photo_id → photos; birthday (IsoDate, NULL); sort; created_at; archived_at | Attribution, never access control |
| `devices` | label; kind (`phone`/`kiosk`); member_id (NULL on kiosks = Everyone); is_kid_device; paired_via (`password`/`code`/`kiosk_code`); created_at; last_seen_at; revoked_at | `kind` is immutable after pairing |
| `join_codes` | code_hash PK; kind (`phone`/`kiosk`); created_by_device_id; created_at; expires_at; used_at; used_by_device_id | Six characters from an unambiguous alphabet (no 0/O, 1/I), 10 minutes, single use, stored as an HMAC; one mechanism pairs a screen and adds a phone |
| `kiosk_panels` | panel_key PK (`calendar.week`, `chores.today`, …); position; visible; size | The display's Today panel order; rows whose plugin is disabled are kept but not rendered |
| `network_allowlist` | target (host, IP or CIDR); label; created_by_member_id; created_at | Private addresses an ICS or photo source may use (§12.6) |
| `photos` | kind (`library`/`avatar`); source_key (`upload`, `inbox`, `source:<id>`); original_name; taken_at; width; height; bytes; sha256 (unique with kind); created_at; hidden; deleted_at | Files: `/data/photos/library/<id>.webp` (≤ 2560 px), `thumbs/<id>.webp` (≤ 400 px), `avatars/<id>.webp` (512 square). EXIF stripped after `taken_at` is read. A 6-hourly reconcile hides rows without files and quarantines files without rows to `.orphans/` |
| `calendars`, `events`, `event_members`, `event_reminders`, `event_revisions` | §7.1 | |
| `plugin_state` | plugin_id PK; enabled; settings_json; settings_version; plugin_version; enabled_at; disabled_at; updated_at | §6.4 |

### 10.2 `calendar_sync`

| Table | Columns |
|---|---|
| `sync_accounts` | provider (`ics`/`caldav`/`google`/`microsoft`); auth_mode (`none`/`app_password`/`service_account`/`oauth`); label; status (`connected`/`needs_reconnect`/`error`/`paused`); server_url; username; credentials_enc (Fernet JSON); allow_private; owner_member_id; interval_s; last_sync_at; last_success_at; next_sync_at; last_error (plain English, no secrets); last_error_at; consecutive_failures; version; created_by_member_id; created_at; deleted_at |
| `remote_calendars` | account_id; remote_id; name; color_hint; read_only; mapped; calendar_id → calendars; sync_token; ctag; last_synced_at; last_error; created_at; `UNIQUE(account_id, remote_id)` |
| `sync_runs` | account_id; started_at; finished_at; outcome; fetched; created; updated; deleted; pushed; error; duration_ms |
| `oauth_states` | state_hash PK; provider; code_verifier; device_id; created_at; expires_at; used_at |

### 10.3 Other plugins

| Table | Columns |
|---|---|
| `lists` | name; kind (`grocery`/`todo`/`packing`/`custom`, guessed from the name); icon; sort; created_by_member_id; created_at; updated_at; deleted_at |
| `list_items` | list_id; text (200); note; quantity (20); due_date (IsoDate, NULL); checked_at; checked_by_member_id; assigned_member_id; position; version; created_by_member_id; created_at; updated_at; deleted_at; cleared_at (Clear done: hidden, kept as the list's history for its Usuals, gone after 180 days) |
| `chores` | title; description; icon; points (default 0); rrule (NULL = one-off); start_date; due_time (`HH:MM`); assignee_mode (`fixed`/`rotate`/`any`); assignee_member_ids_json (ordered); rotation_index; requires_approval (NULL → plugin setting); skipped_dates_json (Skip today); active; created_by_member_id; created_at; updated_at; deleted_at |
| `chore_completions` | chore_id; due_date; member_id; completed_at; completed_by_device_id; points_awarded; status (`done`/`pending`/`rejected`); approved_by_member_id; approved_at; `UNIQUE(chore_id, due_date, member_id)`. Undo deletes the row (ADR 0025) |
| `point_adjustments` | member_id; points (±); reason; by_member_id; created_at |
| `rewards` | title; cost_points; icon; active; sort; created_at; deleted_at |
| `redemptions` | reward_id; member_id; cost_points; status (`requested`/`approved`/`denied`/`cancelled`: Take it back); requested_at; decided_by_member_id; decided_at |
| `routines` | title; member_id (NULL = every child); days_json; window_start; window_end (`HH:MM`); icon; points (stars for finishing); sort; active; created_at; deleted_at |
| `routine_steps` | routine_id; title; icon; position |
| `routine_checks` | routine_step_id; member_id; day; checked_at; PK(step, member, day); kept 60 days |
| `routine_finishes` | routine_id; member_id; day; finished_at; points_awarded; PK(routine, member, day): a routine's stars, once a day |
| `meal_entries` | day; slot (`breakfast`/`lunch`/`dinner`/`snack`); position; text; emoji; recipe_url; note; member_id (who cooks); saved_meal_id; source_url; created_by_member_id; created_at; updated_at; deleted_at; one live entry per (day, slot, position): a unique index on rows not removed (ADR 0026) |
| `saved_meals` | text; emoji; recipe_url; ingredients_json; use_count; last_used_at; created_by_member_id; created_at; updated_at; deleted_at (Archive) |
| `countdowns` | title; emoji; color; date (a yearly one's first); time; repeat_yearly; member_id; show_on_display; created_by_member_id; created_at; updated_at; deleted_at |
| `photo_sources` | kind (`inbox`/`immich`/`nextcloud`); label; config_json; credentials_enc; allow_private; enabled; last_scan_at; last_error; items_seen; created_at; deleted_at |
| `weather_cache` (one row) | latitude; longitude; units; payload_json; fetched_at; expires_at; last_error; last_error_at |

Points balance = done completions + finished routines + adjustments − approved redemptions, computed in `domain/points.py`; a request not yet answered holds its cost. The due list, turns and streaks are computed in `domain/chores.py` (ADR 0025). Chores never store per-day instances; the due list is computed from the rule and the completions.

### 10.4 Export

Exported: household (minus `parent_pin_hash`), members, kiosk_panels, network_allowlist, photos metadata, calendars, events, event_members, event_reminders, plugin_state, sync_accounts (minus `credentials_enc`), remote_calendars, lists, list_items, chores, chore_completions, point_adjustments, rewards, redemptions, routines, routine_steps, routine_checks, routine_finishes, meal_entries, saved_meals, countdowns, photo_sources (minus `credentials_enc`). Excluded: app_meta, devices, join_codes, event_revisions, oauth_states, sync_runs, weather_cache. Plus one `.ics` per local calendar. A test asserts every table is in exactly one list and every `*_enc`/`*_hash`/`*_fp` column is excluded. Photo files are on the volume; `docs/RESTORE.md` says to back up `/data` whole.

## 11. API outline, jobs and live events

All under `/api`; the error envelope everywhere; mutations carry `X-Sunroom: 1`. Auth column: `—` public, `A` any signed-in device, `K` a kiosk acting as a tapped member (`X-Sunroom-Member` header, §12.3), `P` parent (a phone not marked as a child's, or any device holding a parent-PIN grant).

### 11.1 Core

| Area | Endpoints | Event |
|---|---|---|
| Setup (first run) | `GET setup/status` —; `POST setup/household {password, name, timezone, …}` — (only while `onboarded_at` is NULL and no password exists); the rest of the wizard uses the normal routes | `settings.changed` |
| Meta | `GET health`, `GET version` —; `GET admin/diagnostics`, `GET admin/backups`, `POST admin/backups/run`, `GET admin/backups/{name}`, `GET admin/backups/full.zip` (the DB plus photos and a manifest), `GET export` P; `GET admin/update` A (the opt-in check's last answer and how to update here), `POST admin/update/check` P (Check now: once a minute, 409 while the check is off, §13.6) | |
| Auth | `POST auth/login` —; `POST auth/join-codes` A (a signed-in phone shows a code for a new phone); `POST auth/join {code}` —; `GET auth/session` A; `PUT auth/member` A (phones; 409 on kiosks); `POST auth/logout` A; `GET auth/devices` P; `PATCH auth/devices/{id} {label, is_kid_device}` P; `DELETE auth/devices/{id}` P; `POST auth/devices/sign-out-others {include_kiosks}` P | `devices.changed` |
| Display pairing | `POST auth/kiosk/pairings` — (the display asks for a code: `{code, poll_token, expires_in}`); `GET auth/kiosk/pairings/{poll_token}?wait=25` — (long-poll; carries the session cookie once claimed); `POST auth/kiosk/pair {code, label}` P (a parent's phone claims the code); `POST auth/kiosk/pair-with-password {password, label}` — (typed on the display; the login limiter applies) | `devices.changed` |
| Display state | `GET display/state?wait=55&etag` — (the screen's wanted power and brightness with the reason, the schedule and the server's time; a long-poll for the Pi helper that answers at once when its etag is stale, §13.5); `POST display/wake` (a kiosk's cookie only, 403 otherwise; awake for 2 minutes) | |
| Parent PIN | `PUT auth/pin`, `DELETE auth/pin` P; `POST auth/pin/verify {pin}` A (sets the 10-minute grant cookie; rate-limited per device); `POST auth/pin/lock` A | `settings.changed` |
| Household | `GET settings` A; `PATCH settings` P; `GET members` A; `POST members`, `PATCH members/{id}`, `POST members/{id}/archive`, `…/restore`, `PUT members/{id}/avatar`, `DELETE members/{id}/avatar` P | `members.changed`, `settings.changed` |
| Photos (core store) | `GET photos?kind&source&cursor` A; `POST photos` (multipart, ≤ 15 MB, ≤ 10 files) A; `GET photos/{id}`, `GET photos/{id}/thumb` A; `DELETE photos/{id}`, `POST photos/{id}/hide` P | `photos.changed` |
| Display | `GET kiosk/layout` A; `PUT kiosk/layout` P; `POST kiosk/command {reload \| wake \| screensaver \| show_event}` P | `settings.changed`, `kiosk.command` |
| Network allowlist | `GET`, `POST`, `DELETE network-allowlist` P | `settings.changed` |
| Calendar | `GET calendar/calendars` A; `POST`, `PATCH`, `DELETE` (soft), `…/restore calendar/calendars` P (local only; 409 `managed_by_sync` otherwise); `GET calendar/occurrences` A; `GET calendar/events/{id}` A; `POST calendar/events` A K; `PATCH calendar/events/{id} {scope: all, expected_version}` A K; `PATCH calendar/events/{id}/occurrences/{rid} {scope: this \| following}` A K; `DELETE calendar/events/{id}?scope=all`, `DELETE …/occurrences/{rid}?scope=` A K; `POST calendar/events/{id}/undo` A; `POST calendar/events/{id}/move` A K (drag fast path); `GET calendar/rrule/describe` A | `calendars.changed`, `events.changed {calendar_id, event_ids, calendar_version}` |
| Plugins | `GET plugins` A; `POST plugins/{id}/enable`, `…/disable`, `…/restart` P; `GET plugins/{id}/settings` A; `PUT plugins/{id}/settings` P | `plugins.changed` |
| Test only (`SUNROOM_TEST_MODE=1`, localhost) | `POST _test/reset`, `_test/drop-streams`, `_test/revoke-sessions`, `_test/clock {set \| advance}`, `POST _test/seed {profile: "sample-family"}` (the Sample Family in Sample Town, and each plugin's own data); the sync plugin's scripted account (`calendar-sync/_test/fake`); the weather plugin makes up its forecast in test mode | |

### 11.2 Sync plugin (`/api/calendar-sync`)

`GET accounts` A; `POST accounts/ics {url, label, owner_member_id, interval_min}` P (SSRF check, fetched once to validate, auto-mapped); `POST accounts/caldav {server_url, username, app_password, label, allow_private}` P (discovery, lists calendars, nothing mapped yet); `POST accounts/google/service-account {key_json, label}` P (validates the key, returns the service-account email to share with); `POST accounts/{id}/google/add-calendar {calendar_id}` P (`calendarList.insert` then a first sync); `POST accounts/google/start` P → `{authorize_url}` and `GET google/callback` — (state is single-use; redirects to `/settings/calendars?google=connected|denied|expired|failed`); `GET accounts/{id}/calendars` A; `PUT accounts/{id}/calendars/{rid} {mapped, color, owner_member_id, visible_on_display}` P; `POST accounts/{id}/sync` P (409 if running; 1 per 60 s); `PATCH accounts/{id}` P; `DELETE accounts/{id}` P (credentials wiped; calendars unmapped; events kept 30 days); `GET accounts/{id}/runs` P. Events: `sync.changed {account_id, status}`, `calendars.changed`, `events.changed`.

### 11.3 Other plugins

| Plugin | Endpoints |
|---|---|
| `lists` | `GET lists`, `POST lists`, `PATCH lists/{id}`, `DELETE lists/{id}`, `POST lists/{id}/restore` (a parent, or a child's own list), `PUT lists/order`; `GET lists/{id}/items` (open items, done ones, Usuals), `POST lists/{id}/items` (several at once; one already open isn't added twice), `PATCH lists/{id}/items/{item}` (text, note, quantity, due, assignee, position, checked), `DELETE …/items/{item}`, `POST lists/{id}/restore-items {ids}` (Undo and Put back), `POST lists/{id}/clear-checked` (returns ids for Undo); `GET lists/todo?date` (open items due by that day), `GET lists/removed`. All A K. `lists.changed {list_id}` |
| `chores` | `GET chores?include_inactive` A; `POST chores` A K (adding never asks for the PIN); `PATCH`, `DELETE chores/{id}`, `POST chores/{id}/restore`, `POST chores/{id}/skip \| unskip {date}` P; `GET chores/today?date` A (columns, boxes, routines, stars with streaks, asks, completions waiting); `GET chores/week?start` A; `GET chores/removed` A; `POST chores/{id}/complete {due_date, member_id}` A K (credit: ADR 0025); `POST chores/{id}/undo {due_date, member_id}` A K (own completion, or P); `POST chores/completions/{id}/approve \| reject` P; `GET chores/points` A; `POST chores/points/adjust` P; `GET chores/rewards?include_inactive` A; `POST`, `PATCH`, `DELETE chores/rewards` P; `POST chores/rewards/{id}/redeem` A K; `POST chores/redemptions/{id}/cancel` A K (the asker, or P); `POST chores/redemptions/{id}/approve \| deny` P; `GET chores/routines?member_id&date&include_inactive` A; `POST`, `PATCH`, `DELETE chores/routines` P; `PUT chores/routines/{id}/steps` P; `POST chores/routines/{id}/steps/{step}/check {date, member_id, checked}` A K; `POST chores/routines/{id}/finish {date, member_id}` A K (stars once a day). Events: `chores.changed`, `points.changed {member_id}`, `routines.changed` |
| `meals` | `GET meals/week?start&days` A (the household's slots and the entries, each with its saved meal's ingredients); `PUT meals/entries` A K (with an id it changes that entry, without one it fills the spot; returns what it replaced, for Undo; a new text becomes a saved meal); `DELETE meals/entries/{id}`, `POST …/restore` A K; `POST meals/entries/{id}/move {day, slot}` A K (Swap days); `POST meals/copy-week {from_start, to_start}` A K (returns ids for Undo; filled spots are kept); `GET meals/saved?q` A; `POST`, `PATCH`, `DELETE` (Archive), `…/restore meals/saved` A K; `GET meals/removed` A. `meals.changed {days}` |
| `countdowns` | `GET countdowns/upcoming?limit&include_birthdays&date` A (countdowns and birthdays, soonest first, with days to go; the wall never lists a surprise); `GET`, `POST`, `PATCH`, `DELETE`, `…/restore countdowns` A K; `GET countdowns/removed` A. `countdowns.changed` |
| `screensaver` | `GET screensaver/manifest` A (every library photo not hidden or removed, newest first, with its URLs; the settings); `GET screensaver/sources`, `PATCH screensaver/sources/{id}` P; `POST screensaver/sources/{id}/scan` P (Check now). Start screensaver from a phone is core's `POST kiosk/command {screensaver}`. Adding Immich or Nextcloud sources comes later. `screensaver.changed`, `photos.changed` |
| `weather` | `GET weather` A (status, the place, units, now, the next 24 hours, 7 days with sunrise and sunset; `fetched_at`, `stale` after 3 h); `POST weather/refresh` P (once a minute); `GET weather/geocode?q` P (10 a minute per device). The test server makes up its forecast and places and never calls Open-Meteo. `weather.changed` |

### 11.4 Background jobs

| Job | Cadence | Does | Failure surfaces as |
|---|---|---|---|
| `nightly-backup` (core) | 03:30 household time | Verified online backup; rotate 14 daily / 8 weekly; `PRAGMA optimize` | Settings banner when the last good backup is older than 36 h; diagnostics |
| `prune-expired` (core) | hourly | Join codes, revisions > 30 d, OAuth states, sync runs > 7 d | Log |
| `photos-reconcile` (core) | 6 h | Hide rows without files; quarantine files without rows | Diagnostics count |
| `calendar_sync:tick` | 60 s | Spawn due account workers (≤ 2 concurrent) | Account `last_error`; status `error` after 3 failures; `needs_reconnect` on auth failure; `sync.changed`; the quiet banner |
| `calendar_sync:push-sweep` | 60 s and on `events.changed` | Push pending edits and deletes | "Not synced yet" on the event; the banner |
| `screensaver:inbox-scan` | 5 min | Import files from `/data/photos/inbox` (JPEG, PNG, WebP, HEIC) that have sat still for 10 s, re-encoded before the write lock, one transaction each; originals move to `inbox/imported/`, unreadable files to `inbox/unreadable/` | Source `last_error` in Settings → Photos & screensaver |
| `screensaver:source-sync` | 30 min (later) | Immich and Nextcloud albums since `last_scan_at` | Same |
| `screensaver:thumb-backlog` | 10 min | Missing thumbnails after a crash mid-import | Log |
| `meals:prune` | hourly | Delete entries removed and saved meals archived over 7 days ago | Log |
| `countdowns:tidy` | hourly | A one-off countdown whose day has passed leaves for Recently removed; removed ones go after 7 days | Log |
| `weather:refresh` | 30 min, and when the household's place or the units change | Open-Meteo forecast; cache 60 min; after a failure, 5 minutes before the next try | The rail shows "as of 9:10" after 3 h |
| `lists:tidy` | hourly | Auto-clear done items after the chosen days; delete lists and items removed over 7 days ago, and cleared items over 180 days | Log |
| `chores:prune` | hourly | Delete routine checks over 60 days old (chores, completions and redemptions are history) | Log |
| `screen-schedule` (core) | 30 s, and on `settings.changed` | Works out the screen's wanted state; wakes the display-state long-polls when it changes | The Pi's helper keeps the last state; the page sleeps by itself |
| `update-check` (core) | hourly; asks GitHub once 24 h have passed, opt-in | GitHub's latest release compared with the build | The line in Settings → About (§13.6) |

Plugin jobs run inside their runner; a job exception marks the plugin errored (restartable) while its routes stay up.

### 11.5 Live events (SSE)

`hello` (epoch, seq, mode live/replay/resync, server time), `ping`, `session.expired`, `members.changed`, `settings.changed`, `devices.changed`, `plugins.changed {id, status}`, `calendars.changed`, `events.changed {calendar_id, event_ids, calendar_version}` (clients debounce 250 ms and skip if their cached `calendar_versions[id]` is already current), `sync.changed`, `lists.changed`, `chores.changed`, `points.changed`, `routines.changed`, `meals.changed`, `countdowns.changed`, `photos.changed`, `screensaver.changed`, `weather.changed`, `kiosk.command` (kiosks act; phones ignore). The client (`lib/eventRouter.ts`) maps each to debounced query invalidations, as Dinner Bell.

## 12. Access, devices, kiosk and security

### 12.1 First run

With no household row and no `APP_PASSWORD`, every request is redirected to `/setup`. The wizard (on whatever device opened it first, usually a phone or laptop) sets the household password (12+ characters, with a strength hint, stored with `hashlib.scrypt`; no reset flow beyond `sunroom reset-password` via `docker exec` or the `APP_PASSWORD` override), names the family, confirms the time zone detected from the browser, adds people (name, color, parent or child, optional birthday), chooses features, and ends on "Pair the kitchen screen" (skippable). `onboarded_at` is written at the end; the wizard route then returns 404 forever. `APP_PASSWORD` in the environment skips the password step and overrides later changes. A note in the README and in the wizard says to finish setup before exposing the app beyond the LAN.

### 12.2 Sessions and devices

Dinner Bell's model: a per-device signed cookie (`v1.<device>.<epoch>.<day>.<mac>`), 400 days (Chrome's cap), re-issued after 30 days; "Who's using this phone?" stored on the device row; "Add a phone" by one-time code or QR; "sign out other devices" by bumping `auth_epoch`; in-memory login rate limiting (5 per IP per 15 min, 50 per hour global). Differences: the cookie is named `sunroom` without the `__Host-` prefix and without `Secure` when the request is plain HTTP (the LAN case); over HTTPS it is `__Host-sunroom` with `Secure`, and the two coexist (§13.4). A device signed in with the password is a parent device unless it is marked as a child's.

### 12.3 The display (kiosk device)

- Pairing: the display opens `/display`; with no session it asks the server for a code (`POST auth/kiosk/pairings`), shows it at 160 px with a QR of `<advertised url>/pair#CODE`, and long-polls for the claim. A parent types the code under Settings → Phones & screens on a signed-in phone (or scans the QR; camera scanning needs HTTPS, typing always works), or types the household password on the display's keyboard. The device row gets `kind = kiosk`, `member_id = NULL` (Everyone); the long-poll response carries the cookie and the page reloads into the board. The cookie is the normal 400-day, 30-day-reissued cookie (§13.4), so it never expires while the display is on; a password or secret-key change, or a restore, signs it out and it shows a new code (documented in Settings: "including the kitchen screen").
- Attribution: Dinner Bell's rule that attribution never comes from the request is relaxed for kiosks only. A kiosk request may carry `X-Sunroom-Member: <id>` (the avatar tapped before checking a chore); phones ignore the header and use their device row. A child tapping a parent's avatar still cannot do parent actions.
- Parent actions on the display (Settings, features, accounts, approvals, deletions of other people's things) need a parent grant: `POST auth/pin/verify` sets a 10-minute `sunroom_parent` cookie (HKDF-signed, HttpOnly, no sliding); the display auto-locks after 10 minutes; "Lock" clears it. A household without a PIN is nagged once a week in Settings but allowed (then kiosk parent actions are open).
- The PIN is 4–6 digits, PBKDF2-SHA256 (200,000 iterations, 16-byte salt), compared in constant time; 5 failures per device per 15 minutes, 50 per hour globally, plus a 1-second delay after the third failure. Marking a phone as a child's device requires a PIN to exist first.
- **Child-safe editing** (on by default once a child exists): changing or removing an event on the display asks for the PIN; moving one (a drag or Move) does not, because it is low-risk and undoable; adding events, items and chores, and completing things, never asks. **Recently removed** (Settings → Household) lists soft-deleted items from the last 7 days with **Put back**, because a toast's Undo is not enough on a screen a child reaches.
- `GET /api/display/state` is unauthenticated and returns only the wanted screen power, brightness and the next change time, so the Pi helper can act on it (§13.5).

### 12.4 Phones and children

Onboarding a phone asks "Whose phone is this?"; picking a child marks `is_kid_device` when a PIN exists. Children's devices can add events and items, complete their own chores, request rewards, and see everything; they cannot change settings, approve, or delete what they did not create (409 `parent_required`, "Ask a parent to do that.").

### 12.5 CSRF and origins

The Host rule and the CSRF check are specified in §13.4: every request's `Host` must be a LAN-style name, an IP literal, `localhost`, `.ts.net` or a name in `APP_ALLOWED_HOSTS`; mutations require `X-Sunroom: 1` and an `Origin` equal to `scheme://Host` (or, without an `Origin`, a same-origin `Sec-Fetch-Site`). `Referrer-Policy: same-origin`. Forwarded headers are trusted only from `TRUSTED_PROXIES`. Security headers as Dinner Bell, with `img-src 'self' blob: data:` (photos are same-origin files), `Permissions-Policy: camera=(self), screen-wake-lock=(self)`, and the style nonce (decision 0007).

### 12.6 Outbound requests (SSRF)

`core/netguard.py` classifies every outbound URL (ICS feeds, CalDAV servers, Immich, Nextcloud, geocoding): non-HTTP schemes and userinfo are refused; the host is resolved and any loopback, link-local, RFC 1918, ULA, multicast or reserved address is "private". Private is allowed only when the parent added the host or CIDR to the network allowlist and ticked "This server is on your home network" on that account or source (`allow_private`). Connections are pinned to the resolved address with the original hostname for TLS verification; redirects are re-classified per hop (max 3). Response caps: ICS 20 MB, CalDAV 50 MB, photo 50 MB; timeouts 5 s connect, 30 s read. Google and Open-Meteo hosts are constants. A test enumerates every `httpx.AsyncClient(` construction outside `core/http.py` and fails if one exists. The audit (`tests/test_ssrf_audit.py`) also pins the only modules that touch the network directly (the guard's resolver, the container's health probe on localhost, the Host rule's own name), that the guarded client is made once in `app.py`, that no code passes a literal `allow_private=True`, and that outside plugins only the update check uses the shared client.

### 12.7 Secrets, logs, limits

Secrets at rest: Fernet under HKDF subkeys (`session-v1`, `parent-grant-v1`, `join-code-v1`, `plugin-secrets-v1`); a changed `APP_SECRET_KEY` wipes every `credentials_enc` column and marks the owners `needs_reconnect`. Logs: structlog with the redactor extended for `app_password`, `refresh_token`, `api_key`, `pin`; ICS URLs logged host-only; never VEVENT bodies. Rate limits: login and pairing 5/15 min per IP; PIN per device; `sync now` 1/min per account; ICS minimum 5 min; geocode 10/min; photo upload 60/h per device. The export is parent-gated and `no-store`.

## 13. Setup, deployment and the Raspberry Pi kiosk

The facts below were checked against primary sources on 2026-10-07 (Raspberry Pi's kiosk tutorial and configuration docs, the `raspi-config` source for Trixie and Bookworm, the labwc manual, Docker's Pi OS install page, Chrome's cookie-lifetime notes, MDN's secure-context list, Google's redirect rules, Tailscale's Serve docs, Home Assistant's app configuration docs). `docs/KIOSK.md`, `docs/HARDWARE.md`, `docs/REMOTE-ACCESS.md` and `docs/RESTORE.md` carry the full runbooks; this section is what the implementer builds.

### 13.1 Three install paths

| | a. All on the Pi | b. Server elsewhere, the Pi is the screen | c. Any computer, no Pi |
|---|---|---|---|
| Runs where | The container and the Chromium kiosk on one Pi | The container on a NAS or mini-PC (Compose, Portainer, Unraid, CasaOS, Synology); Chromium on the Pi | The container on a laptop or NAS; phones and a browser tab |
| Phone address | `http://sunroom.local:8080` | `http://<server>:8080` | `http://<computer>:8080` |
| Wall display secure context | Yes: `http://localhost:8080` is a secure context, so the service worker and Wake Lock work with no certificate | Not by itself over plain HTTP; the launcher passes `--unsafely-treat-insecure-origin-as-secure=<server origin>` so Chromium on the display treats the server as secure (service worker and Wake Lock work); an HTTPS address through the owner's proxy or Tailscale needs no flag | n/a |
| Command | `curl -fsSL https://raw.githubusercontent.com/ScopeXL/assistant-calendar/main/kiosk/install.sh \| bash` (the GitHub repo is `assistant-calendar`; the product is Sunroom) | the same with `--display-only --url http://<server>:8080` (or an `https://` name) | `docker run -d --name sunroom --restart unless-stopped -p 8080:8080 -v sunroom_data:/data scopexl/sunroom:latest` |

**The owner's deployment is path b** (Q3): the container on the owner's Docker host from a `docker-compose.yml` in a folder of its own (`docker compose up -d`; `docs/DEPLOY.md`), behind the existing HTTPS reverse proxy with `APP_ALLOWED_HOSTS=<public name>` and `TRUSTED_PROXIES=<proxy>`, and a Pi installed with `--display-only --url https://<public name>` driving a landscape touchscreen. Paths a and b are both first-class in the README, which presents them side by side after a one-question chooser ("Do you already run Docker somewhere at home?"); M0 is verified on the owner's path b, and path a on a spare card when one is available (M5 at the latest).

The README's "All on the Pi" section walks a non-technical person through Raspberry Pi Imager (Raspberry Pi OS 64-bit with desktop; the customisation tab: hostname `sunroom`, a user, Wi-Fi, locale, SSH on), then the one-line installer, then "Set up the household on your phone" (scan the printed QR or open `http://sunroom.local:8080`, finish the wizard, add to the home screen), then "Pair the wall screen" (type the wall's six-character code under More → Pair a display, also linked from Settings → Phones & screens). It ends with "If sunroom.local doesn't open: use the IP the installer printed; phones on a VPN or mobile data can't see .local names." Path b adds the server-side one-liners per platform (Portainer stack, Unraid with `--user 99:100`, CasaOS custom install, Compose) and installs the Pi with `--display-only`. Path c is one `docker run` or the compose file, and `just dev` for contributors.

### 13.2 The `kiosk/` folder

`kiosk/install.sh` (bash, `set -euo pipefail`, the body wrapped in `main "$@"` on the last line so a truncated download never runs half a script; prompts read from `/dev/tty`; refuses to run as root; idempotent, with managed-block markers and a version header on every file it writes; logs to `~/.local/state/sunroom-kiosk/install.log`). Flags: `--display-only --url URL`, `--server-only` (Pi OS Lite, headless), `--version X.Y.Z`, `--port`, `--output HDMI-A-1`, `--rotate 0|90|180|270`, `--brightness auto|ddc|sysfs|none`, `--force-hdmi 1920x1080`, `--no-screen-helper`, `--no-reboot`, `--x11`, `--uninstall`.

Steps: (0) preconditions: `aarch64`, Bookworm or Trixie, internet, 2 GB free, wait for the first-boot `unattended-upgrades` dpkg lock; (1) packages only if missing: `curl ca-certificates jq qrencode chromium`, plus `wlopm wlr-randr` on Wayland or `x11-xserver-utils unclutter` on X11, `ddcutil` when asked; (2) Docker via `get.docker.com` if absent, `usermod -aG docker`, `systemctl enable --now docker` (the script keeps using `sudo docker` because the group needs a re-login); (3) the stack: `/opt/sunroom/docker-compose.yml` (Dinner Bell's hardened service, `container_name: sunroom`, `ports: "8080:8080"`, named volume `sunroom_data`, env `TZ`, `SUNROOM_ADVERTISED_URL=http://<hostname>.local:8080`, `SUNROOM_INSTALL_KIND=pi`), `/opt/sunroom/.env` (0600), `/opt/sunroom/update.sh`, `docker compose up -d`, wait for health; (4) the kiosk: `sudo raspi-config nonint do_boot_behaviour B4` (desktop autologin), `sudo raspi-config nonint do_blanking 1` (no blanking on labwc, X11 and the console in one call), `~/.config/sunroom-kiosk/config`, the launcher and helper into `~/.local/bin`, systemd user units, the labwc autostart managed block (or an XDG autostart `.desktop` on X11), the labwc cursor rule, a NetworkManager drop-in `wifi.powersave = 2`, `systemctl enable systemd-time-wait-sync`, optional `video=HDMI-A-1:1920x1080M@60D vc4.force_hotplug=1` in `/boot/firmware/cmdline.txt`, brightness setup; (5) print the phone URL, the IP fallback and a QR code, then "Reboot now? [Y/n]".

Session detection mirrors `raspi-config` (lightdm's configured session or a running `labwc`/`wayfire`); Wayfire (older Bookworm) is refused with the one-line fix (`sudo raspi-config nonint do_wayland W3` on Bookworm, `W2` on Trixie); no desktop means `--server-only` or "install the desktop".

**The launcher** `~/.local/bin/sunroom-kiosk` (run by `sunroom-kiosk.service`, `Restart=always`): waits up to 60 s for `timedatectl` NTPSynchronized (a Pi has no clock), then for `/api/health` with no cap (the wallpaper shows while the container migrates), rewrites `exited_cleanly` and `exit_type` in the dedicated profile's `Default/Preferences` so power loss never shows "Restore pages?", applies X11-only blanking, cursor and rotation commands when on X11, then execs `chromium` with: `--user-data-dir=~/.config/sunroom-kiosk/profile --kiosk --start-maximized --no-first-run --noerrdialogs --disable-infobars --hide-crash-restore-bubble --touch-events=enabled --disable-pinch --overscroll-history-navigation=0 --enable-features=OverlayScrollbar --disable-features=Translate,TranslateUI --password-store=basic --disable-component-update --check-for-update-interval=31536000 --autoplay-policy=no-user-gesture-required` and, on Wayland, `--ozone-platform=wayland --enable-wayland-ime --wayland-text-input-version=3`, opening `http://localhost:8080/display?dimmer=screen` when the screen helper sets the brightness, else `?dimmer=page` (§13.5). With `--display-only --url http://<server>:8080` it also passes `--unsafely-treat-insecure-origin-as-secure=http://<server>:8080` so the display gets a secure context over plain LAN HTTP (an `https://` URL needs no flag). Never `--incognito` (it would discard the pairing cookie), never `--disable-gpu`.

**Units**: `sunroom-kiosk.service`, `sunroom-screen.service` (the helper, §13.5), `sunroom-kiosk-restart.timer` at 04:00 ± 5 min (Chromium's memory grows for days on a 4 GB Pi; a nightly restart is the standard fix). The labwc autostart block imports `WAYLAND_DISPLAY` and friends into the user manager, applies `wlr-randr --transform` when rotated, and restarts both units. `kiosk/labwc-rule.py` (stdlib `xml.etree`) copies `/etc/xdg/labwc/rc.xml` to the user's config if absent and inserts, once, a `<windowRule identifier="chromium*">` with `WarpCursor` to a corner and `HideCursor` (touch does not reveal the pointer), keeping a backup. `kiosk/update.sh` (`sudo /opt/sunroom/update.sh [X.Y.Z]`) pulls, restarts, waits for health and prints the version or the last 40 log lines. `kiosk/uninstall.sh` removes everything it installed (asks before deleting the profile, which holds the pairing), leaves Docker and the data volume unless `--purge`.

### 13.3 Hardware guidance (`docs/HARDWARE.md`)

| Item | Recommendation |
|---|---|
| Pi 5, 4 GB | Recommended: the fastest Chromium, NVMe via the M.2 HAT, the 27 W supply and the active cooler in a wall enclosure; 8 GB is headroom, not a need |
| Pi 4, 4 GB | Fine with the nightly browser restart; 2 GB only for `--display-only`; Pi 3 and Zero 2 W: no |
| Storage | An A2-class card (the official card) or, better, a USB or NVMe SSD. SQLite WAL with `synchronous=NORMAL` fsyncs only at checkpoints, so app-caused wear is negligible; the real risk is power loss during an OS write, hence a proper supply and nightly verified backups |
| Power | The official supply; never power a portable monitor from the Pi's USB ports |
| Monitor, class A | 15.6" portable USB-C touch monitors: HDMI for video, a separate USB cable for touch, their own power brick; few have VESA holes |
| Monitor, class B | 21.5–24" HDMI touch monitors with VESA 100 and a USB-B touch port (the ViewSonic TD22xx/TD24xx class): speakers for chimes, DDC/CI brightness often works; mount the Pi on the VESA plate |
| Official Touch Display 2 | The 5" and 7" are too small for a family week; the 10" (1200×1920) suits a hallway or portrait layout and needs a Pi 5 (four-lane DSI); backlight via sysfs |
| Cables and mounting | Right-angle adapters, a labelled touch cable (without it the screen works but ignores taps), a VESA mount or short arm, the Pi's storage reachable |
| An old tablet instead | Android: Fully Kiosk Browser at `/display` with its screen-off schedule; iPad: Safari plus Guided Access and Auto-Lock Never on a charging stand. Pairing is identical; the server runs elsewhere |

### 13.4 First run, the Host rule and cookies

- With no household row (and no `APP_PASSWORD`), every SPA route redirects to `/setup`; `/display` instead shows "Finish setting up Sunroom on a phone or computer" with the advertised URL as a QR. `GET /api/setup/status` (public) returns `setup_complete`, `password_from_env`, the browser-suggested time zone, the advertised URL and the version; `POST /api/setup` (public while incomplete, 410 after; rate-limited like login) creates the household, stores the password with `hashlib.scrypt` (n 2¹⁵, r 8, p 1, 16-byte salt; stdlib only), writes `onboarded_at` atomically with the first device row and returns the session cookie; the wizard then continues through the normal routes (UX §6).
- Lost password: `APP_PASSWORD` in the environment is authoritative at every boot; without it, `sudo docker exec -it sunroom sunroom reset-password` prompts twice, writes the new hash and bumps `auth_epoch` (phones sign in again, displays show their code again; the README says so).
- **The Host rule replaces `APP_BASE_URL`** (decision 0017). Every request's `Host` (or `X-Forwarded-Host` from a trusted proxy) must be `localhost`, a loopback or IP literal, the container hostname, a name ending in `.local`, `.lan`, `.home`, `.home.arpa`, `.internal` or `.ts.net`, or match `APP_ALLOWED_HOSTS` (exact or `*.example.com`); otherwise 421 with the fix in the body. CSRF on every mutating request: `X-Sunroom: 1` present; the scheme is `https` only when a trusted proxy says so; if `Origin` is present it must equal exactly `scheme://Host` (`null` → 403); if absent, `Sec-Fetch-Site` must be `same-origin` or `none`. A reverse proxy must forward `Host` unchanged and set `X-Forwarded-Proto`, and be listed in `TRUSTED_PROXIES`. HSTS only on HTTPS.
- Cookies: `sunroom=v1.<device>.<epoch>.<day>.<mac>; Path=/; HttpOnly; SameSite=Lax; Max-Age=34560000` (400 days, the most Chrome allows; re-issued on any visit after 30 days, so an in-use display never ages out); over HTTPS the name is `__Host-sunroom` with `Secure`, so an http cookie never shadows an https one when both are in use. The display's cookie lives in `~/.config/sunroom-kiosk/profile` and survives reboots, power loss and the nightly restart.
- mDNS: Pi OS advertises `<hostname>.local` (avahi on the desktop image); iOS, macOS, Windows 10 1903+ and Android since the November 2021 resolver update resolve it; Settings → Connection lists every address the server has recently been reached on, so a parent can pick one that works.

### 13.5 Screen sleep, wake and brightness

- Household settings (§10.1): `sleep_from`, `sleep_to`, `sleep_mode` (dim clock or screen off), and the evening dim, `dim_from` and `dim_level` (only with a sleep time: it runs from `dim_from` until sleep starts). A tap wakes a sleeping screen for 2 minutes; the browser's nightly restart is the kiosk's 04:00 timer, not a setting.
- The rule is `domain/screen.py`: daytime is on at 100; the evening dim is on at its level; asleep is off with Screen off, or on at 20 with the dim clock; awake (tapped) is on at 100.
- `GET /api/display/state?wait=55&etag=…` is public and non-sensitive: `{etag, screen: on|off, brightness, reason: day|dim|sleep|awake, awake_until, schedule, server_time}`, the etag a hash of everything but the server's time. It answers at once when the etag is stale, else waits on the `ScreenWatch` event, which the 30-second `screen-schedule` tick sets when the state changes, as do `settings.changed` and `POST /api/display/wake` (a kiosk's cookie only; sets `awake_until` 2 minutes on).
- The app always does the in-page part, so sleep works on any device, tablets included: Night (the dim clock, or black with "tap to wake") while asleep; during the evening dim, a dark veil over the page unless the Pi's helper dims the panel itself; a tap posts `/wake`; `navigator.wakeLock` where available. Who dims is the launcher's `?dimmer=screen|page`, which the page keeps in localStorage (`lib/dimmer.ts`), so the page and the panel never both dim.
- `kiosk/sunroom-screen` (Python, stdlib only; `sunroom-screen.service`, started by the desktop session with the browser) long-polls the state and applies only what changed. Off and on: Wayland `wlopm --off/--on '*'` (fallback `wlr-randr --output X --off/--on`), X11 `xset dpms force off/on` then `xset dpms 0 0 0` (never `xset -dpms`, which lights a sleeping screen; the launcher uses the same). Brightness: `ddcutil --bus N setvcp 10` on DDC/CI monitors (the bus found at install from `ddcutil detect --brief`; `i2c-dev` loaded at boot; the `i2c` group), or the backlight's `brightness` on DSI panels, where asleep only `bl_power` goes off so touch keeps working (a udev rule gives the `video` group write access). `sunroom-screen --method` says which (`ddc`, `sysfs` or `none`), and the launcher picks `?dimmer=` from it. Without an answer it backs off from 2 s to 60 s, switches the screen on after five failures in a row (about 30 s), and leaves it on at full brightness when it stops.
- Tap-to-wake works because the USB touch controller keeps reporting while the panel is DPMS-off; monitors whose touch sleeps with the panel get `--no-screen-helper` (KIOSK.md), and the page's own sleep. Presence (a PIR sensor on GPIO, camera motion on tablets) is later work.

### 13.6 Updates and the update check

Pi: `sudo /opt/sunroom/update.sh`; Compose: `docker compose pull && docker compose up -d` in its folder; a Portainer stack: re-pull and redeploy; `docker run`: pull, remove, run again. Migrations run at start after the pre-migration copy; a failed migration exits 70 with nothing changed; rollback is the restore runbook plus the previous tag. In-app: Settings → About → "Check for new versions daily", **off by default** (one request a day to `api.github.com` reveals the server's IP); when on, the hourly `update-check` job asks GitHub's latest-release API through the guarded client once 24 hours have passed (the answer lives in memory, so a restart asks again), compares its tag with the build, and About shows "Sunroom 0.6.1 is available." with the way to update worded by `SUNROOM_INSTALL_KIND` (`docker`, `pi`, `portainer`, `ha`: "On the Pi, run sudo /opt/sunroom/update.sh"); **Check now** asks at once (a parent, once a minute); `SUNROOM_UPDATE_CHECK=0` pins it off and the switch says the server keeps it off. Watchtower (the maintained `nicholas-fedor` fork; the original was archived in December 2025) is documented as possible but not recommended: an unattended pull at 3 AM can leave the wall dark.

### 13.7 Backups and restore

Nightly verified copies as Dinner Bell (§14.4). Settings → Backup has **Download backup** (the newest verified `.db`, a few MB) and **Download everything** (`sunroom-YYYY-MM-DD.zip` streamed: the DB, `photos/`, a manifest with version, revision and counts); endpoints under `GET /api/admin/backups/…`. Restore, in `docs/RESTORE.md` wording: stop the container, run `docker run --rm -v sunroom_data:/data -v "$HOME/Downloads:/restore:ro" --user 10001:10001 scopexl/sunroom:latest restore /restore/<file>`, start it. `sunroom restore` (a `.db`, or the zip) refuses while the instance lock is held, and checks everything before it moves anything: a zip holds only the names Download everything writes and a manifest of the right format; the database passes `quick_check` and carries a revision this image knows. Then it moves the current DB, WAL and SHM aside together (`sunroom.pre-restore.<time>.db`), swaps the checked copy in, bumps `auth_epoch`, restores photos from a zip (files already in place kept), and prints the minimum image version. The zip never holds `secret.key`, so on a new volume synced calendars ask to be connected again (unless `APP_SECRET_KEY` is set to the same value). Later: copy nightly backups to a USB stick labelled `SUNROOM-BACKUP` or a network share.

### 13.8 Remote access and HTTPS (`docs/REMOTE-ACCESS.md`)

| Works over plain HTTP on the LAN | Needs HTTPS (a secure context) |
|---|---|
| Everything in the calendar, live updates, photos, pairing by typed code or by the QR code the app shows (phones scan it with their own camera app), Add to Home Screen on iPhone (iOS 26 opens any home-screen site as a web app) and Android (as a shortcut); and on the Pi's own display everything, since the launcher marks the server's origin as secure (and `localhost` already is one) | An installable PWA with a service worker (offline shell, Android's Install prompt), Screen Wake Lock on phones and tablets, the Google OAuth web flow, Web Push (later) |

LAN-only is the default for newcomers. **The owner already has an HTTPS reverse proxy** and uses it exactly as Dinner Bell does (ADR 0003 there): the public name in `APP_ALLOWED_HOSTS`, the proxy in `TRUSTED_PROXIES`, the Dinner Bell proxy notes for SSE (no buffering) carried over; this is what makes the Google OAuth web flow available to the owner from M2. For everyone else, **Tailscale** is the recommended upgrade: `tailscale up` on the server host, MagicDNS and HTTPS certificates on, `sudo tailscale serve --bg 8080` → `https://sunroom.<tailnet>.ts.net` with a valid certificate, no port forwarding, phones run the Tailscale app; `.ts.net` passes the Host rule by default; set `TRUSTED_PROXIES` to the Docker network's gateway (Docker hands Tailscale's connections to the container from there, not from 127.0.0.1; REMOTE-ACCESS.md shows how to find it) and confirm the forwarded scheme in Settings → About → Connection; the OAuth redirect `https://sunroom.<tailnet>.ts.net/api/calendar-sync/google/callback` is acceptable to Google. Alternatives: Caddy with Let's Encrypt (`APP_ALLOWED_HOSTS=calendar.example.com`, the proxy in `TRUSTED_PROXIES`; the login page is then public), Cloudflare Tunnel (no open ports; Cloudflare sees the traffic, noted in PRIVACY.md), Caddy `tls internal` (advanced; a root certificate on every phone).

### 13.9 Home Assistant app (later)

A separate repo `ScopeXL/sunroom-ha` (so the Home Assistant version bump stays decoupled from Sunroom releases, a lesson from an earlier add-on) with `repository.yaml` and `sunroom/config.yaml`: `arch: [aarch64, amd64]`, `image: scopexl/sunroom` (the multi-arch image; no Dockerfile), `init: false`, `ingress: true`, `ingress_port: 8080`, `ingress_stream: true` (SSE), `ports: "8080/tcp": 8080` kept open for the Pi kiosk and phones, `map: [{type: media, read_only: false}]` for photos, `watchdog` on `/api/health`, `backup: cold`, options `tz`, `password`, `allowed_hosts`. The app reads `/data/options.json` when present (`SUNROOM_HA=1`), serves the SPA with a relative base under ingress (Vite `base: './'`, router basename from `document.baseURI`, relative API URLs, manifest and service worker off under ingress, absolute URLs built from `X-Ingress-Path`), and treats requests from `172.30.32.2` carrying `X-Ingress-Path` as a signed-in parent.

### 13.10 Pi gotchas, each with its home

| Risk | Mitigation |
|---|---|
| Chromium memory growth on 4 GB | The 04:00 restart timer; `Restart=always` on a crash |
| Wi-Fi power save drops the SSE stream | The NetworkManager drop-in; the client reconnects with backoff anyway |
| No clock at boot | `systemd-time-wait-sync`; the launcher waits for NTP; the display shows the server's time |
| HDMI hotplug, a monitor off at boot, "wakes right after blanking" | `--force-hdmi` (`video=…` plus `vc4.force_hotplug=1`); documented in KIOSK.md |
| Portrait mounting | Control Centre → Screens, or `--rotate 90` (`wlr-randr --transform 90`); touch follows the output, else a libinput `calibrationMatrix` in `rc.xml`; `display_rotate` is legacy under KMS |
| "Restore pages?" after power loss | `--hide-crash-restore-bubble` plus the Preferences rewrite |
| A keyboard left attached (Alt+F4, Ctrl+Alt+T) | systemd restarts Chromium in 3 s; the README says not to leave one; a `--lockdown` option later strips labwc keybinds |
| Translate, password and notification prompts | The flags above; the display never asks for permissions |
| Silent chimes | `--autoplay-policy=no-user-gesture-required`; HDMI audio is the default sink; `wpctl status` in KIOSK.md |
| A visible cursor | The labwc window rule; `unclutter` on X11 |
| Wayfire on an older Bookworm | Refused with the one-line switch to labwc |
| The on-screen keyboard | The display UI ships its own (UX §1); `--enable-wayland-ime --wayland-text-input-version=3` is passed and squeekboard is left enabled as a fallback |
| Touch sleeps with the panel on some monitors | The schedule's on-time always runs; `--no-screen-helper` keeps the app's blackout only |
| The kiosk opens before the container is healthy | The launcher waits for `/api/health`; "wallpaper for more than 2 minutes → `sudo docker logs sunroom`" in the README |
| `.local` fails | The IP fallback from the installer and Settings → Connection |
| `curl | bash` cut short, the dpkg lock, running as root, the Docker group | The `main` wrapper, the lock wait, the root refusal, `sudo docker` throughout |

Hardware test matrix before the first kiosk release, recorded in `docs/HARDWARE.md`: Pi 5 + Trixie + a 24" HDMI touch monitor (landscape and portrait, DDC brightness); Pi 4 (4 GB) + Bookworm on labwc + a 15.6" portable monitor; the 10" Touch Display 2 (sysfs backlight); pull the plug five times (pairing survives, `quick_check` ok, no restore bubble); a 72-hour soak with memory samples; Wi-Fi only; tap-to-wake with the panel off; squeekboard behaviour; `.local` from iPhone, Android and Windows.

## 14. Foundation, tooling and release

Everything in this section is Dinner Bell's, renamed, unless a row says otherwise. Read its `docs/PLAN.md` §11 for the full detail; this section lists only what an implementer must know to copy it and what differs.

### 14.1 Repo layout

```
sunroom/
  README.md LICENSE SECURITY.md PRIVACY.md CHANGELOG.md VERSION CLAUDE.md
  Dockerfile docker-compose.example.yml .dockerignore .env.example justfile
  .githooks/ .github/{workflows/ci.yml,dependabot.yml} .gitleaks.toml .claude/{settings.json,skills/deploy/}
  backend/ (uv project, src layout)   frontend/ (pnpm, Vite)   docs/ (PLAN, UX, DEPLOY, RELEASING, RESTORE, SYNC, adr/)
  kiosk/ (install.sh, uninstall.sh, update.sh, sunroom-kiosk helper, systemd units; §13)
  scripts/ (release.py, check_release_meta.py, private_scan.py, image_*.sh, smoke_image.sh, e2e-server.sh)
```

### 14.2 Configuration

Infrastructure settings come from the environment only (pydantic-settings, `env_file=None`, frozen, `SecretStr`, problems reported by variable name, exit 78). Household settings live in typed tables and the Settings screens. Differences from Dinner Bell are marked.

| Variable | Default | Notes |
|---|---|---|
| `APP_SECRET_KEY` | generated | **Differs:** if unset, generated on first boot and stored at `/data/secret.key` (mode 0600), so a self-hoster never has to make one. Set it explicitly for multi-container setups. Losing it signs every device out and disconnects accounts; the DB survives |
| `APP_PASSWORD` | unset | **Differs:** optional. When set it overrides the password chosen in the setup wizard, for Portainer-style deployments |
| `APP_ALLOWED_HOSTS` | unset | **Differs:** there is no `APP_BASE_URL`. The Host rule (§13.4) accepts localhost, IP literals, `.local`-style LAN names and `.ts.net` by itself; this comma-separated list (exact names or `*.example.com`) adds a public reverse-proxy name |
| `TRUSTED_PROXIES` | unset | As Dinner Bell: forwarded headers (`X-Forwarded-Host`, `X-Forwarded-Proto`) are trusted only from these |
| `SUNROOM_ADVERTISED_URL` | derived from the request | **New:** the address printed on QR codes and in Settings when the request came from `localhost` (the Pi's own display); `install.sh` sets `http://<hostname>.local:8080` |
| `SUNROOM_INSTALL_KIND` | `docker` | **New:** `pi`, `portainer` or `ha`; only changes the wording of the update pill |
| `SUNROOM_UPDATE_CHECK` | unset | **New:** `0` forces the daily release check off regardless of the setting |
| `TZ` | unset | Optional override; the household time zone is chosen in the wizard and stored in the DB. Validated as IANA |
| `PORT` | `8080` | |
| `DATA_DIR` | `/data` | SQLite, backups, photos, secret key |
| `LOG_LEVEL` | `INFO` | structlog JSON in the container, console in dev |
| `SUNROOM_STATIC_DIR`, `SUNROOM_CONTAINER`, `SUNROOM_TEST_MODE` | | Build and test flags, as Dinner Bell's `DINNERBELL_*` |
| `SUNROOM_ALLOW_PRIVATE_URLS` | `false` | **New:** when true, ICS and photo-source URLs may point at private LAN addresses (Immich, Nextcloud on the LAN). Off by default to block SSRF; the Settings screen explains it |

Unknown `APP_*`/`SUNROOM_*` names produce a typo warning at boot.

### 14.3 justfile

Dinner Bell's recipe set, verbatim where it applies: `setup`, `dev`, `fmt`, `lint`, `typecheck`, `test`, `api-types`, `api-types-check`, `migrations-check`, `release-meta-check`, `check` (CI runs exactly this), `build`, `e2e`, `screenshots`, `scan`, the three hook recipes, `smoke-image`, `preflight`, `bump`, `release-tag`, `image`, `image-verify`, `release`, `inspect-backup`, `db-revision`. Additions: `display` (opens the built app at `/display` in a 1920×1080 Chromium window for review), `seed` (loads the synthetic fixture household: "Sample Family" with four members, two local calendars, an ICS fixture account, chores, lists, meals, countdowns and a dozen stock photos, so screenshots and demos never use real data), `kiosk-lint` (shellcheck on `kiosk/*.sh`).

### 14.4 Startup, migrations, backups, export

Identical to Dinner Bell: settings → data dir and `flock` → pre-migration backup when migrations are pending or the version changed → migrate in one transaction → verify → serve; exit codes 78/73/74/65/70. One Alembic history for core and plugins (§6.4), timestamp revision ids, `released.lock`, forward-only, an upgrade test from each release's fixture DB. Nightly verified backups at 03:30 local keeping 14 daily and 8 weekly; a JSON export in which every table is listed as exported or excluded (credentials ciphertext is excluded; a test enforces the listing). **New:** backups can be downloaded from Settings → Backup (§13.7). Later (not built yet): the export also writes an `.ics` per local calendar, so a family can leave Sunroom with their events in a calendar app's format; today the JSON export has them.

### 14.5 Versioning, Docker, CI, privacy

- `VERSION` is the single source of truth (Dinner Bell ADR 0019); Keep a Changelog; annotated `vX.Y.Z` tags; `pyproject.toml` and `package.json` stay `0.0.0`.
- The Dockerfile is Dinner Bell's: multi-stage, digest-pinned bases, `uv sync --frozen --no-dev`, non-root uid 10001, `/data` must be a mounted volume (exit 73 otherwise, and not on NFS/CIFS), healthcheck via `python -m sunroom.healthcheck`, OCI labels, build-info. Images are built locally with buildx under OrbStack from `git archive` of the tag for linux/amd64 and linux/arm64 and pushed to Docker Hub as `scopexl/sunroom:X.Y.Z`, `X.Y`, `latest` (ADR 0005 there). `docker-compose.example.yml` keeps the hardening (`read_only`, `tmpfs /tmp`, `cap_drop ALL`, `no-new-privileges`, log rotation) and adds the photos note.
- CI (`ci.yml`): backend, frontend, contract, e2e and secrets jobs, SHA-pinned actions, `permissions: contents: read`; no secrets, no image builds. Dependabot weekly and grouped, TypeScript minors ignored.
- Privacy guardrails: gitleaks plus `scripts/private_scan.py` with the owner's term list outside the repo; synthetic fixtures only ("Sample Family", "Sample Street"); screenshots only into the gitignored `.screenshots/`; `.claude/settings.json` denies reading `.env`, `.data/`, `.private/`. The deploy skill is Dinner Bell's with the image name changed.
- Git: noreply identity in the repo, `area: summary` subjects with the Co-Authored-By trailer, commit when green, explicit paths, push only on deploy or when the owner asks. Switch the remote to SSH before the first release (Dinner Bell's 0.1.0 push failed over HTTPS).

### 14.6 Testing overview

| Layer | Tool | What |
|---|---|---|
| Pure logic | pytest + Hypothesis | `domain/`: recurrence expansion against RFC 5545 fixtures (EXDATE, RECURRENCE-ID overrides, COUNT/UNTIL, monthly by weekday, DST-crossing timed events, all-day spans, floating times), timeline layout (overlap columns), week math, points |
| Services and API | pytest, httpx ASGITransport, template DB, `FakeClock`, `FakeCalendarProvider`, `FakeWeather`, `FakePhotoSource`; sockets disabled | Every route; sync engine against the fake provider (create/update/delete both ways, conflicts, errors, backoff); plugin enable/disable; auth and pairing; export listing |
| Frontend units | Vitest + jsdom | tokens AA test, design rules test (no raw hex, no `title=`, no runtime style injection, every `motion` use under `MotionConfig`), quick-add parsing table, reducers |
| End to end | Playwright against the production build: `display-1080p` (1920×1080, touch, Chromium), `display-portrait` (1080×1920), `phone-webkit` and `phone-chromium` (390×844), `desktop` (1440×900); axe; a fixture fails any test on a CSP violation or page error; tap-target checks (56 px display, 44 px phone) | First run, pairing, add event, recurring edit chooser, chore completion with Undo, lists sync between two pages, screensaver in/out, theme switch, PIN gate |
| Image | `just smoke-image` | Boots the image with an empty volume, waits for health, runs the setup wizard through the API, checks the private scan |

### 14.7 Definition of done (per task)

1. `just check` green. 2. `just e2e` green for touched flows. 3. For UI changes, `just screenshots` at 1920×1080, 1080×1920 and 390×844 in light and dark, reviewed against UX §10. 4. Docs updated (PLAN or UX, plus an ADR if a decision changed). 5. A plain-English CHANGELOG line under `[Unreleased]`. 6. `just scan` clean. 7. Committed.

### 14.8 CLAUDE.md

Written in M0 in Dinner Bell's shape and kept under 15 KB: the stack, status line, read-first list, priorities (§1), hard rules (privacy, secrets unread, migrations, `domain/` pure, one process, words, deploy only through the skill, never skip a failing check, plus two new ones: **every plugin must be fully functional when every other plugin is disabled**, and **the display must never show a dead end: every screen on it has a way back without a keyboard**), commands table, architecture map, conventions, definition of done, deploy summary, and an empty "Gotchas that already bit" list.

## 15. Milestones

The deploy pipeline and the real wall come first, so every later milestone is reviewed on the owner's actual display and phone. Each milestone ends with a minor version, the deploy skill, and the owner's checklist on the wall and a phone. Verify lines are what the implementer runs before calling a milestone done; the owner's checklist is what the owner does.

### M0 Foundation → 0.1.0

Copy Dinner Bell's skeleton with renames (§4, §14): repo files, `Dockerfile`, compose, CI, hooks, scans, `VERSION`, CHANGELOG, LICENSE, SECURITY, PRIVACY, README (the three install paths), CLAUDE.md (§14.8), `docs/PLAN.md` and `docs/UX.md` from this plan, ADRs 0001–0020, switch the remote to SSH, set the noreply identity (`.gitignore` is already clear of `docs`). Backend: core, db, web (Host rule, CSRF, nonce-stamped `index.html`, security headers), events, meta (health, version, diagnostics, backups, export, setup), auth (password with scrypt, sessions, devices, join codes, display pairing with long-poll, PIN and parent grants, `Actor`/`ParentDep`, children's devices), household (settings columns, members with role, color, birthday, avatars), the core photo store, the plugin framework with an empty registry, `plugin_state`, `kiosk_panels`, `network_allowlist`, `core/netguard.py` and `core/http.py`, the baseline migration, export lists, the test-only router, the test scaffolding (template DB, `FakeClock`, `StreamProbe`), `sunroom` CLI (`serve`, `openapi`, `check-config`, `backup-now`, `reset-password`, `restore`, `status`). Frontend: tokens and motion stylesheets with the AA and design-rules tests, `motion` under `MotionConfig` with the nonce, the Display shell (rail, empty board, Today panel skeleton, idle and wake state machine, the on-screen keyboard, the PIN dialog, the pairing screen, Night), the Phone shell (tab bar, sheets, toasts), onboarding wizard, sign in, Who's using this, Pair a display, Settings pages (Family, Features, Display, Household, Phones & screens, Backup, About), the generic plugin settings form, `features/registry.ts`, SSE client and event router, the PWA manifest and service worker. `kiosk/install.sh` with the launcher, units and labwc rule (the sleep helper comes in M5), `just display`, `just seed`, `just kiosk-lint`, e2e projects and the screenshot recipe.

*Verify:* `just check` green; `just e2e` green for first run → pair a display → PIN gate → sign out; `just smoke-image` boots an empty volume with no env, answers `/api/setup/status` with `setup_complete: false`, completes setup through the API and passes the private scan; a request with `Host: evil.example` gets 421; a mutation without `X-Sunroom: 1` gets 403; `GET /api/plugins` is `[]`; `GET /api/export` lists every table; the e2e CSP guard passes with a `motion` animation on screen; the image runs on the owner's Portainer host behind the reverse proxy (Dinner Bell's deploy steps, `APP_ALLOWED_HOSTS` and `TRUSTED_PROXIES` set), the owner's Pi is installed with `install.sh --display-only --url https://<public name>`, the display pairs from a phone, survives a reboot and a pulled plug, and shows the empty board with the clock, date and the lit today column. The owner's checklist: the wizard on a phone, the wall paired, Settings behind the PIN on the wall, "Add to Home Screen" on an iPhone.

### M1 Calendar core → 0.2.0

Backend: `calendars`, `events`, `event_members`, `event_reminders`, `event_revisions`, `domain/recurrence.py` and `timeparts.py`, the occurrence endpoint with the LRU, scope edits and undo, `rrule/describe`, the overlay hook, the twelve ICS fixtures with goldens (expansion only, loaded by a test-only importer), `sunroom bench`. Frontend: the Week board, Day, Month, Who's doing what and Today views, the Today panel's calendar sections, the event sheet, the Add panel with quick add (chrono-node plus the people and repeat grammar) and every chip picker, the recurring chooser, drag with the long-press sensor, Undo toasts, reminders as display toasts, the person filter, the daylight tint and Auto theme (sunset from a fixed 7 PM until the weather plugin brings a location), text size, "dim past events", the phone Calendar views and editor, search, Recently removed. Local calendars (create, color, owner) and a built-in Holidays source if cheap here, else M2.

*Verify:* `uv run pytest tests/domain tests/calendar -q` green including the Hypothesis partition property (occurrences of M equal occurrences of M′ ∪ M2 for any split point); the ICS goldens match the `recurring-ical-events` oracle; `sunroom bench occurrences --events 500 --recurring 100 --weeks 1` prints cold under 100 ms on the owner's Pi (recorded in `docs/PERF.md`); e2e: add "Dentist Thu 2:30pm Mia" from the display → the chip appears on Thursday in Mia's color → a phone sees it within 3 s → change "this and following" → undo → the drag moves a chip and Undo moves it back; the owner's checklist on the wall: the week reads from the doorway, the now line sits where it should, a child adds an event with the on-screen keyboard without help.

### M2 Synced calendars → 0.3.0

The `calendar_sync` plugin: models, `ical.py`, `tzmap.py`, providers `ics`, `holidays`, `fake`, `caldav` (discovery, sync-collection and ctag diff, multiget, push with If-Match, `raw_ical` round-trip), `google` (service-account mode: key upload, helper email, `calendarList.insert`, `syncToken`; OAuth mode: Kroger's PKCE flow, enabled on HTTPS or at `localhost`), the engine with chunked upserts, push sweep, backoff and `needs_reconnect`, SSRF guard and the LAN allowlist, `sync.changed` banners, Settings → Calendars & accounts on the phone with the three Google ways and the iCloud steps with drawings, calendar-to-person mapping with "already used by Mia" hints, `docs/SYNC.md`.

*Verify:* engine tests against `FakeCalendarProvider` (create, update, delete both ways; the local-newer-with-pending-push rule; 412 retry; `fail_next("auth")` → `needs_reconnect` and the banner); `POST accounts/ics` with a private URL → 422 until allowlisted; `just smoke-caldav` against a Radicale container with the fixtures imported matches the goldens; on the owner's real accounts (never committed): an iCloud calendar syncs both ways within 5 minutes, a Google calendar via the secret address appears, a Google calendar via the helper account accepts an event added on the wall; the measured freshness of the secret address goes in `docs/SYNC.md`.

### M3 Lists and chores → 0.4.0

The `lists` plugin (lists, items with person and day, Usuals, clear done, auto-clear, the Lists room and the phone tab, the Today panel's To do). The `chores` plugin (chores with rules, rotation and "Mia's turn", the computed due list, completion with the kiosk member header, approval, points and streaks, rewards and redemptions, routines with the step library and the full-screen runner, the Chores room with per-person columns and This week, Stars & rewards, Settings → Chores). The signature done moment on canvas and `motion`, the All done and routine celebrations, Child-safe editing, the Who picker and "Who did it?".

*Verify:* a kiosk request with `X-Sunroom-Member` completes a chore attributed to that member and a phone request ignores the header; disabling the plugin returns 404 `plugin_disabled` and re-enabling keeps the data; a plugin job that raises marks only that plugin errored; e2e on the display project: complete a chore → the stamp, the burst and the count pop → Undo reverses all of it, with Reduce Motion the moment still reads as done; a routine runs to its finish screen; a reward request appears on a parent's phone and Approve on the wall asks for the PIN; the owner's checklist: the children complete real chores for a week and the owner notes what felt wrong.

### M4 Meals, countdowns, photos and weather → 0.5.0

The `meals` plugin (week grid, saved meals, copy last week, the calendar overlay, "Add ingredients to Groceries" when Lists is on); `countdowns` (tiles, birthdays from people, "Add a countdown" from an event, the day celebration); `screensaver` (upload from phones with HEIC, the inbox folder, thumbnails, the manifest, the overlay with the clock band and Up next, Photos room, the night modes, Immich if time allows); `weather` (Open-Meteo, geocoding at onboarding, the rail block, day-header icons, the screensaver corner, sunrise and sunset for the Auto theme and the daylight tint).

*Verify:* a JPEG dropped into `/data/photos/inbox` appears in the manifest with EXIF stripped after a clock advance; the screensaver fades in after the fake-mode idle and any tap returns to where the display was; `GET countdowns/upcoming` includes a member birthday; the meals overlay shows in `occurrences?overlays=meals`; weather renders from a recorded fixture with sockets disabled; the owner's checklist: the screensaver on the wall for an evening, Tonight on the Today panel, a countdown the children care about.

### M5 The wall, polished → 0.6.0

`kiosk/sunroom-screen` with the display state long-poll, sleep and brightness on the owner's monitor, `update.sh`, the update check and pill, Download everything and `sunroom restore`, `docs/KIOSK.md` and `RESTORE.md` completed (M0 wrote their first versions), `HARDWARE.md`, `REMOTE-ACCESS.md`, the hardware test matrix results, the portrait pass on a real panel if one is available, the SSRF audit test, the secret-key reconcile over every `credentials_enc` table, `docs/PLUGINS.md` (how to add an in-repo plugin in seven steps), Tailscale verified end to end with Google OAuth over `ts.net`.

*Verify:* `just preflight` green; `shellcheck kiosk/*.sh` clean; the helper turns the owner's monitor off at the scheduled time and a tap brings it back; `update.sh` upgrades 0.5.0 → 0.6.0 on the Pi with the display paired throughout; a restore from "Download everything" on a fresh volume brings back events, photos and lists and shows the pairing code; `grep -rn "httpx.AsyncClient(" backend/src | grep -v core/http.py` is empty.

### M6 Polish from the first weeks of use → 0.7.0

The owner's notes after living with it: sizes, colors, what the children tap, what grandparents ask. A performance pass on the Pi 4 if one is in use, an accessibility pass with a screen reader on the phone, the first v1.1 items from §19 that proved urgent (notes and timers, per-display layouts). 1.0.0 is the owner's call.

*Verify:* the definition of done per task (§14.7); the screenshot checklist (UX §10) at every size; a fresh install from the README by someone who has not seen the project, timed against the success test in §1.

## 16. UX

Moved to [`docs/UX.md`](UX.md) on 2026-10-07 (M0), keeping its numbering: PLAN §16.n is UX §n (rules for every screen, words, navigation and layout, display screens, phone screens, flows, visual direction, empty and quiet states, motion spec, accessibility and the screenshot checklist, refinements).

## 17. Risks and unknowns

Numbers stay fixed because other sections cite them; settled items leave gaps.

| # | Risk or unknown | How it gets resolved |
|---|---|---|
| 1 | Google two-way sync needs a Google Cloud project either way (service account or OAuth); some families will not finish seven steps | The wizard suggests the secret iCal address first and says plainly what two-way adds. The service-account guide has one screenshot per step and a "paste the key file" drop zone. Loopback sign-in on the display when the Pi hosts both. A redirect relay (§19) later |
| 2 | iCloud CalDAV is unofficial: undocumented 503 rate limits, no recurrence expansion, UID rules, app-specific passwords revoked on an Apple ID password change | Backoff with jitter; our own expansion; `raw_ical` round-trips; `needs_reconnect` banner with the fix spelled out; `docs/SYNC.md` records every quirk met |
| 3 | Freshness of Google's secret iCal feed is undocumented (its consumption of other feeds is known to lag by hours) | Measured in M2 against a test calendar; the UI shows "Updated 2 min ago" and the wizard sets expectations |
| 4 | Week board performance on a Pi 4 with animations and 500 occurrences | `sunroom bench` in M1; CSS transforms and opacity only; "Reduce motion" setting; the README recommends a Pi 5 |
| 5 | Chromium on labwc: multi-touch is off unless `mouseEmulation="no"`; Wayland text input is immature | `kiosk/install.sh` writes the labwc touch config; the in-app keyboard is the default, squeekboard the fallback |
| 6 | Phones on plain HTTP get no service worker, no installable PWA on Android, no Wake Lock, no `crypto.randomUUID()` | IDs come from the server (UUIDv7); "Add to Home Screen" still works on iOS; Tailscale HTTPS is the documented upgrade path (§13.8) |
| 7 | SD-card wear and corruption under SQLite WAL | README and `install.sh` recommend an SSD or an A2 card; nightly verified backups; `PRAGMA synchronous=NORMAL` |
| 8 | `motion` under the strict CSP | The nonce (decision 0007) is verified in M0 by the e2e CSP guard; the fallback is CSS plus the Web Animations API, recorded in an ADR |
| 9 | Lexend may lack tabular figures | M0 check; fixed-width digit boxes for the clock or Albert Sans (§5.2) |
| 10 | First-run race if an unconfigured instance is exposed publicly | The wizard closes after setup; the README and the wizard say to finish setup on the LAN first; `APP_PASSWORD` for unattended deployments |
| 11 | A household time-zone change moves floating ICS events | Floating events are flagged and re-imported on the next full sync |
| 12 | HEIC uploads from iPhones | `pillow-heif` has arm64 wheels; if it fails to install, the upload sheet says "share as JPEG" |
| 13 | Photos live outside the SQLite backup | `RESTORE.md` says back up `/data` whole; a one-tap backup download includes the DB only and says so |
| 14 | A household password change signs out the display | Accepted; the display shows its pairing code again and a phone re-pairs it in ten seconds |
| 15 | The kiosk's member header is spoofable by anyone on the LAN holding the kiosk cookie | Accepted for a household; parent actions still need the PIN grant |
| 16 | Demand for third-party plugins | The contract is designed for it (§6.4); not built until asked |
| 17 | Open-Meteo terms (CC BY 4.0, non-commercial limits) | "Weather by Open-Meteo" in the panel footer; one call per 30 minutes |
| 18 | HTTP/1.1 allows six connections per host; each SSE stream is one | One stream per page, closed when hidden (Dinner Bell's client); a shared BroadcastChannel stream if families open many tabs |
| 19 | The e2e touch projects are Chromium, not the Pi's Chromium build | A real-Pi checklist on every release (§15) |

## 18. Where this plan departs from the brief, and suggestions

**Departures (each is deliberate):**

1. **The photo store is core, not only a plugin.** Avatars need it; the screensaver plugin builds on it.
2. **Weather and calendar sync are plugins** (the brief listed sync among plugins; weather was not mentioned). Both can be turned off and the calendar still works.
3. **Google two-way sync uses a service account on a LAN**, because the OAuth flow the brief implied cannot complete without a public HTTPS address. OAuth is still offered where it can work.
4. **A first-run wizard instead of an env-only password** (Dinner Bell's ADR 0004), and an auto-generated secret key, so a non-technical self-hoster never edits a file.
5. **A JavaScript animation library** behind a CSP nonce, revisiting Dinner Bell's CSS-only rule for this app (decision 0007, Q2).
6. **Recurrence on the backend** rather than in the browser (decision 0003).
7. **"Lists, chores, tasks"** became two plugins: `lists` (shared checklists; items with due dates are the tasks) and `chores` (recurring, per person, with the children's layer). One plugin would have made both worse.
8. **Meal plans stay simple** (a week grid with saved meals). The household already runs Dinner Bell for real meal planning and shopping; a link to it is a §19 idea rather than a rebuild.

**Suggestions folded into v1** (things the brief did not ask for that competitors have or that their users ask for; see the research summary in §19's sources):

| Suggestion | Why | Where |
|---|---|---|
| Parent PIN and children's devices | Children use the wall screen; Skylight and Hearth both ship a lock; DAKboard added "Child Lock" in 2026 | §12 |
| "Who's doing what" people view (a column per person for today and the week) | Hearth's most-praised view | UX |
| Routines (morning, bedtime) with a full-screen step runner and a bigger celebration at the end | Hearth; Skylight's "explosion of emojis" on a finished list is what families remember | §9, UX |
| Rewards with parent approval, streaks | Skylight charges $79/yr for stars; Hearth $9/mo | §9 |
| Sync health: "Updated 2 min ago", "Sync now", a plain-English fix for expired passwords | The top complaint across every competitor is sync | §8 |
| Explicit calendar-to-person mapping with "already used by Mia" hints | Skylight's duplicate-profile complaint | §8 |
| A holidays calendar generated offline, birthdays from people | Cozi charges for a birthday tracker; no feed to configure | §8, §9 |
| Dark, light and Auto by sunset, plus a sleep schedule and dimming | Skylight has no dark mode; glare at night is a common complaint | §12, §13, UX |
| Text size (Standard, Large, Extra large) and "dim past events" | Skylight's own display settings; small text is a frequent complaint | UX |
| The screensaver never hides the day: a clock and the next event sit on the photo, and any touch returns to the board | A Calendar 2 review's main complaint | UX |
| Quick add in natural language, parsed locally | Skylight's Sidekick without an API key | UX |
| Works without the internet | Skylight has no offline mode; a local server simply keeps going while sync pauses | §5 |
| Undo everywhere instead of confirmations | Dinner Bell's rule; children tap things | UX |
| Export to ICS and a one-tap backup download | Ownership; every cloud vendor in the research removed features at some point | §14 |
| Portrait and landscape as equals; several displays per household | Calendar 2's stand lost portrait; a hallway "today" screen is a natural second display | UX, §13 |
| Guest / privacy mode (photos, clock and weather instead of the board) | Hearth's Privacy Mode | UX |
| Reminders as quiet display toasts that dismiss themselves | A Calendar 2 complaint: notifications that never dismiss | UX |
| Phone calendar search and "Add a countdown" from any event | Cozi charges for search; countdowns from events is a one-tap win | UX |
| A guided Pi install script, a QR code to the phone app, an update script, and an opt-in update check | Setup is the weak spot of every open-source alternative reviewed | §13 |

## 19. Ideas beyond v1

| Idea | Call |
|---|---|
| Magic import: photograph a flyer or forward an email and get draft events to review | **v1.1**, opt-in with the household's own Claude API key; `<input type="file" capture>` works over plain HTTP; a "Review 3 events" sheet, never auto-saved. The research's local-LLM numbers (a 3B model at ~5 tokens/s on a Pi 5) rule out on-device image parsing |
| LLM fallback for quick add when chrono-node is unsure | Later, behind the same key |
| Email-to-calendar (a mailbox read over IMAP; `.ics` attachments parsed locally) | Later |
| Notes and kitchen timers plugin (sticky notes on the Today panel; timers with a chime that dismiss themselves) | **v1.1**, cheap |
| Home Assistant plugin: who's home from person entities, HA calendars, HA to-do lists, notify, motion-wake | **v1.x**; the household runs HA |
| Dinner Bell link for the Meals room ("Tonight: Tacos" from its plan; a token endpoint on the Dinner Bell side) | Later; Dinner Bell's own ideas list already names a kitchen-tablet "Tonight" display |
| Adapters instead of rebuilds: Mealie or Tandoor (meals), Donetick or Grocy (chores), Immich and Nextcloud (photos, designed in §9) | Immich in M4 if time allows, else v1.1; the rest later |
| iCloud Shared Album public links (unofficial webstream endpoint) | Later; it has broken before |
| Notifications to phones (ntfy, Pushover, Web Push over HTTPS) | Later |
| A Google OAuth redirect relay (a static page on GitHub Pages, the my.home-assistant.io pattern) so LAN-only households can use OAuth | Later, if the service-account path proves too hard for families |
| Microsoft 365 via Graph device-code flow | Later |
| Per-display layouts (a hallway "today" screen with its own panels) | **v1.1**: a `display_profile_json` on the device row |
| Offline write queue on phones (Dinner Bell's op outbox) | Later; v1 shows cached data with a quiet pill |
| Shared whiteboard or doodles (WebSocket) | Later |
| Co-parenting: custody overlay, two households | Later |
| PIR motion wake and pixel shift for OLED | Later; the display helper (§13) is the place |
| Voice: phone dictation works today; local Whisper through HA's Wyoming | Later |
| Importers from Skylight (reverse-engineered API) and Cozi (ICS export works already) | Later |
| School lunch menus (Nutrislice) | Later |
| Allowance ledger and savings goals on top of points | Later |
| Translations (strings are centralized from M0) and more calendars (Hebrew, Islamic) | Later |
| Home Assistant add-on packaging (`config.yaml`, `build.yaml`, `run.sh`, with `aarch64`) | **v1.x** |
| Print the week or a list | v1.1, cheap |
| "Who's looking" personalization via a camera | Not planned: privacy |

Sources behind the competitor claims above (checked 2026-10-07): Skylight's support articles on iCloud two-way sync, Sidekick and display settings, and the TechCrunch and SlashGear coverage of Calendar 2; Hearth's features and membership pages; Cozi's plan comparison; DAKboard's pricing and TouchHub announcement; Mango's features page; Amazon's Alexa+ announcements and the Tom's Guide piece on Echo Show ads; Google's Nest calendar support page; Samsung's Family Hub ad coverage; the GitHub topics `skylight-alternative` and `family-calendar` (Prism, Skylite UX, DinkyDash, LX Family Planner, Kinboard, OpenSkyLight, Mantel); Home Assistant's DIY family calendar thread, Daylight Calendar Card and ChoreOps; Google's OAuth redirect rules, limited-input-device scopes and Calendar sync guide; Apple-related CalDAV notes from python-caldav issue 3 and the Nylas iCloud guide; Google Photos API update notes; Open-Meteo's terms; Raspberry Pi's kiosk tutorial and configuration docs; MDN's secure-contexts list.

## 20. Open questions for the owner

Asked and answered on 2026-10-07; the plan reflects the answers. Q5 was settled when the owner cleared `docs` from `.gitignore`; Q6 was not asked and uses its default.

| # | Question | Answer |
|---|---|---|
| Q1 | The product's name | **Sunroom** (package `sunroom`, image `scopexl/sunroom`, env prefix `SUNROOM_`) |
| Q2 | Motion: the `motion` library behind a CSP nonce, or Dinner Bell's CSS-only rule | **`motion` with the nonce** (decision 0007); the e2e CSP guard stays on |
| Q3 | The kitchen screen's orientation, and where the server runs | **Landscape first, portrait supported; the container runs on the owner's existing server behind the HTTPS reverse proxy, and the Pi is the display only** (`install.sh --display-only`). The all-on-one-Pi path stays supported for other households |
| Q4 | How far the chores plugin goes for kids | **The full layer**: assignment and rotation, stars, rewards with parent approval, streaks, routines; each part switchable, all on by default |
| Q5 | `docs/` was gitignored when planning started; commit docs or keep them private? | Commit them (decision 0016); the owner cleared `.gitignore` during planning |
| Q6 | Which calendar service to wire first | Default: ICS and holidays first, then iCloud CalDAV, then Google by service account, then Google OAuth (which the owner's proxy makes usable) |
