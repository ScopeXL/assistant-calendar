# Changelog

Everything that changes in Sunroom, written in plain English. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- A calendar address that stops working, say after you reset Google's secret address, now says
  so on the board, and Connect again takes its new address. Before, it quietly kept showing the
  last events it had.

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

[Unreleased]: https://github.com/ScopeXL/assistant-calendar/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ScopeXL/assistant-calendar/compare/v0.2.0...v0.3.0
