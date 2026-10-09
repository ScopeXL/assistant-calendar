/**
 * How occurrences sit on the board (UX §4 "Week board", "Day view", "Month view"): which days an
 * occurrence covers, the all-day band and the timed list per day, what's past and what's on now,
 * and where the now line goes. Pure: the views stay thin and this is unit-tested.
 *
 * Times are the household's wall time as the API sends it ("2026-10-08T14:30:00"); ISO strings
 * compare correctly as text.
 */
import { addDays } from "../../lib/dates";

/** The fields of the API's occurrence that the board reads. */
export interface Placed {
  key: string;
  title: string;
  all_day: boolean;
  start_local?: string | null;
  end_local?: string | null;
  start_date?: string | null;
  end_date?: string | null; // exclusive
  member_ids: string[];
}

export interface DayEntry<T extends Placed> {
  occurrence: T;
  /** Goes on to the next day ("→" after the title). */
  continues: boolean;
  /** Began on an earlier day. */
  continued: boolean;
}

export interface DayColumn<T extends Placed> {
  day: string;
  allDay: DayEntry<T>[];
  timed: DayEntry<T>[];
}

const dayOf = (local: string): string => local.slice(0, 10);

/** Each day an occurrence covers, in order. A timed end at midnight belongs to the day before. */
export function daysCovered(occurrence: Placed): string[] {
  let first: string;
  let last: string;
  if (occurrence.all_day) {
    if (!occurrence.start_date || !occurrence.end_date) return [];
    first = occurrence.start_date;
    last = addDays(occurrence.end_date, -1);
  } else {
    if (!occurrence.start_local || !occurrence.end_local) return [];
    first = dayOf(occurrence.start_local);
    last = dayOf(occurrence.end_local);
    if (last > first && occurrence.end_local.slice(11) === "00:00:00") last = addDays(last, -1);
  }
  const days: string[] = [];
  for (let day = first; day <= last && days.length < 400; day = addDays(day, 1)) days.push(day);
  return days;
}

function startOf(occurrence: Placed): string {
  return occurrence.all_day
    ? `${occurrence.start_date ?? ""}T00:00:00`
    : (occurrence.start_local ?? "");
}

/** The occurrences of each day in `days`: spans and all-day events in the band at the top,
 * timed ones in start order underneath. */
export function byDay<T extends Placed>(occurrences: readonly T[], days: readonly string[]) {
  const columns = new Map<string, DayColumn<T>>(
    days.map((day) => [day, { day, allDay: [], timed: [] }]),
  );
  for (const occurrence of occurrences) {
    const covered = daysCovered(occurrence);
    const spans = occurrence.all_day || covered.length > 1;
    covered.forEach((day, index) => {
      const column = columns.get(day);
      if (!column) return;
      const entry: DayEntry<T> = {
        occurrence,
        continues: index < covered.length - 1,
        continued: index > 0,
      };
      (spans ? column.allDay : column.timed).push(entry);
    });
  }
  for (const column of columns.values()) {
    column.allDay.sort(
      (a, b) =>
        startOf(a.occurrence).localeCompare(startOf(b.occurrence)) ||
        a.occurrence.title.localeCompare(b.occurrence.title),
    );
    column.timed.sort(
      (a, b) =>
        startOf(a.occurrence).localeCompare(startOf(b.occurrence)) ||
        a.occurrence.title.localeCompare(b.occurrence.title),
    );
  }
  return columns;
}

/** Events that overlap in time, from the first's start to the latest end, in start order. */
export interface Cluster<T extends Placed> {
  start: string;
  end: string;
  items: T[];
}

/** Timed events (in start order) grouped where they overlap: one that starts as another ends
 * begins a new group. The Day view sets each group side by side, the Hours grid in lanes. */
export function clusters<T extends Placed>(timed: readonly T[]): Cluster<T>[] {
  const out: Cluster<T>[] = [];
  for (const occurrence of timed) {
    const start = occurrence.start_local ?? "";
    const end = occurrence.end_local ?? start;
    const last = out.at(-1);
    if (last && start < last.end) {
      last.items.push(occurrence);
      if (end > last.end) last.end = end;
    } else {
      out.push({ start, end, items: [occurrence] });
    }
  }
  return out;
}

/** Over before `now` (a wall time); an all-day event is past from the next day. */
export function isPast(occurrence: Placed, now: string): boolean {
  if (occurrence.all_day) return (occurrence.end_date ?? "") <= dayOf(now);
  return (occurrence.end_local ?? "") <= now;
}

/** On right now (all-day events are never "in progress": they'd fill the whole day). */
export function isOn(occurrence: Placed, now: string): boolean {
  if (occurrence.all_day) return false;
  return (occurrence.start_local ?? "") <= now && now < (occurrence.end_local ?? "");
}

/** Where today's now line goes: after the chips that have finished, in order. */
export function nowSlot(timed: readonly DayEntry<Placed>[], now: string): number {
  let slot = 0;
  while (slot < timed.length) {
    const entry = timed[slot];
    if (!entry || !isPast(entry.occurrence, now)) break;
    slot += 1;
  }
  return slot;
}

/** The occurrences on now, next, and later today, for the Today panel (UX §3). */
export function todayParts<T extends Placed>(occurrences: readonly T[], now: string) {
  const today = dayOf(now);
  const todays = occurrences.filter((o) => daysCovered(o).includes(today));
  const timed = todays.filter((o) => !o.all_day && daysCovered(o).length === 1);
  return {
    allDay: todays.filter((o) => o.all_day || daysCovered(o).length > 1),
    now: timed.filter((o) => isOn(o, now)),
    upNext: timed.find((o) => (o.start_local ?? "") > now) ?? null,
    later: timed.filter((o) => (o.start_local ?? "") > now).slice(1),
  };
}

/** Within `people` (none chosen means everyone shows), or for Everyone. */
export function shownFor(occurrence: Placed, people: ReadonlySet<string>): boolean {
  if (people.size === 0 || occurrence.member_ids.length === 0) return true;
  return occurrence.member_ids.some((id) => people.has(id));
}
