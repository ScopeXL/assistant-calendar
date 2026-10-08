/**
 * Quick add (UX §4 and §6, ADR 0015): one line of text read as an event draft while the family
 * types, in the browser. chrono-node finds dates and times; the small grammars here find repeats,
 * lengths, people, "all day" and the casual words (today, tomorrow, noon). Each finding is a span
 * of the text, so the editor can show which words were understood.
 *
 * Everything is the household's wall time. chrono gets a reference made from the household's
 * today, and none of its own day or year guesses are used, only what it read in the text (a
 * month and day, a weekday, an hour and minute), so the device's time zone never moves a result.
 */
import * as chrono from "chrono-node";

import { addDays, weekOf, weekdayOf, zonedParts } from "../../lib/dates";
import type { Repeat } from "./repeat";

export interface QuickAddMember {
  id: string;
  name: string;
}

export interface QuickAddContext {
  now: Date; // server-corrected now
  zone: string; // the household's IANA zone; everything below is in this zone
  weekStartsOn: number; // 0 Monday … 6 Sunday
  members: QuickAddMember[];
  defaultDay: string; // ISO date: the day tapped on the board, or today
}

export type UnderstoodKind = "day" | "time" | "length" | "who" | "repeat" | "allDay";

/** A span of the input text the parser used, as in `text.slice(start, end)`. */
export interface Understood {
  kind: UnderstoodKind;
  start: number;
  end: number;
}

export interface QuickAddDraft {
  title: string; // the input minus the parsed words, tidied
  day: string | null; // ISO date understood, or null (the editor then uses defaultDay)
  allDay: boolean; // true when "all day" was said, or when no time was understood
  start: string | null; // "HH:MM" 24-hour local wall time, null when all day
  end: string | null; // "HH:MM" when a range ("2-3pm") or a length ("for 2h") was given
  durationMinutes: number | null; // from a length or a range
  memberIds: string[]; // members named, in household order
  repeat: Repeat | null;
  understood: Understood[]; // sorted by start; the editor highlights these spans
}

interface Span {
  start: number;
  end: number;
}

/** How a day was said: "tomorrow", "Thu", "Oct 9" or "the 9th", "10/9". */
type DaySource = "word" | "weekday" | "date" | "slash";

/** A repeat as said, before the event's day settles its weekday. */
interface RepeatWords {
  freq: Repeat["freq"];
  interval: number;
  weekdays?: number[];
  monthDay?: number;
}

type Finding = Span &
  (
    | { kind: "allDay" }
    | { kind: "repeat"; words: RepeatWords }
    | { kind: "length"; minutes: number }
    | { kind: "who"; ids: string[]; possessive: boolean }
    | { kind: "day"; day: string; source: DaySource }
    | { kind: "time"; from: number; to: number | null }
  );

interface Reading {
  text: string;
  /** The text with found words hidden, so the grammars after them and chrono skip them. */
  masked: string;
  findings: Finding[];
}

type Groups = (string | undefined)[];

interface Match extends Span {
  groups: Groups;
}

const HIDDEN = "\uE000";
const DAY_MINUTES = 24 * 60;
const HALF_DAY = 12 * 60;
const WORKWEEK = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

// Whole words, without lookbehind (older Safari lacks it): the left edge is the first group.
const LEFT = "(^|[^\\p{L}\\p{N}_])";
const RIGHT = "(?![\\p{L}\\p{N}_])";

function words(body: string): RegExp {
  return new RegExp(`${LEFT}(?:${body})${RIGHT}`, "giu");
}

function matches(pattern: RegExp, text: string): Match[] {
  return Array.from(text.matchAll(pattern), (match) => ({
    start: match.index + (match[1]?.length ?? 0),
    end: match.index + match[0].length,
    groups: match.slice(2),
  }));
}

function hide(text: string, { start, end }: Span): string {
  return text.slice(0, start) + HIDDEN.repeat(end - start) + text.slice(end);
}

function claim(reading: Reading, finding: Finding): void {
  reading.findings.push(finding);
  reading.masked = hide(reading.masked, finding);
}

