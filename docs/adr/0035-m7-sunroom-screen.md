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
