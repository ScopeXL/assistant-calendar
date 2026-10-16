# Sunroom — UX

This document covers every screen on the wall display and on phones, the main flows step by step, empty and quiet states, the visual direction and the motion spec. It goes with [`PLAN.md`](PLAN.md), which cites it as "UX §n"; the reasoning for the visual direction is in [ADR 0013](adr/0013-visual-direction-sunroom.md). It was split out of PLAN §16 on 2026-10-07, at the start of M0.

Wireframes show structure, not styling. The display is drawn at 1920×1080 (and 1080×1920 where portrait differs); phones at 390×844.

## Contents

1. [Rules for every screen](#1-rules-for-every-screen)
2. [Words](#2-words)
3. [Navigation and layout](#3-navigation-and-layout)
4. [Display screens](#4-display-screens)
5. [Phone screens](#5-phone-screens)
6. [Flows](#6-flows)
7. [Visual direction: "Sunroom"](#7-visual-direction-sunroom)
8. [Empty and quiet states](#8-empty-and-quiet-states)
9. [Motion spec](#9-motion-spec)
10. [Accessibility, children, guests and the screenshot checklist](#10-accessibility-children-guests-and-the-screenshot-checklist)
11. [Refinements adopted from the interaction design](#11-refinements-adopted-from-the-interaction-design)

---

**The bar:** if a six-year-old, a grandparent or a guest has to ask how the screen works, the design failed. Design for a glance from the sink at three metres, and for a tap with a wet finger at arm's length. The person who sets it up is a non-technical self-hoster, usually on a phone; the wall takes a password too (masked, behind the PIN) and hands a file or Google's own page to a phone. Two surfaces, one app: the display is the family's shared wall, open, no sign-in, always on today; phones are private, remember who holds them, and do the typing-heavy work.

## 1. Rules for every screen

**Two distances on one display.** Every element is either a *glance element* (read from 2–3 m) or an *arm's-length element* (read and tapped from 50 cm), and the two never share a size. Glance elements, big and few: the header's clock and date; Now and Up Next in the Today panel; today's day number and the lit column; task progress per person ("Mia 2 of 3"); Tonight; countdown numbers; the screensaver clock and next event. At Standard text size on a 24" 1080p monitor a glance element reads at 3 m (about 15 mm cap height, 40 px Lexend or larger); on a 15.6" monitor at 2 m. Glance elements are never truncated mid-word and never share a line with secondary text. Everything else (chips, headers, lists, task rows, meal cells, buttons, the keyboard, settings, sheets) is arm's-length.

**Type sizes on the display** (CSS px at Standard; Large multiplies by 1.15, Extra large by 1.3 and Small by 0.875 through the root font size; nothing on the display is smaller than 18 px, or 16 px at Small, the size for a screen around 1920×1080 that is read up close: ADR 0029):

| Role | Standard | Line | Where |
|---|---|---|---|
| Caption | 18 | 24 | "Updated 9:10 AM", keyboard hints |
| Secondary | 20 | 28 | Times on chips, "Done by Mia", locations, column counts |
| Body | 24 | 32 | Chip titles, list items, task titles, meal names, button labels (600) |
| Title | 32 | 40 | A page's title in the header (a list's name, Saved Meals), the Month view's month and the Day view's day, panel titles, day headers |
| Glance | 40 | 48 | The Up Next title, "All done, Mia!" |
| Header clock | 40 | 48 | Weight 800, digits in fixed-width boxes (ADR 0021); AM or PM at 20 beside it, in ink-soft, on its baseline; the date at 24, weight 600, on the same baseline (ADR 0033) |
| Big number | 72 | 72 | Countdown tiles, star balances |
| Step title | 64 | 72 | The routine runner's current step |
| Wall clock | 200 | 200 | Screensaver and Night (does not scale) |
| Keyboard key | 28 | — | Key caps; PIN pad keys 36 |
| Month cell line | 20 | 26 | The only place an event title sits below body size |

Phones keep Dinner Bell's scale (caption 13/18, secondary 14/20, body 16/24, row 18/24, title 24/30, big number 30/36); anything typed into is at least 16 px; phones follow the OS text size.

**Tap targets.**

| Element | Display | Phone |
|---|---|---|
| Primary buttons (Add event, Done, Save) | 64 px tall, full panel width | 48 px |
| Other buttons, icon buttons, segmented options, chips | 56 px | 44 px |
| Rail rooms | 96 px tall, full rail width | tab bar 56 px |
| Event chips on the board | at least 56 px tall (72 with a time line), full column width | rows 56 px |
| Checkboxes (tasks, items) | 64 px box inside a 96 px × full-row tap area | 48 px box in 72 × 80 |
| Avatar chips in Who pickers | 64 px circle, 96 px wide with the name | 48 px circle |
| Keyboard keys | 80 × 64 landscape, 88 × 72 portrait, 8 px gaps | native |
| PIN pad keys | 112 × 88 | native numeric |
| The routine Done button | 120 px tall, 60% of the width | 64 px |
| Undo on a toast | 64 px | 44 px |

Nothing a finger taps is under 56 px on the display or 44 px on phones, with at least 8 px between neighbours on a line, at every text size: targets and the gap between them grow with Large and Extra large and never shrink under Small (the `--tap` and `--tap-primary` tokens; `min-h-tap`, `size-tap`, `min-h-tap-primary`) (the options of one segmented control and the cells of a tab bar or the rail count as one control); the e2e tests check both. **Every action has a visible button**: swipes (week paging), long-presses (chip drag) and taps on empty board space are shortcuts for something that also has a button. On the Week board's **Hours** layout a short event is still a full-size button whose top is at its time, so in one column a later chip can sit on the transparent tail of an earlier one; a chip too small to read is what the zoom is for, the way a Month cell opens its day (ADR 0028).

**Button groups.** A few short choices side by side, the chosen one filled with ink (a segmented control). Each word has 20 px of room on either side on the display and 16 on phones (it was 12; ADR 0029), with 4 px between cells. A group that can't fit one line (the four text sizes on a phone) wraps onto a second row and keeps a fixed corner radius, so it still reads as one control: it never scrolls and never spills past its card. Where words won't fit at all (the header's views, the Week's layout in a narrow header) the group is icons: round 56 px cells with 8 px between them and no border, each named for screen readers, lining up with the icon buttons beside them. A setting's choices are a group up to six options and 40 letters in all; more, or longer ones, are chips.

**Spacing and surfaces.** An 8 px grid; display gutters 24 px; board column gaps 8 px; chip padding 12 px vertical and 16 px horizontal; rows 64 px (72 with a second line); section gaps 32 px. Shell widths in landscape: rail 192 px, Today panel 400 px (both in rem, so they widen with the text size), the header 80 px tall over the board and the panel, the board gets the rest (1328 px wide: seven columns of about 190 px with the panel, about 245 px without). Portrait: the header (two rows) on top, a 384 px Today band under it, a 112 px bottom bar, board rows between. The rail, the header, the board and the Today panel are flat surfaces that differ by tint only; sheets and panels are a fourth; cards exist only where something really is a card (a list tile, a countdown tile, a reward, a photo); no shadows except on a lifted chip and an open panel. Corner radius follows hierarchy: panels and sheets 24 px (20 on phones), buttons 16 (12), event chips 12 (8), avatars and filter chips round. Today's column is one step lighter than the wall; past chips sit above the now line and are dimmed; the in-progress chip is filled solid in its person's color. Reading width on laptops is capped at about 72 characters.

**The on-screen keyboard (display).** Sunroom's own (ADR 0022). Appears only when a text field is focused, slides up in 220 ms, never on first paint and never on a laptop that sent a physical key event in the last 5 s. It is a dock across the bottom of the screen (ADR 0032): from the rail to the screen's edge in landscape, whichever side the rail is on, the full width in portrait and before pairing, with the keys centred in it and a row of numbers above the letters, as on a tablet (it was a 960 px box under the side panel). It never covers the focused field or the panel's primary button: the panel scrolls so the field sits 16 px above the keys, and the primary button stays pinned above them. Layouts: letters; numbers and symbols; a numeric pad for times, PINs and codes; a code layout for pair codes; long-press for accents. Above the keys there is no row at all until a key is held: then its accents show there (a row of suggestions was planned and never built; the 56 px it kept empty went in 0.9.0, ADR 0030). Shift is automatic for a title's first letter; no autocorrect. **Done** lowers the keyboard and keeps the draft; ↵ in a quick-add field saves, elsewhere it is Done; tapping outside a field lowers the keyboard and keeps the draft.

**Undo, drafts, confirmations.** Prefer Undo over confirmation: every destructive or attributing action shows an Undo toast, 8 s on the display (people look up later), 6 s on phones; two toasts at most on the display, three on phones. Confirmation sheets exist only for what Undo can't cover: remove a person, remove an account, delete a list that still has items, unpair a screen, erase all data; their buttons name the action ("Remove Mia" / "Keep Mia"). Recently Removed keeps removed things for 7 days. **Settings save themselves** (ADR 0029): no Settings page has a Save button. A switch, a segmented choice, a chip or a select saves the moment it changes; a typed field saves when it is left or on ↵, and a quiet "Saved" shows under it for two seconds. The control moves at once; if the save is refused it goes back and a toast says why ("Not saved — you're offline. Try again when you have signal."). What a page shows is always what the server holds, so two phones never fight over a form. Sheets and dialogs (a person, a calendar, an account, a routine, a reward, the PIN) and the two fields for Google's keys keep their Save and Cancel: something half-typed in a sheet shouldn't save itself. Drafts save themselves: a phone editor closed mid-way picks up where it was; on the display an editor left open closes after 10 minutes idle and its draft shows as a "Continue: Dentist Thu…" chip in the Add panel for an hour.

**Attribution.** When an action needs a person it shows the Who picker (each member, Everyone, A guest). The display's default is Everyone: adding an item or an event attributes nothing unless someone taps an avatar; completing an assigned task needs no extra tap; completing an Anyone task asks "Who did it?" beside the box. Phones attribute silently to whoever is using them. Attribution reads as a sentence under the thing ("Added by Mia", "Done by Mia · 4:12 PM", "Sam cooks"), never a bare avatar on an arm's-length surface.

**Speed, live, offline.** Taps respond instantly (optimistic; a pressed control dips and shades in 90 ms; a button waiting on the server keeps its label, shows a small spinner and can't be tapped twice). Anything saved on a phone shows on the display within a second and the other way round; the display never needs a refresh. **That includes every setting** (ADR 0029): the household's own (theme, text size, rail, home view, sleep, time zone and the rest) and each feature's (the screensaver's timing, the Tasks board's stars, which meals are planned, birthdays), and turning a feature on or off, which adds or removes its room without the other rooms blinking. A screen whose connection dropped catches up on what it missed when it reconnects. The only time a screen reloads is after the server itself was updated, and it does that by itself (§8). Two kinds of offline, both quiet pills (§8): the display can't reach the server; the server has no internet.

**Idle, wake and reset.** The display is shared, so it quietly returns to the shared state. After 2 minutes idle the board comes back to now: the person filters clear, an open sheet closes, and the board goes back to this week (today on the Day view, this month on the Month view). What the screen chose for itself stays as it was: its view, the Week's layout and zoom, the Today panel and the rail (ADR 0031), and a zoomed Hours grid keeps now in view until the next touch. After 5 any room returns to the Calendar room, in that same view (Settings → Display → Return to the calendar after picks the minutes, or Never; Settings leaves with the other rooms and its parent grant locks after 2 minutes, ADR 0034); after 10 an open editor closes into a Continue chip; after the screensaver setting (default 15) the screensaver starts if Photos is on; the sleep schedule brings Night. Any tap while asleep wakes to where it was (or to the week board if asleep over 30 minutes, in the room it was in when Return to the calendar after is Never), and the waking tap does nothing else. **A refresh, an update or a restart brings a screen back to what it was showing** (ADR 0030): the room, the view and which week, day or month, who's filtered, the Week's layout and zoom, the Today panel and the rail, kept in that screen's own browser. The idle rules above are what's remembered: a screen that sat idle comes back to this week in its own view; a screen refreshed mid-use comes back where it was. A change to Home view, Week layout, Today panel or Compact rail in Settings → Display wins over what a screen chose for itself, so it shows at once: the latest choice wins (ADR 0031). An open sheet or a half-typed Add is never brought back, and neither is Settings (its PIN may have locked again). Settings → Display → **When it starts** → **The home view** turns the memory off: the screen then keeps nothing and always opens at home.

**What never appears.** Internal ids, full feed URLs (secret addresses show as "…/private-3f9a…/basic.ics"), tokens, keys after upload; jargon (users see "Apple", "a calendar address (.ics)", "Sign in with Google", "paired screens", never "CalDAV", "ICS feed", "OAuth", "kiosk"); native tooltips, hover-only affordances, double-taps, pinch as the only way; all-caps labels, "A · B · C" strings in running text, emoji in the app's own copy (one exception, the owner's choice: the heart beside Support Sunroom's heading, hidden from screen readers; ADR 0034); machine timestamps, "null", HTTP codes; subscription or upsell language of any kind.

**Theme and first paint.** Light, Dark and Auto (dark from sunset to sunrise using the household's location, or 7 PM–7 AM without one); the wall tint follows the time of day in both themes (§7), AA holding at every stop. A page's first paint is the theme, tint and text size this browser last showed (a small script in the page's head reads them before anything paints), so a refresh never shows another theme first; the fades wait until the household's own appearance is on, and a pair screen loading its board keeps what it last showed (ADR 0032). Nothing animates on first paint or a room switch; the board opens on this week with today visible and the Today panel on Now / Up Next.

## 2. Words

Plain words in the family's own vocabulary. A button says exactly what happens and the toast repeats the verb.

**Case** (ADR 0028, 0032). Titles, headings, navigation labels and buttons are in Title Case: screen, page, room, sheet, panel and dialog titles; section headings, the Today panel's included; the names of views, tabs and rail rooms; the header's quick jumps (This Week, Today, This Month); and every button of up to five words, a toast's action and a link that looks like a button included (Add Event, Save Changes, Clear Done, Check Now, Take It Back, Download Backup). Capitalize every word except a, an, the, and, or, but, of, to, in, on, at, by, for, from, with, unless it is the first or last word or follows a colon: "Who's Using This", "Take Your Data with You", "Google: The Secret Address", "Bring in Your Calendars", "Ask for It", "Hide from Screensaver". The "in" of signing in belongs to the verb and may keep its capital ("Sign In Again"); Google's own Sign in with Google is written Google's way. A button of six words or more reads as a sentence and stays in sentence case ("Type the household password here instead", "Use a code from another phone"). Everything else stays sentence case: toasts, hints, row and field labels (Text size, Live updates), segmented options that aren't view names (Extra large), chips, menu items, the choices in a list (Add an account's Another calendar), body, empty states and error copy; an icon-only button's name for a screen reader ("Next tip") is a label too. A page's or a button's name inside a sentence keeps its Title Case ("open Settings → Calendars & Accounts", "tap Add a Countdown"). Dates and spans ("October 2026", "Oct 5–11", "Wed, Oct 7") are unchanged, and so is the lowercase "today" beside the Day view's title. Never all caps. The design-rules test checks every title and every button written as a literal.

The user-facing glossary is PLAN §2; a few words only the UI uses: **Room** (a top-level area on the rail or a phone tab), **Board** (the display's main area), **Today panel** (the glance column), **Now / Up Next / Later Today / Tomorrow** (the panel's headings, only the ones with content), **Tonight**, **Coming Up**, **Chip** (an event on the board; also the pick-one buttons in editors), **Task** (stored as `chore`: something a person does, once or on a rule; the family read "Chore" until 0.8.0, ADR 0029), **Home calendar** (Sunroom's own, always there and writable), **Google · Family** (a synced calendar named as in its source), **Just This One / This and the Ones After / All of Them** (buttons, so in Title Case), **Quick add**, **Usuals**, **Mia's turn**, **Done by Mia**, **All done, Mia!**, **Stars** (always a star glyph with the number), **Ask for it / Approve / Not now**, **Pair code**.

**Time and date words.** "4:00 PM" or "16:00"; minutes always shown except in month cells and phone week strips ("4 PM"); "Today", "Tomorrow", "Yesterday" within a day in sheets and the Today panel, otherwise "Thu, Oct 9"; board headers always "Thu 9"; full weekday names only in the Day view title. Lengths: "30 min", "1 hour", "1½ hours", "all day", "until 5:30 PM". Counts: "2 of 3", "12 to get", "+2 more", never "2/3". Relative: "in 20 min", "12 days", "Updated 9:10 AM", "hasn't answered since 9:10 AM".

**Devices and screens** (ADR 0034). A phone, tablet or computer signed in with the household password is a **device** ("on a signed-in device", "from any device"); a wall screen paired with a code is a **screen** ("paired screens", "this screen"; a new one is named "Kitchen screen" until it's renamed, and that stays a name). The app never says "phone or computer" for what any signed-in device can do, and a paired screen never shows a control it can't use (pick a file, open another website, download) nor a line saying where to do it instead: whoever can see a setting can use it. Where something genuinely can't be done on a screen and is part of what that screen is showing (Google's own sign-in page, a key file, adding photos), the screen shows the QR code that opens it on a device, worded "from a device" ("Or add it from a device", "Sign in again from a device:"). Two places keep "phone" because they are about one: setup, before any screen exists ("Finish setting up Sunroom on a phone or computer"), and installing the app on a phone's home screen. Two tips say what signed-in devices can do that a screen can't.

**Buttons and their toasts** (Undo unless noted; a button in Title Case, its toast in sentence case): Add Event → "Added Dentist"; Add Task → "Added Feed the dog"; Save Changes → "Changes saved"; Remove (an event) → "Removed Dentist"; Move to Thu or a drop → "Moved Soccer practice to Thu"; Done (task) → "Done by Mia"; Add Item → "Added Milk"; Clear Done → "Cleared 8 done items"; Add Dinner → "Added Tacos for Tuesday"; Ask for It → "Asked for Movie night. A parent will say yes or no." (no Undo; **Take It Back**); Approve → "Mia got Movie night"; Not Now → "Told Mia not now"; Finish Routine → "Bedtime routine done"; Pair → "Kitchen screen paired"; Connect Apple → "Connected Apple · 3 calendars"; Remove Apple (an account) → "Removed Apple" (no Undo: it asks first); Put Back → "Put back Dentist"; Set PIN → "PIN set".

**Error copy** says what happened and what to do, in the app's voice, without apology or codes: "That PIN didn't match. Try again." · "Too many tries. Wait 1 minute." · "That password didn't match. Try again." · "That code didn't work. A code works once, for 10 minutes. Make a new one on the phone." · "Not saved — the screen can't reach Sunroom. It will try again." · "Not saved — you're offline. Try again when you have signal." · "Google hasn't answered since 9:10 AM. Showing what we had." · "Apple said that password isn't right. Make a new app-specific password and try again." · "That address didn't give us a calendar. Check it ends in .ics, or try another way." · "This event comes from Apple · Work and can't be changed here. Change it in the Calendar app." · "Only a parent can approve rewards. Ask one, or enter the PIN." · "That name is already in use. Pick another." · "Photos need room: 2 GB free. Remove some, or move photos to a bigger disk (About → Storage)."

## 3. Navigation and layout

**The display shell (landscape, 1920×1080).** Four surfaces: the rail (left, 192 px, the full height), the header (80 px, over the board and the Today panel), the board, the Today panel (right, 400 px, hideable per screen from any room).

```
+----------+-----------------------------------------------------------------------------------------------------+
|   [▦]    | [⇤] Tue, Oct 7  9:41 AM  (☼ 64° ⌄)     │ [<] [This Week] [>] [☰][⏱]      [⛛] [▦ Week][1][▤][☺] [⇥] |
|----------|----------------------------------------------------------------------------+------------------------|
| [cal]    |                                                                            | Up Next                |
| Calendar |                                                                            |                        |
|          |  Sun 5   |  Mon 6   |  TUE 7   |  Wed 8   |  Thu 9   |  Fri 10  |  Sat 11  | 4:00 PM                |
| [list]   |          |          |  today   |          |          |          |          | Soccer practice        |
| Lists    |----------|----------|----------|----------|----------|----------|----------| (M) Mia · Field 3      |
|          | Columbus |          | Pajama   |          |          |          | Hike     |                        |
| [check]  | Day (All)|          | day (L)  |          |          |          | (All)    |------------------------|
| Tasks    |----------|----------|----------|----------|----------|----------|----------| Later Today            |
|          | 10:00 AM | 8:00 AM  | 8:00 AM  | 9:00 AM  | 2:30 PM  | 3:30 PM  | 9:00 AM  | 6:30 PM  Dinner at     |
| [meal]   | Church   | Dentist  | School   | Vet      | Dentist  | Pickup   | Soccer   |          Grandma's     |
| Meals    | (All)    | (S)      | drop-off | (A)      | (M)      | (L)      | game (M) |          (All)         |
|          |          |          | (A)      |          |          |          |          | 7:30 PM  Leo's bedtime |
| [photo]  | 2:00 PM  | 4:00 PM  |· now 9:41|          | 4:00 PM  | 6:00 PM  | 12:00 PM |          routine       |
| Photos   | Grandma  | Piano    | 4:00 PM  |          | Soccer   | Pizza    | Lunch at |------------------------|
|          | visit    | (L)      | Soccer   |          | practice | night    | Nana's   | Tasks Today            |
|          | (All)    |          | practice |          | (M)      | (All)    | (All)    | (M) Mia   2 of 3       |
|          |          | 6:30 PM  | (M)      |          |          |          |          | (L) Leo   1 of 1 done  |
|          |          | Book club|          |          |          |          |          | (S) Sam   0 of 1       |
|          |          | (A)      | 6:30 PM  |          |          |          |          |------------------------|
|          |          |          | Dinner at|          |          |          |          | Tonight                |
|          |          |          | Grandma's|          |          |          |          | Tacos · Sam cooks      |
|  ( + )   |          |          | (All)    |          |          |          |          |------------------------|
|  Add     |          |          | 7:30 PM  |          |          |          |          | Coming Up              |
|----------|          |          | Bedtime  |          |          |          |          | 12 days  Mia's birthday|
|⚙ Settings|          |          | routine  |          |          |          |          | 31 days  Beach trip    |
+----------+----------+----------+----------+----------+----------+----------+----------+------------------------+
```

`[⇤]` and `[⇥]` are Hide the rail and the Today panel's button; `[☰][⏱]` are Agenda and Hours; `[⛛]` is Filter. `(M) (L) (A) (S)` are 28 px avatar circles with initials in each person's color; `(All)` is the neutral Everyone mark; "TUE 7 · today" is the lit column; the 8:00 AM chip in today's column sits above the now line, dimmed.

**The header** (ADR 0029, 0030) is the same bar in every room. It starts with **Hide the rail** (**Show the rail** while it's folded) and ends with the Today panel's button: the two toggles sit at the header's edges, each nearest its own panel, and each icon faces that panel (a bar on the panel's side). With the rail on the right they swap ends. Neither is in portrait, where the bar never folds and the band has no button. After Hide the rail, today: the date ("Tue, Oct 7", 24 px, semi-bold), the time (40 px, weight 800, digits in fixed-width boxes, AM or PM at 20 px in ink-soft on its baseline), and the weather as a round pill, outlined like This Week and Filter: the sky's icon, the temperature at 24 px and a chevron, which opens the forecast ("as of 9:10 AM" in the temperature's place when the forecast is old). The forecast is a sheet: the place without its country as its one-line title, **Today** (a line on the weather now with the day's high and low, then the next twelve hours) and **Forecast** (the days ahead), and Weather by Open-Meteo at the foot; the day's high and low are no longer in the header, only there and in the pill's spoken name. The date and the time share one baseline; the pill is centred on the time's digits; the three are 24 px apart, and the block is a tap target tall, so portrait's first row never grows when the weather arrives (ADR 0033; ADR 0032 centred all three, and the date floated above the line the time stands on; ADR 0030 put the date on the time's baseline beside a centred weather whose own text brought a fourth). Then, after a 2 px rule with 24 px either side, the room's own part, handed over by whichever room is on screen: its controls, with what belongs at the right pushed there, 16 px between groups. **A room the rail already names (Calendar, Lists, Tasks, Meals, Countdowns, Photos, Settings) writes no title here, and nothing in the header has a second line** (ADR 0030): the room's name is still the page's heading for a screen reader. A page the rail can't name keeps a one-line title at 32 px after its way back: a list ("‹ Lists  Groceries"), Saved Meals ("‹ Meals  Saved Meals"), Stars & Rewards ("‹ Tasks  Stars & Rewards"). What used to be a second line moved into the page that needs it ("4 to get" over a list's items, "8 photos" over the grid) or went (the Meals week's span: its rows carry their dates). At the far right, the same in every room and 12 px apart: the Today panel's button and the live-updates icon, only while it has something to say: reconnecting, checking every 30 seconds, or offline; connected shows nothing and the corner is clear (ADR 0030). From 104rem of its own width (1920 px at Standard and Small) it is one row, exactly 80 px tall whatever the room puts in it, so its rule meets the one under the rail's mark; narrower (Large, Extra large, a laptop, portrait) the room's part takes a second row and the end of the first row stays where it was. A row that still can't hold everything wraps rather than clips. Nothing in the header animates in.

**The Calendar's part of the header** (ADR 0030). After the rule: the arrows around **This Week** (the calendar week, or the window around today with Rolling week on; or Today, This Month), then, on the Week view only, its layout as two icons, **Agenda · Hours**, beside the arrows because it changes the same board they page. At the right: **Filter**, then the view switch: four icons (Week · Day · Month · People) with the chosen view's word beside its icon, or, under 64rem of header (portrait at Large and Extra large, a small laptop), one **View** button that says the current view ("View: Week") and opens the four as a menu. Either way the current view is written out. No month, no year and no span: the day heads carry the dates, the Month view writes its month over its weekdays and the Day view its day over its timeline (§4). While a chip is being dragged a quiet pill in the header reads "Drop on a day". At 1920 px Standard with the rail whole and the Today panel open, the worst case (Wed, Sep 30, 12:30 PM, the Week view, four people filtered, a temperature of two digits) is still one row, with about 4 px to spare (measured for ADR 0033; 0.10.0's header was 8 px over in that case, though about 58 px had been measured for 0.9.0); with the live icon showing as well, or an old forecast's "as of 9:10 AM" in the weather's pill, the room's part wraps.

**Filter** is one button for whose events the board shows, with room for other kinds of filter later: a funnel icon; the word "Filter" beside it only where the header has 112rem of its own width (the rail folded or the panel hidden: at 1920 px Standard with both open there's no room); and, while people are chosen, their small avatars after the icon (three at most, then "+2") and a darker border, so a filtered board never looks like an empty week. It is named "Filter: Mia, Leo" then. It opens a menu under itself: **Everyone**, then each person in the household's order with a check; several at once. Choosing a person keeps the menu open for the next; it closes on Everyone (which clears the filter), Escape, the button, or a tap anywhere else, and that tap does nothing else: a tap on the board never also opens Add. Chips of people who aren't chosen fade and keep their words; Everyone's events always show. The filter clears after 2 minutes idle. Not on the People and Today views, which don't filter, and not in a household of one.

**Above the board's days** there is nothing but the plugins' quiet pills ("Google hasn't answered since 9:10 AM"), and no row at all until one has something to say. The "Show" row of avatars and the Week's tools left it in 0.9.0: the people went to Filter, the layout to the header, and the zoom onto the Hours grid.

**The rail** (ADR 0029, 0030), top to bottom: the Sunroom mark alone (48 px, no word beside it; it still says "Sunroom" to a screen reader), centred like the rooms' icons in a block as tall as the header with the same rule under it, so the rail's rule and the header's meet; the rooms in the household's order (36 px icon, 20 px label, 96 px tall each; at most six, the rest fold into More); a flexible gap; **Add** (a 64 px circle with a plus, "Add" under it); and **Settings** as one 56 px row with a rule above it, the gear and the word side by side, which lines up with the tips strip when tips are on. The gear is a padlock while Settings are locked behind the PIN on a paired screen (with a grant open the word reads "Unlocked"; a parent's laptop, and a household with no PIN, always see the gear). The clock and the weather left the rail for the header in 0.8.0, and **Hide the rail** followed them in 0.9.0.

**The mini rail.** Hide the rail (in the header) folds it to its icons, 72 px wide: the mark, each room's icon, a 56 px Add circle (the size of a room's icon cell, not the full rail's 64) and the gear, every one still named for a screen reader: the words stay in the page with no height, so a room keeps its name. It is never fully hidden, unlike the Today panel: the rooms stay one tap away. The board and the header take the room, and the toasts follow. On this screen it lasts until someone opens it again, idle minutes and all, like the Today panel's button; Settings → Display → **Compact rail** folds it on every screen, and a change of that setting wins over what a screen chose for itself (ADR 0031). The width eases, the rooms' height with it, and the words fade (§9). Portrait's bottom bar is always whole.

**The Today panel**, top to bottom, each section only with content and its plugin on: **Now** (an event in progress, "until 5:00 PM"), **Up Next** (time at 24 px, title at 40, person and location at 20), **Later Today**, **Tomorrow** (only after 6 PM), **Tasks Today** (a line per person with a small progress ring), **Tonight**, **To Do** (list items due today), **Coming Up** (the three nearest: every countdown the family added, however far out, and a birthday only within Settings → Features → Countdowns → **Birthdays in Coming Up**, a month by default; ADR 0032). Tapping any line opens its thing. It shows beside every room, Settings included, until its button in the header hides it on this screen.

**Tips** (ADR 0028): with Settings → Display → Show tips on (on by default since 0.12.0, ADR 0034; it was off until someone turned it on), a 56 px strip runs along the bottom of the board, between the rail and the Today panel (above the bottom bar in portrait): a lightbulb, one thing Sunroom can do on one line, and **Next tip** at the right. A new tip comes every half hour and on Next tip, never the same twice in a row, and only about rooms that are on. The board gives it the room (Hours with no zoom still fits), and toasts rise above it. The wall and laptops show it; phones never do.

**Layout options compared.** Three boards were drawn: **A**, week columns plus the Today panel (above); **B**, a Today hero (today's events at glance size, tasks, Tonight, the nearest countdown) with a week strip of day rows and dots; **C**, People (a column per person, Everyone first, for today or this week).

| | A: Week + Today panel | B: Today hero + strip | C: People |
|---|---|---|---|
| Glance at 3 m | Good: Up Next and today's lit column are glance-sized | Best: every line of today is glance-sized | Fair: today per person reads; nothing beyond today |
| Editing ease | Best: tap a day to add on it; drag chips across days | Fair: only today is in reach | Fair: no day targets |
| Density with 6 calendars | Good: 9–12 chips a day before "+N more"; filters and per-calendar "show on this screen" | Poor beyond today | Good for today; cramped with 5+ people in week mode |
| Portrait | Days become rows, the panel becomes the top band | Natural | Columns fall under 180 px with 6 people |
| Who it suits | Most households | Small households, grandparents, a hallway screen | Big households; children who want to see "mine" |

**Decision:** A is the default board; B is the **Today** view (selectable, and the default on screens narrower than 1280 px); C is **People**; Month is the fourth view. The Today panel can be hidden per screen.

**Portrait (1080×1920).** The header runs across the top, in two rows: today (and the live-updates icon while something's wrong), then the room's controls (for the Calendar: the arrows, Agenda · Hours, Filter and the views). Under it the Today panel is a band (24rem, about 384 px, so it grows with the text size) with its blocks in three columns: Now, Up Next, Later Today and Tomorrow in the first; the plugins' blocks flowing through the other two (Tasks Today, Tonight on one line, To Do without its detail line, the next countdown). The rail becomes a 112 px bottom bar; the week shows **days as rows** (seven 150 px columns would truncate every title): the same two-line chips, 224 px wide, four per line, two lines per row before "+N more" (all-day chips first, then the timed ones, sharing the lines, so a dinner never pushes the day's events off its row; "+N more" only as wide as its words); today's row is lit and the now line is a vertical divider that moves right as events end. Orientation is detected from the viewport and can be forced in Settings → Display. Panels become bottom sheets at two-thirds height; the keyboard's dock is full width.

```
+------------------------------------------------------------------+
| Tue, Oct 7  9:41 AM  (☼ 64° ⌄)                                   |
| [<] [This Week] [>] [☰][⏱]            [⛛] [▦ Week] [1] [▤] [☺]  |
|------------------------------------------------------------------|
| Up Next                  | Later Today            | Tasks Today   |
| 4:00 PM                  | 6:30 PM  Dinner at     | (M) Mia 2 of 3|
| Soccer practice          |          Grandma's     | (L) Leo done  |
| (M) Mia · Field 3        | 7:30 PM  Leo's bedtime |---------------|
|                          |          routine       | Tonight       |
|                          |                        | Tacos · Sam   |
|------------------------------------------------------------------|
| Sun 5  | [Columbus   ] [10:00 AM  ] [2:00 PM   ]                 |
|        | [Day   (All)] [Church    ] [Grandma   ]                 |
|--------+---------------------------------------------------------|
| Mon 6  | [8:00 AM   ] [4:00 PM   ] [6:30 PM   ]                  |
|        | [Dentist(S)] [Piano  (L)] [Book club(A)]                |
|--------+---------------------------------------------------------|
| TUE 7  | [Pajama    ] [8:00 AM   ] ┊ [4:00 PM   ] [6:30 PM   ]   |
| today  | [day    (L)] [School  (A)]┊ [Soccer  (M)] [Dinner   ]   |
|        | [7:30 PM Bedtime routine (L)]   now 9:41                |
|--------+---------------------------------------------------------|
| Wed 8  | [9:00 AM Vet (A)]                                       |
|  …     |                                                         |
|------------------------------------------------------------------|
|  [cal]      [list]     [check]     [meal]     [photo]   (+)  [gear]
|  Calendar   Lists      Tasks       Meals      Photos    Add      |
+------------------------------------------------------------------+
```

**The phone shell.** A bottom tab bar with five slots: Today, Calendar, then enabled rooms in the household's rail order until four slots are used, then More (always last; holds the rest plus Settings, Who's Using This, Pair a Display, Install the App, About). Sheets rise from the bottom for editing and choices, close with a visible Done, Cancel or Save (swiping down is a shortcut), take focus on open and return it on close. Primary actions sit in the thumb zone. **Laptops** (1024 px and up) get the display shell with a physical keyboard and no on-screen keyboard; hover adds nothing; arrow keys work on the board.

**What each plugin contributes.**

| Plugin | Rail room / phone tab | Today panel | Board | Settings page |
|---|---|---|---|---|
| Calendar (core) | Calendar | Now, Up Next, Later Today, Tomorrow | Week, Day, Month, People, Today | Household |
| Synced Calendars | — | — | Their events, colored by the assigned person | Calendars & Accounts |
| Lists | Lists | To Do (items due today) | — | — |
| Tasks | Tasks | Tasks Today; routine prompts in their window | — | Tasks (stars, rewards, routines) |
| Meals | Meals | Tonight | An all-day overlay chip if enabled | Meals (which slots) |
| Countdowns | Countdowns | Coming Up | A quiet day marker | — |
| Photos & Screensaver | Photos | — | The screensaver | Photos & Screensaver |
| Weather | the header's block, by the clock | — | The screensaver corner; day-header icons | Household → Location |

## 4. Display screens

**Welcome and Pair this screen.** Before the household exists, the display shows a QR code and the address, because setup happens on a phone: "Set up Sunroom on your phone. Open sunroom.local or http://192.168.1.20. Then come back here: this screen will show a code to pair it." Once a password exists:

```
+-------------------------------------------------------------------------------------------------+
|                                        [sun mark]  Sunroom                                      |
|                                    Pair this screen                                             |
|                                   7 K 4 M 9 X          (160 px, spaced)                         |
|  On a signed-in device, open Pair a Display (More on a phone, Settings → Devices) and type it.  |
|                           The code changes every 10 minutes.                                    |
|                                 Type the household password here instead                        |
+-------------------------------------------------------------------------------------------------+
```

The code is six characters from the no-look-alike alphabet, rotates every 10 minutes, and pairs once. "Type the household password here instead" swaps the code for one masked field with show/hide and the keyboard; the field clears after 60 s idle. After pairing: "Name this screen" with chips (Kitchen, Hallway, Living room, Office, Other) → **Done** → the week board. The screen never asks again unless unpaired.

**Week board** (drawn above). Chips show the start time (secondary) with the person's avatar at the right, then the title (body, at most two lines). All-day events sit in a band at the top of each column; multi-day events repeat in each day with "→" after the title on all but the last. One person: a 12% tint of their color with a 6 px bar at the left; several people: a neutral tint with up to three avatars; Everyone: neutral; in progress: solid fill with white text; past (today): no tint, ink-soft text. The now line is a 2 px line across today's column with "now 9:41" at its left end under the last finished chip; it drops to the next slot in 400 ms when an event ends; other columns have no line. "+3 more" appears as the last row when chips don't fit and opens the Day view. Tap a chip → the event sheet; tap empty space in a column → the editor with that day set; long-press a chip → drag to another day; swipe horizontally → previous or next week. Filters show the chosen people's chips plus Everyone's and fade the rest to 30% so the week's shape stays. Weekend first or last follows Household → Week starts on. With Settings → Display → **Rolling week** on (ADR 0033), the Week view shows yesterday, today and the five days after instead, so today keeps the second column whatever the weekday; the arrows still page seven days, This Week and the idle return come back to the window around today, and the title stays This Week there; at midnight the days move one column left. Only the Week view rolls: Month, People, Today, the Meals and Tasks weeks, a phone's week strip and Add's Day strip keep the calendar week, and "next week" in Add means the calendar's. A person's birthday from Family is an all-day chip in their color with a cake before the title ("Mia's birthday"), whatever features are on; it can't be moved, and a tap opens its sheet, which says "From Mia's birthday in Settings → Family."

**Week board, Hours layout** (Settings → Display → Week layout, or the two icons beside the header's arrows; ADR 0028, ADR 0029 for the zoom, ADR 0030 for where its buttons are). The zoom's three buttons, **Fit the day · Zoom out · Zoom in** (the whole day first, ADR 0032), sit in a row on the grid's bottom corner like a map's, outside the scroller so they stay put while the hours scroll under them; fitted, they cover the last column's last two hours and nothing else. Each day is a column from midnight to midnight: the hour gutter at the left (every other hour until an hour is 3rem tall, every hour from there, in the household's 12- or 24-hour clock), each day's head (its name, then up to three all-day chips and "+N more") staying on top while the hours scroll under it, and every timed event placed at its time and as tall as it lasts. With no zoom, the default, the whole day fits on the screen with nothing to scroll. **Zoom in** makes an hour half again as tall with each tap, as far as a 15-minute event filling a full chip (six taps at 1080p), where the button greys out; **Zoom out** steps back the same way, and **Fit the day** shows the whole day again (both grey while the day already fits). Zoomed in, the grid scrolls, with no scrollbar (ADR 0033: the kitchen screen's overlay bar flashed once a minute while a resting grid followed now; the hour cut off at the bottom edge, the hours under a finger and Fit the day say it scrolls), starting with now a third of the way down (7 AM on another week), and each step keeps the minute in the middle of the view where it was. The faint lines between the hours appear as it zooms: half hours from 6rem an hour, quarters from 12rem. On a laptop, ctrl + wheel (which is also what a trackpad pinch sends) zooms like the buttons; the buttons are the control, the wheel is a shortcut. The zoom stays through idle minutes (ADR 0031): from the board going back to now until the next touch, a zoomed grid keeps now a third of the way down, minute by minute. A chip's button is never shorter than a tap target, and a block as tall as the event inside it shows what fits: a time row and the title (two title lines when tall), the title and time on one row, the title alone in a caption, or only its tint; the time drops out of columns narrower than 10rem. Events that overlap share the column in lanes, at most three side by side and each at least a tap target wide (two at 1080p with the Today panel, three without it); when a group has more, the last lane says "+2" and opens the day. Past events today keep a faint block; the in-progress one is solid. The now line runs across today at the minute and creeps down as it passes (§9). A tap on an empty spot adds an event at that time, to the quarter hour; a long press lifts a chip to another day, keeping its time. Reduce Motion makes the now line step once a minute.

**Day view**, the only timeline. Its own day is written over it ("Wednesday, October 7", with a quiet "today" beside it: the one place a weekday is spelled out, and the header doesn't say which day). Every hour gets at least a thin band, every event a full chip, and empty stretches collapse into one "free until 4:00 PM" line, so the day never scrolls for nothing. The now line moves continuously through the bands and glides through an event while it is on.

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | header: today │ [<] [Today] [>]                  [⛛] [Week][▣ Day][Month][People] | Today panel   |
|          |----------------------------------------------------------------------------|                        |
|          | Tuesday, October 7  today                                                  |                        |
|          | all day  | [ Pajama day · Leo ]                                            |                        |
|          |  8 AM    | [ 8:00–8:30 AM   School drop-off · Ana ]              (dimmed)  |                        |
|          |  9 AM    |────────────────────── now 9:41 ─────────────────────────────── |                        |
|          |          |   free until 4:00 PM                                            |                        |
|          |  4 PM    | [ 4:00–5:00 PM   Soccer practice · Mia · Field 3 ]             |                        |
|          |  6 PM    | [ 6:30–8:00 PM   Dinner at Grandma's · Everyone ]              |                        |
|          |  7 PM    | [ 7:30 PM        Leo's bedtime routine        [Start] ]         |                        |
|          |          |   Tap a time to add                                             |                        |
+----------+----------+-----------------------------------------------------------------+------------------------+
```

Overlapping events sit side by side, each at least half the width; more than three overlapping become "+2 more". Tapping an hour band opens the editor with that day and hour set. Tasks are not on the timeline; they live in the Today panel and the Tasks room.

**Month view**: the month's name ("October 2026") over the weekday row, since the header doesn't say it and the cells are bare numbers; then cells with the day number (28 px, today's in a filled circle), up to three one-line entries at 20 px with a 4 px color bar and the person's initial, then "+N more"; a countdown's day shows a small star mark; the current week is lit a step and today two. A cell is one button that opens its Day view, where every event is a full chip: three tappable entries won't fit a cell at the wall's 56 px tap size (decided in M1).

**People**: one column per person, Everyone first, in household order; Today or This Week (rows per day inside each column, compact one-line chips). Each column: the avatar at 72 px with the name (glance-sized so a child finds their own column), today's events (or a **Free day** pill in the person's tint when there are none), that person's tasks with working checkboxes (the same celebration as the Tasks room), then "Cooks tonight" if set. Up to seven columns fit; an eighth pages horizontally.

**Event sheet** (a 640 px side panel from the right in landscape, over the Today panel; a bottom sheet in portrait):

```
+-----------------------------------------+
| Soccer practice                 [Close] |
| Thu, Oct 9 · 4:00–5:00 PM               |
| Every week on Thu                       |
| (M) Mia                                 |
| Field 3                                 |
| Home calendar                           |
| Bring shin guards.                      |
| [ Change ]  [ Move ]  [ Remove ]  [ Add a countdown ] |
+-----------------------------------------+
```

**Change** opens the editor filled in; **Move** opens a day picker (the next 14 days as chips plus a month grid) and asks "Move Which?" for a repeating event; **Remove** removes with Undo and asks "Remove Which?" for a repeating event. A read-only synced event shows the source line in place of the buttons: "From Apple · Work. Change it in the Calendar app." A writable synced event behaves like a Home event and says "Google · Family" quietly. With Child-safe editing on, Change and Remove on the display ask for the parent PIN; Move does not.

**Add and the event editor** (ADR 0029, reshaped by ADR 0030). **Add** (the rail's plus) opens the Add panel with the kind that fits the current room chosen and the first field focused; tapping empty space on a day column, an hour band or a month cell opens it with Event chosen and that date set. The board stays visible and accepts one kind of tap while the panel is open: a day, to set the date, whatever kind of thing is being added (the panel keeps its kind and its title).

```
+----------+----------------------------------------------+------------------------------------------+
| rail     | header                                       | Add                              [Close] |
|          |----------------------------------------------| [▦ Event][☰ Item][☑ Task][🍴 Meal][⌛ Countdown]
|          | board, lit; tap a day to set the date        | What, when, who                          |
|          |  Sun 5 | Mon 6 | TUE 7 | Wed 8 | Thu 9 | …   | [ Dentist Thu 2:30pm Mia              ] |
|          |        |       |       |       | ▲ set |     | Saved as "Dentist"                       |
|          |        |       |       |       |       |     | Who                                      |
|          |        |       |       |       |       |     | (All)  (A)   (S)   (M)   (L)             |
|          |        |       |       |       |       |     |                                          |
|          |        |       |       |       |       |     | When                                     |
|          |        |       |       |       |       |     | Day                            Oct 5–11  |
|          |        |       |       |       |       |     | [Sun][Mon][Tue][Wed][THU][Fri][Sat]      |
|          |        |       |       |       |       |     | [<] [Today] [>] [Pick a date ▾]          |
|          |        |       |       |       |       |     | Time            [All day] [ 2:30 PM ▾ ]  |
|          |        |       |       |       |       |     | How long                   [ 1 hour ▾ ]  |
|          |        |       |       |       |       |     | Repeats     [ Every week on Thu ▾ ]      |
|          |        |       |       |       |       |     |                                          |
|          |        |       |       |       |       |     | Details                                  |
|          |        |       |       |       |       |     | Calendar                     [ Home ▾ ]  |
|          |        |       |       |       |       |     | Color   (☺)(●)(●)(●)(●)(●)(●)(●)(●)      |
|          |        |       |       |       |       |     | [More… ▾]                                |
|          |        |       |       |       |       |     | [              Add event              ] |
|----------+----------------------------------------------+------------------------------------------|
|                                    |  q   w   e   r   t   y   u   i   o   p                        |
|                                    |  123        space              ↵                              |
+------------------------------------+---------------------------------------------------------------+
```

**The kinds of thing to add** are one row at the top of the panel: Event, then Item, Task, Meal and Countdown for the features that are on, each cell the room's own icon over its word, the chosen one filled. Always one row: on a phone, where five cells don't fit, the row scrolls sideways with a fade at its edge. Each kind has its own form below, built the same way (ADR 0030): **three parts, 32 px apart**. The first, what and who, starts with the form's main field and has no heading; then **When** and **Details**, each under its own heading, their rows 16 px apart. A row's label is quiet (20 px, soft ink; 14 px on a phone), so it reads as a label and not as one more chip. A question with a handful of answers that fit one line stays a row of chips (Who, the Day strip, Which list, Stars); a question with more is a **value row**: the label at the left and what's chosen on one button at the right ("2:30 PM", "1 hour", "Every week on Thu"), which opens its picker in place under the row. So nothing hides behind a chip that looks like a choice: the answer is on the row's face. A chip that opens something (Pick a date, More…, Another day) is outlined with a chevron and never filled. Switching kinds puts the panel back at its top. The primary button is pinned at the bottom of the panel, above the keyboard.

**The event form**, top to bottom:

- **What, when, who** (the quick-add field; "Title" when changing an event). It parses as you type, locally (chrono-node plus a small grammar for people and repeats): the title; a day word (today, tomorrow, Mon…Sun, "next Tue", "Oct 9", "9/10" by locale); a time ("2:30pm", "14:30", "noon", "2-3pm" sets both); a length ("for 2h", "30 min"); a person's name or nickname; a repeat word ("every Tue", "daily", "weekdays", "monthly"); "all day". What it understands fills the rows below, and the line under the field says what's left as the title: `Saved as "Dentist"`. Nothing parsed means a title-only draft on the chosen day. The words the parser used stay in the field. **A row set by hand keeps winning over later typing**; anything the parser filled is one tap to change.
- **Who**: the Who picker, several at once.
- **Day**: the week as seven cells in the household's order (Sunday or Monday first), the weekday's name over the day's number, today's on a sun disc; under it **Previous week**, **Today**, **Next week** and **Pick a date**, which opens a month grid in place (Previous and Next month; cells 56 px on the wall, 44 on phones). The strip follows the chosen day when it leaves the week on show. Neither the wall nor a phone ever meets the native date input: one look, one set of names (a strip cell is "Thu, Oct 8", a grid cell "October 8"), and nothing the kitchen screen can't work without a keyboard. For an all-day event a small **Last day** row follows: Same day, or Another day from a month grid.
- **Time**, one row: the **All day** chip, and one button that says the time ("2:30 PM", or "Pick a time" while it's all day). The button opens the hours (6 AM to 11 PM in four columns, with **Earlier hours**) and the minutes (:00 :15 :30 :45) in place, and **Done** closes them: any time in two taps. The row of likely times (9:00 AM, 12:00 PM…) is gone: the owner read four filled chips for one time.
- **How long** (not for all day), one row: a button that says the length and opens the usual ones as a list (30 min, 1 hour, 1½ hours, 2 hours, 3 hours), then **Other**, a stepper in quarter hours. A length that isn't one of the usual ones (45 minutes typed into the field) shows on the button as it is.
- **Repeats**, one row: a button that says the rule in words ("Doesn't repeat", "Every week on Thu", "Every day, 9 times") and opens the choices as a list, a row each with a check on the chosen one: Doesn't repeat, Every day, Every weekday, Every week on Thu, Every 2 weeks on Thu, Every month on the 9th, Every month on the second Thursday, Every year on Oct 9, and **Custom…** last, which opens under the list: every N (a stepper, no typing) days, weeks, months or years; for weeks, the seven weekdays in the household's order, any number of them; for months, "On the 9th" or "On the second Thursday". Whenever it repeats, **Ends** is under that: Never, On a date (a month grid), After N times (a stepper). **Done** closes it; Doesn't repeat closes it by itself. A rule from another calendar that these shapes can't hold is the list's first row, **As it is: every month on the 15th**, and is left exactly as it was until another choice is made.
- **Calendar**, only with two or more that can be written to (read-only ones don't appear): a value row with the calendars as a list, the household's own first, then an account's, named after it ("Apple · Family"). It starts on the Default calendar (Settings → Calendars & Accounts).
- **Color**: a row of dots, the person's own color first (a small figure in a ring), then the twelve, each a tap-sized cell named by its word for a screen reader; the chosen one is ringed. No words on the row; in the wall's panel the thirteen cells take two lines (dots aren't chips, ADR 0034). Picking the person's color again clears a color the event had.
- **More…** (an opener): Where, Notes, and **Remind**, a value row (None, 10 min before, 1 hour before, 1 day before; "A reminder shows on paired screens."); open already when changing an event that has any of them.
- **Add Event** (or **Save Changes**), pinned. ↵ in the field is the same as the button. After saving, the panel closes (exit), the new chip eases in, and the toast offers Undo.

A picker that opens low in the panel scrolls into view, so it never appears under the pinned button. The panel opens at its top every time.

**The other forms**, in the same three parts. **Item**: What (commas make several: "Milk, eggs, bread" adds three), Which list (chips; the open list first), Who (one person, optional); When: Day with **No day** first. **Task**: What; Who, where the first cell is **Anyone** and several people can be picked, with "Each does it" or "They take turns" once there are two; When: Day (the day it starts), Due (the **Any time** chip and one button, "by 5:00 PM", with the same hours and minutes as an event's Time), Repeats (the simple presets and Custom…; a new task repeats every day until told otherwise); Details: Stars (0–5 as chips, if stars are on). **Meal**: one field, **What's cooking**: what's typed is the meal's name and, at the same time, the search of the saved meals, which sit under the field as one row of chips (most made first; narrowing as you type; the row scrolls sideways). Tapping one fills the field and keeps its emoji, recipe and ingredients, and so does typing a saved meal's name in full; changing the words lets go of it. With no saved meals yet the row reads "Meals you add are kept here for next time." Then Who cooks, where the first cell is **Anyone**; When: Day, on the week the board shows, and Which meal (when the household plans more than dinner); Details: "Add 5 items to Groceries" as a switch, for a saved meal with ingredients. Opened from a day's cell in the Meals room the day and the meal are already decided, so they are value rows ("Day · Sat, Oct 10") that open their pickers only when tapped. **Countdown**: what it counts down to, Whose; When: Day, with the month grid open from the start (it is rarely this week); Details: an emoji from one scrolling row, a color as a row of dots, Every year, Show it on paired screens. An item's own sheet picks its day with the same Day strip, and a routine's **Starts** and **Shows for** are the same time and length pickers. The primary button says **Add Item** / **Add Task** / **Add Dinner** / **Add Countdown** (or **Save Changes**).

**Lists room**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | header: today │                                             [+ New list]   | Today panel            |
|          |----------------------------------------------------------------------------|                        |
|          | +-------------------------------+  +-------------------------------+        |                        |
|          | | Groceries                     |  | To do                         |        |                        |
|          | | 12 to get                     |  | 4 to do · 1 for today         |        |                        |
|          | | Mia added Milk · 2:10 PM      |  | Sam added Call plumber · Mon  |        |                        |
|          | +-------------------------------+  +-------------------------------+        |                        |
|          | +-------------------------------+  +-------------------------------+        |                        |
|          | | Packing: beach                |  | Costco                        |        |                        |
|          | | 9 to pack                     |  | All done                      |        |                        |
|          | +-------------------------------+  +-------------------------------+        |                        |
+----------+----------------------------------------------------------------------------+------------------------+
```

Tiles 400 × 160 px, two or three across: the name at title size, the count at body, the last change at secondary. **New List** is one field, **Name**, with the usual names (Groceries, To do, Packing, Costco, Pharmacy) as chips under it that fill the field; **Add List** makes it and opens it. **Change List**, among a list's buttons in the header, renames or removes it (removing confirms when the list has items; otherwise Undo); a long press on a tile (500 ms, held still) is a shortcut to it, and its release doesn't open the list.

**List detail**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | header: today │ [< Lists]  Groceries          [Clear done] [Change list]    | Today panel            |
|          |----------------------------------------------------------------------------|                        |
|          | 12 to get                                                                  |                        |
|          | [ ]  Milk                                             Added by Mia          |                        |
|          | [ ]  Eggs                                                                   |                        |
|          | [ ]  Shin guards                                      (M) Mia · Thu         |                        |
|          | [✓]  Bread  (struck, dimmed)                          Checked off by Ana    |                        |
|          |   … 7 more done                                                             |                        |
|          |----------------------------------------------------------------------------|                        |
|          | Usuals: [Milk] [Eggs] [Bread] [Bananas] [Apples] [Yogurt]                   |                        |
|          | [ Add to Groceries                                     ] (All) [ Add ]      |                        |
+----------+----------------------------------------------------------------------------+------------------------+
```

Rows 72 px; a 64 px checkbox at the left in a 96 px tap column; the name at body size; who added it, a person and a day at secondary size on the right. Checking draws the marker line in the checker's color (Dinner Bell's strike), then the row folds into the collapsed Done group after 600 ms; toast "Checked off Milk" with Undo. On the display the checker is Everyone unless an avatar was tapped first (the add row's avatar chip doubles as "who is checking" and resets to Everyone after 2 minutes idle). **Clear Done** removes all checked items with Undo. The add row sits at the bottom; focusing it raises the keyboard with the Usuals strip still visible; **Add** saves and keeps focus for the next item. Tapping a row's text opens a small sheet: Rename, Who, Day, Remove. An item with a day shows in the Today panel on that day.

**Tasks room**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | header: today │ [Today] [This Week]                      [Stars & Rewards]  | Today panel            |
|          |----------------------------------------------------------------------------|                        |
|          | (M) Mia  2 of 3   ★ 42  | (L) Leo  1 of 1   ★ 18  | (S) Sam  0 of 1  | Anyone 0 of 2  |            |
|          |-------------------------|-------------------------|------------------|----------------|            |
|          | [ ] Feed the dog        | All done, Leo!          | [ ] Take out the | [ ] Empty the  |            |
|          |     by 5:00 PM · ★2     |                         |     trash        |     dishwasher |            |
|          |                         | Done                    |     by 8:00 PM   |     Mia's turn |            |
|          | Done                    | [✓] Make bed            |                  |     ★1         |            |
|          | [✓] Make bed            |     Done by Leo · 7:50  |                  | [ ] Water the  |            |
|          |     Done by Mia · 7:42  |                         |                  |     plants ★1  |            |
|          |                         | Bedtime routine 7:30 PM |                  |                |            |
|          |                         | [ Start ]               |                  |                |            |
+----------+----------------------------------------------------------------------------+------------------------+
```

One column per person with tasks today, plus **Anyone** last; the header is glance-sized (avatar, name, "2 of 3", the star balance if stars are on); empty columns read "Nothing today". A task row: a 64 px box, the title at body size, due time, stars and "Mia's turn" at secondary. Done rows move under a Done heading in the same column and keep their stamp; they are not hidden, because seeing them is the reward. Completing an assigned task is one tap; an Anyone task pops "Who did it?" beside the box. Undo on the toast reverses the stamp and the stars; tapping a done box again un-does it ("Not done yet"). **This Week** shows seven compact rows per column (day, count, a check or a dash), the fridge-chart feel. Routines appear at the bottom of their child's column during their window with **Start**. Editing: tap the title → Change, Skip today (with Undo), Remove.

**Stars & Rewards** (when enabled): a balances strip per child ("★ 42 · +12 this week · 6 days in a row"), reward tiles (title, cost, **Ask for It**), and an **Asked** list with **Approve** (PIN on the display) and **Not Now**. Ask for it opens the children-only Who picker; a reward costing more than the balance says "Mia has 18 of 30 stars" under a disabled button. Streaks reset quietly to "0 days in a row". Settings → Tasks sets stars per task, adds rewards, and turns stars, rewards or routines off, which hides every star glyph.

**Routine runner** (full screen; the rail and panel hide)

```
+-------------------------------------------------------------------------------------------------+
| Leo's bedtime routine                               Step 2 of 5                         [Stop]  |
|                                      [ toothbrush icon, 240 px ]                                |
|                                           Brush teeth                                           |
|                                          ●  ●  ○  ○  ○                                          |
|                        [                      Done                      ]                       |
|                                          Skip this one                                          |
+-------------------------------------------------------------------------------------------------+
```

The step title is 64 px; the icon comes from the step library (toothbrush, bed, book, shirt, backpack, sun, moon, bath, plate, dog…) chosen when the routine is made, so a pre-reader can follow. **Done** (120 px tall, 60% wide, in the child's color) stamps and bursts, and the next step slides in from the right; skipped steps show hollow dots. The last Done shows "All done, Leo! Night night." for 6 s with the full-screen burst and "+5 stars" if the routine gives stars, then returns to Tasks. **Stop** asks nothing; checked steps are kept for the day, so the column offers **Continue** while the routine's window is open.

**Meals room**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | header: today │ [<] [This Week] [>]            [Copy last week] [Saved Meals] | Today panel          |
|          |----------------------------------------------------------------------------|                        |
|          |          | Dinner                                            | Who cooks     |                        |
|          | Sun 5    | Roast chicken                                     | (A) Ana       |                        |
|          | Mon 6    | Pasta night                                       |               |                        |
|          | Tue 7    | Tacos                                             | (S) Sam       |  (lit row)             |
|          | Wed 8    | [ + Add dinner ]                                  |               |                        |
|          | Thu 9    | Leftovers                                         |               |                        |
+----------+----------------------------------------------------------------------------+------------------------+
```

Rows are days (120 px), columns are the meals the family plans (Dinner only by default; Settings → Meals, where each planned meal also has a switch to show it on the calendar); today's row is lit; a cell shows the meal name (with its emoji) at body size and who cooks, in their color. Its part of the header has the week's arrows, This Week, **Copy Last Week** (Undo) and **Saved Meals**. Tapping a filled cell: Change, Swap days (the week's other days as chips; whatever was there takes its place), Add ingredients to Groceries (when the saved meal has ingredients and Lists is on), Remove (Undo). **Saved Meals** is the library: every meal the family has typed, most made first, as tiles with the name, "Made 6 times", its ingredients and recipe link; New saved meal; a tile opens its name, its emoji (picked from a row of foods, with None first: the wall's keyboard has no emoji to type), recipe link, ingredients (with commas) and Archive, with **Save Changes** pinned under them. The add panel is one field, "What's cooking", with the saved meals as one row of chips under it (most made first, narrowing as you type), then Who cooks, Day, Which meal (when there's more than dinner), and "Add 5 items to Groceries" as a switch (§4 "The other forms"). A countdown's photo and a saved meal's photo wait for a later milestone (ADR 0026).

**Countdowns room**: tiles 400 × 280 px sorted by date, the number at 72 px ("12 days", "Tomorrow", "Today!"), the emoji and name, the date (and "Turns 9" for a child's birthday), and the person, in their color. Birthdays come from Family by themselves (Settings → Features can turn that off). A tile opens Change and Remove; a birthday's says it comes from Family. Add countdown asks what it counts down to, the day, whose, an emoji, a color, **Every year**, and **Show it on paired screens** (off for a surprise: only signed-in devices show it; its tile says "Hidden from paired screens."). Past countdowns leave the next day into Recently Removed. On the day, the Today panel reads "Today: Mia's birthday!" and the first touch of the day plays the big celebration once.

**Photos room**: "124 photos" over the grid (how many the screensaver shows), and in the header **Start Screensaver**, **Settings** (the screensaver part of Display settings, behind the PIN: start after 5, 15 or 30 minutes, an hour or Never; change photo every 15 s, 30 s, 1, 2 or 5 min; show the clock and next event; shuffle; sources). On a paired screen, a line "Add photos from a device: open Sunroom there, then Photos." with a QR (a screen has no files); on a signed-in device, **Add Photos** among the room's buttons in the header instead (several at once, from its files; ADR 0028). Then a grid of 200 px thumbnails, newest first. Tapping one opens it full screen with Previous, Next and Hide from screensaver; the display can hide photos but never deletes them (phones delete, with Undo).

**Screensaver**

```
+-------------------------------------------------------------------------------------------------+
|                                   [ photo, fit to screen ]                                      |
|                                                                                                 |
|  9:41                                                                   Up Next                 |
|  Tuesday, Oct 7 · ☼ 64°                                                 4:00 PM Soccer practice |
|                                                                         Mia                     |
+-------------------------------------------------------------------------------------------------+
```

The photo fits inside the screen (never cropped; the letterbox takes the wall's current tint). The clock (200 px, weight 700) and date sit bottom-left on a quiet gradient band; Up Next bottom-right at glance size; the band is the only thing over the photo. Any tap wakes to where the display was; the waking tap does nothing else. With no photos: the tint, the clock and Up Next, never a stock image.

**Night** (from Settings → Display → Sleep: from, to, and **Dim clock** or **Screen off**): Dim clock is a black screen with the clock at 200 px in a 35% ink-soft and tomorrow's first event under it, and the Pi's helper turns the panel down to 20%; Screen off is fully black, and the helper switches the screen itself off (PLAN §13.5). A tap wakes it for 2 minutes in the dark theme, at full brightness; routines and tasks still work in those minutes. **Dim in the evening** (only with sleep times): from its time until sleep starts the screen is less bright: **Brightness** 60%, 40% or 20%. The helper turns the panel down where it can (DDC/CI, or a backlight); anywhere else the page draws a dark veil over itself, so the two never both dim.

**Parent PIN** (a centred dialog whenever the display needs a parent): four to six dots, a 3 × 4 keypad with 80 px keys, Cancel, and the line "Forgot it? A parent can change it on a signed-in device under Settings → Family." The dialog accepts as soon as the right length matches; a wrong PIN shakes the dots once and says "That PIN didn't match. Try again."; five wrong in a row: "Too many tries. Wait 1 minute." with a countdown. A correct PIN opens Settings for 10 minutes of activity (the rail's padlock becomes the gear, with "Unlocked" under it; **Lock**, Settings' own button in the header, ends it; the grant locks after 2 minutes idle, and the page leaves with Return to the calendar after, or stays with Never: ADR 0034; on the wall the pad rises only after a touch, never by itself for a page left open). With no PIN set, the gear opens Settings directly and the Family page says "Set a parent PIN so children can't open Settings on paired screens."

**Settings (display)**: a list-and-detail layout under the header (which writes no title: the rail's gear is lit); the list of pages is 384 px wide, so every page's name is on one line ("Calendars & Accounts" wrapped at 320; ADR 0030); the Today panel stays beside it until its button hides it (the pages are capped at a reading width anyway; ADR 0029). Passwords and calendar addresses are typed here on the on-screen keyboard, masked, behind the PIN (ADR 0028); only what needs a file or Google's own page says "Do this from a device" with a QR code to that page, and a screen shows nothing else it can't do (§2 "Devices and screens").

| Page | Contents |
|---|---|
| Family | One row per person: avatar, name, role and color word, with a chevron. **The row is the button** (ADR 0029): a tap opens **Edit Mia** (Name; Parent or Child; Color, the twelve named colors each showing the initial, the ones nobody else has first and the taken ones after with whose they are, "Mia's"; Photo: **Add a Photo** on a signed-in device, and Remove photo (a paired screen shows the photo row only to remove one, with no line pointing elsewhere); **Save Changes**; **Remove Mia** confirms and offers to keep her history). **Add a person** in one row: the name, Parent or Child, **Add** (in a card narrower than 20rem, on the smallest phones, the name takes its own line with Parent or Child beside Add under it). **Parent PIN** (Set, Change, Remove; changing asks the old one). **Child-safe editing** on/off |
| Features | One group per feature with a switch and one line on what it adds: Synced Calendars, Lists, Tasks, Meals, Countdowns, Photos & Screensaver, Weather. Turning one off hides its room and panel at once; its data stays. A stopped feature shows "Retry". A feature with a Settings page of its own (Tasks, Meals, Photos & Screensaver) shows a row that opens it ("Tasks settings"), so its settings live in one place; the others keep their one or two settings here, saving as they change: Lists has **Clear completed items after** Never / 1 day / 3 days / 1 week, Weather has **Temperature unit** Auto / °F / °C (Auto: °F in the United States, °C elsewhere, going by the household's time zone), Countdowns has birthdays and **Birthdays in Coming Up** 1 week / 2 weeks / 1 month / 3 months / Any time (1 month by default: a countdown someone added always shows in Coming Up, while a birthday further out still shows on the board on its day and in the Countdowns room). Options read as short as they can ("15 min", "1 hour", "°F"), with Never first. Synced Calendars has nothing under its switch: Google's app keys are asked for where they're used, inside Sign in with Google (Calendars & Accounts, ADR 0030) |
| Calendars & Accounts | **Default calendar** first, where new events go: a value row whose list is every calendar that can be written to, the household's own and then an account's, named after it ("Apple · Family"). It saves as it's picked ("Saved"), and Add starts with it but can pick another (ADR 0032). **Calendars**: a row for each of the household's own (the Home calendar always), with its color dot, whose it is and "Default calendar" on that one ("Hidden on paired screens" when it is); a tap opens **Edit Kids' activities** (name, color with the free ones first, whose, Show on paired screens, Remove). Sunroom always keeps one calendar of its own, so the last one has no Remove, and neither has the default calendar: a line under Save Changes says why ("Sunroom keeps one calendar of its own, so this one stays."). **Accounts**: a row for each account with its name, its address, its status line ("Updated 9:10 AM" or the quiet error) and how many of its calendars are on the board; a tap opens its sheet, **Edit Apple**: the status and **Refresh Now** (an account that stopped working shows **Connect Again** for a new password or address, **Sign In Again** for Google's own page, or how to replace a helper's key); **Sync**, a switch for each calendar the account has, the ones that sync first and then by name (as they were when the sheet opened, so a row never moves under the finger that switched it; ADR 0032) ("Shows events only" for a read-only one), a synced one's name opening **Edit School** inside the sheet (Whose; Color when it's Everyone's, the free colors first; **Back to Apple**); **Show on Kitchen**, named after the paired screen ("Show on the Screens" with several, absent with none), a switch for each synced calendar; and **Remove Account**, which asks ("Remove Apple?" · **Remove Apple** · **Keep It**). Every switch and chip in the sheet saves as it changes. **Add an Account** opens the same steps as on a device (§6), typed on the on-screen keyboard, with "Or add it from a device" and a QR under the choices. Google's **Share with a Sunroom helper** (a key file) and **Sign in with Google** (Google's own page) say "From a device" and open a QR with "Do this from a device"; an account that Google signed out shows "Sign in again from a device:" and a QR code of Calendars & Accounts in place of **Sign In Again**. **Sign in with Google asks for the app's client ID and secret the first time, and keeps them** (ADR 0030): with none saved its step shows the two fields and **Save Keys and Continue**; with them saved, "Keys saved" with **Change Keys** (the ID to edit; the secret is never shown again) and **Remove Keys**, then **Sign in with Google**. The sheet of an account that signed in this way has **Google App Keys** under its status, with Change keys, so they can be replaced without starting the account over |
| Display | Theme Light / Dark / Auto (its hint says when Auto turns dark: "at sunset and light at sunrise" once the household has a location, "at 7 PM until a location is set in Household" before); Text size Small / Standard / Large / Extra large (previews live); Daylight tint on/off ("The background warms through the day: cool in the morning, golden in the afternoon, rosy at dusk. Off keeps the midday shade."); Rail side Left / Right; Compact rail (only the rooms' icons, for a wider board; anyone can open it back out from the header); Controls at the bottom; Today panel Show / Hide; Home view Week / Today / People (what the screen shows until someone picks another view); When it starts Where it left off / The home view (what the screen shows after a refresh, an update or a restart; it remembers by default, ADR 0030); Week layout Agenda / Hours (Agenda stacks each day's events; Hours draws them on a 24-hour grid); Rolling week (off by default: the Week view keeps today in the same column, showing yesterday, today and the five days after instead of the calendar week; ADR 0033); Show tips (on by default since 0.12.0, ADR 0034: one thing Sunroom can do under the board, a new one every half hour, not on phones); Return to the calendar after Never / 2 min / 5 min / 10 min ("How long Lists, Tasks, Settings and the other rooms stay open with nobody touching the screen. The board itself still comes back to today after 2 minutes."; Settings included since ADR 0034); Dim past events; Screensaver (as in Photos); Sleep (from, to, Dim clock / Screen off; Dim in the evening from a time, Brightness 60% / 40% / 20%); Sounds On / Off; Orientation Auto / Landscape / Portrait; Reduce motion |
| Tasks | **What Tasks Include** (stars, rewards, routines, a parent's check); **Rewards**; **Routines**; **Stars** (give or take stars to one or more children at once: −5, −1, +1, +5, +10 or **Custom…**, which opens Give or take and a stepper of 1 to 100, starting at the chosen amount; with a reason; the toast names everyone, "Gave Mia and Leo 5 stars"; ADR 0034) |
| Meals | **Which meals** the family plans, as chips (Dinner by default), then one switch for each of those: **Show breakfast on the calendar**, **Show dinner on the calendar**… (all off by default). A meal that's on shows as a chip at the top of its day on the board. The page has no heading of its own: its title already says Meals |
| Household | Name (saves when the field is left); Time zone (saves when picked); Week starts on Sunday / Monday; Time format 12-hour / 24-hour; Location, noted "Used for the weather, and for sunrise and sunset. Only your city goes to Open-Meteo, when you search for it and for the forecast; nothing else leaves." (ADR 0034) (**Set the City** or **Change** opens the field "Your city", which finds places as you type and lists them under itself; **Remove**) |
| Devices | (ADR 0032; it was Phones & Screens.) **Paired Screens** on top: this screen (name, Rename, **Unpair This Screen**) and the others (**Unpair**); **Pair a Display** (a sheet for the code a screen shows; on signed-in devices, never on the screen itself). With none paired: "No screen paired yet. Open Sunroom on the screen you want to pair and type its code here." Then **Signed-in Devices** (ADR 0034; it was Phones & Computers): every phone, tablet and computer, each with an icon for what it is (from the name it signed in with: "iPad, Safari" is a tablet, "Mac, Chrome" a computer) and "Used by Mia, last used today"; **Sign Out**, or **Sign Out of This Phone** (Tablet, Computer) on the device itself; with a parent PIN set, **Child's Device**; and **Add a Device** (a one-time code and QR for a phone or tablet, the address under it for a computer) |
| Recently Removed | A page of its own (ADR 0029): everything removed in the last 7 days (events, lists and items, tasks, meals, countdowns), each with what it was, when it went and **Put Back** |
| Backup | The nightly backups: the last backup time, a banner if older than 7 days, **Back Up Now**, and on a signed-in device **Download Backup** (the newest copy) and **Download Everything** (a zip with every photo, to restore from; restoring is a runbook step with the server stopped, docs/RESTORE.md); **Take Your Data with You**: **Export Everything** (one JSON file anyone can read), on a signed-in device. A paired screen shows nothing it can't do: the backups and Back Up Now, with no line saying to download elsewhere (ADR 0034). **Start Over** (a signed-in device only; a paired screen never shows it, since a child can reach it; ADR 0029): "Erase everything Sunroom knows and set it up again from the start." and **Erase Everything…**, which opens the sheet **Erase Everything?** in two steps. 1. "Keep a copy first?": "This removes every person, calendar, event, list, task, meal, countdown, photo and setting, and signs out every phone and screen. A copy of today's database stays on the server in backups/pre-erase, but photos are deleted for good." with **Download Everything** ("The download has started. Continue once it's saved.") and **I Have a Copy**. 2. The **Household password**, then **Erase Everything** or **Keep Everything**; a wrong one says "That password didn't match. Try again." Afterwards that device reloads onto the setup wizard, every other phone goes there too, and every wall shows its welcome screen again. What downloads a file, and Start Over, go by what the device is (a laptop has them), not by its size |
| Support Sunroom | (ADR 0034.) **Support Sunroom** 💛 (the heart hidden from screen readers): "Sunroom is free and open source, and not for profit: no ads, no accounts, no subscription. If it has earned a place on your wall, a donation helps it keep growing." Then the owner's links and addresses from `features/settings/support.ts`, each only when set: **Patreon** (a row that opens it in a new tab; on a paired screen its address and a QR code), and each donation address with a QR code and **Copy** (not on a screen). **Feedback**: "Found a problem, or have an idea? Feedback goes to Sunroom's page on GitHub, where everyone can see it. It needs a GitHub account; nothing from your calendar is sent." and **Send Feedback**, a sheet: What is it? (Something's wrong · An idea), In a few words, What happened, or what would help, "Sunroom 0.12.0 on Docker is added for you. Nothing else is.", then **Open GitHub** (GitHub's new-issue page with all of it filled in, in a new tab) and **Cancel**. On a paired screen, no box for the words: a QR code of the link with the title, "Scan this with your phone to finish on GitHub.", and **Done** |
| About | Version and build; **Updates** (**Check for updates daily**, off until a parent turns it on and greyed out when the server keeps it off; then the last check, "This is the latest version (checked at 9:10 AM).", or "Sunroom 0.6.1 is available." with how to update this install; **Check Now**); **Storage** (**Free space**, the photos folder); **Connection** (**Live updates** as the live-updates icon; **URL**, the address this device uses; **Recently reached at**); **The Small Print**: "Sunroom is open source, under the MIT licence.", "Your data stays on your server. No analytics, no ads, no outside scripts." and "Weather by Open-Meteo." (ADR 0034: "Not affiliated with Google or Apple" went; the author's line waits for the owner's word on the private-terms scan) |

**The Who picker** (shared; ADR 0029): avatar circles with names under them: **Everyone** (a house mark, neutral; **Anyone** for a task), then each member in household order (initial or photo in their color). Selected: an ink ring, the person's tint and the name in bold, with 8 px of room above the avatar and under the name on the wall, as at its sides (4 px all round on a phone's smaller cells; ADR 0034). **It is always one row.** The cells share the row's width: 64 px avatars while the people fit (Everyone and five people do in the wall's panel), 56 px for everyone once a seventh cell would need more room, and when even those don't fit the row scrolls sideways with a fade at its edge (48 and 40 px on phones, by the same rule). A name too long for its cell is cut with an ellipsis on screen only; a screen reader hears all of it. The one exception is "Who did it?" beside a task's box, in a narrow board column, where the picker wraps onto more lines rather than hide people off the side. Children-only pickers show only children.

**Toasts (display)**: bottom centre of the board, 72 px tall, body text, a 64 px Undo button, 8 s, two at most; a toast never covers the now line's label or the Today panel. **A toast stays where it was raised** (ADR 0032), on the wall and on phones: one raised on the page stays on the page when a sheet opens over it (under its backdrop, on its way out), and one raised while a sheet is open shows in the sheet, floating over the bottom of its body above its footer (or just above its pinned button, never over it) and taking no room, so the sheet never moves as a toast comes or goes; when the sheet closes, its toasts go back to the page.

## 5. Phone screens

Phones are the second screen: adding and editing on the go, connecting accounts (a key file or Google's own page needs a signed-in device, not a paired screen), and a personal Today. The shell is Dinner Bell's: a bottom tab bar (Today, Calendar, Lists, Tasks, More; plugin tabs appear only when enabled, five at most), sheets from the bottom, 16 px gutters, safe-area insets, primary actions in the thumb zone.

**Install the App, Sign in, Who's Using This?** are Dinner Bell's screens with Sunroom's words: the install guide first on an iPhone in Safari; one password field with show/hide and the return key submitting; "Use a code from another phone" takes the six-character pair code; big name buttons per person with the current choice marked three ways, plus **Someone Else** and **A Guest**. A child's phone (a child chosen) asks the parent PIN for Settings and never shows Approve.

**Today**

```
+--------------------------------------+
| Tue, Oct 7                   (M) Mia |
|                                      |
| Up Next                              |
| 4:00 PM                              |
| Soccer practice                      |
| Mia · Field 3                        |
|--------------------------------------|
| Today                                |
| 8:00 AM  School drop-off · Ana       |
| 6:30 PM  Dinner at Grandma's         |
| 7:30 PM  Leo's bedtime routine       |
|--------------------------------------|
| Tasks                                |
| (M) Mia  2 of 3          See tasks   |
|--------------------------------------|
| Tonight                              |
| Tacos · Sam cooks                    |
|--------------------------------------|
| Coming Up                            |
| 12 days  Mia's birthday              |
|                                      |
| [             + Add              ]   |
|--------------------------------------|
| Today  Calendar  Lists  Tasks   More |
+--------------------------------------+
```

The avatar at the top right is who's using this phone; tapping it opens Who's Using This. Sections follow the display's Today panel; a child's phone shows that child's tasks first.

**Calendar**: a segmented control with **Week** (default: a strip of seven 44 px day cells with person-colored dots over a continuous list starting on the selected day), **Day** (the timeline with hour bands, collapsed free time and the gliding now line; "Tap a time to add"), **Agenda** (the list grouped by day; past days collapse into "Earlier"), **Month** (a grid with dots and the selected day's list under it). Person filter avatars sit under the control behind a "Show" chip and persist on a phone. A search field (title and location) lives in the month picker's header.

```
+--------------------------------------+
| October 2026 ▾        [Wk|Day|Ag|Mo] |
| [S 5][M 6][T 7][W 8][T 9][F10][S11]  |
|  ●●   ●●●  ●●●●  ●    ●●   ●●   ●●●  |
|--------------------------------------|
| Tue, Oct 7 · today                   |
| all day  Pajama day · Leo            |
| 8:00 AM  School drop-off · Ana       |
| ─────────── now 9:41 ─────────────   |
| 4:00 PM  Soccer practice · Mia       |
|          Field 3                     |
| 6:30 PM  Dinner at Grandma's         |
|                                      |
| Wed, Oct 8                           |
| 9:00 AM  Vet · Ana                   |
| [             + Add              ]   |
|--------------------------------------|
| Today  Calendar  Lists  Tasks   More |
+--------------------------------------+
```

**Event sheet and editor**: the sheet shows the title, time, people, calendar source line ("From Apple · Ana"), location and notes, with **Change**, **Move**, **Add a Countdown** and **Remove** (read-only synced events show the source line instead of buttons). The editor is the same form as the display's (§4), in a sheet, with the phone's native keyboard:

```
+--------------------------------------+
| Add                            Close |
| [▦ Event][☰ Item][☑ Task][🍴 Meal][⌛ |  (scrolls sideways)
| What, when, who                      |
| [ Dentist Thu 2:30pm Mia           ] |
| Saved as "Dentist"                   |
| Who                                  |
| (All)   (A)   (S)   (M)   (L)        |
| Everyone Ana  Sam  [Mia]  Leo        |
| Day                         Oct 5–11 |
| [Sun][Mon][Tue][Wed][THU][Fri][Sat]  |
| [<] [Today] [>] [Pick a date]        |
| Time                                 |
| [All day][9:00 AM][12:00 PM]         |
| [2:30 PM][3:00 PM][6:00 PM]          |
| [Pick a time]                        |
| How long  ·  Repeats  ·  Color  ·  … |
|--------------------------------------|
| [           Add event             ]  |
+--------------------------------------+
```

The quick-add field runs the same parser and fills the same rows; chips and cells are 44 px; the month grid stands in for the native date input here too; the button is pinned in the thumb zone while the sheet scrolls. **Add several** (under More) takes pasted lines, one draft per line, with a review list and **Add all**, for school newsletters. **Remind** shows a toast on paired screens 10 minutes, 1 hour or 1 day before; phone notifications are a later idea (PLAN §19).

**Lists**: a list of lists (name, count, last change) and the list detail: 48 px checkboxes in 72 × 80 px tap areas, the marker strike, a collapsed Done group, the add field pinned above the tab bar with a Usuals strip above it, attribution silent ("Added by Mia").

**Tasks**

```
+--------------------------------------+
| Tasks                      ★ 42 Mia  |
| [Today | This Week]                  |
| Mia · 2 of 3                         |
| [ ] Feed the dog     by 5:00 PM · ★2 |
| [✓] Make bed       Done · 7:42 AM    |
| [✓] Pack backpack  Done · 7:45 AM    |
| Anyone · 0 of 2                      |
| [ ] Empty the dishwasher  Mia's turn |
| [ ] Water the plants             ★1  |
| > Leo · all done                     |
| > Sam · 0 of 1                       |
| Bedtime routine 7:30 PM     [Start]  |
| Stars & Rewards                    > |
| [             + Add              ]   |
|--------------------------------------|
| Today  Calendar  Lists  Tasks   More |
+--------------------------------------+
```

The phone's person comes first and open; others collapsed. Completing stamps and bursts the same way (§9), scaled to the row. Stars & Rewards and the routine runner work on a phone too (a child can run bedtime from a tablet in their room). Parents' phones show **Asked** requests at the top of Tasks and Today with Approve and Not now.

**Meals**: a week list (day rows with the meal and who cooks; "+ Add dinner" on empty days), the add sheet with its one field and the saved meals as chips under it, the library under **Saved Meals**, and the "Add 4 items to Groceries" toggle when a saved meal has ingredients.

**More**: the rooms not in the tab bar (Meals, Countdowns, Photos), then Settings, Who's Using This (shows the name), Pair a Display, Install the App, About. Photos here is where photos are added (camera or library, several at once) and deleted (with Undo).

**Settings (phone)**: the same pages as the display's (§4), full screen with Back; parents' phones open them directly, children's phones ask the PIN. Two pages do more on a signed-in device than on a paired screen: **Calendars & Accounts** takes Google's helper key file and opens Google's own sign-in page (the wall hands those two to a device); **Backup** downloads the backup, everything (photos included) and the export, and has **Start Over** (Erase everything…, §4); restoring is a runbook step with the server stopped (`sunroom restore`, docs/RESTORE.md). **Support Sunroom** opens its links and GitHub's new-issue page in the phone's browser.

**Pair a Display**

```
+--------------------------------------+
| < Back       Pair a Display          |
| The screen shows a code. Type it     |
| here.                                |
|   [ _  _  _  _  _  _ ]               |
| [              Pair               ]  |
| No code? On the screen, open         |
| sunroom.local. A screen that's       |
| already paired shows the calendar.   |
| Paired screens                       |
| Kitchen screen · awake · Unpair      |
+--------------------------------------+
```

A wrong code: "That code didn't work. Codes change every 10 minutes; read the one on the screen now." Success: "Kitchen screen paired", and the screen moves on by itself.

## 6. Flows

**First run (self-hoster, on a phone).** 1. The container starts; the display's browser shows **Welcome** with a QR code and the address; the self-hoster opens it on a phone. 2. "Welcome to Sunroom. Let's set it up — about three minutes." → **Start**. 3. **Set a household password** (show/hide; "Everyone at home signs in on their devices with this one password. Paired screens don't need it."; "8 characters or more. A few words together work well.", ADR 0034). 4. **Name your household**: the field starts as "Home", with the chips Home, Family and Our home; time zone from the phone with Change; week starts on Sunday or Monday; **Theme** Light / Dark / Auto (Auto by default, "Auto is dark from sunset to sunrise once Sunroom knows where home is (the next step), and from 7 PM until then. On a phone, Auto follows the phone."), shown on the page the moment it's picked (ADR 0034). 4b. **Where's home?** "Sunroom shows your weather and turns dark at sunset. Type your city, or one nearby." The field, **Your city**, searches as you type (from two letters, a third of a second after the last key; there is no Search button) and lists the places under itself ("Keep typing…" under three letters with nothing found, "Nothing by that name. Try the nearest city." from three) → tap the city → "Home is Springfield, Illinois, United States"; **Later** skips (it gets dark at 7 PM until it's set; the step skips itself with the weather off). 5. **Who lives here?** "Start with you": one row with the name, Parent or Child and **Add Me** (then **Add** for each next person: the name clears and keeps focus, and the role stays as chosen, since two children in a row is common), a color picked automatically; then **Next**; then "Set a parent PIN? It keeps children out of Settings on paired screens." **Set a PIN** or **Later**. 6. **Bring in your calendars**: Apple, Google, Holidays, Another calendar (.ics), A calendar server, **Skip for Now**; each flow returns here. 7. **"You're set."** "Everyone at home can sign in with the household password, or with a code from Settings, then Devices." and "To put Sunroom on a screen on the wall, open it there: it shows a code. Type that code under More, then Pair a Display, or type the household password on the screen itself." → **Open Sunroom** → Who's Using This phone? → Today. The step counter runs "1 of 6" to "6 of 6". **How it's laid out** (ADR 0032, modelled on Pair This Screen): from 1024 px a centred card, with the brand, "About three minutes. Everything can be changed later in Settings." and the six steps listed at the left (Household password, Your household, Where's home, Who lives here, A parent PIN, Your calendars: a check on the done ones, the current one bold and marked, the rest quiet; the list shows the way, Back walks it), and the step's title, lead and form at the right, its buttons on one row (Back or Later at the left, the main one at the right); both columns sit in the middle of the window, and a new step rises in. On a phone, one column: the brand with "2 of 6", a six-segment bar under it, then the step, its main button full width. Welcome and You're Set are one centred column with the brand, the title at glance size and one big button, You're Set with a check in the sun's color. Pairing a screen is not a step (ADR 0030): the moment setup is done the display shows **Pair This Screen** by itself, and it is paired whenever the family gets to it (below).

**Pairing the display (any time).** The display shows **Pair This Screen** with a six-character code (or returns to it after an unpair). A signed-in phone: More → **Pair a Display** → the code → **Pair**; any signed-in device (a computer has no More): Settings → Devices → **Pair a Display**, the same field in a sheet; or on the display, **Type the household password here instead**. Then "Name this screen" chips → the week board. The same code mechanism, mirrored, is **Add a Device** (Settings → Devices): the signed-in device shows a code and QR, and the address for a computer; the new one types the code on its sign-in screen (**Use a code from another device**).

**Add an event from the display (quick add).** 1. Tap **Add** in the rail, or empty space in Thursday's column (which skips the day chip). 2. The Add panel opens with Event selected and the field focused; the keyboard rises. 3. Type "Dentist Thu 2:30pm Mia"; the rows fill as you type (Thu in the Day strip, 2:30 PM among the times, 1 hour, Mia), the line under the field reads `Saved as "Dentist"`, and Thursday's column lights behind. 4. Fix anything by tapping its row. 5. **Add Event** (or ↵): the panel slides away, the chip eases into Thursday, toast "Added Dentist · Undo".

**Add from a phone.** Calendar → **+ Add** (or tap a time in Day view) → type, or tap the rows → **Add Event** → the display shows it within a second, easing into its column; nothing else moves.

**Change one occurrence of a repeating event.** Tap the chip → event sheet → **Change** → edit → **Save Changes** → the chooser:

```
+--------------------------------------+
| Change Which?                        |
| Soccer practice repeats every week.  |
| [         Just This One           ]  |
| [     This and the Ones After     ]  |
| [          All of Them            ]  |
| Cancel                               |
+--------------------------------------+
```

"Just This One" makes an exception (the chip gets a small "changed" dot; its sheet reads "Changed from the usual time"); "This and the Ones After" splits the series; "All of Them" edits it. The toast says "Changes saved · Undo" and Undo reverses the whole choice. **Remove** and **Move** (and a drop) ask the same three.

**Drag a chip to another day.** Press and hold 400 ms: the chip lifts (scale 1.04, a shadow), its column closes the gap, a quiet pill in the header reads "Drop on a day". The column under the finger lights (rows in portrait); hovering the board's edge for 600 ms pages the week. Release on a day: the chip settles in time order; "Moved Soccer practice to Thu · Undo" (a repeating event asks "Move Which?" first while the chip waits, lifted). Release elsewhere: it springs back. Every drag has a button twin, **Move** in the sheet. Read-only synced chips do not lift; the header reads "From Apple · Work · can't be moved here" for 2 s.

**Complete a task on the display.** Mia taps the box next to **Feed the dog** in her column (no attribution tap: it is assigned to her). The signature moment (§9) plays: the box fills in her color, the stamp lands, the burst radiates, "Done by Mia · 4:12 PM" appears, the header pops to "3 of 3 · ★44", the row eases under Done. Her last task adds "All done, Mia!" with the bigger burst. Toast "Done by Mia · Undo" for 8 s; Undo puts the row back, lifts the stamp and takes the stars back. An **Anyone** task opens "Who did it?" with avatar chips beside the box; "Mia's turn" tasks preselect Mia and leave the chips for 2 s so someone else can claim it.

**A child runs a bedtime routine.** At 7:30 PM the Today panel reads "Leo's bedtime routine · Start" and his Tasks column shows **Start**. The runner takes the whole screen, one step at a time: a 240 px icon, the step name at 64 px, filled dots for progress, a 120 px **Done** button in Leo's color, a quiet **Skip This One**. Each Done stamps and bursts, and the next step slides in from the right. After the last: "All done, Leo! Night night." with the full-screen burst and "+5 stars", then back to Tasks after 6 s or a tap. Stopping keeps progress for an hour ("Continue · step 3 of 5"); idle rules pause while a routine runs, up to 30 minutes.

**Redeem a reward.** Mia opens Tasks → **Stars & Rewards** → **Ask for It** on Movie night (30 of her 42 stars) → the children-only Who picker. "Asked for Movie night. A parent will say yes or no." with **Take It Back**. The request shows under Asked on the display and at the top of parents' phones. A parent approves on their phone, or on the display with the PIN. Stars drop to 12 with a pop; "Mia got Movie night" and the big burst. **Not Now** says "Not now" on the rewards page without a reason field.

**Groceries from a phone to the display.** Ana adds "Milk" (or taps it in Usuals): "Added Milk · Undo", "Added by Ana". Within a second the display's Groceries list eases the row in; the Lists room tile reads "13 to get · Ana added Milk · 2:10 PM". At the store she checks items off on her phone; the display strikes them live.

**Connect an Apple calendar** (on any signed-in device or a paired screen). Settings → Calendars & Accounts → **Add an Account** → **Apple** (the first of Apple, Google, Holidays, Another calendar and A calendar server; ADR 0032). The app says Apple wherever the family reads it; the technical name of Apple's calendar service, iCloud, stays in docs/SYNC.md. Three illustrated steps (a schematic drawing under each, the thing to tap ringed in `sun`; no logos or brand colors): open appleid.apple.com and sign in; under Sign-In and Security tap App-Specific Passwords, then the plus, and name it Sunroom; copy the password (xxxx-xxxx-xxxx-xxxx). A note that two-factor authentication must be on. Fields: Apple Account email, app-specific password → **Connect** ("Connecting…" up to 20 s). Success: "Connected Apple · 3 calendars", a list with switches and a person chip each ("Ana's calendar → Ana", "Family → Everyone", guessed from names and editable), "Show on the kitchen screen" on by default → **Done**. From then on the account is a row in Calendars & Accounts that opens its sheet (§4). Errors: "Apple said that password isn't right. Make a new app-specific password and try again." / "Apple didn't answer. Check the server has internet and try again." On a paired screen the first step says "On another device, open appleid.apple.com and sign in." (the wall opens no browser tab), and the password is typed on the on-screen keyboard, masked.

**Connect Google.** Add an account → **Google** → "Three ways. Pick the one that fits:" On a paired screen the secret address is typed there; the helper and Sign in with Google say "From a device" and open a QR with "Do this from a device" (a key file to upload; Google's own page).

| Way | One line under it | Gives |
|---|---|---|
| **Paste the secret address** | "Easiest. Shows events only; you can't add from Sunroom. Google updates it slowly (sometimes hours)." | read-only |
| **Share with a Sunroom helper** | "About 10 minutes, once. Lets you add and change events from Sunroom." | read-write |
| **Sign in with Google** | "Needs Sunroom at an https:// address on the internet and your own Google app keys, which it asks for here." | read-write |

The secret address: illustrated steps (Google Calendar settings → the calendar → Integrate calendar → copy "Secret address in iCal format") → paste → **Add Calendar** → "Added Google · Family (shows events only)"; its status line says "Updated 9:10 AM · Google updates this slowly" so staleness is expected, not a bug. The helper (a service account, never called that in the UI): "You'll make a helper account at Google and share your calendar with it." Steps with an **Open** link and a drawing each: make a project named Sunroom at console.cloud.google.com; enable the Google Calendar API; IAM & Admin → Service accounts → Create "sunroom"; Keys → Add key → JSON (a file downloads). **Upload the Key File** → Sunroom shows "Your helper's address:" with **Copy** (the key is stored encrypted and never shown again). "In Google Calendar settings, pick the calendar, go to Share with specific people, paste the helper's address, choose Make changes to events, and Send." → **Find calendars** → switches and person chips → **Done**; "No calendars shared with the helper yet. Sharing can take a minute; try again." Sign in with Google: disabled with its reason when the address is plain http or local (unless at `localhost` or `127.0.0.1`); otherwise steps for the OAuth client (Web application; the redirect address shown with Copy), the consent screen set to External and **published** ("If it stays in Testing, Google signs Sunroom out every 7 days"), "Paste the client ID and secret below." with the two fields right there → **Save Keys and Continue** (they're kept: the next time the step says "Keys saved", with **Change Keys** and **Remove Keys**) → **Sign in with Google** → "Google may say the app isn't verified: tap Advanced, then Go to Sunroom. It's your own app." → choose calendars → **Done**. Google sends the browser back to Calendars & Accounts, which says how it went and cleans the address: "Connected Google" with the new account's calendars to pick, or "Google didn't finish signing in. Try again." / "That sign-in took too long. Try again." / "Google said no. Try again, or use the secret address." Later sign-outs show "Google signed Sunroom out." with **Sign In Again**.

**Another calendar (.ics)**: paste any address (school, team, holidays), name it, a person or Everyone → **Add Calendar**; read-only; refreshed every 30 minutes (15 min to 6 h in its row). **Holidays**: pick the country (and state) → added instantly, no address.

**Screensaver in and out.** No tap for the set minutes: the board fades to the first photo over 800 ms; the clock and Up Next fade in 220 ms later; photos crossfade every 30 s. A tap fades the photo out in 220 ms to exactly where the display was if asleep under 30 minutes, otherwise to this week's board (in the room it was in, with Return to the calendar after on Never); the waking tap does nothing else. Phones can **Start Screensaver** from More → Photos; the sleep schedule overrides the screensaver at night.

**Theme auto switch at sunset.** Theme Auto; sunset 6:42 PM from the household's location (7 PM without one). At 6:42, once the display has been idle 10 s, every color token crossfades to the dark theme over 600 ms and the wall tint moves to its evening stop; if someone is mid-tap or typing it waits for the next 10 s of idle. Phones follow their own OS setting unless the household forced Light or Dark. Sunrise reverses it. Reduce Motion makes both instant.

## 7. Visual direction: "Sunroom"

This is the design pass for the brief. ADR 0013 records it; `frontend/src/styles/tokens.css` implements it; `tokens.test.ts` enforces the contrast pairs below.

**Concept.** A sunroom is the bright, quiet room where a family actually sits: glass, plaster, a few plants, and light that moves across the wall through the day. The display is that wall. It is calm, large and legible from the doorway; it is never a dashboard. Two things carry the identity:

1. **Light that follows the day.** The wall's tint shifts in four steps (dawn, midday, afternoon, dusk) in the light theme and two (evening, night) in the dark theme, crossfading over two seconds when a step changes, never on first paint. Today's column on the board is "lit" (a plain `surface` panel on the tinted wall), and a thin amber "now" line glides down it. With Auto theme on, dusk hands over to the dark theme at sunset. A household can turn the daylight tint off in Display settings; the wall then stays at the midday value.
2. **The person color.** Each member owns one saturated color. It fills their avatar, the edge and tint of their event chips, their task rows, their progress ring, and the burst when they finish something. Shared things (Everyone) are ink on surface. Color is never the only signal: every chip shows the avatar or initial, and names are written out.

Everything else is quiet: one typeface, few surfaces, no decorative gradients, no cards within cards, no shadows except under an open sheet and a chip being dragged.

**Color tokens.** Role-named, defined once on `:root`, overridden under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])`; mapped into Tailwind with `@theme inline` exactly as Dinner Bell's `tokens.css`. The daypart tints are set by `data-daypart` on `<html>`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `wall` | `#F5F5F2` (midday), `#ECF5FA` (dawn), `#F8F2E7` (afternoon), `#F9ECE1` (dusk) | `#0F171F` (night), `#171A26` (evening) | The app background. Ink on every tint ≥ 13:1, ink-soft ≥ 4.9:1 |
| `surface` | `#FFFFFF` | `#1A222B` | Today's column, sheets, the Today panel blocks, list rows, the rail |
| `ink` | `#1C2430` | `#EDF1F4` | Text and primary actions (actions are ink, as in Dinner Bell ADR 0027) |
| `on-ink` | `#FFFFFF` | `#0F171F` | Text on ink buttons |
| `ink-soft` | `#5B6775` | `#A6B1BD` | Secondary text (5.3:1 on wall, 5.8:1 on surface; 8.1:1 / 7.3:1 dark) |
| `line` | `#D9E0E6` | `#2A3542` | Grid lines, rules, dividers (structural, not text) |
| `sun` | `#F5AE39` | `#FCB442` | The lit accent: the now line's glow, today's date disc, progress fills, celebration gold. Text on it is `ink` (8.2:1 / 8.7:1). Never used as text in the light theme |
| `sun-ink` | `#8A5A00` | `#FCB442` | "Now" labels and the now line itself in light (≥ 4.5:1 on wall and surface, and ≥ 3:1 as a UI line); in dark, `sun` serves both roles (9.9:1) |
| `alert` | `#C7362C` | `#FF7B6E` | Errors, destructive actions, overdue (≥ 4.5:1 on every wall tint; white on it ≥ 5:1; 6.3:1 on dark surface) |
| `on-sun`, `on-alert` | `#1C2430`, `#FFFFFF` | `#0F171F` | Text on a `sun` or `alert` fill |
| `night`, `night-ink` | `#000000`, `#A6B1BD` | the same | Night (§4): true black and the dim clock, whatever the theme |
| `qr-tile`, `qr-ink` | `#FFFFFF`, `#1C2430` | the same | QR codes stay dark on white in both themes: not every camera reads light on dark |
| `scrim` | `rgb(15 23 31 / .45)` | `rgb(0 0 0 / .6)` | Sheet backdrops, the screensaver's text plate |

**Person colors** (twelve, named after what you'd see from a sunroom; a household picks one per person; the picker shows the swatch with the person's initial, and a color word for screen readers). Solids are computed in OKLCH so they sit at the same lightness and read as one family; M0 ran the contrast test and nudged the light solids that failed on the warmest wall tint, so the light column below is the nudged one.

| Name | Light solid (white text ≥ 5:1, ≥ 4.5:1 on wall) | Dark solid (ink text ≥ 4.6:1, ≥ 4.6:1 as text on dark surface) |
|---|---|---|
| clay | `#B84639` | `#C5776A` |
| olive | `#7A6B00` | `#9F8D0E` |
| moss | `#307945` | `#3CA059` |
| sea | `#00777C` | `#219BA1` |
| sky | `#006EBE` | `#3F90DD` |
| iris | `#705CBF` | `#8F7EDE` |
| berry | `#9F4B9A` | `#AF7BA9` |
| rose | `#B3436E` | `#C1758D` |
| copper | `#A54C00` | `#CA7D44` |
| bark | `#7D5B40` | `#AE8A6D` |
| slate | `#50667C` | `#7B95B0` |
| lime | `#637200` | `#8B9D26` |

The last four came in 0.12.0 (ADR 0034), so a family of five still has free colors for its shared calendars; they were appended, so nobody's color moved. They fill the gaps the eight left: an orange (copper, a terracotta pot), and then the only colors far enough from the eight are muted ones (bark, the wood of the frame; slate, a stone floor; lime, new leaves), all at the eight's OKLCH lightness (light 0.50–0.52, dark 0.66) and passing every check the token test makes without a nudge.

- Each person has three derived values via CSS `color-mix(in oklab, …)`, so no extra tokens: `--p-tint` (12% of the solid over `surface` in light, 24% in dark) for chip and row backgrounds; `--p-edge` (the solid) for the 6 px chip edge and the avatar; `--p-text` (the solid in dark, ink in light) for any text in the person's color. Rule enforced by the design-rules test: in the light theme a person color is never used for body text on a tint; names on chips are ink.
- Shared ("Everyone") items use `ink` edge and a `line`-tinted background.
- Synced calendars that belong to no person (a shared "Family" Google calendar, the school ICS feed) get a calendar color from the same twelve, chosen in the calendar's page of its account's sheet: the colors nobody has first, then the taken ones marked "Mia's" (`ui/ColorPicker`, shared with a person's and a calendar's sheets).

**Type.** One family, **Lexend** (variable, self-hosted via fontsource), chosen because it was designed to make reading easier and its open, wide letters hold up at a distance; weights 400 (body), 600 (emphasis, times, the header's date), 700 (titles, chip titles) and 800 (the clock, countdown numbers, the routine step). The display's scale is in §1 (caption 18, secondary 20, body 24, title 32, glance 40, header clock 40, big number 72, step title 64, wall clock 200); phones keep Dinner Bell's scale (13 / 14 / 16 / 18 / 24 / 30). Sizes are rem on a root size the display's Text size setting controls (Small ×0.875, Standard 16 px, Large ×1.15, Extra large ×1.3; phones use the browser's default so the OS text size applies). Anything typed into is at least 16 px on phones and 24 px on the display. Lexend has no tabular figures (checked in M0), so times and counters that change in place sit in fixed-width digit boxes (`ui/Digits`, ADR 0021). Title Case for titles, headings and navigation; sentence case for everything else (§2); never all caps; no letterspaced eyebrows; day names read "Mon 13", not "MON".

**Space and shape.** An 8 px grid; the widths, gaps, targets and radii are in §1 (rail 192 px, Today panel 400 px, chips 12 px radius, panels 24 px). The board itself is square-cornered: it is the wall, not a card. The board is one `wall` surface with `line` grid lines; today's column is a `surface` panel; chips are the only card-like objects and sit flat with a 6 px person edge on the left over a 12% tint (24% in dark); the Today panel is stacked blocks separated by 32 px of space, not boxed. Focus: a 4 px `ink` outline with a 2 px offset on every display control (3 px on phones); inverse surfaces set the ring to `wall`.

**Motion.** Tokens in `motion.css`: tap 90 ms, quick 150, enter 220, exit 180, settle 320 (springs: stiffness 400, damping 30), celebrate 600, daylight 2000; easings standard `cubic-bezier(.2,0,0,1)`, arrive `cubic-bezier(.05,.7,.1,1)`, leave `cubic-bezier(.3,0,.8,.15)`. Rules: motion answers what someone did; nothing animates on first paint, on a tab switch or when the wall tint changes except the two-second crossfade itself; `prefers-reduced-motion` and the Display setting "Reduce motion" make every transition instant and stop the now line gliding (it jumps once a minute), with celebrations reduced to the check fill and a single soft flash.

The signature moment, **Done**, frame by frame (a task or list item checked on the display; on phones the same at 80% scale):

| Time | What happens |
|---|---|
| 0 ms | The finger lifts. The check circle fills with the person's solid color on a spring (settle 320); the check mark draws in `on-ink` over 200 ms |
| 60 ms | The row stamps: scale 1 → 1.03 → 1 with a −1° → 0° rotation over 300 ms, as if pressed into the wall |
| 120 ms | A burst of 28 particles (small discs and 4-point stars in the person's solid and `sun`) rises from the check for 600 ms on the canvas layer above the UI, with gravity, and fades |
| 200 ms | If points are on, "+2" rises from the check and flies to the person's avatar in the Today panel (or portrait's band), else the one in their column's header (rise 250, then settle 320), and the avatar bumps (scale 1.1) as it lands while the column's star count pops. With no avatar on screen it rises from the row and fades; with Reduce Motion nothing flies |
| 900 ms | The row folds into the Done group below (exit 180 + layout spring); the Undo toast is already showing ("Done: Feed the cat, by Mia", 6 s) |

Other motions: a press dips controls by 3% and shades rows (tap); sheets slide up from the bottom edge on phones and rise 16 px with a fade on the display (enter/exit); the week board swipes between weeks with inertia and snaps (settle), a tap on the week header's arrows does the same; a long-pressed chip lifts (scale 1.04, a soft shadow) and follows the finger across days, drops with a spring, and the toast offers Undo; the now line moves once a minute with a 500 ms ease; a toast rises and eases out; a countdown number ticks over with a vertical roll when the day changes; the screensaver fades in over 1 s and out in 300 ms; the theme crossfades over 600 ms when switched, every color together (ADR 0032); the routine runner's steps slide left as each is done, and the final step fires the celebration with all of that person's color plus `sun`.

**Icons and the app icon.** lucide, 2 px stroke, always beside a label on the rail and on primary actions. The app icon is a window: a rounded square in `wall` with a four-pane mullion in `ink` and `sun` light filling the lower-left pane; maskable with the safe zone respected; the splash uses the same mark on `wall`. No calendar-grid cliché, no sun-with-rays cliché. Wherever the name stands beside the mark (the setup wizard, sign-in, the wall before it's paired, the rail's top) it is one lockup, `ui/Brand`: the mark with "Sunroom" in Lexend 800, the mark hidden from screen readers so the name is heard once.

**Self-critique against the generic default.** Before settling on this direction, the plan was checked against what a brief like this usually produces, and revised:

| Default it avoided | What Sunroom does instead | Why |
|---|---|---|
| Pastel "family app" palette with a rounded display face and emoji everywhere | A cool daylight wall, one amber accent for time, one legible sans; emoji only where the family puts them (countdowns, meals) | Reads as a calm object on a kitchen wall, not a toy; children are served by size and color, not cuteness |
| Warm cream background with a serif display and a terracotta accent | The cool-to-warm daypart tints, and no serif | That combination is the current generated-page tell, and cream glares at night |
| A grid of identical rounded, shadowed cards per widget (the dashboard look) | One board surface; chips are the only cards; the Today panel is stacked blocks | Glanceability needs hierarchy, not a kit of equal boxes |
| ALL-CAPS eyebrow labels, "A · B · C" meta strings, arrows on buttons, monospace for times | Title Case only for titles, headings and navigation (§2), sentence case for the rest, stacked lines, plain verbs, tabular figures in the same family | Dinner Bell's rules, and they are easier to read from across a room |
| Motion as decoration: staggered entrances on load, hover lifts, things that drift | Motion answers what someone just did (ADR 0029): an event eases in where it was added, a finished task glides under Done, the week slides in from the side it was paged from, a count pops. Nothing moves on first paint or when a room opens, and Reduce Motion turns all of it off | On a wall that's glanced at all day, movement that means nothing is noise; movement that follows a tap says "that worked" from across the room |
| A "now" indicator as a red hairline (Google Calendar's) | An amber line with a soft glow, the lit today column, and the wall's own tint | Ties the time of day into the identity instead of borrowing a competitor's cue |
| Confetti on everything | One celebration, Done, in the person's color; a bigger one at the end of a routine; nothing else bursts | Spend the boldness in one place so it keeps meaning something |

## 8. Empty and quiet states

**An empty room** (Lists, Tasks, Photos, Countdowns, Saved Meals, Stars & Rewards) is one centred block (ADR 0032): an icon in a soft circle, a short line in bold ("No lists yet"), a note on what goes there, and the one big button that starts it. On the wall it sits in the middle of the room, under the header's own button; on a phone it starts a third of the way down, and the screen's bottom bar holds the button, so there's never a second one. Anywhere that's empty without being a room (a list with nothing on it, a week with no meals planned, a Settings group) keeps a quiet line.

| Where | Copy | Button |
|---|---|---|
| Week board, nothing this week | "Nothing on this week yet. Add an event, or bring in a calendar you already use." | Add Event; a quiet "Bring in a Calendar" shows the phone QR |
| Today panel, nothing today | "Nothing today." (or "Nothing else today." once today's are over) then "Tomorrow · 8:00 AM School drop-off"; the Today view and a phone's Today say it too | — |
| Day view, nothing that day | "Nothing planned yet. Tap a time to add." (a phone's day list: "Nothing planned") | — |
| People, a person with nothing | A **Free day** pill under the name, in the person's tint with the chips' ink (neutral for Everyone): a clear calendar is a state, not an error (ADR 0032). Their tasks still follow | — |
| Lists room | **No lists yet** · "Groceries, to-dos, packing: everyone sees them on paired screens and on their own devices." | New List |
| A list with no items | "Nothing on Groceries yet. Add the first thing." | the add field, focused |
| Tasks room, none | **No tasks yet** · "Give each person a few, and watch them get stamped." | Add Task |
| A person with no tasks today | "Nothing today" | — |
| Stars & Rewards, no rewards | **No rewards yet** · "Rewards are what stars buy: movie night, an ice cream run." | Add Reward (PIN) |
| Routines, none | "A routine is a short checklist a child runs on their own: pajamas, teeth, book." | Add Routine (PIN) |
| Meals, empty week | "Tonight's dinner shows here and on the Today panel. Add a dinner." | Add Dinner |
| Saved Meals, none | **No saved meals yet** · "Save a meal once and add it in one tap next week." | New Saved Meal |
| Countdowns, none | **No countdowns yet** · "Count down to birthdays, trips, the last day of school." | Add Countdown |
| Tips strip (Show tips on) | One thing Sunroom can do: "Hold a chip on the board, then drag it to another day." Never an error, a warning, a nag or a count of what's unused | Next tip |
| Photos, none | **No photos yet** · "Photos added from any device show here and on the screensaver." | the QR and "Add photos from a device…" in the button's place on a paired screen (it has no file picker); **Add Photos** on a computer, and in a phone's bar |
| Screensaver with no photos | The time-of-day tint, the clock and Up Next, and one line: "Add photos from a device to see them here." Never a stock image | — |
| Settings → Calendars, none | "Bring in calendars you already use: Google, Apple, or any calendar address." | Add an Account (a QR on the display) |
| Devices, no screens | "No screen paired yet. Open Sunroom on the screen you want to pair and type its code here." | Pair a Display (on signed-in devices) |
| Only the calendar enabled | The rail shows Calendar, Add and the lock; the Today panel shows only events; Settings → Features says "Turn on what your family uses." | — |
| Search, no match | "Nothing matches 'xyz'." | Add 'xyz' as New |
| Recently Removed, empty | "Things removed in the last 7 days show here." | — |

Quiet states, never error walls:

| State | What shows |
|---|---|
| A synced calendar hasn't answered | A one-line pill above the board's days: "Google hasn't answered since 9:10 AM. Showing what we had." Tapping it opens the Calendars page. The calendar's events stay |
| Server has no internet | "Updated 9:10 AM" on synced calendars only; everything else normal |
| Display can't reach the server | Header pill "Can't reach Sunroom · showing 9:10 AM"; a write says "Not saved — the screen can't reach Sunroom. It will try again." and retries every 10 s |
| Phone offline | Pill "Offline · showing what we had"; a write says "Not saved — you're offline. Try again when you have signal." (an offline queue is a PLAN §19 idea) |
| Syncing | "Syncing 3…" |
| PIN-locked | A padlock in place of the rail's gear; Settings and approvals ask for the PIN; nothing else is ever locked |
| Child-safe editing stops an action | The PIN dialog with one line above it: "Changing events on this screen asks for the parent PIN." |
| Read-only synced event | The sheet's source line instead of buttons |
| A reward costs more than the balance | "Mia has 18 of 30 stars" under a disabled Ask for it, never hidden |
| Google signed Sunroom out (OAuth) | A banner in Calendars & Accounts and a header pill: "Google signed Sunroom out." with **Sign In Again** (phone) |
| A password or a calendar address stopped working | A header pill: "Apple needs its password again." or "School's calendar address stopped working." Tapping it opens Calendars & Accounts, where the account's row says so in red and its sheet's **Connect Again** takes the new one (on the wall, typed on its keyboard); the events stay |
| Photos folder nearly full | A line in Photos and About: "2 GB free" |
| Backup older than 7 days | A line in Backup; never a pill on the board |
| A plugin stopped | A line in Settings → Features: "Weather stopped working. Retry" |
| Live updates | Connected, a header shows nothing (ADR 0030): the icon is drawn only while something is wrong, at the wall's top-right corner (the right end of the header, in every room) and at the right end of a phone Calendar's Show row, and keeps no room for itself when it's gone. About → Connection shows it in every state, so "is it connected?" always has an answer. The states are told apart by shape: connected (a Wi-Fi mark, quiet; About only), reconnecting (a slowly turning arrow; still with Reduce Motion), checking every 30 seconds (a clock: something between here and the server holds the stream back), offline (Wi-Fi crossed out, in ink); nothing once signed out. Anything but connected shows only after 2 s, so a reconnect on a room switch never flickers. A tap says it in words: "Live updates are on.", "Reconnecting to Sunroom…", "Live updates are off for now; checking every 30 seconds.", "Can't reach Sunroom." |
| Update available | The server was updated: every open screen says "Sunroom was updated to 0.7.0. Refreshing…" and reloads itself 4 s later, fresh (ADR 0028), once per version, waiting while an editor, a routine, a sheet or a save is open (10 minutes at most). Without the live stream, phones still show "New version · Refresh" and the wall reloads at 3 AM |
| Loading | Grey placeholder shapes after 300 ms, with "Loading…" for screen readers; the board's first paint from cache is instant, placeholders apply to panels and settings only |
| Night | The dim clock or black screen (§4) |

## 9. Motion spec

The principles and the signature moment are in §7. Implementation (decision 0007): anything that is a state toggle (press, selection, sheets and panels, toasts, the list strike, crossfades, the PIN shake, placeholders) is CSS in `styles/motion.css`; anything that moves between layouts or follows a finger (chips arriving, leaving, dropping and springing back, the week swipe, the done row relocating, routine steps swapping) uses `motion` under `<MotionConfig nonce reducedMotion="user">` (exits through `AnimatePresence`, the done row through `layout` by position); the bursts are a canvas layer. Nothing animates on first paint or a room switch. As built (ADR 0029), three of those are CSS keyframes instead, because they only need to play once when an attribute or a key changes and must never run when the board is merely resized: a chip arriving (`data-arrive`), a page turning (`data-page`), and the now line's drop. The table's last column says what is built and since when. `motion` keeps fading under Reduce Motion (it drops only transforms), so anything that leaves through it asks `useMotionReduced()` and leaves its `exit` out.

| Name | Value | Easing |
|---|---|---|
| tap | 90 ms | standard |
| quick | 150 ms | standard |
| enter | 220 ms | arrive |
| exit | 180 ms | leave |
| glide | 400 ms | standard (the now line's drop; a week's settle) |
| settle | spring, stiffness 400, damping 30 | chip drops, the stamp |
| celebrate | 600 ms | overshoot `cubic-bezier(.34,1.56,.64,1)` for the stamp, leave for the burst |
| crossfade | 600 ms | linear (theme) |
| daylight | 2000 ms | linear (wall tint steps) |
| saver-in / saver-out | 800 / 220 ms | linear / leave |
| photo | 1500 ms | linear |

| Motion | Trigger | Behaviour | Reduced motion | Built |
|---|---|---|---|---|
| Press dip | finger down on a button, chip or key | tap: scale .96 and shade | shade only | yes |
| Row shade | finger down on a row | tap: shade | same | yes |
| Selection fill | a chip or avatar selected | quick: fill and ring | instant | yes |
| Panel or sheet open | Add, a chip tapped, Change | enter: slide from the right (landscape) or the bottom; the backdrop fades with it | appears in place | yes |
| Panel or sheet close | Close, Save, Cancel | exit: slide back; the page takes taps 180 ms later | disappears | yes |
| Keyboard | a field focused or blurred | enter / exit: slides up and down; the field scrolls into view in the same 220 ms | appears / disappears | yes |
| Toast | after an action | enter: rise 16 px and fade; exit: ease out | appears / disappears | yes |
| Rail fold | Hide the rail, Show the rail, the Compact rail setting | enter: the rail's width eases between 192 and 72 px and the board follows, as the Today panel's does; each room's height eases between 96 and 72 px, the words under the icons fade (quick) and give up their height, Settings' word folds away beside its gear, and the Add circle settles between 64 and 56 px; the mark and the icons stay centred, so they glide. Never on first paint (a rail that starts folded is drawn folded) | instant | 0.8.0; it actually eases from 0.9.0 (the surface crossfade's rule used to cancel it) |
| Chip arrives | saved here or on another device | enter: fade and grow from 96% in place. One that moved to another day or time arrives there | appears | 0.8.0: the Week (Agenda, Hours), Day, People, Month and the phone's lists (`lib/arrivals`); marked for a second, never on first paint, paging or a view switch |
| Chip leaves | removed, moved, undone | exit: fade and shrink; the others close up once it has gone | disappears | 0.8.0: the Week's Agenda and Hours |
| Count pop | "2 of 3", "12 to get", a star balance | quick: scale 1 → 1.15 → 1 | no scale | yes; since 0.8.0 also the Today panel's lines, a list's count on its tile and in its header, a child's stars on Rewards (`ui/Pop`) |
| List strike | an item checked | 250 ms marker stroke in the checker's color, 600 ms hold, then folds into Done | strike appears; the row moves without sliding | yes; since 0.8.0 the row glides into Done and back, and the rows around it close up |
| Task done | the box tapped | the signature moment (§7) | box fills, check and stamp appear, "Done by Mia" appears, no burst | yes; since 0.8.0 the stamped row glides under Done |
| All done | a person's last task | 900 ms: a header burst and "All done, Mia!" fades in | text appears | yes |
| Routine step | Done in the runner | celebrate on the button; the next step enters from the right as the old one slides off to the left and fades | steps swap in place | yes; the old step's exit since 0.8.0 |
| Routine finish, reward approved, countdown day | | 900 ms full-screen or panel burst, once | text appears | yes |
| Week swipe | horizontal drag on the board | 1:1 with the finger, resistance beyond one week; on release, glide to the nearest week; a flick over 0.5 px/ms moves exactly one | pages without sliding | not yet: a swipe pages by a week, with the Week buttons' slide. Following the finger is its own task |
| Week buttons | arrows, This Week (Today, This Month), a swipe | enter: the new page slides in 1.5rem from the side it comes from and fades up. Not the idle reset going back to this week, nor a view switch | cuts | 0.8.0: the wall's Week, Day and Month, Meals' week, the phone's Calendar (`usePageTurn`) |
| Chip lift / drag / drop / spring back | long-press 400 ms, move, release | lift: scale 1.04 and an 8 px shadow, the origin keeps a dashed outline; drag 1:1 with the column tinting; drop settles into time order; elsewhere springs back | lift shade only; lands in place | the lift and the drag; a drop lands in place and elsewhere it returns at once, with no spring |
| Now line (board) | an event ends | glide: drops into its new place, from about a chip above (from the side in portrait), while the finished chip dims | instant | 0.8.0 |
| Now line (Hours grid) | every minute | a 60 s linear transition of its position (`--motion-minute`), so it creeps; remounted on a zoom or resize so it never glides across a change of scale, and nothing moves on first paint | steps once a minute | yes |
| Now line (Day view) | an event ends | glide: the line sits between the day's rows, and drops into its new place | instant | 0.8.0 |
| Lit column | midnight | crossfade | instant | 0.8.0: the Week's columns (Agenda and Hours) |
| Wall tint | the daypart changes | daylight crossfade, at most once a minute, never on first paint | instant | yes |
| Theme switch | sunset, sunrise, the setting | crossfade: every color on the page at once, for 600 ms (`data-theme-switching`), deferred until 10 s idle at sunset and sunrise. Never on first paint, and never a theme that arrives with the settings: the page paints the remembered one first | instant | yes; every color together since 0.10.0 (the surfaces took 2 s and buttons 90 ms before) |
| Screensaver in / photo / out | idle, every 30 s, a tap | saver-in, photo crossfade (no pan or zoom), saver-out | cuts | yes |
| Night in / out | the schedule | crossfade to black, the clock fading in; on waking, the layer fades away in exit over the screen it gives back | cut | yes; the fade out since 0.8.0 |
| PIN wrong | | quick: the dots shake once (±6 px) and clear | dots clear | yes |
| Spinner, placeholders | waiting, loading after 300 ms | continuous; the placeholders breathe slowly (opacity, 2 s) | still | yes; the placeholders' breath since 0.8.0 |
| Today panel | its button in the header | enter: its width eases between 400 px and nothing, and the board takes or gives the room; what's in it keeps its width and leaves once it has closed. Never on first paint | instant | 0.8.0 |

Sheets and panels do not use `overlay` or `allow-discrete` for their exit (Safari): the dialog stays open while a keyframe slides it away, then the script closes it (Dinner Bell's pattern). Sound for the done moment exists and is off by default (a 120 ms pop).

## 10. Accessibility, children, guests and the screenshot checklist

- **Text size** (Settings → Display): Small, Standard, Large, Extra large change the display's root font size so everything scales in rem; the structure holds (seven columns, two-line chips, "+N more" sooner; the rail and Today panel widen at Extra large and narrow at Small). Small shrinks text and spacing, never a tap target or the 8 px between two of them. Phones follow the OS text size.
- **Color is never the only signal**: avatars carry an initial or photo; done is a check, the stamp, "Done by Mia" and the row's place; past is dimmed and above the now line; selected is a ring, a check and a bold name; filtered-out chips fade but keep their text. The user-facing color words are plain (Red, Olive, Green, Teal, Blue, Purple, Plum, Pink, Orange, Brown, Gray, Lime), mapped to the tokens in §7; no yellow, which fails as text. The token test checks every pair in both themes and at every wall-tint stop.
- **Focus, keyboard and screen readers**: a 4 px ink ring with 2 px offset on the display (3 px on phones), the wall color on inverse surfaces; laptops get a sensible tab order and arrow keys across the board, Escape closes, `/` focuses quick add; the on-screen keyboard never appears when a physical keyboard is in use. Names by example: a chip "Soccer practice, 4:00 to 5:00 PM, Mia, Thursday October 9, button"; a task box "Feed the dog, Mia, 2 stars, due 5:00 PM, not done, checkbox"; the now line is `aria-hidden`; the Today panel is a landmark; toasts are live regions; sheets take focus on open and return it on close.
- **Left-handed and placement**: Settings → Display → Rail side (Left or Right mirrors the shell: the rail, the Today panel and the toasts' place over the board; the keyboard's dock spans whatever isn't rail), and Controls at the bottom for a screen hung high.
- **Children**: zero-reading paths (find your column by avatar and color, tap the big box, get the stamp; routine steps are icons first); Child-safe editing and the parent PIN keep Settings, approvals and event changes behind a parent on the display; nothing a child can tap is unrecoverable (Undo, Recently Removed, no "delete everything" outside Settings); no shaming copy, streaks just read "0 days in a row".
- **Guests and grandparents**: the display is open to anyone in the house, attribution defaults to Everyone, "A guest" is in every Who picker; a grandparent can read the Today panel from the doorway and add an event on 80 px keys without meeting Settings; guests' phones sign in with the household password for the week and are signed out from Devices.

**Screenshot review checklist.** `just screenshots` captures the key screens in fake mode at 1920×1080 and 1080×1920 (Standard, Extra large and Small), 390×844 and 1440×900, light and dark, at 09:40, 16:10 and 21:30 so the tint and theme stops show. Then check:

- [ ] At 25% zoom (standing in for 3 m) the header's clock, today's day number, the Up Next title and the task counts still read; nothing else needs to.
- [ ] Display body text is 24 px, secondary 20, captions 18, nothing smaller than 18; phone body 16, inputs at least 16.
- [ ] Every display tap target is at least 56 px (checkboxes and primary buttons 64, keys 80×64) with 8 px between neighbours; phone targets at least 44 (primary 48, checkboxes 48 in 72×80); the axe checks pass.
- [ ] The header (ADR 0029, 0030): at 1920×1080 Standard and Small it is one row, 80 px tall in every room (today's date and time on one baseline and the weather pill centred on the digits, a thin rule, the room's controls, the Today panel's button, and no live icon while connected), in late September too, on the Week view with Agenda · Hours and four people filtered; at Large, Extra large, on a laptop and in portrait it is two rows with the first row's end unmoved; the Calendar's views are four icons with the chosen one's word, or the View menu in portrait at Extra large; no room the rail names writes its title there and nothing has a second line; a list, Saved Meals and Stars & Rewards show their name after their way back; the Month view says its month and the Day view its day; the Filter menu opens under its button, over the board and never under the Today panel, and a filtered board says who on the button; the zoom sits on the Hours grid's corner and covers no chip before 10 PM when the day is fitted; the Today panel's button works from Settings.
- [ ] Remembering (ADR 0030), by hand in `just display`: Month, two people filtered, the rail folded, the Today panel hidden, then refresh: all four are back, with no flash of the home view first; open Lists, close the window and run it again: it opens in Lists; with Settings → Display → When it starts on The home view, a refresh opens the home view at home.
- [ ] The rail (ADR 0029, 0030): the mark alone at its top, centred, in a block as tall as the header, the two rules meeting; Settings as one 56 px row at its bottom, level with the tips strip when tips are on (a padlock only with a PIN set and no grant open); folded it is 72 px of icons with the mark, every room, a 56 px Add circle and the gear, nothing clipped, and the header and board start where it ends. Hide the rail is in the header before the date and the Today panel's button at its other end, each icon facing its own panel; with the rail on the right they swap ends. By hand: the fold eases and the words fade, in both directions.
- [ ] Today's column is lit, the now line sits between the right chips with its time label, past chips are dimmed, an in-progress chip is solid.
- [ ] Hours (both display sizes, light and dark): with no zoom the whole day fits with nothing to scroll and the gutter's hours line up with the grid; chips sit at their times with tap-sized buttons; the now line's label reads over a solid in-progress chip; Fit the day and Zoom out are grey until it's zoomed, four taps of Zoom in give an hour about five times as tall with half-hour lines and no scrollbar, and zoomed all the way a 15-minute event has a full chip and Zoom in is grey; the zoom's three buttons sit in a row on the grid's bottom corner (Fit the day, Zoom out, Zoom in), stay put while it scrolls, and are the only thing over the grid.
- [ ] With Show tips on, the strip sits under the board between the rail and the Today panel (above the bottom bar in portrait), its tip on one line with an ellipsis and Next tip at 56 px; toasts sit above it; Hours with no zoom still fits with nothing to scroll, and no chip in a column is covered to less than 24 px.
- [ ] A person's birthday shows on its day as an all-day chip in their color with the cake mark (the seed's Mia, on Friday), on the Week, Day, Month and People views and in the phone's Calendar lists.
- [ ] With six calendars in fake mode no column overflows without "+N more", the person filter fades the rest without hiding it, and the Today panel has at most nine lines.
- [ ] Avatars always show an initial or photo; Everyone is neutral; names accompany colors on every arm's-length surface.
- [ ] The Add panel shows the board behind it; the keyboard docks across the bottom from the rail to the screen's edge (full width in portrait and on the pair screen), its keys centred, a row of numbers above the letters; the row of kinds, the field and the primary button are visible above the keys; the kinds are one row (scrolling on a phone, never wrapping); the Who row never wraps (six cells at 64 px on the wall); the Day strip starts on the household's day; the form is in three parts 32 px apart (What and who with no heading, When, Details) and no row of chips wraps; Time, How long and Repeats are one button each that says what's chosen, and their pickers, Pick a date and Custom… open in place and in view; a chip that opens something is outlined with a chevron, never filled; labels are quieter than what's under them; nothing shows under the pinned button; a meal is one box with the saved meals in one row under it.
- [ ] Settings (ADR 0029): no page has a Save button, and a sheet still has its own; a person, a calendar, an account, a reward and a routine are rows with a chevron, and their sheets are titled "Edit …"; a color picker shows the free colors first and whose the others are; an account's sheet has its status, Sync, "Show on" the paired screen's name and Remove account, and a calendar's page inside it comes back with "Back to …"; Recently Removed is its own page; on a phone and a laptop Backup ends with Start Over, and on the kitchen screen it doesn't.
- [ ] No `title=` attributes, no hover-only controls, no all-caps, no IDs or feed URLs, no emoji in the app's own copy.
- [ ] An empty room (Lists, Tasks, Photos at least: the screenshots' `lists-empty`, `tasks-empty`, `photos-empty`) is centred: the icon in its circle, the short line, the note, one big button (on the wall 64 px, centred in the room; on a phone the bar's), a paired screen's QR where Photos' button would be; a list with nothing on it is still a quiet line; quiet pills are one line.
- [ ] The screensaver's photo is uncropped and the clock band is the only overlay; Night is black with the dim clock; the evening dim darkens the whole page evenly and nothing else changes.
- [ ] Portrait: the header is on top in two rows (today, then the room's controls), the Today band is under it and every Today block fits in its three columns (Tasks Today, Tonight, To Do, Coming Up), the rail is a bottom bar with labels, days are rows with four two-line chips per line, today's row is lit, sheets rise to two-thirds height, the keyboard never covers the field or the button.
- [ ] Motion, by hand in `just dev`: the done moment plays, its "+2" flies to the person's avatar in the Today panel, and Undo reverses all of it; a long press on a list's tile opens Change list without opening the list; a week swipe pages by a week and the new week slides in from that side, as the arrows do (following the finger isn't built: §9); a long-press lifts a chip and a drop moves it with a toast; an event added from a phone eases onto the wall and one removed fades away, and the board's first paint, a page and a view switch move no chip; a stamped task and a checked item glide under Done and back on Undo; a count pops when it changes; the Today panel's button slides the panel open and shut; a routine's finished step slides off as the next comes in; a panel slides in with the keyboard and the field in view; the theme crossfades at the forced sunset in fake mode; the screensaver fades in after the test idle (30 s in fake mode) and a tap wakes it without triggering what's under the finger; with Reduce Motion on, all of it is instant and the done moment still reads as done.
- [ ] Setup (ADR 0032) at 1440×900 (`desktop`: `setup-welcome`, `setup-household`, `setup-people`, `setup-done`) and 390×844: on the laptop the six steps beside the form, the current one marked and the done ones checked, both columns centred, Back at the left of the main button; on a phone the brand row with "2 of 6" and the six-segment bar; Welcome and You're Set centred with one big button.
- [ ] Nothing comes from real household data; fake mode only; `.screenshots/` is gitignored.

## 11. Refinements adopted from the interaction design

| Refinement | Reason |
|---|---|
| The Today panel's **Up Next** is the biggest text on the board; the header's clock is 40 px and the 200 px clock lives on the screensaver and Night | A glance from the sink wants "what's next" more than the time |
| **Stacked chips, no hour grid, on the week board** (still the default, Agenda; Hours is the household's opt-in grid since M6, with a zoom for when a slot is too small); the now line is a divider that drops as events end; the Day view is the only timeline, with collapsed free time | At 1080p a 30-minute slot is about 30 px: too small for a 56 px target or 24 px text. Stacked chips are what a paper calendar does |
| **Portrait shows days as rows**, four two-line chips per line | Seven 150 px columns truncate every title |
| **Tapping empty space on a day adds an event on that day**; the editor is a side panel so the board stays visible | "Events are hard to add on-screen" is a top complaint; the common case is two taps and one line of typing |
| **Person filters clear after 2 minutes idle; rooms return to the calendar after 5** | A shared wall must look the same to the next person who glances |
| The keyboard **docks under the panel at 960 px wide**, not full width | Full-width keys under a right-hand panel put the field 900 px from the keys. Changed by ADR 0032: the owner found it unfamiliar, so it's a dock from the rail to the edge with the keys (still 80 × 64) centred, and a number row |
| **One pair-code system** (six characters, 10 minutes, once) for pairing a screen and adding a phone | One mental model |
| **Assigned tasks need no attribution tap**; Anyone tasks ask "Who did it?"; list adds on the display attribute nothing unless an avatar is tapped | Forcing a tap on every task adds a step to the moment that should feel instant |
| **Child-safe editing** (on when a child exists) and **Recently Removed** (7 days) | Toast Undo is not enough on a screen a child reaches |
| **Accounts are added from any device** (ADR 0028): passwords are typed on the wall's keyboard, masked, behind the PIN; a key file and Google's own page go to a phone with a QR | The family adds an account wherever they are. Masking keeps the password from the room; the wall has no files and can't show Google's page |
| **Routines live in the Tasks room and the Today panel**, not on the board | A nightly chip on the calendar is clutter |
| **Night** is an app state (black or a dim clock); the backlight is the Pi helper's job (PLAN §13) | A browser can't switch a monitor off; the app does the part it can |
| Sound for the done moment is **off by default** | Kitchens are loud enough |
