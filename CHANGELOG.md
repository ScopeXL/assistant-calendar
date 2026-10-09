# Changelog

Everything that changes in Sunroom, written in plain English. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The week can show each day as hours, midnight to midnight, with longer events taller and the
  now line creeping through today: Settings → Display → Week layout → Hours, or the Hours
  button on the board. When a day is busy, zoom with 24h · 12h · 1h · 15m.
- Tips: Settings → Display → Show tips puts one thing Sunroom can do under the board, a new one
  every half hour.
- The top-right corner of the board, and the phone's Calendar, show whether the screen is
  getting live updates: connected, reconnecting, checking every 30 seconds, or offline. Tap it
  to hear which. Settings → About → Connection shows the same icon.

### Changed

- Titles, headings and the names of rooms, views and tabs now capitalize each word
  ("Calendars & Accounts", "This Week", "Who's Doing What"). Buttons and messages stay as
  they were.
- "Kid" is now "Child" everywhere you read it.
- Adding a person is one row, their name, Parent or Child, and Add, in setup, Settings →
  Family and Who's Using This. Child stays picked for the next one.
- The Today panel's button at the top of the board is now an icon, the same size as the
  arrows beside it.
- Settings → About → Storage says "Free space".
- Add an account works on any device: a phone, a computer, or the kitchen screen, where the
  password is typed on its own keyboard and stays hidden. Google's helper and Sign in with
  Google show a code to finish on a phone. Back from Google's sign-in, Calendars & Accounts
  says how it went and opens the new account's calendars.
- Add photos from a computer's browser too, not only a phone: Photos → Add photos, and a
  person's photo in Settings → Family.
- After you update Sunroom, every kitchen screen and phone that's open says so and refreshes
  itself.

### Fixed

- Times on every screen now follow the household's time zone and 12- or 24-hour choice from
  Settings → Household, not the device's.
- A person's birthday now shows on the calendar as a chip in their color, with Countdowns on or
  off. Before, it was a grey star that depended on Countdowns.
- Events on the kitchen screen that can't be moved (from a read-only calendar, a dinner, a
  birthday) no longer read as unavailable to a screen reader.
- On a portrait kitchen screen, a busy day's all-day events no longer spill into the next
  day's row or hide its other events: whatever doesn't fit is behind "+N more".
- On the week board, today's now line always shows, even when the day's events don't all fit.
- The kitchen screen's keyboard now types into sheets (changing a person, setting the PIN), and
  the sheet moves up so the field stays above the keys.
- The code in the kitchen screen's Photos room opens Sunroom on a phone that has never used it,
  instead of an error.
- After typing in the Add panel or a sheet, the kitchen screen no longer stays shifted up with
  the clock cut off at the top.
- The Today panel scrolls when it holds more than fits, instead of cutting its last lines.
- At Extra large text, and on a laptop's shorter screen, the rail's rooms make room so Add and
  Settings stay on the screen.
- "Change which?" keeps the days' capitals: "every week on Tue and Thu".
- The Today view waits for the day's events before saying "Nothing on today."
- Settings choices with longer words (Change photo every, Clear done items) wrap as buttons on
  a phone instead of running into each other, and Google's helper asks for its key file with a
  proper Upload the key file button.

## [0.6.0] - 2026-10-08

### Added

- The kitchen screen can dim in the evening before it sleeps: Settings → Display → Dim in the
  evening, from the time you choose, a little, half or low.
- Settings → About → New versions: Sunroom can check once a day whether there's a new version,
  and says how to update. It's off until you turn it on.
- Settings → Backup → Download everything: the family's data and every photo in one file, to
  keep somewhere safe. [docs/RESTORE.md](docs/RESTORE.md) shows how to put it back, on the same
  server or a new one.
- On a Raspberry Pi, the screen itself now switches off at bedtime and turns down in the evening
  (on monitors that allow it), and a tap brings it back. Run the Pi installer again to add this
  to a screen you already have (docs/KIOSK.md).

### Changed

- On an upright kitchen screen, the Today band at the top now fits everything (Tonight and Coming
  up too), in three columns.
- When a chore with stars is done, the "+2" flies to the person's picture on the Today panel.
- A long press on a list's tile opens Change list.
- Adding an iCloud or Google calendar on a phone: each step now has a drawing of what to tap.
- The Copy button for Google's helper address works on a plain home address too (it did
  nothing there before).
- Behind the scenes: restoring a backup checks it completely before anything changes; new guides
  for choosing the hardware, reaching Sunroom away from home, and adding a feature; and the
  privacy page lists everything Sunroom sends and to whom.

## [0.5.0] - 2026-10-08

### Added

- Meals: the week's dinners on the kitchen screen and on phones.
  - Tonight's dinner, and who cooks, shows on the Today panel.
  - Every meal you add is kept under Saved meals, so next week it's one tap. A saved meal can
    have its recipe link and ingredients.
  - Add ingredients to Groceries puts a meal's ingredients on your grocery list in one tap.
  - Swap days, and Copy last week, both with Undo.
  - Breakfast, lunch and snacks too if you want them, and dinner on the calendar, in
    Settings → Meals.