const pad = (value: number): string => String(value).padStart(2, "0");
const clock = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
/** Minutes from one wall time to the next time it's `to`, across midnight if need be. */
const minutesAfter = (from: number, to: number): number =>
  (to - from + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES;

function isoDay(year: number, month: number, date: number): string | null {
  const day = new Date(Date.UTC(year, month - 1, date));
  if (day.getUTCFullYear() !== year || day.getUTCMonth() !== month - 1) return null;
  return day.toISOString().slice(0, 10);
}

/** The first of these weekdays on or after today. */
function nextOnWeekdays(today: string, weekdays: readonly number[]): string {
  return addDays(today, Math.min(...weekdays.map((day) => (day - weekdayOf(today) + 7) % 7)));
}

/** The first day of a month with this date ("the 9th") on or after today. */
function nextOnDate(today: string, date: number): string | null {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  for (let ahead = month; ahead < month + 12; ahead += 1) {
    const day = isoDay(year + Math.floor(ahead / 12), (ahead % 12) + 1, date);
    if (day && day >= today) return day;
  }
  return null;
}

/* Numbers and weekdays as words */

const NUMBER_WORDS = "one two three four five six seven eight nine ten eleven twelve".split(" ");
const ORDINAL_WORDS = ["", "", "second", "third", "fourth", "fifth", "sixth"];

/** 2 for "2", "two", "2nd" or "second" (and 1 for "a"); null for anything else. */
function numberOf(word: string | undefined): number | null {
  const lower = word?.toLowerCase() ?? "";
  if (/^\d/.test(lower)) return parseInt(lower, 10);
  if (lower === "a" || lower === "an") return 1;
  if (NUMBER_WORDS.includes(lower)) return NUMBER_WORDS.indexOf(lower) + 1;
  return ORDINAL_WORDS.indexOf(lower) > 0 ? ORDINAL_WORDS.indexOf(lower) : null;
}

const DAY =
  "mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?";
const DAYS = "(?:mon|tues|wednes|thurs|fri|satur|sun)days";
const ANY_DAY = `(?:${DAYS}|${DAY})`;
const AND = "\\s*,\\s*(?:and\\s+)?|\\s*[&/+]\\s*|\\s+and\\s+";
const DAY_LIST = `${ANY_DAY}(?:(?:${AND}|\\s+)${ANY_DAY})*`;
const DAY_WORD = new RegExp(ANY_DAY, "giu");
const DAY_PREFIXES = ["mo", "tu", "we", "th", "fr", "sa", "su"];

/** The weekdays a list names ("Tue and Thu"), sorted. */
function weekdaysIn(list: string): number[] {
  const days = Array.from(list.matchAll(DAY_WORD), (match) =>
    DAY_PREFIXES.indexOf(match[0].slice(0, 2).toLowerCase()),
  );
  return [...new Set(days)].filter((day) => day >= 0).sort((a, b) => a - b);
}

/* "all day" */

const ALL_DAY = words("all[\\s-]?day");

function readAllDay(reading: Reading): void {
  for (const { start, end } of matches(ALL_DAY, reading.masked)) {
    claim(reading, { kind: "allDay", start, end });
  }
}

/* Repeats */

const EVERY = "(?:every|each)\\s+";
// "every Tue and Thu", also "every Tue and every Thu".
const EVERY_DAY_LIST = `${ANY_DAY}(?:(?:${AND}|\\s+)(?:${EVERY})?${ANY_DAY})*`;
const ORDINALS = ["2nd", "3rd", "4th", "5th", "6th", ...ORDINAL_WORDS.slice(2)].join("|");
const INTERVAL = `(?:(other)\\s+|(\\d{1,2}|${NUMBER_WORDS.join("|")})\\s+|(${ORDINALS})\\s+)?`;
const ON_DAYS = `(?:\\s+on\\s+(${DAY_LIST}))?`;
const ON_DATE = "(?:\\s+on\\s+the\\s+(\\d{1,2})(?:st|nd|rd|th)?)?";

function intervalOf([other, count, nth]: Groups): number | null {
  if (other) return 2;
  const number = numberOf(count ?? nth) ?? 1;
  return number >= 1 && number <= 99 ? number : null;
}

function weekly(interval: number | null, list: string | undefined): RepeatWords | null {
  if (interval === null) return null;
  const weekdays = list ? weekdaysIn(list) : [];
  return weekdays.length ? { freq: "weekly", interval, weekdays } : { freq: "weekly", interval };
}

function monthly(interval: number | null, date: string | undefined): RepeatWords | null {
  if (interval === null) return null;
  if (date === undefined) return { freq: "monthly", interval };
  const monthDay = Number(date);
  return monthDay >= 1 && monthDay <= 31 ? { freq: "monthly", interval, monthDay } : null;
}

function every(freq: "daily" | "yearly", interval: number | null): RepeatWords | null {
  return interval === null ? null : { freq, interval };
}

// In this order: the words one pattern found are hidden from the ones after it.
const REPEATS: [RegExp, (groups: Groups) => RepeatWords | null][] = [
  [words(`${EVERY}${INTERVAL}weeks?${ON_DAYS}`), (g) => weekly(intervalOf(g), g[3])],
  [words(`${EVERY}${INTERVAL}months?${ON_DATE}`), (g) => monthly(intervalOf(g), g[3])],
  [words(`${EVERY}${INTERVAL}days?`), (g) => every("daily", intervalOf(g))],
  [words(`${EVERY}${INTERVAL}years?`), (g) => every("yearly", intervalOf(g))],
  [
    words(`${EVERY}weekdays?|(?:on\\s+)?weekdays`),
    () => ({ freq: "weekly", interval: 1, weekdays: WORKWEEK }),
  ],
  [
    words(`${EVERY}weekends?|(?:on\\s+)?weekends`),
    () => ({ freq: "weekly", interval: 1, weekdays: WEEKEND }),
  ],
  [
    words(`${EVERY}(other\\s+)?(${EVERY_DAY_LIST})`),
    ([other, list]) => weekly(other ? 2 : 1, list),
  ],
  [words(`(?:on\\s+)?(${DAYS}(?:(?:${AND}|\\s+)${DAYS})*)`), ([list]) => weekly(1, list)],
  [
    words(`(weekly|fortnightly)${ON_DAYS}`),
    ([word, list]) => weekly(word?.toLowerCase() === "weekly" ? 1 : 2, list),
  ],
  [words(`monthly${ON_DATE}`), ([date]) => monthly(1, date)],
  [words("daily"), () => every("daily", 1)],
  [words("yearly|annually"), () => every("yearly", 1)],
];

function readRepeats(reading: Reading): void {
  for (const [pattern, read] of REPEATS) {
    for (const { start, end, groups } of matches(pattern, reading.masked)) {
      const repeat = read(groups);
      if (repeat) claim(reading, { kind: "repeat", start, end, words: repeat });
    }
  }
}

/* Lengths */

const ABOUT = "(?:(?:about|around|roughly|approximately|approx\\.?)\\s+)?";
const HOURS = "h|hrs?|hours?";
const MINUTES = "m|mins?|minutes?";
// Without "for", "in 30 min" and "2 hours later" say when, not how long.
const WHEN_BEFORE =
  /(?:^|[^\p{L}\p{N}_])(?:in|within|every|each|after|before|than|under|over)\s*$/iu;
const WHEN_AFTER = /^\s*(?:ago|later|after|before|from\s+now|away|left)(?![\p{L}\p{N}_])/iu;

function hoursOf(text: string | undefined): number {
  const whole = text?.replace("½", "").trim();
  return (whole ? Number(whole) : 0) + (text?.includes("½") ? 0.5 : 0);
}

// Each pattern's first group is "for", which only some may leave out.
const LENGTHS: [RegExp, (groups: Groups) => number][] = [
  [words(`(for\\s+)${ABOUT}(?:(?:an?|one)\\s+)?hour\\s+and\\s+a\\s+half`), () => 90],
  [words(`(for\\s+)${ABOUT}(?:half\\s+an?\\s+hour|an?\\s+half\\s+hour|half\\s+hour)`), () => 30],
  [
    words(`(for\\s+)${ABOUT}(an?|${NUMBER_WORDS.join("|")})\\s+(hours?|minutes?)`),
    ([, count, unit]) => (numberOf(count) ?? 0) * (unit?.toLowerCase().startsWith("h") ? 60 : 1),
  ],
  [
    words(
      `(for\\s+${ABOUT})?(\\d+(?:\\.\\d+)?\\s*½?|½)\\s*(?:${HOURS})(?:\\s*(?:and\\s+)?(\\d{1,2})\\s*(?:${MINUTES})|(\\d{2}))?`,
    ),
    ([, hours, minutes, attached]) => hoursOf(hours) * 60 + Number(minutes ?? attached ?? 0),
  ],
  [words(`(for\\s+${ABOUT})?(\\d+)\\s*(?:${MINUTES})`), ([, minutes]) => Number(minutes)],
];

function readLengths(reading: Reading): void {
  for (const [pattern, read] of LENGTHS) {
    for (const { start, end, groups } of matches(pattern, reading.masked)) {
      const minutes = Math.round(read(groups));
      if (!(minutes >= 1 && minutes <= DAY_MINUTES)) continue;
      const loose = !groups[0];
      if (loose && WHEN_BEFORE.test(reading.masked.slice(0, start))) continue;
      if (loose && WHEN_AFTER.test(reading.masked.slice(end))) continue;
      claim(reading, { kind: "length", start, end, minutes });
    }
  }
}

/* People */

const MONTH_WORDS = new Set(
  [
    "january february march april may june july august september october november december",
    "jan feb mar apr jun jul aug sep sept oct nov dec",
  ]
    .join(" ")
    .split(" "),
);

const folded = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, " ");
const escaped = (name: string): string =>
  name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");

