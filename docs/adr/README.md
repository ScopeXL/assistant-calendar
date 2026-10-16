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
| [0028](0028-m6-batch-1-the-owners-first-notes.md) | The owner's first notes (M6 batch 1): Title Case for titles, headings and navigation (supersedes the case rule in 0013); Child, not Kid; birthdays from the core; the live-updates icon; Agenda and Hours with a zoom; accounts and photos from any device; refresh after an update; tips; the keyboard inside sheets | — |
| [0029](0029-m6-batch-2-the-owners-second-notes.md) | The owner's second notes (M6 batch 2): Tasks, not Chores; People; Small text and tap targets that never shrink; roomier button groups; the global header and the room's slot in it; the view switch as icons or a View menu; the rail's fold and brand; the Hours zoom as buttons (supersedes 0028's ladder); Add as touch forms with a day and time picker and custom repeats; settings that save themselves; rows you tap, an account's sheet and one color picker; Erase everything; a plugin's settings across versions and on every screen at once; what moves, and why | — |
| [0030](0030-m6-batch-3-the-owners-third-notes.md) | The owner's third notes (M6 batch 3): the live icon only while something is wrong (supersedes 0028's corner); the page hides a resting pointer; a screen remembers its view and room, with When it starts; the city search as you type and no pairing step in the wizard; the rail's mark and its fold that eases, with both toggles in the header; a header with no titles or second line, Filter, and the zoom on the grid (supersedes parts of 0029); Google's keys inside Sign in with Google; Add in three parts with value rows and one field for a meal | — |
| [0031](0031-idle-brings-the-board-back-to-now.md) | Idle brings the board back to now (this week, everyone's events, nothing open) and keeps what a screen chose for itself; a change in Settings → Display wins over a screen's own choice; a zoomed grid at rest keeps now in view (supersedes parts of 0028, 0029 and 0030) | — |
| [0032](0032-m6-batch-4-the-owners-fourth-notes.md) | The owner's fourth notes (M6 batch 4): a quick gate per task and the full gate per batch; preflight needs the newest migration's fixture; every button in Title Case (narrows 0028); Fit the day first in the zoom and the header's three things centred (change parts of 0030); "Nothing today" and Free day; the remembered theme painted first and one crossfade; toasts that stay where they were raised; birthdays within a window in Coming Up; Devices; empty rooms; the update check reads tags; Apple first, accounts renamed; setup's steps beside the form; the keyboard as a centred dock with a number row (changes 0022's placement); the e2e job's time, and the deploy reporting CI | — |
| [0033](0033-m6-batch-5-the-owners-fifth-notes.md) | The owner's fifth notes (M6 batch 5): no scrollbar on the Hours grid (the kitchen screen's overlay bar flashed once a minute); the forecast's Today and Forecast, and its place without the country on one line; the header's date and time on one baseline and the weather as a pill with a chevron, the high and low moved into the forecast (changes 0032's centred header); Rolling week in Settings → Display, yesterday, today and the five days after, the Week view only | — |
| [0034](0034-m6-batch-6-the-owners-sixth-notes.md) | The owner's sixth notes (M6 batch 6): devices and paired screens, and a screen that shows only what it can do; setup's 8 characters, Home and theme; Return to the calendar honoured by Settings, and tips on; four more colors; stars for several children; Support Sunroom; the people a title names and chips in their colors; reminders that come back and a Default reminder; Needs Attention; any reverse proxy with nothing to set (changes 0017); a refresh asks the server for the page (changes 0007); the backup policy and every copy listed; restore from a file, applied as Sunroom runs itself again (changes 0027) | — |
