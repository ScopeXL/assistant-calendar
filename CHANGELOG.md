# Changelog

Everything that changes in Sunroom, written in plain English. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/ScopeXL/assistant-calendar/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ScopeXL/assistant-calendar/releases/tag/v0.1.0