function readPeople(reading: Reading, members: readonly QuickAddMember[]): void {
  const named = members.filter((member) => folded(member.name));
  if (!named.length) return;
  // Longest first, so "Ana Sofia" wins over "Ana".
  const names = [...new Set(named.map((member) => folded(member.name)))]
    .sort((a, b) => b.length - a.length)
    .map(escaped)
    .join("|");
  const name = `(?:${names})(?:['’]s)?`;
  const group = words(`((?:with|w/)\\s*)?(${name}(?:(?:${AND})${name})*)`);
  const one = words(`(${names})(['’]s)?`);
  for (const { start, end, groups } of matches(group, reading.masked)) {
    const said = matches(one, groups[1] ?? "");
    const first = folded(said[0]?.groups[0] ?? "");
    // A month's name beside a number is a date: "May 5", "5 May".
    if (said.length === 1 && MONTH_WORDS.has(first)) {
      const after = reading.masked.slice(end);
      const before = reading.masked.slice(0, start);
      if (/^\s*\d/.test(after) || /\d(?:st|nd|rd|th)?\s+(?:of\s+)?$/i.test(before)) continue;
    }
    const spoken = new Set(said.map((match) => folded(match.groups[0] ?? "")));
    const ids = named.filter((member) => spoken.has(folded(member.name))).map(({ id }) => id);
    const possessive = said.some((match) => Boolean(match.groups[1]));
    if (ids.length) claim(reading, { kind: "who", start, end, ids, possessive });
  }
}

