# ADR 0015: Quick add is parsed locally with chrono-node; no LLM in v1

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

- "Events are hard to add on-screen" is a top complaint about wall calendars. The common case should be two taps and one line of typing (UX §11).
- Skylight's Sidekick turns plain text into events, but through a cloud service.
- An LLM would need an API key or a cloud dependency, and a local one is slow on a Pi: about 5 tokens a second for a 3B model on a Pi 5 (PLAN §19).

## Decision

- **Quick add parses as you type, in the browser,** with `chrono-node` plus a small grammar for people and repeats: "Soccer Tue 4pm", "Dentist Oct 14 2:30".
- It picks out a title, a day word, a time or a range, a length, a person's name, a repeat word and "all day" (UX §4).
- **What it understood shows as chips** under the field. Each chip is a button that opens its picker, so a misreading is one tap to fix. When nothing parses, the draft is a title-only, all-day event on the selected day.
- **The display and phones run the same parser.** Saving goes through the normal event API, which validates it like any other event.
- **No LLM in v1.** A fallback for when chrono-node is unsure, behind the household's own API key, is a later idea (PLAN §19).

## Consequences

- Quick add needs no internet and no key, and sends the text nowhere.
- A table of phrases and the chips they should produce is a Vitest unit test (PLAN §14.6).
- The words the parser used stay in the field, so nothing typed is lost; "9/10" is read by locale.
- `chrono-node` reads dates against the browser's clock and zone, while Sunroom shows timed events in the household zone (PLAN §7.2). How a phone in another zone reads "Thu 2:30pm" is settled when quick add is built, in M1.
