# Architecture decision records

Each record covers one decision: the context, what was decided, and the consequences. All of them are short. Records 0001 to 0017 were seeded from the decisions table in PLAN §3; 0018 to 0020 record the answers to the open questions in PLAN §20 that the table didn't cover; 0021 onwards were decided while building.

**Rules for adding and changing records**
- New decisions get the next number. To change a decision, add a new ADR that supersedes the old one, and change the old one's status to "Superseded by 00NN". Never rewrite an accepted record's decision.
- Every open question in PLAN §20 is answered here. Q6 wasn't put to the owner, so its record uses the default and says so.
- Where Sunroom departs from one of Dinner Bell's decisions, the record names it as "Dinner Bell's ADR 00NN".
- Records follow the repo's privacy rules: no real names, addresses, hostnames, IP addresses or local paths, and only synthetic examples.

| ADR | Decision | Answers |
|---|---|---|
| [0001](0001-copy-dinner-bell-stack.md) | Copy Dinner Bell's stack and skeleton | — |
| [0002](0002-in-repo-plugins-with-runtime-switches.md) | Plugins are in-repo modules with runtime switches and explicit registries | — |
| [0003](0003-recurrence-expanded-on-the-backend.md) | Recurrence is expanded on the backend | — |
| [0004](0004-google-three-tiers.md) | Google in three tiers: a secret address, a service account, and OAuth only on public HTTPS or at `localhost` on the display | — |
| [0005](0005-icloud-and-caldav-with-app-passwords.md) | iCloud through CalDAV with an app-specific password; generic CalDAV shares the adapter; ICS as the fallback | — |
| [0006](0006-first-run-password-devices-kiosk-pin.md) | A household password set on first run, per-device sessions, a paired kiosk that never expires, an optional parent PIN | — |
| [0007](0007-motion-library-behind-a-csp-nonce.md) | The `motion` library is allowed, behind a per-request CSP style nonce | Q2: `motion` or CSS-only motion |
| [0008](0008-themes-are-a-household-setting.md) | Light, Dark, or Auto by sunrise and sunset, as a household setting | — |
| [0009](0009-photos-as-files-on-the-volume.md) | Photos are files on `/data/photos` with WebP thumbnails, indexed in SQLite | — |
| [0010](0010-weather-from-open-meteo.md) | Weather from Open-Meteo, with no API key | — |
| [0011](0011-name-sunroom.md) | The app is called Sunroom | Q1: the product's name |
| [0012](0012-license-mit.md) | MIT license | — |
| [0013](0013-visual-direction-sunroom.md) | Visual direction "Sunroom": a calm wall whose light follows the day | — |
| [0014](0014-one-responsive-app-for-display-and-phone.md) | Kiosk and phone are one responsive app; the device kind picks the layout | — |
| [0015](0015-quick-add-parsed-locally.md) | Quick add is parsed locally with chrono-node; no LLM in v1 | — |
| [0016](0016-docs-are-committed.md) | `docs/` is committed | Q5: commit the docs or keep them private |
| [0017](0017-host-rule-instead-of-base-url.md) | A Host rule instead of `APP_BASE_URL`; the cookie name follows the scheme | — |
| [0018](0018-owners-deployment-and-orientation.md) | Landscape first; the owner's server runs behind the HTTPS proxy and the Pi is the display only | Q3: the screen's orientation and where the server runs |
| [0019](0019-chores-full-kids-layer.md) | Chores ship the full kids layer, each part switchable | Q4: how far chores go for kids |
| [0020](0020-sync-provider-order.md) | Calendar providers in order: ICS and holidays, iCloud, Google by service account, Google OAuth | Q6: which calendar service to wire first (default) |
| [0021](0021-digit-boxes-for-lexend.md) | Changing numbers sit in fixed-width digit boxes, because Lexend has no tabular figures | — |
| [0022](0022-the-display-keyboard-is-our-own.md) | The wall screen's on-screen keyboard is Sunroom's own, not react-simple-keyboard | — |
| [0023](0023-recurrence-engine-walks-rules-itself.md) | The recurrence engine walks rules itself; python-dateutil is its test reference (supersedes the engine library in 0003) | — |
| [0024](0024-sync-speaks-http-through-the-guard.md) | Sync providers speak HTTP through the guarded client, with their own small CalDAV and Google clients (supersedes the libraries in 0005) | — |
| [0025](0025-chores-are-rules.md) | Chores are rules: due days, turns, credit and streaks are computed, in `domain/chores.py` (settles ADR 0019's open question) | — |
| [0026](0026-m4-meals-countdowns-photos-weather.md) | Meals, countdowns, photos and weather: overlays answer only while on, Groceries through the Lists API, sunset worked out in the browser, the screensaver as a frontend overlay | — |
| [0027](0027-m5-the-wall-polished.md) | The wall, polished: one screen state for the page and the Pi's helper, who dims, the opt-in update check, Download everything and a restore that checks first | — |