/* Casual day words */

const DAY_WORDS = words(
  "(?:the\\s+)?day\\s+after\\s+(?:tomorrow|tmrw)|today|tonight|tomorrow|tmrw|tmr",
);
// "on the 9th", but not "the 4th of July", which chrono reads whole.
const NTH_DAY = words(
  "(?:on\\s+)?the\\s+(\\d{1,2})(?:st|nd|rd|th)(?!\\s+(?:of\\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))",
);

function readDayWords(reading: Reading, today: string): void {
  for (const { start, end } of matches(DAY_WORDS, reading.masked)) {
    const word = reading.text.slice(start, end).toLowerCase();
    const ahead = word.includes("after") ? 2 : word === "today" || word === "tonight" ? 0 : 1;
    claim(reading, { kind: "day", start, end, day: addDays(today, ahead), source: "word" });
  }
  for (const { start, end, groups } of matches(NTH_DAY, reading.masked)) {
    const day = nextOnDate(today, Number(groups[0]));
    if (day) claim(reading, { kind: "day", start, end, day, source: "date" });
  }
}

/* Dates and times, read by chrono */

// chrono's parsers without its casual words ("tonight", "this evening") or its refiners: which
// day a weekday means, the year of a date and how results combine are decided here instead.
const reader = new chrono.Chrono({
  parsers: chrono.en.configuration.createConfiguration(false, false).parsers,
  refiners: [],
});

