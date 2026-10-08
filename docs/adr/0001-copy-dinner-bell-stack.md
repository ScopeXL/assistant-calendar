# ADR 0001: Copy Dinner Bell's stack and skeleton

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The owner has two kinds of earlier apps to borrow from:
- **Dinner Bell**, the owner's newest app, finished on 2026-10-07. It already solved Docker, privacy scanning, migrations, backups, the PWA, device sessions and live updates, and its ADRs record why.
- **Older projects.** They have no Docker and are Windows-first. One of them supplies the plugin precedent (ADR 0002), and a few small frontend rules come from them too (PLAN §4).

Sunroom has to run as one container on a Raspberry Pi or a home server, be published for other families, and stay safe for AI sessions to change (PLAN §1). Matching Dinner Bell means the owner and future sessions already know the patterns.

## Decision

Copy Dinner Bell's stack and skeleton, with renames (PLAN §4, §14):
- **Backend:** Python 3.14, FastAPI, async SQLAlchemy 2.1 on aiosqlite, Alembic (forward-only, run at startup), pydantic-settings, structlog.
- **Frontend:** React 19, TypeScript 6.0, Vite 8, Tailwind 4, TanStack Router and Query, openapi-fetch with generated types.
- **Runtime:** one container, one uvicorn worker, SQLite in WAL mode on `/data`, server-sent events for live updates.
- **Tooling:** a justfile; Playwright, Vitest and pytest; the Docker Hub image `scopexl/sunroom`, built locally for amd64 and arm64.
- **Versions** are pinned at M0 to what Dinner Bell pinned on 2026-10-06, re-checked on PyPI and npm. Sunroom's additions (icalendar, caldav, the Google client, `motion`, chrono-node and the rest) are listed in PLAN §5.2.

What comes over beyond the stack:

| Area | Copied from Dinner Bell |
|---|---|
| Repo files | Dockerfile, compose example, `.dockerignore` allowlist, justfile, git hooks, CI, Dependabot, `VERSION` and the release scripts, CHANGELOG, LICENSE, SECURITY, PRIVACY, the README's shape |
| Backend | The boot sequence and exit codes, `core/`, `db/`, `web/`, `events/`, `meta/`, `auth/`, `household/`, the feature-package shape, the Kroger OAuth account module (reused for Google, ADR 0004), the test scaffolding |
| Frontend | The API client, the SSE client and event router, the store, Undo toasts, wake lock, the `ui/` primitives, `tokens.css`, `motion.css`, the service worker, the Vite config, the e2e setup with its CSP guard, and `designRules.test.ts` (adapted to ban raw hex and runtime style injection, not `style={}`) |
| Docs | The PLAN and UX structure, this ADR format, CLAUDE.md's shape, the deploy skill, `.claude/settings.json` |

What is deliberately not borrowed (PLAN §4, and two more departures from PLAN §3), and what replaces it:

| Not borrowed | Instead | Record |
|---|---|---|
| Older projects' Windows process formation and autostart | Dinner Bell's single container | this record |
| An MCP bundle | Nothing in v1 | — |
| A zustand store | Dinner Bell's 25-line store | — |
| CDN fonts | Lexend, self-hosted | 0013 |
| A dark-only theme | Light, Dark and Auto as a household setting | 0008 |
| 110 KB CLAUDE.md files | A CLAUDE.md under 15 KB | — |
| Dinner Bell's env-only password (Dinner Bell's ADR 0004) | A first-run wizard; `APP_PASSWORD` optional | 0006 |
| Dinner Bell's CSS-only motion (Dinner Bell's ADR 0027) | `motion` behind a CSP style nonce | 0007 |
| Dinner Bell's photos in SQLite (Dinner Bell's ADR 0020) | Files on `/data/photos` | 0009 |
| Dinner Bell's single `APP_BASE_URL` | The Host rule | 0017 |

## Consequences

- Dinner Bell's ADRs still explain most of the skeleton. Sunroom's records cover what is new or different, and each departure names the Dinner Bell ADR it departs from.
- M0 is mostly copying and renaming. That lets the deploy pipeline and the real wall come first, so every later milestone is reviewed on the owner's display and phone (PLAN §15).
- With the patterns come Dinner Bell's constraints: one process holds the event hub, the write lock and the rate limiters in memory; `/data` must be a local volume; images are built from `git archive` of a tag.
- The two apps share a skeleton but not a codebase. A fix found in one is worth porting to the other by hand.
