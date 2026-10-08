/**
 * Repeats as the editor offers them (UX §4 "Repeats", PLAN §7): a few shapes that compile to an
 * RFC 5545 RRULE and back, the presets for a start day, and the sentence that names a repeat.
 * Any other rule is "Custom", and the editor shows the server's description of it.
 *
 * Days are ISO dates; weekdays count 0 Monday … 6 Sunday, like the household's week_starts_on.
 * Monthly-by-date and yearly rules name no day of their own (they follow the start day), so the
 * server can still move them to another day.
 */
import { monthDay, weekdayOf, zonedParts } from "../../lib/dates";

export type Repeat =
  | { freq: "daily"; interval: number }
  | { freq: "weekly"; interval: number; weekdays: number[] } // 0 Monday … 6 Sunday, sorted, at least one
  | { freq: "monthly"; interval: number; by: "date" } // on the start day's date
  | { freq: "monthly"; interval: number; by: "weekday" } // on the start day's nth (or last) weekday
  | { freq: "yearly"; interval: number };

export interface RepeatEnd {
  until?: string; // ISO date (inclusive)
  count?: number; // 1–1000
}

export interface RepeatPreset {
  key: string;
  label: string;
  repeat: Repeat | null; // null = "Doesn't repeat"
}

const CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const NTH = ["first", "second", "third", "fourth"];
const WORKWEEK = [0, 1, 2, 3, 4];
const MAX_COUNT = 1000;

const pick = (list: readonly string[], index: number): string => list[index] ?? "";