// Words chrono reads once respelled, at the same length so every offset still holds.
const RESPELL: [RegExp, (word: string) => string][] = [
  [words("(?:12\\s*)?(?:noon|midday)"), () => "12pm"],
  [words("(?:12\\s*)?midnight"), () => "12am"],
  [words("tues|weds"), (word) => word.slice(0, 3)],
  [/()@\s/gu, () => "at"], // "soccer @ 4"
];
const WEEK_PARTS = words("week(?:end|day)s?");
// A time after these ends something rather than starting it: "Library until 5pm".
const NOT_A_START_TIME = /(?:^|[^\p{L}\p{N}_])(?:until|till|til|before|after)\s*$/iu;
const DATE_PARTS: chrono.Component[] = ["day", "month", "weekday", "year"];
const AFTER_THE = /(?:^|[^\p{L}\p{N}_])the\s+$/iu;

/** "Thu" is the next Thursday on or after today; "next Thu" the one in the following week. */
function weekdayDay(result: chrono.ParsedResult, today: string, weekStartsOn: number): string {
  const weekday = ((result.start.get("weekday") ?? 1) + 6) % 7; // chrono counts from Sunday
  const ahead = (weekday - weekdayOf(today) + 7) % 7;
  if (/\bnext\b/i.test(result.text)) {
    const nextWeek = addDays(weekOf(today, weekStartsOn)[0] ?? today, 7);
    return addDays(nextWeek, (weekday - weekStartsOn + 7) % 7);
  }
  if (/\b(?:last|past)\b/i.test(result.text)) return addDays(today, ahead - 7);
  return addDays(today, ahead);
}

/** The month and day on or after today (a past one is next year's), or in the year said. */
function dateDay(result: chrono.ParsedResult, today: string): string | null {
  const month = result.start.get("month");
  const date = result.start.get("day");
  const year = result.start.get("year");
  if (month === null || date === null) return null;
  if (result.start.isCertain("year") && year !== null) return isoDay(year, month, date);
  const thisYear = Number(today.slice(0, 4));
  for (let next = thisYear; next <= thisYear + 8; next += 1) {
    const day = isoDay(next, month, date);
    if (day && day >= today) return day;
  }
  return null;
}

const minutesOf = (components: chrono.ParsedComponents): number =>
  (components.get("hour") ?? 0) * 60 + (components.get("minute") ?? 0);

/** A time or a range in minutes after midnight, am and pm settled as a family means them. */
function readClock(result: chrono.ParsedResult): { from: number; to: number | null } {
  const { start, end } = result;
  let from = minutesOf(start);
  const startHour = start.get("hour") ?? 0;
  if (!start.isCertain("meridiem")) {
    if (end?.isCertain("meridiem")) {
      // chrono gave the start the end's am or pm: right for "4-5pm", not for "11-1pm".
      if (startHour >= 12 && from > minutesOf(end)) from -= HALF_DAY;
    } else if (startHour >= 1 && startHour <= 7 && !/^\D*0\d/.test(result.text)) {
      // A bare "at 4" is the next sensible hour: 1–7 PM, 8–11 AM. "07:30" is a 24-hour time.
      from += HALF_DAY;
    }
  }
  if (!end) return { from, to: null };
  let to = minutesOf(end);
  const endHour = end.get("hour") ?? 0;
  if (!end.isCertain("meridiem") && endHour <= 12) {
    // Whichever of its am and pm comes first after the start: "at 4-5", "10am-2".
    const morning = (endHour % 12) * 60 + (end.get("minute") ?? 0);
    const evening = morning + HALF_DAY;
    to = minutesAfter(from, morning) < minutesAfter(from, evening) ? morning : evening;
  }
  return { from, to: to === from ? null : to };
}

