/**
 * Dates and times as the household reads them (UX §2 "Time and date words"): in the household's
 * time zone and its 12- or 24-hour choice, formatted with Intl (no date library needed in M0).
 *
 * Calendar days are ISO strings ("2026-10-07") and day math happens on UTC midnights, so a
 * week never gains or loses an hour across a daylight-saving change.
 */
let zone: string | undefined;
let hour12 = true;

export interface DatePreferences {
  timezone: string;
  timeFormat: "12h" | "24h";
}

export function setDatePreferences(preferences: DatePreferences): void {
  zone = preferences.timezone;
  hour12 = preferences.timeFormat === "12h";
}

export function householdZone(): string | undefined {
  return zone;
}

export interface ZonedParts {
  day: string; // ISO date in the household zone
  hour: number;
  minute: number;
  weekday: number; // 0 Monday … 6 Sunday, as the household setting counts
}

const partsFormat = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? "";
  let format = partsFormat.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    partsFormat.set(key, format);
  }
  return format;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function zonedParts(moment: Date, timeZone = zone): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(moment)) parts[part.type] = part.value;
  const hour = Number(parts.hour) % 24;
  return {
    day: `${parts.year ?? "1970"}-${parts.month ?? "01"}-${parts.day ?? "01"}`,
    hour,
    minute: Number(parts.minute),
    weekday: Math.max(0, WEEKDAYS.indexOf(parts.weekday ?? "Mon")),
  };
}

function utcMidnight(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1));
}

export function addDays(day: string, days: number): string {
  const moved = utcMidnight(day);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** 0 Monday … 6 Sunday. */
export function weekdayOf(day: string): number {
  return (utcMidnight(day).getUTCDay() + 6) % 7;
}

/** The seven days of the week holding ``day``, starting on the household's chosen weekday. */
export function weekOf(day: string, weekStartsOn: number): string[] {
  const offset = (weekdayOf(day) - weekStartsOn + 7) % 7;
  const start = addDays(day, -offset);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function dayFormat(options: Intl.DateTimeFormatOptions): (day: string) => string {
  const format = new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  return (day) => format.format(utcMidnight(day));
}

/** "Tue" */
export const shortWeekday = dayFormat({ weekday: "short" });
/** "Tuesday" */
export const longWeekday = dayFormat({ weekday: "long" });
/** "7" */
export const dayNumber = (day: string): string => String(Number(day.slice(8, 10)));
/** "Oct 7" */
export const monthDay = dayFormat({ month: "short", day: "numeric" });

/** "October 9", for what a screen reader says (UX §10). */
export const longMonthDay = dayFormat({ month: "long", day: "numeric" });
/** "Tue, Oct 7" */
export const shortDate = dayFormat({ weekday: "short", month: "short", day: "numeric" });
/** "October 2026" */
export const monthYear = dayFormat({ month: "long", year: "numeric" });
/** "Oct" */
export const shortMonth = dayFormat({ month: "short" });

/** "Oct 5–11", or "Sep 28 – Oct 4" across months (UX §3's board title). */
export function weekSpan(days: readonly string[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "";
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${monthDay(first)}–${dayNumber(last)}`;
  }
  return `${monthDay(first)} – ${monthDay(last)}`;
}

/** "4:00 PM" or "16:00" (minutes always shown). */
export function formatTime(moment: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: hour12 ? "h12" : "h23",
  }).format(moment);
}

/** The rail clock: "9:41" (12-hour, no AM/PM) or "21:41". */
export function formatClock(moment: Date): string {
  const { hour, minute } = zonedParts(moment);
  const shown = hour12 ? ((hour + 11) % 12) + 1 : hour;
  return `${hour12 ? String(shown) : String(shown).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "AM" or "PM" beside the 12-hour clock, or nothing. */
export function clockSuffix(moment: Date): string {
  if (!hour12) return "";
  return zonedParts(moment).hour < 12 ? "AM" : "PM";
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** The household's wall time now, as the API writes it ("2026-10-07T09:41:00"). */
export function wallNow(moment: Date): string {
  const { day, hour, minute } = zonedParts(moment);
  return `${day}T${pad(hour)}:${pad(minute)}:00`;
}

/** A wall time from the API ("2026-10-08T14:30:00") as "2:30 PM" or "14:30"; `compact`
 * drops ":00" ("4 PM") for month cells and phone week strips (UX §2). */
export function formatWallTime(local: string, { compact = false } = {}): string {
  const hour = Number(local.slice(11, 13));
  const minute = Number(local.slice(14, 16));
  if (!hour12) return `${pad(hour)}:${pad(minute)}`;
  const shown = ((hour + 11) % 12) + 1;
  const suffix = hour < 12 ? "AM" : "PM";
  return compact && minute === 0
    ? `${String(shown)} ${suffix}`
    : `${String(shown)}:${pad(minute)} ${suffix}`;
}

/** "4:00–5:00 PM", "11:30 AM – 12:30 PM" or "16:00–17:00". */
export function formatWallRange(start: string, end: string): string {
  const from = formatWallTime(start);
  const to = formatWallTime(end);
  if (!hour12) return `${from}–${to}`;
  const fromSuffix = from.slice(-2);
  return fromSuffix === to.slice(-2) ? `${from.slice(0, -3)}–${to}` : `${from} – ${to}`;
}