- Countdowns: "12 days" to the things your family looks forward to.
  - Birthdays count down by themselves, from the birthdays in Family.
  - The nearest three show on the Today panel; on the day it says "Today: Mia's birthday!" and
    the kitchen screen celebrates the first time someone touches it.
  - Add a countdown from any event on the calendar.
  - Keep one off the kitchen screen, for a surprise.
- Photos and the screensaver: add photos from a phone (several at once, iPhone photos too), and
  when nobody has touched the kitchen screen for a while they fade in with the clock and what's
  next. A tap takes you back to where you were.
  - The Photos room shows them all; hide one from the screensaver right there.
  - A parent can start the screensaver from their phone.
  - Photos put in the photos/inbox folder on the server are added by themselves.
  - Settings → Photos & screensaver sets when it starts and how often the photo changes.
- Weather by the clock, with each day's sky on the board and the forecast a tap away, from
  Open-Meteo.
- Where's home: a new first-run step (also in Settings → Household → Location) for the weather.
  With it, the kitchen screen turns dark at your sunset and light at sunrise, instead of 7 PM
  and 7 AM, and it waits until nobody's touching the screen.
- At night, the dim clock shows tomorrow's first event under it.

### Changed

- Behind the scenes: adding photos no longer holds up everything else while they're
  processed, which matters on a Raspberry Pi.

## [0.4.0] - 2026-10-08

### Added

- Lists, on the kitchen screen and on phones: groceries, to-dos, packing lists and your own.
  - Add several things at once ("milk, eggs, bread"), or tap one of the list's Usuals, the
    things your family adds most.
  - Give a thing a person or a day; things due today show on the Today panel under To do.
  - Checking one off strikes it through in the color of whoever checked it, and it moves to
    Done. Clear done tidies the list, with Undo.
- Chores, with a column for each person and one for anyone:
  - a chore can be each person's own, taken in turns ("Mia's turn"), or anyone's ("Who did
    it?");
  - ticking one stamps it, with a burst in that person's color; their last one of the day
    says "All done, Mia!";
  - This week shows how each person did, day by day.
- Stars: chores can give stars, kids see their balance, a week's total and how many days in a
  row they finished everything.
- Rewards: kids ask for a reward with their stars, and a parent says yes or not now, on a
  phone or on the kitchen screen with the PIN.
- Routines: a morning or bedtime checklist a kid runs on the kitchen screen, one big step at a
  time, with a picture for each, ending with a celebration (and stars, if you like).
- Settings → Chores turns stars, rewards, routines and a parent's check on or off, and sets
  up rewards and routines. Turning on "A parent checks finished chores" holds a kid's stars
  until a parent says it's done.
- Who's doing what shows each person's chores under their events, and the Today panel shows
  how everyone is doing.
- Recently removed now brings back lists, things on them and chores, too.

### Fixed

- A calendar address that stops working, say after you reset Google's secret address, now says
  so on the board, and Connect again takes its new address. Before, it quietly kept showing the
  last events it had.
- Behind the scenes: a feature whose background work trips up keeps working on screen, and a
  safety check that each feature switches fully off works again.

## [0.3.0] - 2026-10-08

### Added

- Bring in the calendars you already use, from Settings → Calendars & accounts on a phone:
  - Google, three ways: paste its secret address (shows events only), share your calendars with
    a Sunroom helper you make once, or sign in with Google when Sunroom has an https:// address;
  - iCloud, with an app-specific password;
  - other calendar servers such as Nextcloud and Fastmail;
  - any calendar address (.ics): school, team and Outlook calendars;
  - public holidays for your country and region, with no address at all.
- Each calendar can belong to a person, so its events show in their color, or to everyone, with
  a color of its own (each color says who already uses it). Any calendar can stay off the
  kitchen screen and show only on phones.
- Calendars from iCloud, Google's helper or sign-in, and calendar servers sync both ways:
  - what you add, change, move or remove on the kitchen screen or a phone goes back within a
    minute;
  - changes made elsewhere arrive within about five minutes, or straight away with Refresh now;
  - a change waiting to go out says "Not synced yet".
- An event's sheet says where it comes from, like "iCloud · Work". Events from calendars that
  only show events, such as holidays or a school's calendar address, say so and can't be changed
  by mistake.