function readChrono(reading: Reading, today: string, weekStartsOn: number): void {
  let text = reading.masked;
  const respelled: Span[] = [];
  for (const [pattern, spell] of RESPELL) {
    for (const { start, end } of matches(pattern, text)) {
      const word = text.slice(start, end);
      text = text.slice(0, start) + spell(word).padEnd(word.length) + text.slice(end);
      respelled.push({ start, end });
    }
  }
  // "weekend" and "weekday" on their own stay in the title rather than meaning a Saturday.
  for (const span of matches(WEEK_PARTS, text)) text = hide(text, span);

  const [year = 1970, month = 1, date = 1] = today.split("-").map(Number);
  // Noon on the household's today in the device's zone: chrono only takes the date from it.
  const reference = new Date(year, month - 1, date, 12);
  const kept: chrono.ParsedResult[] = [];
  for (const result of reader.parse(text, reference)) {
    if (result.text.includes(HIDDEN) || result.start.tags().has("result/relativeDate")) continue;
    if (/^\d*(?:\.\d*)?$/.test(result.text.replace(/\s/g, ""))) continue; // a bare "20"
    // Of two readings that overlap, keep the longer, as chrono's own refiner does.
    const last = kept.at(-1);
    if (last && result.index < last.index + last.text.length) {
      if (result.text.length <= last.text.length) continue;
      kept.pop();
    }
    kept.push(result);
  }

  for (const result of kept) {
    const span = { start: result.index, end: result.index + result.text.trimEnd().length };
    for (const word of respelled) {
      if (word.start < span.end && word.end > span.start) {
        span.start = Math.min(span.start, word.start);
        span.end = Math.max(span.end, word.end);
      }
    }
    const before = reading.text.slice(0, span.start);
    const parts = result.start;
    const hasDate = DATE_PARTS.some((part) => parts.isCertain(part));
    if (parts.isCertain("hour")) {
      if (hasDate || NOT_A_START_TIME.test(before)) continue;
      claim(reading, { kind: "time", ...span, ...readClock(result) });
    } else if (hasDate && !result.end) {
      if (parts.isCertain("weekday") && !parts.isCertain("day")) {
        // "Fun in the sun" and "SAT prep" don't name days.
        const short = /\b(?:mon|tue|wed|thu|fri|sat|sun)\b/i.exec(result.text)?.[0];
        const acronym = short === short?.toUpperCase() && /\p{Ll}/u.test(reading.text);
        if ((short !== undefined && acronym) || AFTER_THE.test(before)) continue;
        const day = weekdayDay(result, today, weekStartsOn);
        claim(reading, { kind: "day", ...span, day, source: "weekday" });
      } else if (parts.isCertain("day") && parts.isCertain("month")) {
        // A month alone ("March 2027") names no day.
        const day = dateDay(result, today);
        const slash = result.start.tags().has("parser/SlashDateFormatParser");
        if (day) claim(reading, { kind: "day", ...span, day, source: slash ? "slash" : "date" });
      }
    }
  }
}

/* Settling the days */

// A day after these ends something rather than starting it: "every Tue until Dec 31".
const NOT_A_START_DAY =
  /(?:^|[^\p{L}\p{N}_])(?:until|till|til|through|thru|ending|ends|before|after)\s*$/iu;
const BESIDE = /^[\s,]*$/;
// What joins the days of a list or a range: "Mon/Wed/Fri", "Sat and Sun", "Oct 20 - Oct 23".
const BETWEEN_DAYS = /^\s*(?:,\s*)?(?:and|or|&|\/|\+|-|–|—|to|through|thru|until|till)?\s*$/i;

