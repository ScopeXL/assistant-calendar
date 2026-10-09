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

**The bar:** if a six-year-old, a grandparent or a guest has to ask how the screen works, the design failed. Design for a glance from the sink at three metres, and for a tap with a wet finger at arm's length. The person who sets it up is a non-technical self-hoster on a phone; they never type a secret on the wall. Two surfaces, one app: the display is the family's shared wall, open, no sign-in, always on today; phones are private, remember who holds them, and do the typing-heavy work.

## 1. Rules for every screen

**Two distances on one display.** Every element is either a *glance element* (read from 2–3 m) or an *arm's-length element* (read and tapped from 50 cm), and the two never share a size. Glance elements, big and few: the rail clock and date; Now and Up Next in the Today panel; today's day number and the lit column; chore progress per person ("Mia 2 of 3"); Tonight; countdown numbers; the screensaver clock and next event. At Standard text size on a 24" 1080p monitor a glance element reads at 3 m (about 15 mm cap height, 40 px Lexend or larger); on a 15.6" monitor at 2 m. Glance elements are never truncated mid-word and never share a line with secondary text. Everything else (chips, headers, lists, chore rows, meal cells, buttons, the keyboard, settings, sheets) is arm's-length.

**Type sizes on the display** (CSS px at Standard; Large multiplies by 1.15 and Extra large by 1.3 through the root font size; nothing on the display is smaller than 18 px):

| Role | Standard | Line | Where |
|---|---|---|---|
| Caption | 18 | 24 | "Updated 9:10 AM", keyboard hints |
| Secondary | 20 | 28 | Times on chips, "Done by Mia", locations, column counts |
| Body | 24 | 32 | Chip titles, list items, chore titles, meal names, button labels (600) |
| Title | 32 | 40 | Board title ("October 2026"), room titles, panel titles, day headers |
| Glance | 40 | 48 | The Up Next title, "All done, Mia!" |
| Rail clock | 56 | 56 | Weight 800, digits in fixed-width boxes (ADR 0021), as large as the rail allows up to this; no AM/PM in the rail |
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
| Checkboxes (chores, items) | 64 px box inside a 96 px × full-row tap area | 48 px box in 72 × 80 |
| Avatar chips in Who pickers | 64 px circle, 96 px wide with the name | 48 px circle |
| Keyboard keys | 80 × 64 landscape, 88 × 72 portrait, 8 px gaps | native |
| PIN pad keys | 112 × 88 | native numeric |
| The routine Done button | 120 px tall, 60% of the width | 64 px |
| Undo on a toast | 64 px | 44 px |

Nothing a finger taps is under 56 px on the display or 44 px on phones, with at least 8 px between neighbours on a line (the options of one segmented control and the cells of a tab bar or the rail count as one control); the e2e tests check both. **Every action has a visible button**: swipes (week paging), long-presses (chip drag) and taps on empty board space are shortcuts for something that also has a button. On the Week board's **Hours** layout a short event is still a full-size button whose top is at its time, so in one column a later chip can sit on the transparent tail of an earlier one; a chip too small to read is what the zoom is for, the way a Month cell opens its day (ADR 0028).

**Spacing and surfaces.** An 8 px grid; display gutters 24 px; board column gaps 8 px; chip padding 12 px vertical and 16 px horizontal; rows 64 px (72 with a second line); section gaps 32 px. Shell widths in landscape: rail 192 px, Today panel 400 px (both in rem, so they widen with the text size), the board gets the rest (1328 px: seven columns of about 190 px with the panel, about 245 px without). The rail is 192 px rather than the planned 176 because Lexend's figures are wide and the clock must fit (ADR 0021). Portrait: a 400 px Today band on top, a 112 px bottom bar, board rows between. The rail, the board and the Today panel are three flat surfaces that differ by tint only; sheets and panels are a fourth; cards exist only where something really is a card (a list tile, a countdown tile, a reward, a photo); no shadows except on a lifted chip and an open panel. Corner radius follows hierarchy: panels and sheets 24 px (20 on phones), buttons 16 (12), event chips 12 (8), avatars and filter chips round. Today's column is one step lighter than the wall; past chips sit above the now line and are dimmed; the in-progress chip is filled solid in its person's color. Reading width on laptops is capped at about 72 characters.

**The on-screen keyboard (display).** Sunroom's own (ADR 0022). Appears only when a text field is focused, slides up in 220 ms, never on first paint and never on a laptop that sent a physical key event in the last 5 s. In landscape it is 960 px wide and docks bottom-right under the side panel (bottom-left when the rail is on the right); in portrait it is full width. It never covers the focused field or the panel's primary button: the panel scrolls so the field sits 16 px above the keys, and the primary button stays pinned above them. Layouts: letters; numbers and symbols; a numeric pad for times, PINs and codes; a code layout for pair codes; long-press for accents. A suggestion row above the keys shows what the field most likely wants as chips: recent event titles, Usuals on a list, saved meals, member names when the parser sees a name beginning. Shift is automatic for a title's first letter; no autocorrect. **Done** lowers the keyboard and keeps the draft; ↵ in a quick-add field saves, elsewhere it is Done; tapping outside a field lowers the keyboard and keeps the draft.

**Undo, drafts, confirmations.** Prefer Undo over confirmation: every destructive or attributing action shows an Undo toast, 8 s on the display (people look up later), 6 s on phones; two toasts at most on the display, three on phones. Confirmation sheets exist only for what Undo can't cover: remove a person, disconnect an account, delete a list that still has items, unpair a screen, erase all data; their buttons name the action ("Remove Mia" / "Keep Mia"). Recently Removed keeps removed things for 7 days. Drafts save themselves: a phone editor closed mid-way picks up where it was; on the display an editor left open closes after 10 minutes idle and its draft shows as a "Continue: Dentist Thu…" chip in the Add panel for an hour.

**Attribution.** When an action needs a person it shows the Who picker (each member, Everyone, A guest). The display's default is Everyone: adding an item or an event attributes nothing unless someone taps an avatar; completing an assigned chore needs no extra tap; completing an Anyone chore asks "Who did it?" beside the box. Phones attribute silently to whoever is using them. Attribution reads as a sentence under the thing ("Added by Mia", "Done by Mia · 4:12 PM", "Sam cooks"), never a bare avatar on an arm's-length surface.