function parts(day: string): { year: number; month: number; date: number } {
  return {
    year: Number(day.slice(0, 4)),
    month: Number(day.slice(5, 7)),
    date: Number(day.slice(8, 10)),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Which of its weekday the day is in its month: 1–4, or -1 when it's the month's last one. */
function weekdayPosition(day: string): number {
  const { year, month, date } = parts(day);
  return date + 7 > daysInMonth(year, month) ? -1 : Math.ceil(date / 7);
}

function cleanInterval(interval: number): number {
  return Number.isFinite(interval) ? Math.max(1, Math.trunc(interval)) : 1;
}

function sortedWeekdays(weekdays: readonly number[]): number[] {
  return [...new Set(weekdays)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day < 7)
    .sort((a, b) => a - b);
}

/** Sorted, without repeats; the start day's weekday when none are left. */
function cleanWeekdays(weekdays: readonly number[], startDay: string): number[] {
  const kept = sortedWeekdays(weekdays);
  return kept.length ? kept : [weekdayOf(startDay)];
}

/** "Mon", "Mon and Wed", "Mon, Wed and Fri". */
function listed(words: readonly string[]): string {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${pick(words, words.length - 1)}`;
}

/** "1st", "2nd", "9th", "12th", "22nd". */
function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${String(n)}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
}

export function repeatToRRule(repeat: Repeat, startDay: string, end?: RepeatEnd): string {
  const rule = [`FREQ=${repeat.freq.toUpperCase()}`];
  const interval = cleanInterval(repeat.interval);
  if (interval > 1) rule.push(`INTERVAL=${interval}`);
  if (repeat.freq === "weekly") {
    const days = cleanWeekdays(repeat.weekdays, startDay);
    rule.push(`BYDAY=${days.map((day) => pick(CODES, day)).join(",")}`);
  } else if (repeat.freq === "monthly" && repeat.by === "weekday") {
    rule.push(`BYDAY=${weekdayPosition(startDay)}${pick(CODES, weekdayOf(startDay))}`);
  }
  // A rule may not have both; the date wins.
  if (end?.until) {
    rule.push(`UNTIL=${end.until.replaceAll("-", "")}`);
  } else if (end?.count !== undefined) {
    const count = Math.min(MAX_COUNT, Math.max(1, Math.trunc(end.count)));
    rule.push(`COUNT=${count}`);
  }
  return rule.join(";");
}

function validDay(year: number, month: number, date: number): boolean {
  return month >= 1 && month <= 12 && date >= 1 && date <= daysInMonth(year, month);
}

/**
 * UNTIL as a household day: a DATE as written, a UTC time on the household's clock (the zone
 * `setDatePreferences` was given), so "11:59 PM in New York" stays Dec 31.
 */
function untilDay(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(value);
  if (!match) return null;
  const [year, month, date, hour, minute, second] = match.slice(1, 7).map(Number);
  if (year === undefined || month === undefined || date === undefined) return null;
  if (!validDay(year, month, date)) return null;
  if (match[7] === "Z") {
    const moment = new Date(Date.UTC(year, month - 1, date, hour ?? 0, minute ?? 0, second ?? 0));
    return zonedParts(moment).day;
  }
  return `${match[1] ?? ""}-${match[2] ?? ""}-${match[3] ?? ""}`;
}

function whole(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || !/^[+-]?\d{1,4}$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

/** Plain weekday codes ("MO,WE") as weekdays, or null when one carries a position ("2TH"). */
function codesToWeekdays(value: string): number[] | null {
  const days = value.split(",").map((code) => CODES.indexOf(code));
  return days.length && days.every((day) => day >= 0) ? days : null;
}

export function rruleToRepeat(
  rrule: string,
  startDay: string,
): { repeat: Repeat; end: RepeatEnd } | null {
  const fields = new Map<string, string>();
  for (const piece of rrule
    .trim()
    .replace(/^RRULE:/i, "")
    .split(";")) {
    if (!piece.trim()) continue;
    const [key, value, extra] = piece.split("=").map((text) => text.trim().toUpperCase());
    if (!key || value === undefined || extra !== undefined || fields.has(key)) return null;
    fields.set(key, value);
  }
  const take = (key: string): string | undefined => {
    const value = fields.get(key);
    fields.delete(key);
    return value;
  };

  const freq = take("FREQ");
  const intervalText = take("INTERVAL");
  const interval = intervalText === undefined ? 1 : whole(intervalText, 1, 9999);
  const countText = take("COUNT");
  const untilText = take("UNTIL");
  const wkst = take("WKST");
  const byDay = take("BYDAY");
  const byMonthDay = take("BYMONTHDAY");
  const byMonth = take("BYMONTH");
  const bySetPos = take("BYSETPOS");
  if (interval === null || fields.size > 0) return null;
  if (countText !== undefined && untilText !== undefined) return null;

  const end: RepeatEnd = {};
  if (countText !== undefined) {
    const count = whole(countText, 1, MAX_COUNT);
    if (count === null) return null;
    end.count = count;
  }
  if (untilText !== undefined) {
    const until = untilDay(untilText);
    if (until === null) return null;
    end.until = until;
  }

  const start = parts(startDay);
  const weekday = weekdayOf(startDay);
  const onDates = byMonthDay !== undefined || byMonth !== undefined || bySetPos !== undefined;
  let repeat: Repeat | null = null;
  if (freq === "DAILY" && !onDates) {
    // Every day on some weekdays is every week on them.
    const weekdays = byDay === undefined ? null : codesToWeekdays(byDay);
    if (byDay === undefined) repeat = { freq: "daily", interval };
    else if (weekdays && interval === 1) repeat = { freq: "weekly", interval, weekdays };
  } else if (freq === "WEEKLY" && !onDates) {
    const weekdays = byDay === undefined ? [weekday] : codesToWeekdays(byDay);
    // The day a week starts on only matters every few weeks on more than one day.
    const weekStartMatters = interval > 1 && (weekdays?.length ?? 0) > 1;
    if (weekdays && !(weekStartMatters && wkst !== undefined && wkst !== "MO")) {
      repeat = { freq: "weekly", interval, weekdays };
    }
  } else if (freq === "MONTHLY" && byMonth === undefined) {
    if (byDay === undefined && bySetPos === undefined) {
      const date = byMonthDay === undefined ? start.date : whole(byMonthDay, 1, 31);
      if (date === start.date) repeat = { freq: "monthly", interval, by: "date" };
    } else if (byDay !== undefined && byMonthDay === undefined) {
      // "2TH", or "TH" with BYSETPOS=2: the start day's place among its weekdays in the month.
      const match = /^([+-]?\d{1,2})?([A-Z]{2})$/.exec(byDay);
      const position = whole(match?.[1] ?? bySetPos, -5, 5);
      const once = match?.[1] === undefined || bySetPos === undefined;
      if (match?.[2] === pick(CODES, weekday) && once && position === weekdayPosition(startDay)) {
        repeat = { freq: "monthly", interval, by: "weekday" };
      }
    }
  } else if (freq === "YEARLY" && byDay === undefined && bySetPos === undefined) {
    const month = byMonth === undefined ? start.month : whole(byMonth, 1, 12);
    const date = byMonthDay === undefined ? start.date : whole(byMonthDay, 1, 31);
    if (month === start.month && date === start.date) repeat = { freq: "yearly", interval };
  }
  if (repeat?.freq === "weekly") repeat.weekdays = cleanWeekdays(repeat.weekdays, startDay);
  return repeat ? { repeat, end } : null;
}

/** Whether two repeats are the same rule (weekdays compared as sets). */
export function sameRepeat(a: Repeat | null, b: Repeat | null): boolean {
  if (!a || !b) return a === b;
  if (a.freq !== b.freq || cleanInterval(a.interval) !== cleanInterval(b.interval)) return false;
  if (a.freq === "weekly" && b.freq === "weekly") {
    return sortedWeekdays(a.weekdays).join() === sortedWeekdays(b.weekdays).join();
  }
  if (a.freq === "monthly" && b.freq === "monthly") return a.by === b.by;
  return true;
}

/** "until Dec 31", or "until Jan 15, 2027" in another year than the start day's. */
function untilWords(until: string, startDay: string): string {
  const sameYear = until.slice(0, 4) === startDay.slice(0, 4);
  return `until ${monthDay(until)}${sameYear ? "" : `, ${until.slice(0, 4)}`}`;
}

export function describeRepeat(repeat: Repeat, startDay: string, end?: RepeatEnd): string {
  const interval = cleanInterval(repeat.interval);
  const every = (unit: string): string =>
    interval === 1 ? `Every ${unit}` : `Every ${String(interval)} ${unit}s`;
  let text: string;
  switch (repeat.freq) {
    case "daily":
      text = every("day");
      break;
    case "weekly": {
      const days = cleanWeekdays(repeat.weekdays, startDay);
      text =
        interval === 1 && days.join() === WORKWEEK.join()
          ? "Every weekday"
          : `${every("week")} on ${listed(days.map((day) => pick(SHORT_DAYS, day)))}`;
      break;
    }
    case "monthly":
      if (repeat.by === "date") {
        text = `${every("month")} on the ${ordinal(parts(startDay).date)}`;
      } else {
        const position = weekdayPosition(startDay);
        const nth = position === -1 ? "last" : pick(NTH, position - 1);
        text = `${every("month")} on the ${nth} ${pick(LONG_DAYS, weekdayOf(startDay))}`;
      }
      break;
    case "yearly":
      text = `${every("year")} on ${monthDay(startDay)}`;
      break;
  }
  if (end?.until) return `${text}, ${untilWords(end.until, startDay)}`;
  if (end?.count !== undefined) {
    const count = Math.min(MAX_COUNT, Math.max(1, Math.trunc(end.count)));
    return `${text}, ${count === 1 ? "once" : `${String(count)} times`}`;
  }
  return text;
}

export function repeatPresets(startDay: string): RepeatPreset[] {
  const weekday = weekdayOf(startDay);
  const repeats: [string, Repeat][] = [
    ["daily", { freq: "daily", interval: 1 }],
    ["weekdays", { freq: "weekly", interval: 1, weekdays: [...WORKWEEK] }],
    ["weekly", { freq: "weekly", interval: 1, weekdays: [weekday] }],
    ["biweekly", { freq: "weekly", interval: 2, weekdays: [weekday] }],
    ["monthly-date", { freq: "monthly", interval: 1, by: "date" }],
    ["monthly-weekday", { freq: "monthly", interval: 1, by: "weekday" }],
    ["yearly", { freq: "yearly", interval: 1 }],
  ];
  return [
    { key: "none", label: "Doesn't repeat", repeat: null },
    ...repeats.map(([key, repeat]) => ({ key, label: describeRepeat(repeat, startDay), repeat })),
  ];
}