/**
 * Days said together become one: "Thu, Oct 9" is the date and its weekday, "tomorrow Thu" the
 * same day twice. Several different days ("Mon/Wed/Fri", "Sat and Sun", "Oct 20 - Oct 23") are
 * no single day, so they stay in the title, as does a day that ends something.
 */
function settleDays(reading: Reading): void {
  const { text } = reading;
  const days: Extract<Finding, { kind: "day" }>[] = [];
  for (const finding of reading.findings) if (finding.kind === "day") days.push(finding);
  days.sort((a, b) => a.start - b.start);

  const joined: typeof days = [];
  for (const day of days) {
    const previous = joined.at(-1);
    if (previous && BESIDE.test(text.slice(previous.end, day.start))) {
      const pair = [previous, day];
      const weekday = pair.find((one) => one.source === "weekday");
      const date = pair.find((one) => one.source !== "weekday" && one.source !== "word");
      if (previous.day === day.day || (weekday && date)) {
        const source = date?.source ?? previous.source;
        joined[joined.length - 1] = {
          ...previous,
          end: day.end,
          day: date?.day ?? day.day,
          source,
        };
        continue;
      }
    }
    joined.push(day);
  }

  const settled = joined.filter((day, index) => {
    const previous = joined[index - 1];
    const next = joined[index + 1];
    if (previous && BETWEEN_DAYS.test(text.slice(previous.end, day.start))) return false;
    if (next && BETWEEN_DAYS.test(text.slice(day.end, next.start))) return false;
    return !NOT_A_START_DAY.test(text.slice(0, day.start));
  });
  reading.findings = [...reading.findings.filter((finding) => finding.kind !== "day"), ...settled];
}

/* The draft */

