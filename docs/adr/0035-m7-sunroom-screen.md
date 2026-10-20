# ADR 0035: Sunroom Screen (M7), and the keyboard's number row

- **Status:** Accepted
- **Date:** 2026-10-20

## Context

- Sunroom 0.12.0 went on the owner's wall and phones. On 2026-10-20 the owner asked for two small
  wall fixes (the keyboard's number row, and the Hours view's now line drawn over the day heads)
  and for a plan: a flashable "Sunroom OS" for a Raspberry Pi, the device's own settings as an
  overlay on the wall, and one install command per OS that ends on a page which finds Sunrooms on
  the network. `docs/M7.md` is that plan, with the research, the design and every decision; this
  ADR keeps the ones that change an earlier decision or that a later session would otherwise have
  to rediscover (PLAN §15, M7). It is started with batch 0's first task and gains a row with each
  task after.

## Decision

| Question | Decision |
|---|---|
| The keyboard's number row | **Gone** (reverses that part of ADR 0032). The letters page (the `text` and `password` layouts) is the three rows of letters again; **123**, the bottom-left key, switches to the numbers and symbols, whose first row is `1234567890`; the number pad for times, PINs and codes is unchanged. The row cost a row of board on every field (64 px, 72 in portrait) and the family reached for 123 anyway |
| How a screen finds a Sunroom | **`GET /api/discover`**, public and `no-store`: `{sunroom: true, id, version, setup_complete, name, url}`. The **id** is `app_meta.instance_id`, a UUIDv7 made once (by the migration for an existing row, at boot for a row that lacks one) and carried by every backup and restore, so a screen whose Sunroom moved to a new address or a new card finds it again by id. **The household's name only to a local address**: the request's Host (after a home proxy's `X-Forwarded-Host`) is an IP literal, `localhost`, the container's own name, a single-label name or a LAN-suffix name, the Host rule's own list, lifted into `web/hosts.is_local_name`; a page rebound from the internet carries its public name and gets `null`. `url` is SUNROOM_ADVERTISED_URL or `null`. Not in "Recently reached at", like `/api/health`. The server doesn't announce itself over mDNS: a container on Docker's default network can't multicast to the LAN, so an all-in-one Pi's avahi file does it (T2) |
| The wall page and the agent | **The launcher names the agent on the address**: `/display?dimmer=…&screen=<port>`. **The server widens one document's CSP**: a `/display` request with exactly one `screen` from 1024 to 65535 gets `connect-src 'self' http://127.0.0.1:<port>`; every other page and port keeps `connect-src 'self'`. **The page reads the port once, at its start, and remembers it nowhere** (a page loaded without it has the plain policy, so a remembered port would only make blocked calls and CSP reports), and nothing calls the agent without it. Because the wall's rooms change the address and drop the parameter, **a fresh reload on such a wall goes to the launcher's address** instead of reloading the room's (the remembered room comes back by itself, ADR 0030). The agent's state is a query, polled every 30 s and kept current by its event stream; `null` when there's no agent or it doesn't answer |
| Sunroom Screen, the agent | **One process, `sunroom-kiosk run`** (`kiosk/agent/`, Python 3.14, FastAPI): the launcher and the screen helper rolled into one, plus an API on **127.0.0.1:7800** that the wall page and the screen's own pages call. **Who may call it:** a loopback Host only (`127.0.0.1`, `localhost`, `[::1]` with its port: a page rebound to 127.0.0.1 still sends its own name); CORS for exactly two origins, the Sunroom this screen shows (from its config, so it moves with the address) and the agent's own, never credentials, and `Access-Control-Allow-Private-Network` on a preflight that asks; every change needs `X-Sunroom-Screen: 1` and, from a page, one of those two origins. **Its settings** stay the bash-sourceable `~/.config/sunroom-kiosk/config`, rewritten in place (comments and keys it doesn't know kept). **What it can do** is the platform adapter's `capabilities`, which the pages show buttons for. **The screen helper** keeps its code and tests, on a daemon thread with a stop event, so it still never leaves a wall dark. **Shape names** all start with `Screen` (`ScreenStateOut`…), so the frontend's two generated schemas never share one. **The browser is watched through DevTools** on the port it picks (`--remote-debugging-port=0`, `DevToolsActivePort`): the page is Sunroom's when its title is Sunroom, it carries the nonce meta and its root has drawn something; nothing is injected. A pipe (`--remote-debugging-pipe`) would expose no port, but Python can't hand a child fds 3 and 4 without `preexec_fn` (unsafe with threads), and Windows can't at all |

## Consequences

- The keyboard: no schema or API change. `ui/Keyboard` lost its `DIGITS` row; `Keyboard.test.tsx` and the
  `shell.spec` dock case check that the first row is the letters' and that 123 reaches the digits.
- Noticed and left as it is: the symbols page's last row (ten symbols and a Delete one and a half
  keys wide) is about 1004 px against the 960 px box of keys in landscape, where it overhangs the
  box but stays in the dock, and 1096 px in portrait, where its first and last keys lose 8 px at
  the screen's edges.
- Migration `202610201813_app_meta_instance_id`: `app_meta.instance_id` (String(36), null), and
  one UUIDv7 for the existing row. Tested from the 0.12.0 fixture (the row keeps its values and
  gains an id); the 0.13.0 fixture `202610201813.sql` is built with a fixed id.
- New in the API: `GET /api/discover` (`DiscoverOut`, `meta/discover.py`). New in `web/hosts`:
  `is_local_name(name, own)`, `own_hostname()`, and `UNNOTED` (what never goes into "Recently
  reached at"). `scripts/image_common.sh` probes the route, and the name rule after setup.
- The agent: a new uv project, `kiosk/agent/` (package `sunroom_kiosk`): `config`, `schemas`,
  `app` (the guard and the routes), `state` (the `Agent`), `browser`, `screen` (moved from
  `kiosk/sunroom-screen`, which stays until the installer switches in T8), `discovery`,
  `policy`, `events`, `updater` (the interface; T9 the real one), `platform/{base,fake}`,
  `testing` (`--fake` only), `cli`. Generated: `frontend/src/api/screen-openapi.json` and
  `screen-schema.d.ts` (`just api-types`). New recipes: `just kiosk-test`; `kiosk-lint` runs
  ruff and pyright strict on it; `just check` runs its tests; CI's `kiosk` job runs on
  `ubuntu-24.04`, `macos-15` and `windows-2025`.
- The wall page: `web/headers.csp(nonce, agent_port)`, `web/spa.screen_port`; in the frontend,
  `lib/screenAgent` (`noteScreenAgent`, called in `main.tsx`; `screenClient`,
  `createScreenClient`, `useScreenAgent`, `useScreenAgentEvents`, `screenReloadUrl`,
  `screenProgress`), `qk.screen.*`, and `lib/update`'s reload going to the launcher's address.