- When an account stops answering, the board shows one quiet line ("iCloud hasn't answered since
  9:10 AM. Showing what we had."), and its events stay. A refused password asks to be connected
  again.
- Setting up Sunroom now offers to bring in your calendars just before it finishes.
- Behind the scenes: Sunroom talks to calendar servers through its own guarded connection.
  Passwords, keys and calendar addresses are stored encrypted, and are never shown again or sent
  to another server.

## [0.2.0] - 2026-10-08

### Added

- The calendar. Add an event by typing it the way you'd say it, like "Dentist Thu 2:30pm Mia":
  Sunroom works out the day, the time, how long, who and how often it repeats, and shows what it
  understood as buttons you can tap to fix.
- Events can repeat: every day, on weekdays, every week or two, every month, every year, or a
  pattern of your own. Changing or removing one asks whether you mean just this one, this one and
  the ones after, or all of them.
- The kitchen screen shows the week, one day, the month, "Who's doing what" (a column for each
  person) or a big Today view. Settings → Display → Home view picks which one it comes back to.
- Press and hold an event on the kitchen screen to drag it to another day.
- Everything you add, change, move or remove says so with an Undo button. Removed events stay in
  Settings → Household → Recently removed for 7 days, with Put back.
- The Today panel shows what's on now, what's next and the rest of today, and tomorrow after
  6 PM.
- An event can show a reminder on the kitchen screen 10 minutes, an hour or a day before.
- Tap people's pictures at the top of the calendar to see only their events (and everyone's).
- Today's events that are over fade, so what's next stands out (Settings → Display).
- On a phone, Today shows what's on now and next, and Calendar has Week, Day, Agenda and Month
  views, a search by title or place, and the same editor.
- Settings → Calendars & accounts: calendars of your own, each with a color, whose it is and
  whether it shows on the kitchen screen, and which one new events go to.
- With kid-safe editing on, changing or removing an event on the kitchen screen asks for the
  parent PIN. Adding and moving events don't.
- Behind the scenes: a recurrence engine of Sunroom's own, checked against two reference
  libraries, and the calendar's tables, which the update adds to the database on its first
  start.

### Changed

- The instructions for running Sunroom on a server now start from a `docker-compose.yml` in a
  folder of its own, started with `docker compose up -d` (a Portainer stack still works). They
  also cover running it next to another app that already uses port 8080, and using a host folder
  instead of the `sunroom_data` volume.

## [0.1.0] - 2026-10-08

### Added

- Set Sunroom up from a phone: a household password, the household's name, time zone and first
  day of the week, the people who live here (parents and kids, each with a color), an optional
  parent PIN, and the kitchen screen.
- Pair the kitchen screen by typing the six-character code it shows into a phone, or by typing
  the household password on the screen's own keyboard. It stays signed in, through restarts and
  power cuts.
- The kitchen screen shows this week: the clock and date, today's column lit, a line for now, and
  the Today panel. Turned on its side, Today sits on top and the rooms along the bottom. Two
  minutes after the last touch it goes back to this week.
- Settings on the kitchen screen ask for the parent PIN. Lock closes them, and they lock
  themselves after two minutes.
- Settings: Family (people, the parent PIN, kid-safe editing), Features, Display (theme, text
  size, daylight tint, reduce motion, which side the rail sits, the Today panel, the sleep
  schedule), Household (name, time zone, first day of the week, 12- or 24-hour time), Phones &
  screens (add a phone with a code, mark a kid's phone, sign out a phone, unpair a screen),
  Backup and About.
- The screen sleeps on a schedule, with a dim clock or a black screen, and a tap wakes it.
- Phones get Today, Calendar and More; a laptop gets the kitchen screen's layout and uses its own
  keyboard.
- A change on one phone or screen shows on all of them at once.
- Sunroom installs on an iPhone or Android home screen like an app.
- One Docker container with a data volume, nightly backups, a full export, and `sunroom`
  commands to back up, restore, reset the password and check the setup.
- A Raspberry Pi installer for the kitchen screen, which can also point at a Sunroom running on
  another computer.

### Behind the scenes

- Every change is checked on the kitchen screen's sizes, phones and a laptop, for accessibility
  in light and dark, and for anything private before it can be published; each release is
  started from a clean copy and tried out before anyone can download it.

### Security

- Sunroom answers only to addresses it recognises (local names and addresses, plus the ones in
  `APP_ALLOWED_HOSTS`), refuses changes from other sites, and limits what its pages may load.
- Outside addresses are checked before every connection, so a setting can't reach into your home
  network unless you allow it.

[0.1.0]: https://github.com/ScopeXL/assistant-calendar/releases/tag/v0.1.0

[0.2.0]: https://github.com/ScopeXL/assistant-calendar/compare/v0.1.0...v0.2.0

[0.3.0]: https://github.com/ScopeXL/assistant-calendar/compare/v0.2.0...v0.3.0

[0.4.0]: https://github.com/ScopeXL/assistant-calendar/compare/v0.3.0...v0.4.0

[0.5.0]: https://github.com/ScopeXL/assistant-calendar/compare/v0.4.0...v0.5.0

[Unreleased]: https://github.com/ScopeXL/assistant-calendar/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/ScopeXL/assistant-calendar/compare/v0.5.0...v0.6.0