// Words that only join a title to what was taken out of it: "Dentist on [Oct 9]".
const DANGLING = new Set("at on for with and from every each starting beginning the".split(" "));
const CONNECTORS = "[\\s,;:&+@/\\-–—]+";
const LEADING_MARKS = new RegExp(`^${CONNECTORS}`, "u");
const TRAILING_MARKS = new RegExp(`${CONNECTORS}$`, "u");
const FIRST_WORD = /^[\p{L}\p{N}'’]+/u;
const LAST_WORD = /[\p{L}\p{N}'’]+$/u;

const tidy = (text: string): string => text.replace(/\s+/g, " ").trim();

/** A piece of the title between found words, without joining words left hanging at its ends. */
function trimPiece(piece: string): string {
  let rest = piece;
  let previous: string;
  do {
    previous = rest;
    rest = rest.replace(TRAILING_MARKS, "");
    const last = LAST_WORD.exec(rest)?.[0];
    if (last && DANGLING.has(last.toLowerCase())) rest = rest.slice(0, -last.length);
  } while (rest !== previous);
  do {
    previous = rest;
    rest = rest.replace(LEADING_MARKS, "");
    const first = FIRST_WORD.exec(rest)?.[0];
    if (first?.toLowerCase() === "and") rest = rest.slice(first.length);
  } while (rest !== previous);
  // A lone "!" or "." left from "Party Sat!" goes too.
  return /[\p{L}\p{N}]/u.test(rest) ? rest : "";
}

function titleOf(text: string, cuts: readonly Span[]): string {
  const pieces: string[] = [];
  let at = 0;
  for (const cut of cuts) {
    pieces.push(text.slice(at, cut.start));
    at = cut.end;
  }
  pieces.push(text.slice(at));
  return tidy(pieces.map(trimPiece).join(" "));
}

function hasTitleWord(text: string): boolean {
  const found = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu) ?? [];
  return found.some((word) => !DANGLING.has(word.toLowerCase()));
}

/** "Mia's recital", "Take Leo to soccer": the name is part of the title too. */
function inTitle(text: string, used: readonly Finding[], index: number): boolean {
  const finding = used[index];
  if (finding?.kind !== "who") return false;
  if (finding.possessive) return true;
  const before = text.slice(used[index - 1]?.end ?? 0, finding.start);
  const after = text.slice(finding.end, used[index + 1]?.start ?? text.length);
  return hasTitleWord(before) && hasTitleWord(after);
}

function draftOf(reading: Reading, ctx: QuickAddContext, today: string): QuickAddDraft {
  const { text } = reading;
  const ordered = [...reading.findings].sort((a, b) => a.start - b.start);
  const first = <K extends UnderstoodKind>(kind: K) =>
    ordered.find((finding): finding is Extract<Finding, { kind: K }> => finding.kind === kind);
  // The first of each kind counts, but "10/9" only when no other day was said ("Grade 3/4 concert
  // Nov 12"). "all day" overrules a time, and a range a length.
  const allDaySaid = first("allDay");
  const days = ordered.filter((finding) => finding.kind === "day");
  const daySaid = days.find((finding) => finding.source !== "slash") ?? days[0];
  const time = allDaySaid ? undefined : first("time");
  const length = allDaySaid || (time && time.to !== null) ? undefined : first("length");
  const repeatSaid = first("repeat");
  const chosen = new Set<Finding | undefined>([allDaySaid, daySaid, time, length, repeatSaid]);
  const used = ordered.filter((finding) => finding.kind === "who" || chosen.has(finding));
  if (!used.length) {
    return {
      title: tidy(text),
      day: null,
      allDay: true,
      start: null,
      end: null,
      durationMinutes: null,
      memberIds: [],
      repeat: null,
      understood: [],
    };
  }

  let day = daySaid?.day ?? null;
  let repeat: Repeat | null = null;
  if (repeatSaid) {
    const { freq, interval, weekdays, monthDay } = repeatSaid.words;
    // "every Tue" starts on the next Tuesday and "monthly on the 1st" on the next 1st, unless
    // the day tapped on the board is already one of them.
    const tapped = ctx.defaultDay >= today ? ctx.defaultDay : null;
    if (!day && weekdays && !(tapped && weekdays.includes(weekdayOf(tapped)))) {
      day = nextOnWeekdays(today, weekdays);
    }
    if (!day && monthDay && Number(tapped?.slice(8)) !== monthDay) {
      day = nextOnDate(today, monthDay);
    }
    if (freq === "weekly") {
      repeat = {
        freq,
        interval,
        weekdays: weekdays ? [...weekdays] : [weekdayOf(day ?? ctx.defaultDay)],
      };
    } else if (freq === "monthly") {
      repeat = { freq, interval, by: "date" };
    } else {
      repeat = { freq, interval };
    }
  }

  let end: string | null = null;
  let durationMinutes = length?.minutes ?? null;
  if (time && time.to !== null) {
    end = clock(time.to);
    durationMinutes = minutesAfter(time.from, time.to);
  } else if (time && length) {
    end = clock((time.from + length.minutes) % DAY_MINUTES);
  }

  const named = new Set(used.flatMap((finding) => (finding.kind === "who" ? finding.ids : [])));
  const cuts = used.filter((_, index) => !inTitle(text, used, index));
  return {
    title: titleOf(text, cuts),
    day,
    allDay: !time,
    start: time ? clock(time.from) : null,
    end,
    durationMinutes,
    memberIds: ctx.members.filter(({ id }) => named.has(id)).map(({ id }) => id),
    repeat,
    understood: used.map((finding) => ({
      kind: finding.kind,
      start: finding.start,
      end: finding.end,
    })),
  };
}

export function parseQuickAdd(text: string, ctx: QuickAddContext): QuickAddDraft {
  const today = zonedParts(ctx.now, ctx.zone).day;
  const reading: Reading = { text, masked: text, findings: [] };
  readAllDay(reading);
  readRepeats(reading);
  readLengths(reading);
  readPeople(reading, ctx.members);
  readDayWords(reading, today);
  readChrono(reading, today, ctx.weekStartsOn);
  settleDays(reading);
  return draftOf(reading, ctx, today);
}