**Speed, live, offline.** Taps respond instantly (optimistic; a pressed control dips and shades in 90 ms; a button waiting on the server keeps its label, shows a small spinner and can't be tapped twice). Anything saved on a phone shows on the display within a second and the other way round; the display never needs a refresh. Two kinds of offline, both quiet pills (§8): the display can't reach the server; the server has no internet.

**Idle, wake and reset.** The display is shared, so it quietly returns to the shared state: after 2 minutes idle the person filters clear and the board scrolls back to this week; after 5 any room returns to the Calendar room (Settings can pick another home); after 10 an open editor closes into a Continue chip; after the screensaver setting (default 10) the screensaver starts if Photos is on; the sleep schedule brings Night. Any tap while asleep wakes to where it was (or to the week board if asleep over 30 minutes), and the waking tap does nothing else.

**What never appears.** Internal ids, full feed URLs (secret addresses show as "…/private-3f9a…/basic.ics"), tokens, keys after upload; jargon (users see "iCloud", "a calendar address (.ics)", "Sign in with Google", "the kitchen screen", never "CalDAV", "ICS feed", "OAuth", "kiosk"); native tooltips, hover-only affordances, double-taps, pinch as the only way; all-caps labels, "A · B · C" strings in running text, emoji in the app's own copy; machine timestamps, "null", HTTP codes; subscription or upsell language of any kind.

**Theme and first paint.** Light, Dark and Auto (dark from sunset to sunrise using the household's location, or 7 PM–7 AM without one); the wall tint follows the time of day in both themes (§7), AA holding at every stop. Nothing animates on first paint or a room switch; the board opens on this week with today visible and the Today panel on Now / Up Next.

## 2. Words

Plain words in the family's own vocabulary. A button says exactly what happens and the toast repeats the verb.

**Case** (ADR 0028). Titles, headings and navigation labels are in Title Case: screen, page, room, sheet, panel and dialog titles; section headings, the Today panel's included; the names of views, tabs and rail rooms; the header's quick jumps (This Week, Today, This Month). Capitalize every word except a, an, the, and, or, but, of, to, in, on, at, by, for, with, unless it is the first or last word or follows a colon: "Who's Doing What", "Take Your Data with You", "Google: The Secret Address", "Bring in Your Calendars". Everything else stays sentence case: action buttons (Add event, Save changes, Clear done, Check now), toasts, hints, row and field labels (Text size, Live updates), segmented options that aren't view names (Extra large), chips, body, empty states and error copy. A page's name inside a sentence keeps its Title Case ("open Settings → Calendars & Accounts"). Dates and spans ("October 2026", "Oct 5–11", "Wed, Oct 7") are unchanged, and so is the lowercase "today" beside the Day view's title. Never all caps. The design-rules test checks every title written as a literal.

The user-facing glossary is PLAN §2; a few words only the UI uses: **Room** (a top-level area on the rail or a phone tab), **Board** (the display's main area), **Today panel** (the glance column), **Now / Up Next / Later Today / Tomorrow** (the panel's headings, only the ones with content), **Tonight**, **Coming Up**, **Chip** (an event on the board; also the pick-one buttons in editors), **Home calendar** (Sunroom's own, always there and writable), **Google · Family** (a synced calendar named as in its source), **Just this one / This and the ones after / All of them**, **Quick add**, **Usuals**, **Mia's turn**, **Done by Mia**, **All done, Mia!**, **Stars** (always a star glyph with the number), **Ask for it / Approve / Not now**, **Pair code**.

**Time and date words.** "4:00 PM" or "16:00"; minutes always shown except in month cells and phone week strips ("4 PM"); "Today", "Tomorrow", "Yesterday" within a day in sheets and the Today panel, otherwise "Thu, Oct 9"; board headers always "Thu 9"; full weekday names only in the Day view title. Lengths: "30 min", "1 hour", "1½ hours", "all day", "until 5:30 PM". Counts: "2 of 3", "12 to get", "+2 more", never "2/3". Relative: "in 20 min", "12 days", "Updated 9:10 AM", "hasn't answered since 9:10 AM".

**Buttons and their toasts** (Undo unless noted): Add event → "Added Dentist"; Save changes → "Changes saved"; Remove event → "Removed Dentist"; Move to Thu or a drop → "Moved Soccer practice to Thu"; Done (chore) → "Done by Mia"; Add to list → "Added Milk"; Clear done → "Cleared 8 done items"; Add dinner → "Added Tacos for Tuesday"; Ask for it → "Asked for Movie night. A parent will say yes or no." (no Undo; **Take it back**); Approve → "Mia got Movie night"; Not now → "Told Mia not now"; Finish routine → "Bedtime routine done"; Pair → "Kitchen screen paired"; Connect iCloud → "Connected iCloud · 3 calendars"; Disconnect → "Disconnected iCloud" (**Connect again**); Put back → "Put back Dentist"; Set PIN → "PIN set".

**Error copy** says what happened and what to do, in the app's voice, without apology or codes: "That PIN didn't match. Try again." · "Too many tries. Wait 1 minute." · "That password didn't match. Try again." · "That code didn't work. A code works once, for 10 minutes. Make a new one on the phone." · "Not saved — the screen can't reach Sunroom. It will try again." · "Not saved — you're offline. Try again when you have signal." · "Google hasn't answered since 9:10 AM. Showing what we had." · "iCloud said that password isn't right. Make a new app-specific password and try again." · "That address didn't give us a calendar. Check it ends in .ics, or try another way." · "This event comes from iCloud · Work and can't be changed here. Change it in the Calendar app." · "Only a parent can approve rewards. Ask one, or enter the PIN." · "That name is already in use. Pick another." · "Photos need room: 2 GB free. Remove some, or move photos to a bigger disk (About → Storage)."

## 3. Navigation and layout

**The display shell (landscape, 1920×1080).** Three surfaces: the rail (left, 192 px), the board, the Today panel (right, 400 px, hideable per screen).

```
+----------+----------------------------------------------------------------------------+------------------------+
| 9:41     | October 2026  Oct 5–11           [Week] [Day] [Month] [Who's Doing What]   | Up Next                |
| Tue      | [<]  [This Week]  [>]     Show (All) (M) (L) (A) (S)       [Today panel ⇥]|                        |
| Oct 7    |----------------------------------------------------------------------------| 4:00 PM                |
| ☼ 64°    |  Sun 5   |  Mon 6   |  TUE 7   |  Wed 8   |  Thu 9   |  Fri 10  |  Sat 11  | Soccer practice        |
| H 72 L 55|          |          |  today   |          |          |          |          | (M) Mia · Field 3      |
|          |----------|----------|----------|----------|----------|----------|----------|                        |
|----------| Columbus |          | Pajama   |          |          |          | Hike     |------------------------|
| [cal]    | Day (All)|          | day (L)  |          |          |          | (All)    | Later Today            |
| Calendar |----------|----------|----------|----------|----------|----------|----------| 6:30 PM  Dinner at     |
|          | 10:00 AM | 8:00 AM  | 8:00 AM  | 9:00 AM  | 2:30 PM  | 3:30 PM  | 9:00 AM  |          Grandma's     |
| [list]   | Church   | Dentist  | School   | Vet      | Dentist  | Pickup   | Soccer   |          (All)         |
| Lists    | (All)    | (S)      | drop-off | (A)      | (M)      | (L)      | game (M) | 7:30 PM  Leo's bedtime |
|          |          |          | (A)      |          |          |          |          |          routine       |
| [check]  | 2:00 PM  | 4:00 PM  |· now 9:41|          | 4:00 PM  | 6:00 PM  | 12:00 PM |                        |
| Chores   | Grandma  | Piano    | 4:00 PM  |          | Soccer   | Pizza    | Lunch at |------------------------|
|          | visit    | (L)      | Soccer   |          | practice | night    | Nana's   | Chores Today           |
| [meal]   | (All)    |          | practice |          | (M)      | (All)    | (All)    | (M) Mia   2 of 3       |
| Meals    |          | 6:30 PM  | (M)      |          |          |          |          | (L) Leo   1 of 1 done  |
|          |          | Book club|          |          |          |          |          | (S) Sam   0 of 1       |
| [photo]  |          | (A)      | 6:30 PM  |          |          |          |          |------------------------|
| Photos   |          |          | Dinner at|          |          |          |          | Tonight                |
|          |          |          | Grandma's|          |          |          |          | Tacos · Sam cooks      |
|          |          |          | (All)    |          |          |          |          |------------------------|
|  ( + )   |          |          | 7:30 PM  |          |          |          |          | Coming Up              |
|  Add     |          |          | Bedtime  |          |          |          |          | 12 days  Mia's birthday|
|          |          |          | routine  |          |          |          |          | 31 days  Beach trip    |
| [lock]   |          |          | (L)      |          |          |          |          |                        |
+----------+----------+----------+----------+----------+----------+----------+----------+------------------------+
```

`(M) (L) (A) (S)` are 28 px avatar circles with initials in each person's color; `(All)` is the neutral Everyone mark; "TUE 7 · today" is the lit column; the 8:00 AM chip in today's column sits above the now line, dimmed. Rail contents, top to bottom: the clock (56 px, 800, digits in fixed-width boxes), weekday and date (20 px), weather (icon and temperature at 24 px, high and low at 18; tap for the day's hours and the week), a divider, the rooms in the household's order (36 px icon, 20 px label, 96 px tall each; at most six, the rest fold into More), a flexible gap, **Add** (a 64 px circle with a plus), the lock (its screen-reader name is "Settings"). Board header on every view: the title (month and span), the arrows and "This Week" (or Today, This month), the view switch (Week · Day · Month · Who's Doing What), the person filter row ("Show" and avatars, multi-select, clears after 2 min idle), the Today panel toggle (an icon, like the arrows), and the live-updates icon at the right, the board's top-right corner; on the Week, its own tools end the second line: the zoom (**24h · 12h · 1h · 15m**, while Hours is on) and the layout switch (**Agenda · Hours**, two icons in a narrow header), both back to the household's after 2 min idle; off this week, the title gains a quiet "Back to this week" chip. Today panel, top to bottom, each section only with content and its plugin on: **Now** (an event in progress, "until 5:00 PM"), **Up Next** (time at 24 px, title at 40, person and location at 20), **Later Today**, **Tomorrow** (only after 6 PM), **Chores Today** (a line per person with a small progress ring), **Tonight**, **To Do** (list items due today), **Coming Up** (the two nearest countdowns). Tapping any line opens its thing.

**Layout options compared.** Three boards were drawn: **A**, week columns plus the Today panel (above); **B**, a Today hero (today's events at glance size, chores, Tonight, the nearest countdown) with a week strip of day rows and dots; **C**, Who's Doing What (a column per person, Everyone first, for today or this week).

| | A: Week + Today panel | B: Today hero + strip | C: Who's Doing What |
|---|---|---|---|
| Glance at 3 m | Good: Up Next and today's lit column are glance-sized | Best: every line of today is glance-sized | Fair: today per person reads; nothing beyond today |
| Editing ease | Best: tap a day to add on it; drag chips across days | Fair: only today is in reach | Fair: no day targets |
| Density with 6 calendars | Good: 9–12 chips a day before "+N more"; filters and per-calendar "show on this screen" | Poor beyond today | Good for today; cramped with 5+ people in week mode |
| Portrait | Days become rows, the panel becomes the top band | Natural | Columns fall under 180 px with 6 people |
| Who it suits | Most households | Small households, grandparents, a hallway screen | Big households; children who want to see "mine" |

**Decision:** A is the default board; B is the **Today** view (selectable, and the default on screens narrower than 1280 px); C is **Who's Doing What**; Month is the fourth view. The Today panel can be hidden per screen.

**Portrait (1080×1920).** The Today panel becomes a band at the top (28rem, about 450 px, so it grows with the text size) with the clock, date and weather in its header strip, and its blocks in three columns: Now, Up Next, Later Today and Tomorrow in the first; the plugins' blocks flowing through the other two (Chores Today, Tonight on one line, To Do without its detail line, the next countdown); the rail becomes a 112 px bottom bar; the week shows **days as rows** (seven 150 px columns would truncate every title): the same two-line chips, 224 px wide, four per line, two lines per row before "+N more" (the all-day band on a line of its own, and "+N more" only as wide as its words); today's row is lit and the now line is a vertical divider that moves right as events end. Orientation is detected from the viewport and can be forced in Settings → Display. Panels become bottom sheets at two-thirds height; the keyboard is full width.

```
+------------------------------------------------------------------+
| 9:41   Tue, Oct 7                            ☼ 64°  H 72  L 55   |
|------------------------------------------------------------------|
| Up Next                  | Later Today            | Chores Today  |
| 4:00 PM                  | 6:30 PM  Dinner at     | (M) Mia 2 of 3|
| Soccer practice          |          Grandma's     | (L) Leo done  |
| (M) Mia · Field 3        | 7:30 PM  Leo's bedtime |---------------|
|                          |          routine       | Tonight       |
|                          |                        | Tacos · Sam   |
|------------------------------------------------------------------|
| October 2026  Oct 5–11        [Week] [Day] [Month] [Who's Doing] |
| [<]  [This Week]  [>]         Show (All) (M) (L) (A) (S)         |
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
|  [cal]      [list]     [check]     [meal]     [photo]   (+)  [lock]
|  Calendar   Lists      Chores      Meals      Photos    Add      |
+------------------------------------------------------------------+
```

**The phone shell.** A bottom tab bar with five slots: Today, Calendar, then enabled rooms in the household's rail order until four slots are used, then More (always last; holds the rest plus Settings, Who's Using This, Pair a Display, Install the App, About). Sheets rise from the bottom for editing and choices, close with a visible Done, Cancel or Save (swiping down is a shortcut), take focus on open and return it on close. Primary actions sit in the thumb zone. **Laptops** (1024 px and up) get the display shell with a physical keyboard and no on-screen keyboard; hover adds nothing; arrow keys work on the board.

**What each plugin contributes.**

| Plugin | Rail room / phone tab | Today panel | Board | Settings page |
|---|---|---|---|---|
| Calendar (core) | Calendar | Now, Up Next, Later Today, Tomorrow | Week, Day, Month, Who's Doing What, Today | Household |
| Synced Calendars | — | — | Their events, colored by the assigned person | Calendars & Accounts |
| Lists | Lists | To Do (items due today) | — | — |
| Chores | Chores | Chores Today; routine prompts in their window | — | Chores (stars, rewards, routines) |
| Meals | Meals | Tonight | An all-day overlay chip if enabled | Meals (which slots) |
| Countdowns | Countdowns | Coming Up | A quiet day marker | — |
| Photos & Screensaver | Photos | — | The screensaver | Photos & Screensaver |
| Weather | the rail block | — | The screensaver corner; day-header icons | Household → Location |

## 4. Display screens

**Welcome and Pair this screen.** Before the household exists, the display shows a QR code and the address, because setup happens on a phone: "Set up Sunroom on your phone. Open sunroom.local or http://192.168.1.20. Then come back here: this screen will show a code to pair it." Once a password exists:

```
+-------------------------------------------------------------------------------------------------+
|                                        [sun mark]  Sunroom                                      |
|                                    Pair this screen                                             |
|                                   7 K 4 M 9 X          (160 px, spaced)                         |
|          On your phone, open Sunroom, then More, then Pair a Display, and type this code.        |
|                           The code changes every 10 minutes.                                    |
|                                 Type the household password here instead                        |
+-------------------------------------------------------------------------------------------------+
```

The code is six characters from the no-look-alike alphabet, rotates every 10 minutes, and pairs once. "Type the household password here instead" swaps the code for one masked field with show/hide and the keyboard; the field clears after 60 s idle. After pairing: "Name this screen" with chips (Kitchen, Hallway, Living room, Office, Other) → **Done** → the week board. The screen never asks again unless unpaired.

**Week board** (drawn above). Chips show the start time (secondary) with the person's avatar at the right, then the title (body, at most two lines). All-day events sit in a band at the top of each column; multi-day events repeat in each day with "→" after the title on all but the last. One person: a 12% tint of their color with a 6 px bar at the left; several people: a neutral tint with up to three avatars; Everyone: neutral; in progress: solid fill with white text; past (today): no tint, ink-soft text. The now line is a 2 px line across today's column with "now 9:41" at its left end under the last finished chip; it drops to the next slot in 400 ms when an event ends; other columns have no line. "+3 more" appears as the last row when chips don't fit and opens the Day view. Tap a chip → the event sheet; tap empty space in a column → the editor with that day set; long-press a chip → drag to another day; swipe horizontally → previous or next week. Filters show the chosen people's chips plus Everyone's and fade the rest to 30% so the week's shape stays. Weekend first or last follows Household → Week starts on. A person's birthday from Family is an all-day chip in their color with a cake before the title ("Mia's birthday"), whatever features are on; it can't be moved, and a tap opens its sheet, which says "From Mia's birthday in Settings → Family."

**Week board, Hours layout** (Settings → Display → Week layout, or the switch on the board; ADR 0028). Each day is a column from midnight to midnight: the hour gutter at the left (every other hour at 24h, every hour otherwise, in the household's 12- or 24-hour clock), each day's head (its name, then up to three all-day chips and "+N more") staying on top while the hours scroll under it, and every timed event placed at its time and as tall as it lasts. **24h** fits the whole day on the screen with nothing to scroll; **12h** shows half the day, **1h** twice that (at least 9rem an hour, so a half-hour event gets a full two-line chip), **15m** twice again; the grid scrolls with a visible scrollbar, starting with now a third of the way down (7 AM on another week), and a zoom keeps the minute in the middle of the view where it was. A chip's button is never shorter than a tap target, and a block as tall as the event inside it shows what fits: a time row and the title (two title lines when tall), the title and time on one row, the title alone in a caption, or only its tint; the time drops out of columns narrower than 10rem. Events that overlap share the column in lanes, at most three side by side and each at least a tap target wide (two at 1080p with the Today panel, three without it); when a group has more, the last lane says "+2" and opens the day. Past events today keep a faint block; the in-progress one is solid. The now line runs across today at the minute and creeps down as it passes (§9). A tap on an empty spot adds an event at that time, to the quarter hour; a long press lifts a chip to another day, keeping its time. Reduce Motion makes the now line step once a minute.

**Day view**, the only timeline: every hour gets at least a thin band, every event a full chip, and empty stretches collapse into one "free until 4:00 PM" line, so the day never scrolls for nothing. The now line moves continuously through the bands and glides through an event while it is on.

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | Tuesday, Oct 7 · today     [<] [Today] [>]       [Week] [Day] [Month] [Who] | Today panel            |
|          |----------------------------------------------------------------------------|                        |
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

Overlapping events sit side by side, each at least half the width; more than three overlapping become "+2 more". Tapping an hour band opens the editor with that day and hour set. Chores are not on the timeline; they live in the Today panel and the Chores room.

**Month view**: cells with the day number (28 px, today's in a filled circle), up to three one-line entries at 20 px with a 4 px color bar and the person's initial, then "+N more"; a countdown's day shows a small star mark; the current week is lit a step and today two. A cell is one button that opens its Day view, where every event is a full chip: three tappable entries won't fit a cell at the wall's 56 px tap size (decided in M1).

**Who's Doing What**: one column per person, Everyone first, in household order; Today or This Week (rows per day inside each column, compact one-line chips). Each column: the avatar at 72 px with the name (glance-sized so a child finds their own column), today's events, that person's chores with working checkboxes (the same celebration as the Chores room), then "Cooks tonight" if set. Up to seven columns fit; an eighth pages horizontally.

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

**Change** opens the editor filled in; **Move** opens a day picker (the next 14 days as chips plus a month grid) and asks "Move Which?" for a repeating event; **Remove** removes with Undo and asks "Remove Which?" for a repeating event. A read-only synced event shows the source line in place of the buttons: "From iCloud · Work. Change it in the Calendar app." A writable synced event behaves like a Home event and says "Google · Family" quietly. With Child-safe editing on, Change and Remove on the display ask for the parent PIN; Move does not.

**Add and the event editor.** **Add** (the rail's plus) opens the Add panel with the type that fits the current room preselected and the quick-add field focused; tapping empty space on a day column, an hour band or a month cell opens it with Event selected and that date set. The board stays visible and accepts one kind of tap while the panel is open: a day, to set the date.

```
+----------+-----------------------------------------------------------+------------------------------------------+
| rail     | October 2026   (board, lit; tap a day to set the date)    | Add                              [Close] |
|          |  Sun 5 | Mon 6 | TUE 7 | Wed 8 | Thu 9 | Fri 10 | Sat 11  | [Event] [Item] [Chore] [Meal] [Countdown]|
|          |        |       |       |       | ▲ set |        |         |                                          |
|          |        |       |       |       |       |        |         | [ Dentist Thu 2:30pm Mia              ] |
|          |        |       |       |       |       |        |         | Understood as:                           |
|          |        |       |       |       |       |        |         | Dentist                                  |
|          |        |       |       |       |       |        |         | [Thu, Oct 9] [2:30 PM] [1 hour] [(M) Mia]|
|          |        |       |       |       |       |        |         | [Doesn't repeat] [Home calendar] [More…] |
|          |        |       |       |       |       |        |         | [              Add event              ] |
|----------+-----------------------------------------------------------+------------------------------------------|
|                                                 | Recent: [Dentist] [Soccer practice] [Piano lesson]     [Done] |
|                                                 |  q   w   e   r   t   y   u   i   o   p                        |
|                                                 |   a   s   d   f   g   h   j   k   l                           |
|                                                 |  ⇧   z   x   c   v   b   n   m   ⌫                            |
|                                                 |  123        space              ↵                              |
+-------------------------------------------------+---------------------------------------------------------------+
```

Quick add parses as you type, locally (chrono-node plus a small grammar for people and repeats): the title; a day word (today, tomorrow, Mon…Sun, "next Tue", "Oct 9", "9/10" by locale); a time ("2:30pm", "14:30", "noon", "2-3pm" sets both); a length ("for 2h", "30 min"); a person's name or nickname; a repeat word ("every Tue", "daily", "weekdays", "monthly"); "all day". The chips under the field show what was understood; each is a button that opens its picker, so anything misread is one tap to fix; nothing parsed means a title-only draft on the selected day, all day; the words the parser used stay in the field. The chips: **Day** (Today, Tomorrow, the next five weekdays, Pick a date; or tap a day on the board), **Time** (All day toggle; hours 6 AM–10 PM as chips with Earlier and Later; minutes :00 :15 :30 :45), **How long** (30 min, 1 hour, 1½ hours, 2 hours, 3 hours, Until), **Who** (the Who picker, multi-select), **Repeats** (Doesn't repeat, Every day, Every weekday, Every week on Thu, Every 2 weeks on Thu, Every month on the 9th, Every year on Oct 9, Custom with every N days/weeks/months, weekdays, ends never / on a date / after N times), **Calendar** (Home first, then every writable synced calendar; read-only ones don't appear; the last-used calendar for this person preselected), **Color** (defaults to the person's color; "Choose a color" for shared things), **More…** (Location with recent places as chips, Notes, Remind on the kitchen screen: none, 10 min, 1 hour, 1 day before).

**The Add panel for other things.** Item, Chore, Meal and Countdown use the same side panel as Event, with their own chips: an item has Which list (chips of lists; the open list preselected), Who (optional), Day (optional), and commas make several items ("Milk, eggs, bread" adds three); a chore has Who or Anyone, Due (a time or none), Repeats, Stars (0–5 as chips, if stars are on); a meal has Day, Which meal (Breakfast, Lunch, Dinner if enabled), Who cooks; a countdown has Day, Who and an optional color. The primary button says **Add event** / **Add item** / **Add chore** / **Add dinner** / **Add countdown** (or **Save changes**) and is pinned above the keyboard; ↵ in the field is the same as the button. After saving, the panel closes (exit), the new chip eases in, and the toast offers Undo.

**Lists room**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | Lists                                                        [+ New list]   | Today panel            |
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

Tiles 400 × 160 px, two or three across: the name at title size, the count at body, the last change at secondary. **New list** asks for a name with chips (Groceries, To do, Packing, Costco, Pharmacy) and opens it. **Change list** in a list's header renames or removes it (removing confirms when the list has items; otherwise Undo); a long press on a tile (500 ms, held still) is a shortcut to it, and its release doesn't open the list.

**List detail**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | [< Lists]   Groceries                     12 to get           [Clear done]  | Today panel            |
|          |----------------------------------------------------------------------------|                        |
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

Rows 72 px; a 64 px checkbox at the left in a 96 px tap column; the name at body size; who added it, a person and a day at secondary size on the right. Checking draws the marker line in the checker's color (Dinner Bell's strike), then the row folds into the collapsed Done group after 600 ms; toast "Checked off Milk" with Undo. On the display the checker is Everyone unless an avatar was tapped first (the add row's avatar chip doubles as "who is checking" and resets to Everyone after 2 minutes idle). **Clear done** removes all checked items with Undo. The add row sits at the bottom; focusing it raises the keyboard with the Usuals strip still visible; **Add** saves and keeps focus for the next item. Tapping a row's text opens a small sheet: Rename, Who, Day, Remove. An item with a day shows in the Today panel on that day.

**Chores room**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | Chores · Today                 [Today] [This Week]       [Stars & Rewards]  | Today panel            |
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

One column per person with chores today, plus **Anyone** last; the header is glance-sized (avatar, name, "2 of 3", the star balance if stars are on); empty columns read "Nothing today". A chore row: a 64 px box, the title at body size, due time, stars and "Mia's turn" at secondary. Done rows move under a Done heading in the same column and keep their stamp; they are not hidden, because seeing them is the reward. Completing an assigned chore is one tap; an Anyone chore pops "Who did it?" beside the box. Undo on the toast reverses the stamp and the stars; tapping a done box again un-does it ("Not done yet"). **This Week** shows seven compact rows per column (day, count, a check or a dash), the fridge-chart feel. Routines appear at the bottom of their child's column during their window with **Start**. Editing: tap the title → Change, Skip today (with Undo), Remove.

**Stars & Rewards** (when enabled): a balances strip per child ("★ 42 · +12 this week · 6 days in a row"), reward tiles (title, cost, **Ask for it**), and an **Asked** list with **Approve** (PIN on the display) and **Not now**. Ask for it opens the children-only Who picker; a reward costing more than the balance says "Mia has 18 of 30 stars" under a disabled button. Streaks reset quietly to "0 days in a row". Settings → Chores sets stars per chore, adds rewards, and turns stars, rewards or routines off, which hides every star glyph.

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

The step title is 64 px; the icon comes from the step library (toothbrush, bed, book, shirt, backpack, sun, moon, bath, plate, dog…) chosen when the routine is made, so a pre-reader can follow. **Done** (120 px tall, 60% wide, in the child's color) stamps and bursts, and the next step slides in from the right; skipped steps show hollow dots. The last Done shows "All done, Leo! Night night." for 6 s with the full-screen burst and "+5 stars" if the routine gives stars, then returns to Chores. **Stop** asks nothing; checked steps are kept for the day, so the column offers **Continue** while the routine's window is open.

**Meals room**

```
+----------+----------------------------------------------------------------------------+------------------------+
| rail     | Meals · Oct 5–11        [<] [This Week] [>]                 [Saved Meals]   | Today panel            |
|          |----------------------------------------------------------------------------|                        |
|          |          | Dinner                                            | Who cooks     |                        |
|          | Sun 5    | Roast chicken                                     | (A) Ana       |                        |
|          | Mon 6    | Pasta night                                       |               |                        |
|          | Tue 7    | Tacos                                             | (S) Sam       |  (lit row)             |
|          | Wed 8    | [ + Add dinner ]                                  |               |                        |
|          | Thu 9    | Leftovers                                         |               |                        |
+----------+----------------------------------------------------------------------------+------------------------+
```

Rows are days (120 px), columns are the enabled meal slots (Dinner only by default); today's row is lit; a cell shows the meal name (with its emoji) at body size and who cooks, in their color. The header has the week's arrows, This Week, **Copy last week** (Undo) and **Saved Meals**. Tapping a filled cell: Change, Swap days (the week's other days as chips; whatever was there takes its place), Add ingredients to Groceries (when the saved meal has ingredients and Lists is on), Remove (Undo). **Saved Meals** is the library: every meal the family has typed, most made first, as tiles with the name, "Made 6 times", its ingredients and recipe link; New saved meal; a tile opens its name, emoji, recipe link, ingredients (with commas) and Archive. The add panel offers saved meals first (most made first, with search), then "Or type a new meal", Day, Which meal (when there's more than dinner), Who cooks, and "Add 5 items to Groceries" as a switch. A countdown's photo and a saved meal's photo wait for a later milestone (ADR 0026).

**Countdowns room**: tiles 400 × 280 px sorted by date, the number at 72 px ("12 days", "Tomorrow", "Today!"), the emoji and name, the date (and "Turns 9" for a child's birthday), and the person, in their color. Birthdays come from Family by themselves (Settings → Features can turn that off). A tile opens Change and Remove; a birthday's says it comes from Family. Add countdown asks what it counts down to, the day, whose, an emoji, a color, **Every year**, and **Show it on the kitchen screen** (off for a surprise: phones only). Past countdowns leave the next day into Recently Removed. On the day, the Today panel reads "Today: Mia's birthday!" and the first touch of the day plays the big celebration once.

**Photos room**: "124 photos", **Start screensaver**, **Settings** (the screensaver part of Display settings, behind the PIN: start after 5, 10, 15, 30 minutes or Never; change photo every 15 s, 30 s, 1 or 2 min; show the clock and next event; shuffle; sources). A line "Add photos from a phone: open Sunroom → More → Photos" with a QR; then a grid of 200 px thumbnails, newest first. Tapping one opens it full screen with Previous, Next and Hide from screensaver; the display can hide photos but never deletes them (phones delete, with Undo).

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

**Night** (from Settings → Display → Sleep: from, to, and **Dim clock** or **Screen off**): Dim clock is a black screen with the clock at 200 px in a 35% ink-soft and tomorrow's first event under it, and the Pi's helper turns the panel down to 20%; Screen off is fully black, and the helper switches the screen itself off (PLAN §13.5). A tap wakes it for 2 minutes in the dark theme, at full brightness; routines and chores still work in those minutes. **Dim in the evening** (only with sleep times): from its time until sleep starts the screen is less bright, **A little**, **Half** or **Low** (60, 40 or 20%). The helper turns the panel down where it can (DDC/CI, or a backlight); anywhere else the page draws a dark veil over itself, so the two never both dim.

**Parent PIN** (a centred dialog whenever the display needs a parent): four to six dots, a 3 × 4 keypad with 80 px keys, Cancel, and the line "Forgot it? Change it from a parent's phone: More → Settings → Family → Parent PIN." The dialog accepts as soon as the right length matches; a wrong PIN shakes the dots once and says "That PIN didn't match. Try again."; five wrong in a row: "Too many tries. Wait 1 minute." with a countdown. A correct PIN opens Settings for 10 minutes of activity (the rail lock shows open; **Lock** in the Settings header ends it; Settings auto-lock after 2 minutes idle). With no PIN set, the lock opens Settings directly and the Family page says "Set a parent PIN so children can't open Settings on this screen."

**Settings (display)**: a list-and-detail layout; the Today panel hides. Anything that needs a secret says "Do this on a phone" with a QR code to that page, because secrets are not typed on a wall.

| Page | Contents |
|---|---|
| Family | One row per person: avatar, name, role, color word, **Change** (Name; Parent or Child; Color, eight named colors each showing the initial; Photo via a phone QR or Remove photo; **Save changes** with Undo; **Remove Mia** confirms and offers to keep her history). **Add a person** in one row: the name, Parent or Child, **Add**. **Parent PIN** (Set, Change, Remove; changing asks the old one). **Child-safe editing** on/off |
| Features | One row per plugin with a switch and one line on what it adds: Synced Calendars, Lists, Chores (sub-switches Stars, Rewards, Routines), Meals (which columns), Countdowns, Photos & Screensaver, Weather. Turning one off hides its room and panel at once; its data stays. A stopped plugin shows "Retry" |
| Calendars & Accounts | **Home calendar** (always). Then each account ("iCloud · ana@…") with its calendars under it, each with a person chip, a **Show on this screen** switch and a status line ("Updated 9:10 AM" or the quiet error). **Refresh now**. **Add an account** → "Connect accounts on a phone: it needs a password you shouldn't type here" with a QR, except **Connect Google on this screen** when the display is at `localhost`. **Disconnect** is phone-only |
| Display | Theme Light / Dark / Auto; Text size Standard / Large / Extra large (previews live); Daylight tint on/off; Rail side Left / Right; Controls at the bottom; Today panel Show / Hide; Home view Week / Today / Who's Doing What; Week layout Agenda / Hours (Agenda stacks each day's events; Hours draws them on a 24-hour grid); Show tips (off by default: one thing Sunroom can do under the board, a new one every half hour, not on phones); Return to home after 2 / 5 / 10 min / Never; Dim past events; Screensaver (as in Photos); Sleep (from, to, Dim clock / Screen off; Dim in the evening from a time, A little / Half / Low); Sounds On / Off; Orientation Auto / Landscape / Portrait; Reduce motion |
| Household | Name; Time zone; Week starts on Sunday / Monday; Time format 12-hour / 24-hour; Location for weather and sunset (a town name search; phone recommended); **Recently Removed** (7 days, Put back) |
| Phones & Screens | This screen (name, Rename, Unpair); other screens; phones with "Mia's phone · last used today"; **Add a phone** (a code and QR); **Sign out a phone** |
| Backup | The nightly backups: the last backup time, a banner if older than 7 days, **Back up now**, and on a phone or computer **Download backup** (the newest copy) and **Download everything** (a zip with every photo, to restore from; restoring is a runbook step with the server stopped, docs/RESTORE.md); **Take your data with you**: **Export everything** (one JSON file anyone can read), on a phone or computer. The wall says to download from a phone |
| About | Version and build; **New versions** (**Check for new versions daily**, off until a parent turns it on and greyed out when the server keeps it off; then the last check, or "Sunroom 0.6.1 is available." with how to update this install; **Check now**); **Storage** (**Free space**, the photos folder); **Connection** (**Live updates** as the live-updates icon; the address this screen uses); the open-source licence; "Not affiliated with Google or Apple"; "Weather by Open-Meteo" |

**The Who picker** (shared): a row of 64 px avatar circles with names under them: **Everyone** (a house mark, neutral), each member in household order (initial or photo with a 3 px ring in their color), **A guest** (dashed). Selected: a 4 px ink ring, a check in the corner and the name in bold. In a question ("Who did it?") it appears as a popover beside the thing; in editors as a chip row; children-only pickers show only children.

**Toasts (display)**: bottom centre of the board, 72 px tall, body text, a 64 px Undo button, 8 s, two at most; over a panel they sit at the panel's bottom; a toast never covers the now line's label or the Today panel.

## 5. Phone screens

Phones are the second screen: adding and editing on the go, connecting accounts (anything that needs a secret is phone-only), and a personal Today. The shell is Dinner Bell's: a bottom tab bar (Today, Calendar, Lists, Chores, More; plugin tabs appear only when enabled, five at most), sheets from the bottom, 16 px gutters, safe-area insets, primary actions in the thumb zone.

**Install the App, Sign in, Who's Using This?** are Dinner Bell's screens with Sunroom's words: the install guide first on an iPhone in Safari; one password field with show/hide and the return key submitting; "Use a code from another phone" takes the six-character pair code; big name buttons per person with the current choice marked three ways, plus **Someone else** and **A guest**. A child's phone (a child chosen) asks the parent PIN for Settings and never shows Approve.

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
| Chores                               |
| (M) Mia  2 of 3          See chores  |
|--------------------------------------|
| Tonight                              |
| Tacos · Sam cooks                    |
|--------------------------------------|
| Coming Up                            |
| 12 days  Mia's birthday              |
|                                      |
| [             + Add              ]   |
|--------------------------------------|
| Today  Calendar  Lists  Chores  More |
+--------------------------------------+
```

The avatar at the top right is who's using this phone; tapping it opens Who's Using This. Sections follow the display's Today panel; a child's phone shows that child's chores first.

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
| Today  Calendar  Lists  Chores  More |
+--------------------------------------+
```

**Event sheet and editor**: the sheet shows the title, time, people, calendar source line ("From iCloud · Ana"), location and notes, with **Change**, **Move**, **Add a countdown** and **Remove** (read-only synced events show the source line instead of buttons). The editor is the same panel as the display's (§4) with the phone's native keyboard:

```
+--------------------------------------+
| Cancel          New event       Save |
| [ Dentist Thu 2:30pm Mia           ] |
| Dentist                              |
| Thu, Oct 9 · 2:30 PM · 1 hour · Mia  |
|                                      |
| Who      (All) (M) (L) (A) (S) (?)   |
| Day      [Today][Tomorrow][Thu 9]    |
|          [Fri 10][Sat 11][Pick…]     |
| Time     [All day]                   |
|          [8][9][10][11][12][1][2][3] |
|          [:00][:15][:30][:45] [AM|PM]|
| How long [30 min][1 hr][1½ hr][2 hr] |
|          [Until…]                    |
| Repeats  [No][Every week on Thu]     |
|          [Every day][Weekdays][More…]|
| Calendar [Home][Google · Family]     |
| More     Location · Notes · Remind   |
| [           Add event             ]  |
+--------------------------------------+
```

The quick-add field runs the same parser and shows the same "understood as" line; chips are 44 px. **Add several** (under More) takes pasted lines, one draft per line, with a review list and **Add all**, for school newsletters. **Remind** shows a toast on the kitchen screen 10 minutes, 1 hour or 1 day before; phone notifications are a later idea (PLAN §19).

**Lists**: a list of lists (name, count, last change) and the list detail: 48 px checkboxes in 72 × 80 px tap areas, the marker strike, a collapsed Done group, the add field pinned above the tab bar with a Usuals strip above it, attribution silent ("Added by Mia").

**Chores**

```
+--------------------------------------+
| Chores                     ★ 42 Mia  |
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
| Today  Calendar  Lists  Chores  More |
+--------------------------------------+
```

The phone's person comes first and open; others collapsed. Completing stamps and bursts the same way (§9), scaled to the row. Stars & Rewards and the routine runner work on a phone too (a child can run bedtime from a tablet in their room). Parents' phones show **Asked** requests at the top of Chores and Today with Approve and Not now.

**Meals**: a week list (day rows with the meal and who cooks; "+ Add dinner" on empty days), the add sheet with saved-meal chips and search, the library under **Saved Meals**, and the "Add 4 items to Groceries" toggle when a saved meal has ingredients.

**More**: the rooms not in the tab bar (Meals, Countdowns, Photos), then Settings, Who's Using This (shows the name), Pair a Display, Install the App, About. Photos here is where photos are added (camera or library, several at once) and deleted (with Undo).

**Settings (phone)**: the same pages as the display's (§4), full screen with Back; parents' phones open them directly, children's phones ask the PIN. Two pages do more on the phone: **Calendars & Accounts** has **Add an account** (Google, iCloud, Another calendar) and Disconnect; **Backup** downloads the export and offers **Restore** with "This replaces everything on the server with the backup from Oct 1."

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

**First run (self-hoster, on a phone).** 1. The container starts; the display's browser shows **Welcome** with a QR code and the address; the self-hoster opens it on a phone. 2. "Welcome to Sunroom. Let's set it up — about three minutes." → **Start**. 3. **Set a household password** (show/hide; "Everyone at home signs in on their phone with this one password. The kitchen screen never needs it."). 4. **Name your household** (chips: "The Riveras", "Our home"); time zone from the phone with Change; week starts on Sunday or Monday. 4b. **Where's home?** "Sunroom shows your weather and turns dark at sunset. Type your town, or a town nearby." → **Search** → the town → "Home is Springfield, Illinois, United States"; **Later** skips (it gets dark at 7 PM until it's set; the step skips itself with the weather off). 5. **Who lives here?** "Start with you": one row with the name, Parent or Child and **Add me** (then **Add** for each next person: the name clears and keeps focus, and the role stays as chosen, since two children in a row is common), a color picked automatically; then **Next**; then "Set a parent PIN? Keeps children out of Settings on the screen." **Set a PIN** or **Later**. 6. **Pair the kitchen screen**: "On the screen, Sunroom now shows a code. Type it here." → **Pair** → "Kitchen screen paired"; **Do this later** skips. 7. **Bring in your calendars**: Google, iCloud, Another calendar (.ics), **Skip for now**; each flow returns here. 8. **"You're set."** → Who's Using This phone? → Today.

**Pairing the display (any time).** The display shows **Pair this screen** with a six-character code (or returns to it after an unpair). A signed-in phone: More → **Pair a Display** → the code → **Pair**; or on the display, **Type the household password here instead**. Then "Name this screen" chips → the week board. The same code mechanism, mirrored, is **Add a phone** (Settings → Phones & Screens): the signed-in phone shows a code and QR; the new phone types it on the sign-in screen.

**Add an event from the display (quick add).** 1. Tap **Add** in the rail, or empty space in Thursday's column (which skips the day chip). 2. The Add panel opens with Event selected and the field focused; the keyboard rises. 3. Type "Dentist Thu 2:30pm Mia"; the understood-as line fills as you type: Dentist · Thu, Oct 9 · 2:30 PM · 1 hour · Mia, and Thursday's column lights behind. 4. Fix anything with a chip. 5. **Add event** (or ↵): the panel slides away, the chip eases into Thursday, toast "Added Dentist · Undo".

**Add from a phone.** Calendar → **+ Add** (or tap a time in Day view) → type or tap chips → **Add event** → the display shows it within a second, easing into its column; nothing else moves.

**Change one occurrence of a repeating event.** Tap the chip → event sheet → **Change** → edit → **Save changes** → the chooser:

```
+--------------------------------------+
| Change Which?                        |
| Soccer practice repeats every week.  |
| [         Just this one           ]  |
| [     This and the ones after     ]  |
| [          All of them            ]  |
| Cancel                               |
+--------------------------------------+
```

"Just this one" makes an exception (the chip gets a small "changed" dot; its sheet reads "Changed from the usual time"); "This and the ones after" splits the series; "All of them" edits it. The toast says "Changes saved · Undo" and Undo reverses the whole choice. **Remove** and **Move** (and a drop) ask the same three.

**Drag a chip to another day.** Press and hold 400 ms: the chip lifts (scale 1.04, a shadow), its column closes the gap, the board header reads "Drop on a day". The column under the finger lights (rows in portrait); hovering the board's edge for 600 ms pages the week. Release on a day: the chip settles in time order; "Moved Soccer practice to Thu · Undo" (a repeating event asks "Move Which?" first while the chip waits, lifted). Release elsewhere: it springs back. Every drag has a button twin, **Move** in the sheet. Read-only synced chips do not lift; the header reads "From iCloud · Work · can't be moved here" for 2 s.

**Complete a chore on the display.** Mia taps the box next to **Feed the dog** in her column (no attribution tap: it is assigned to her). The signature moment (§9) plays: the box fills in her color, the stamp lands, the burst radiates, "Done by Mia · 4:12 PM" appears, the header pops to "3 of 3 · ★44", the row eases under Done. Her last chore adds "All done, Mia!" with the bigger burst. Toast "Done by Mia · Undo" for 8 s; Undo puts the row back, lifts the stamp and takes the stars back. An **Anyone** chore opens "Who did it?" with avatar chips beside the box; "Mia's turn" chores preselect Mia and leave the chips for 2 s so someone else can claim it.

**A child runs a bedtime routine.** At 7:30 PM the Today panel reads "Leo's bedtime routine · Start" and his Chores column shows **Start**. The runner takes the whole screen, one step at a time: a 240 px icon, the step name at 64 px, filled dots for progress, a 120 px **Done** button in Leo's color, a quiet **Skip this one**. Each Done stamps and bursts, and the next step slides in from the right. After the last: "All done, Leo! Night night." with the full-screen burst and "+5 stars", then back to Chores after 6 s or a tap. Stopping keeps progress for an hour ("Continue · step 3 of 5"); idle rules pause while a routine runs, up to 30 minutes.

**Redeem a reward.** Mia opens Chores → **Stars & Rewards** → **Ask for it** on Movie night (30 of her 42 stars) → the children-only Who picker. "Asked for Movie night. A parent will say yes or no." with **Take it back**. The request shows under Asked on the display and at the top of parents' phones. A parent approves on their phone, or on the display with the PIN. Stars drop to 12 with a pop; "Mia got Movie night" and the big burst. **Not now** says "Not now" on the rewards page without a reason field.

**Groceries from a phone to the display.** Ana adds "Milk" (or taps it in Usuals): "Added Milk · Undo", "Added by Ana". Within a second the display's Groceries list eases the row in; the Lists room tile reads "13 to get · Ana added Milk · 2:10 PM". At the store she checks items off on her phone; the display strikes them live.

**Connect an iCloud calendar (phone only).** Settings → Calendars & Accounts → **Add an account** → **iCloud**. Three illustrated steps (a schematic drawing under each, the thing to tap ringed in `sun`; no logos or brand colors): open appleid.apple.com and sign in; under Sign-In and Security tap App-Specific Passwords, then the plus, and name it Sunroom; copy the password (xxxx-xxxx-xxxx-xxxx). A note that two-factor authentication must be on. Fields: Apple ID email, app-specific password → **Connect** ("Connecting…" up to 20 s). Success: "Connected iCloud · 3 calendars", a list with switches and a person chip each ("Ana's calendar → Ana", "Family → Everyone", guessed from names and editable), "Show on the kitchen screen" on by default → **Done**. Errors: "iCloud said that password isn't right. Make a new app-specific password and try again." / "iCloud didn't answer. Check the server has internet and try again."

**Connect Google (phone only).** Add an account → **Google** → "Three ways. Pick the one that fits:"

| Way | One line under it | Gives |
|---|---|---|
| **Paste the secret address** | "Easiest. Shows events only; you can't add from Sunroom. Google updates it slowly (sometimes hours)." | read-only |
| **Share with a Sunroom helper** | "About 10 minutes, once. Lets you add and change events from Sunroom." | read-write |
| **Sign in with Google** | "Needs Sunroom reachable at an https:// address on the internet and your own Google app keys. Or do it on the kitchen screen itself." | read-write |

The secret address: illustrated steps (Google Calendar settings → the calendar → Integrate calendar → copy "Secret address in iCal format") → paste → **Add calendar** → "Added Google · Family (shows events only)"; its status line says "Updated 9:10 AM · Google updates this slowly" so staleness is expected, not a bug. The helper (a service account, never called that in the UI): "You'll make a helper account at Google and share your calendar with it." Steps with an **Open** link and a drawing each: make a project named Sunroom at console.cloud.google.com; enable the Google Calendar API; IAM & Admin → Service accounts → Create "sunroom"; Keys → Add key → JSON (a file downloads). **Upload the key file** → Sunroom shows "Your helper's address:" with **Copy** (the key is stored encrypted and never shown again). "In Google Calendar settings, pick the calendar, go to Share with specific people, paste the helper's address, choose Make changes to events, and Send." → **Find calendars** → switches and person chips → **Done**; "No calendars shared with the helper yet. Sharing can take a minute; try again." Sign in with Google: disabled with its reason when the address is plain http or local (unless on the display at `localhost`); otherwise steps for the OAuth client (Web application; the redirect address shown with Copy), the consent screen set to External and **published** ("If it stays in Testing, Google signs Sunroom out every 7 days"), paste the Client ID and secret → **Sign in with Google** → "Google may say the app isn't verified: tap Advanced, then Go to Sunroom. It's your own app." → choose calendars → **Done**. Later sign-outs show "Google signed Sunroom out." with **Sign in again**.

**Another calendar (.ics)**: paste any address (school, team, holidays), name it, a person or Everyone → **Add calendar**; read-only; refreshed every 30 minutes (15 min to 6 h in its row). **Holidays**: pick the country (and state) → added instantly, no address.

**Screensaver in and out.** No tap for the set minutes: the board fades to the first photo over 800 ms; the clock and Up Next fade in 220 ms later; photos crossfade every 30 s. A tap fades the photo out in 220 ms to exactly where the display was if asleep under 30 minutes, otherwise to this week's board; the waking tap does nothing else. Phones can **Start screensaver** from More → Photos; the sleep schedule overrides the screensaver at night.

**Theme auto switch at sunset.** Theme Auto; sunset 6:42 PM from the household's location (7 PM without one). At 6:42, once the display has been idle 10 s, every color token crossfades to the dark theme over 600 ms and the wall tint moves to its evening stop; if someone is mid-tap or typing it waits for the next 10 s of idle. Phones follow their own OS setting unless the household forced Light or Dark. Sunrise reverses it. Reduce Motion makes both instant.

## 7. Visual direction: "Sunroom"

This is the design pass for the brief. ADR 0013 records it; `frontend/src/styles/tokens.css` implements it; `tokens.test.ts` enforces the contrast pairs below.

**Concept.** A sunroom is the bright, quiet room where a family actually sits: glass, plaster, a few plants, and light that moves across the wall through the day. The display is that wall. It is calm, large and legible from the doorway; it is never a dashboard. Two things carry the identity:

1. **Light that follows the day.** The wall's tint shifts in four steps (dawn, midday, afternoon, dusk) in the light theme and two (evening, night) in the dark theme, crossfading over two seconds when a step changes, never on first paint. Today's column on the board is "lit" (a plain `surface` panel on the tinted wall), and a thin amber "now" line glides down it. With Auto theme on, dusk hands over to the dark theme at sunset. A household can turn the daylight tint off in Display settings; the wall then stays at the midday value.
2. **The person color.** Each member owns one saturated color. It fills their avatar, the edge and tint of their event chips, their chore rows, their progress ring, and the burst when they finish something. Shared things (Everyone) are ink on surface. Color is never the only signal: every chip shows the avatar or initial, and names are written out.

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

**Person colors** (eight, named after what you'd see from a sunroom; a household picks one per person; the picker shows the swatch with the person's initial, and a color word for screen readers). Solids are computed in OKLCH so they sit at the same lightness and read as one family; M0 ran the contrast test and nudged the light solids that failed on the warmest wall tint, so the light column below is the nudged one.

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

- Each person has three derived values via CSS `color-mix(in oklab, …)`, so no extra tokens: `--p-tint` (12% of the solid over `surface` in light, 24% in dark) for chip and row backgrounds; `--p-edge` (the solid) for the 6 px chip edge and the avatar; `--p-text` (the solid in dark, ink in light) for any text in the person's color. Rule enforced by the design-rules test: in the light theme a person color is never used for body text on a tint; names on chips are ink.
- Shared ("Everyone") items use `ink` edge and a `line`-tinted background.
- Synced calendars that belong to no person (a shared "Family" Google calendar, the school ICS feed) get a calendar color from the same eight, chosen at connection time with "already used by Mia" hints.

**Type.** One family, **Lexend** (variable, self-hosted via fontsource), chosen because it was designed to make reading easier and its open, wide letters hold up at a distance; weights 400 (body), 600 (emphasis, times), 700 (titles, chip titles) and 800 (the clock, countdown numbers, the routine step). The display's scale is in §1 (caption 18, secondary 20, body 24, title 32, glance 40, rail clock 56, big number 72, step title 64, wall clock 200); phones keep Dinner Bell's scale (13 / 14 / 16 / 18 / 24 / 30). Sizes are rem on a root size the display's Text size setting controls (Standard 16 px, Large ×1.15, Extra large ×1.3; phones use the browser's default so the OS text size applies). Anything typed into is at least 16 px on phones and 24 px on the display. Lexend has no tabular figures (checked in M0), so times and counters that change in place sit in fixed-width digit boxes (`ui/Digits`, ADR 0021). Title Case for titles, headings and navigation; sentence case for everything else (§2); never all caps; no letterspaced eyebrows; day names read "Mon 13", not "MON".

**Space and shape.** An 8 px grid; the widths, gaps, targets and radii are in §1 (rail 192 px, Today panel 400 px, chips 12 px radius, panels 24 px). The board itself is square-cornered: it is the wall, not a card. The board is one `wall` surface with `line` grid lines; today's column is a `surface` panel; chips are the only card-like objects and sit flat with a 6 px person edge on the left over a 12% tint (24% in dark); the Today panel is stacked blocks separated by 32 px of space, not boxed. Focus: a 4 px `ink` outline with a 2 px offset on every display control (3 px on phones); inverse surfaces set the ring to `wall`.

**Motion.** Tokens in `motion.css`: tap 90 ms, quick 150, enter 220, exit 180, settle 320 (springs: stiffness 400, damping 30), celebrate 600, daylight 2000; easings standard `cubic-bezier(.2,0,0,1)`, arrive `cubic-bezier(.05,.7,.1,1)`, leave `cubic-bezier(.3,0,.8,.15)`. Rules: motion answers what someone did; nothing animates on first paint, on a tab switch or when the wall tint changes except the two-second crossfade itself; `prefers-reduced-motion` and the Display setting "Reduce motion" make every transition instant and stop the now line gliding (it jumps once a minute), with celebrations reduced to the check fill and a single soft flash.

The signature moment, **Done**, frame by frame (a chore or list item checked on the display; on phones the same at 80% scale):

| Time | What happens |
|---|---|
| 0 ms | The finger lifts. The check circle fills with the person's solid color on a spring (settle 320); the check mark draws in `on-ink` over 200 ms |
| 60 ms | The row stamps: scale 1 → 1.03 → 1 with a −1° → 0° rotation over 300 ms, as if pressed into the wall |
| 120 ms | A burst of 28 particles (small discs and 4-point stars in the person's solid and `sun`) rises from the check for 600 ms on the canvas layer above the UI, with gravity, and fades |
| 200 ms | If points are on, "+2" rises from the check and flies to the person's avatar in the Today panel (or portrait's band), else the one in their column's header (rise 250, then settle 320), and the avatar bumps (scale 1.1) as it lands while the column's star count pops. With no avatar on screen it rises from the row and fades; with Reduce Motion nothing flies |
| 900 ms | The row folds into the Done group below (exit 180 + layout spring); the Undo toast is already showing ("Done: Feed the cat, by Mia", 6 s) |

Other motions: a press dips controls by 3% and shades rows (tap); sheets slide up from the bottom edge on phones and rise 16 px with a fade on the display (enter/exit); the week board swipes between weeks with inertia and snaps (settle), a tap on the week header's arrows does the same; a long-pressed chip lifts (scale 1.04, a soft shadow) and follows the finger across days, drops with a spring, and the toast offers Undo; the now line moves once a minute with a 500 ms ease; a toast rises and eases out; a countdown number ticks over with a vertical roll when the day changes; the screensaver fades in over 1 s and out in 300 ms; the theme crossfades over 500 ms when switched by hand; the routine runner's steps slide left as each is done, and the final step fires the celebration with all of that person's color plus `sun`.

**Icons and the app icon.** lucide, 2 px stroke, always beside a label on the rail and on primary actions. The app icon is a window: a rounded square in `wall` with a four-pane mullion in `ink` and `sun` light filling the lower-left pane; maskable with the safe zone respected; the splash uses the same mark on `wall`. No calendar-grid cliché, no sun-with-rays cliché.

**Self-critique against the generic default.** Before settling on this direction, the plan was checked against what a brief like this usually produces, and revised:

| Default it avoided | What Sunroom does instead | Why |
|---|---|---|
| Pastel "family app" palette with a rounded display face and emoji everywhere | A cool daylight wall, one amber accent for time, one legible sans; emoji only where the family puts them (countdowns, meals) | Reads as a calm object on a kitchen wall, not a toy; children are served by size and color, not cuteness |
| Warm cream background with a serif display and a terracotta accent | The cool-to-warm daypart tints, and no serif | That combination is the current generated-page tell, and cream glares at night |
| A grid of identical rounded, shadowed cards per widget (the dashboard look) | One board surface; chips are the only cards; the Today panel is stacked blocks | Glanceability needs hierarchy, not a kit of equal boxes |
| ALL-CAPS eyebrow labels, "A · B · C" meta strings, arrows on buttons, monospace for times | Title Case only for titles, headings and navigation (§2), sentence case for the rest, stacked lines, plain verbs, tabular figures in the same family | Dinner Bell's rules, and they are easier to read from across a room |
| A "now" indicator as a red hairline (Google Calendar's) | An amber line with a soft glow, the lit today column, and the wall's own tint | Ties the time of day into the identity instead of borrowing a competitor's cue |
| Confetti on everything | One celebration, Done, in the person's color; a bigger one at the end of a routine; nothing else bursts | Spend the boldness in one place so it keeps meaning something |

## 8. Empty and quiet states

| Where | Copy | Button |
|---|---|---|
| Week board, nothing this week | "Nothing on this week yet. Add an event, or bring in a calendar you already use." | Add event; a quiet "Bring in a calendar" shows the phone QR |
| Today panel, nothing today | "Nothing on today." then "Tomorrow · 8:00 AM School drop-off" | — |
| Who's Doing What, a person with nothing | "Nothing on" | — |
| Lists room | "Lists live here: groceries, to-dos, packing. Everyone sees them, on the wall and on their phone." | New list |
| A list with no items | "Nothing on Groceries yet. Add the first thing." | the add field, focused |
| Chores room, none | "Chores live here. Give each person a few, and watch them get stamped." | Add chore |
| A person with no chores today | "Nothing today" | — |
| Stars & Rewards, no rewards | "Rewards are what stars buy. Add one — movie night, an ice cream run." | Add reward (PIN) |
| Routines, none | "A routine is a short checklist a child runs on their own: pajamas, teeth, book." | Add routine (PIN) |
| Meals, empty week | "Tonight's dinner shows here and on the Today panel. Add a dinner." | Add dinner |
| Saved Meals, none | "Save a meal once and add it in one tap next week." | New saved meal |
| Countdowns, none | "Count down to birthdays, trips, the last day of school." | Add countdown |
| Photos, none | "Photos added from phones show here and on the screensaver." | the QR and "More → Photos on your phone" |
| Screensaver with no photos | The time-of-day tint, the clock and Up Next, and one line: "Add photos from a phone to see them here." Never a stock image | — |
| Settings → Calendars, none | "Bring in calendars you already use: Google, iCloud, or any calendar address." | Add an account (a QR on the display) |
| Phones & Screens, no screens | "No screen paired yet. Open sunroom.local on the kitchen screen and type its code here." | Pair a Display |
| Only the calendar enabled | The rail shows Calendar, Add and the lock; the Today panel shows only events; Settings → Features says "Turn on what your family uses." | — |
| Search, no match | "Nothing matches 'xyz'." | Add 'xyz' as new |
| Recently Removed, empty | "Things removed in the last 7 days show here." | — |

Quiet states, never error walls:

| State | What shows |
|---|---|
| A synced calendar hasn't answered | A one-line pill in the board header: "Google hasn't answered since 9:10 AM. Showing what we had." Tapping it opens the Calendars page. The calendar's events stay |
| Server has no internet | "Updated 9:10 AM" on synced calendars only; everything else normal |
| Display can't reach the server | Header pill "Can't reach Sunroom · showing 9:10 AM"; a write says "Not saved — the screen can't reach Sunroom. It will try again." and retries every 10 s |
| Phone offline | Pill "Offline · showing what we had"; a write says "Not saved — you're offline. Try again when you have signal." (an offline queue is a PLAN §19 idea) |
| Syncing | "Syncing 3…" |
| PIN-locked | The lock in the rail; Settings and approvals ask for the PIN; nothing else is ever locked |
| Child-safe editing stops an action | The PIN dialog with one line above it: "Changing events on this screen asks for the parent PIN." |
| Read-only synced event | The sheet's source line instead of buttons |
| A reward costs more than the balance | "Mia has 18 of 30 stars" under a disabled Ask for it, never hidden |
| Google signed Sunroom out (OAuth) | A banner in Calendars & Accounts and a header pill: "Google signed Sunroom out." with **Sign in again** (phone) |
| A password or a calendar address stopped working | A header pill: "iCloud needs its password again." or "School's calendar address stopped working." Tapping it opens Calendars & Accounts, where **Connect again** (phone) takes the new one; the events stay |
| Photos folder nearly full | A line in Photos and About: "2 GB free" |
| Backup older than 7 days | A line in Backup; never a pill on the board |
| A plugin stopped | A line in Settings → Features: "Weather stopped working. Retry" |
| Live updates | One icon at the board's top-right corner, at the right end of a phone Calendar's Show row (the header has no room beside its arrows) and in About → Connection, told apart by shape: connected (a Wi-Fi mark, quiet), reconnecting (a slowly turning arrow; still with Reduce Motion), checking every 30 seconds (a clock: something between here and the server holds the stream back), offline (Wi-Fi crossed out, in ink); nothing once signed out. Anything but connected shows only after 2 s, so a reconnect on a room switch never flickers. A tap says it in words: "Live updates are on.", "Reconnecting to Sunroom…", "Live updates are off for now; checking every 30 seconds.", "Can't reach Sunroom." |
| Update available | On the display "New version · Restart tonight" (it reloads at 3 AM); on phones "New version · Refresh". Never during a routine or while changes wait |
| Loading | Grey placeholder shapes after 300 ms, with "Loading…" for screen readers; the board's first paint from cache is instant, placeholders apply to panels and settings only |
| Night | The dim clock or black screen (§4) |

## 9. Motion spec

The principles and the signature moment are in §7. Implementation (decision 0007): anything that is a state toggle (press, selection, sheets and panels, toasts, the list strike, crossfades, the PIN shake, placeholders) is CSS in `styles/motion.css`; anything that moves between layouts or follows a finger (chips arriving, leaving, dropping and springing back, the week swipe, the done row relocating, routine steps swapping) uses `motion` layout and gesture animations under `<MotionConfig nonce reducedMotion="user">`; the bursts are a canvas layer. Nothing animates on first paint or a room switch.

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

| Motion | Trigger | Behaviour | Reduced motion |
|---|---|---|---|
| Press dip | finger down on a button, chip or key | tap: scale .96 and shade | shade only |
| Row shade | finger down on a row | tap: shade | same |
| Selection fill | a chip or avatar selected | quick: fill and ring | instant |
| Panel or sheet open | Add, a chip tapped, Change | enter: slide from the right (landscape) or the bottom; the backdrop fades with it | appears in place |
| Panel or sheet close | Close, Save, Cancel | exit: slide back; the page takes taps 180 ms later | disappears |
| Keyboard | a field focused or blurred | enter / exit: slides up and down; the field scrolls into view in the same 220 ms | appears / disappears |
| Toast | after an action | enter: rise 16 px and fade; exit: ease out | appears / disappears |
| Chip arrives | saved here or on another device | enter: fade and grow from 96% in place; neighbours close the gap in quick | appears |
| Chip leaves | removed, moved, undone | exit: fade and shrink; the gap closes in quick | disappears |
| Count pop | "2 of 3", "12 to get", a star balance | quick: scale 1 → 1.15 → 1 | no scale |
| List strike | an item checked | 250 ms marker stroke in the checker's color, 600 ms hold, then folds into Done | strike appears; the row moves without sliding |
| Chore done | the box tapped | the signature moment (§7) | box fills, check and stamp appear, "Done by Mia" appears, no burst |
| All done | a person's last chore | 900 ms: a header burst and "All done, Mia!" fades in | text appears |
| Routine step | Done in the runner | celebrate on the button; the next step enters from the right as the old one exits left | steps swap in place |
| Routine finish, reward approved, countdown day | | 900 ms full-screen or panel burst, once | text appears |
| Week swipe | horizontal drag on the board | 1:1 with the finger, resistance beyond one week; on release, glide to the nearest week; a flick over 0.5 px/ms moves exactly one | pages without sliding |
| Week buttons | arrows, This Week | glide | cuts |
| Chip lift / drag / drop / spring back | long-press 400 ms, move, release | lift: scale 1.04 and an 8 px shadow, the origin keeps a dashed outline; drag 1:1 with the column tinting; drop settles into time order; elsewhere springs back | lift shade only; lands in place |
| Now line (board) | an event ends | glide: drops to the next slot while the finished chip dims | instant |
| Now line (Hours grid) | every minute | a 60 s linear transition of its position (`--motion-minute`), so it creeps; remounted on a zoom or resize so it never glides across a change of scale, and nothing moves on first paint | steps once a minute |
| Now line (Day view) | every minute | a 60 s linear transition of its position, so it never jumps | updates each minute |
| Lit column | midnight | crossfade | instant |
| Wall tint | the daypart changes | daylight crossfade, at most once a minute, never on first paint | instant |
| Theme switch | sunset, sunrise, the setting | crossfade on every token, deferred until 10 s idle | instant |
| Screensaver in / photo / out | idle, every 30 s, a tap | saver-in, photo crossfade (no pan or zoom), saver-out | cuts |
| Night in / out | the schedule | crossfade to black; the clock fades in | cut |
| PIN wrong | | quick: the dots shake once (±6 px) and clear | dots clear |
| Spinner, placeholders | waiting, loading after 300 ms | continuous; a slow shimmer | still |

Sheets and panels do not use `overlay` or `allow-discrete` for their exit (Safari): the dialog stays open while a keyframe slides it away, then the script closes it (Dinner Bell's pattern). Sound for the done moment exists and is off by default (a 120 ms pop).

## 10. Accessibility, children, guests and the screenshot checklist

- **Text size** (Settings → Display): Standard, Large, Extra large change the display's root font size so everything scales in rem; the structure holds (seven columns, two-line chips, "+N more" sooner; the rail and Today panel widen at Extra large). Phones follow the OS text size.
- **Color is never the only signal**: avatars carry an initial or photo; done is a check, the stamp, "Done by Mia" and the row's place; past is dimmed and above the now line; selected is a ring, a check and a bold name; filtered-out chips fade but keep their text. The user-facing color words are plain (Red, Olive, Green, Teal, Blue, Purple, Plum, Pink), mapped to the tokens in §7; no yellow, which fails as text. The token test checks every pair in both themes and at every wall-tint stop.
- **Focus, keyboard and screen readers**: a 4 px ink ring with 2 px offset on the display (3 px on phones), the wall color on inverse surfaces; laptops get a sensible tab order and arrow keys across the board, Escape closes, `/` focuses quick add; the on-screen keyboard never appears when a physical keyboard is in use. Names by example: a chip "Soccer practice, 4:00 to 5:00 PM, Mia, Thursday October 9, button"; a chore box "Feed the dog, Mia, 2 stars, due 5:00 PM, not done, checkbox"; the now line is `aria-hidden`; the Today panel is a landmark; toasts are live regions; sheets take focus on open and return it on close.
- **Left-handed and placement**: Settings → Display → Rail side (Left or Right mirrors the shell), and Controls at the bottom for a screen hung high.
- **Children**: zero-reading paths (find your column by avatar and color, tap the big box, get the stamp; routine steps are icons first); Child-safe editing and the parent PIN keep Settings, approvals and event changes behind a parent on the display; nothing a child can tap is unrecoverable (Undo, Recently Removed, no "delete everything" outside Settings); no shaming copy, streaks just read "0 days in a row".
- **Guests and grandparents**: the display is open to anyone in the house, attribution defaults to Everyone, "A guest" is in every Who picker; a grandparent can read the Today panel from the doorway and add an event on 80 px keys without meeting Settings; guests' phones sign in with the household password for the week and are signed out from Phones & Screens.

**Screenshot review checklist.** `just screenshots` captures the key screens in fake mode at 1920×1080 and 1080×1920 (Standard and Extra large), 390×844 and 1440×900, light and dark, at 09:40, 16:10 and 21:30 so the tint and theme stops show. Then check:

- [ ] At 25% zoom (standing in for 3 m) the rail clock, today's day number, the Up Next title and the chore counts still read; nothing else needs to.
- [ ] Display body text is 24 px, secondary 20, captions 18, nothing smaller than 18; phone body 16, inputs at least 16.
- [ ] Every display tap target is at least 56 px (checkboxes and primary buttons 64, keys 80×64) with 8 px between neighbours; phone targets at least 44 (primary 48, checkboxes 48 in 72×80); the axe checks pass.
- [ ] Today's column is lit, the now line sits between the right chips with its time label, past chips are dimmed, an in-progress chip is solid.
- [ ] Hours (both display sizes, light and dark): at 24h the whole day fits with nothing to scroll and the gutter's hours line up with the grid; chips sit at their times with tap-sized buttons; the now line's label reads over a solid in-progress chip; at 15m a 15-minute event has a full chip; the header stays three lines in landscape (four in portrait at Extra large).
- [ ] A person's birthday shows on its day as an all-day chip in their color with the cake mark (the seed's Mia, on Friday), on the Week, Day, Month and Who's Doing What views and in the phone's Calendar lists.
- [ ] With six calendars in fake mode no column overflows without "+N more", the person filter fades the rest without hiding it, and the Today panel has at most nine lines.
- [ ] Avatars always show an initial or photo; Everyone is neutral; names accompany colors on every arm's-length surface.
- [ ] The Add panel shows the board behind it; the keyboard docks under the panel; the field and the primary button are visible above the keys.
- [ ] No `title=` attributes, no hover-only controls, no all-caps, no IDs or feed URLs, no emoji in the app's own copy.
- [ ] Empty states say what goes there and offer one button; quiet pills are one line.
- [ ] The screensaver's photo is uncropped and the clock band is the only overlay; Night is black with the dim clock; the evening dim darkens the whole page evenly and nothing else changes.
- [ ] Portrait: the Today band is on top with the clock and weather in its header and every Today block fits in its three columns (Chores Today, Tonight, To Do, Coming Up), the rail is a bottom bar with labels, days are rows with four two-line chips per line, today's row is lit, sheets rise to two-thirds height, the keyboard never covers the field or the button.
- [ ] Motion, by hand in `just dev`: the done moment plays, its "+2" flies to the person's avatar in the Today panel, and Undo reverses all of it; a long press on a list's tile opens Change list without opening the list; a week swipe follows the finger and a flick moves exactly one week; a long-press lifts a chip and a drop moves it with a toast; a panel slides in with the keyboard and the field in view; the theme crossfades at the forced sunset in fake mode; the screensaver fades in after the test idle (30 s in fake mode) and a tap wakes it without triggering what's under the finger; with Reduce Motion on, all of it is instant and the done moment still reads as done.
- [ ] Nothing comes from real household data; fake mode only; `.screenshots/` is gitignored.

## 11. Refinements adopted from the interaction design

| Refinement | Reason |
|---|---|
| The Today panel's **Up Next** is the biggest text on the board; the rail clock is 56 px and the 200 px clock lives on the screensaver and Night | A glance from the sink wants "what's next" more than the time |
| **Stacked chips, no hour grid, on the week board** (still the default, Agenda; Hours is the household's opt-in grid since M6, with a zoom for when a slot is too small); the now line is a divider that drops as events end; the Day view is the only timeline, with collapsed free time | At 1080p a 30-minute slot is about 30 px: too small for a 56 px target or 24 px text. Stacked chips are what a paper calendar does |
| **Portrait shows days as rows**, four two-line chips per line | Seven 150 px columns truncate every title |
| **Tapping empty space on a day adds an event on that day**; the editor is a side panel so the board stays visible | "Events are hard to add on-screen" is a top complaint; the common case is two taps and one line of typing |
| **Person filters clear after 2 minutes idle; rooms return to the calendar after 5** | A shared wall must look the same to the next person who glances |
| The keyboard **docks under the panel at 960 px wide**, not full width | Full-width keys under a right-hand panel put the field 900 px from the keys |
| **One pair-code system** (six characters, 10 minutes, once) for pairing a screen and adding a phone | One mental model |
| **Assigned chores need no attribution tap**; Anyone chores ask "Who did it?"; list adds on the display attribute nothing unless an avatar is tapped | Forcing a tap on every chore adds a step to the moment that should feel instant |
| **Child-safe editing** (on when a child exists) and **Recently Removed** (7 days) | Toast Undo is not enough on a screen a child reaches |
| Secrets are **phone-only**; the display's Calendars page shows a QR instead | Typing an app-specific password on the wall is slow and visible to the room |
| **Routines live in the Chores room and the Today panel**, not on the board | A nightly chip on the calendar is clutter |
| **Night** is an app state (black or a dim clock); the backlight is the Pi helper's job (PLAN §13) | A browser can't switch a monitor off; the app does the part it can |
| Sound for the done moment is **off by default** | Kitchens are loud enough |
