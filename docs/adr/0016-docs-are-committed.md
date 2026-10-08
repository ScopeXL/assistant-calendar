# ADR 0016: Docs are committed

- **Status:** Accepted (the owner's answer to Q5)
- **Date:** 2026-10-07

## Context

- When planning started, `docs/` was listed in `.gitignore`. Q5 asked whether to commit the docs or keep them private (PLAN §20).
- Contributors, and the AI sessions that build Sunroom milestone by milestone, need the plan, the UX spec and the decisions in the repo.
- The owner removed `docs` from `.gitignore` on 2026-10-07, during planning, which answered Q5.

## Decision

- `docs/PLAN.md`, `docs/UX.md` and `docs/adr/` are committed, and so are the runbooks the plan adds later (deploy, releasing, restore, sync, kiosk, hardware, remote access, performance, plugins).
- Private notes go in a gitignored `.private/` folder, which AI sessions are not allowed to read (`.claude/settings.json`).
- Dinner Bell's maintenance rule applies: when a milestone ships, its section of the plan shrinks to a one-line summary pointing at the CHANGELOG, and decisions that change get a new ADR. History is never edited.

## Consequences

- The docs are public, so they follow the same privacy rules as the code: no real names, addresses, hostnames, IP addresses or local paths, and only synthetic examples such as `calendar.example.com`, `sunroom.local` and `192.168.1.20`. The private-terms scan covers them.
- A changed decision is reviewed in git like changed code.
- The plan stays about what is true now and what is left to do.
