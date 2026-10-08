# ADR 0011: The app is called Sunroom

- **Status:** Accepted (the owner's answer to Q1)
- **Date:** 2026-10-07

## Context

- The plan was written under the working name "Sunroom", provisional until the owner answered Q1 (PLAN §20).
- A sunroom is the room in a home where the light changes through the day. That is the visual concept (ADR 0013), so the name and the look explain each other.
- The owner confirmed the name on 2026-10-07.

## Decision

The app is **Sunroom**:

| Where | Name |
|---|---|
| App display name | Sunroom |
| Python package and CLI | `sunroom` (`backend/src/sunroom/`, `sunroom serve`) |
| Docker image | `scopexl/sunroom` |
| Environment prefix | `SUNROOM_` for Sunroom's own variables; the names shared with Dinner Bell keep their `APP_` prefix (`APP_SECRET_KEY`, `APP_PASSWORD`, `APP_ALLOWED_HOSTS`) |
| Database | `/data/sunroom.db` |
| Session cookie and CSRF header | `sunroom`, or `__Host-sunroom` over HTTPS (ADR 0017); `X-Sunroom: 1` |
| Pi install | `/opt/sunroom`, the `sunroom-kiosk` launcher and its units, the hostname `sunroom` (so `sunroom.local`) |

## Consequences

- One word everywhere: the UI, the image, the CLI and the docs.
- The app icon is a window with light in one pane, not a sun (UX §7).
- The installer URL (PLAN §13.1) and the Home Assistant repository's name (PLAN §13.9) assume the GitHub repository is called `sunroom`. It was created under another name, so either it is renamed before the first release or those URLs change.
