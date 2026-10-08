import { addDays, dayNumber, formatWallTime, shortWeekday, weekOf } from "../../lib/dates";
import type { Member } from "../../lib/household";
import { byDay, shownFor } from "./layout";
import type { Occurrence } from "./types";

export interface MonthGrid {
  first: string; // the month's first day
  days: string[]; // whole weeks covering the month
  weeks: string[][];
}

/** The month `offset` months from today's, as whole weeks starting on the household's day. */
export function monthGrid(today: string, offset: number, weekStartsOn: number): MonthGrid {
  const [year = 1970, month = 1] = today.split("-").map(Number);
  const index = year * 12 + (month - 1) + offset;
  const first = `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, "0")}-01`;
  const start = weekOf(first, weekStartsOn)[0] ?? first;
  const weeks: string[][] = [];
  let day = start;
  do {
    weeks.push(Array.from({ length: 7 }, (_, n) => addDays(day, n)));
    day = addDays(day, 7);
  } while (day.slice(0, 7) === first.slice(0, 7));
  return { first, days: weeks.flat(), weeks };
}

const SHOWN = 3;

/**
 * Month (UX §4): cells with the day number, up to three one-line entries with a color bar and
 * the person's initial, then "+N more". This week is lit a step and today two. A cell is one
 * button that opens its Day view, where every event is a full chip: three tappable entries
 * wouldn't fit a cell at the wall's tap-target size.
 */
export function MonthView({
  grid,
  today,
  occurrences,
  members,
  people,
  onDay,
}: {
  grid: MonthGrid;
  today: string;
  occurrences: Occurrence[];
  members: Member[];
  people: string[];
  onDay: (day: string) => void;
}) {
  const columns = byDay(occurrences, grid.days);
  const filter = new Set(people);
  const month = grid.first.slice(0, 7);
  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-line px-2 pb-2">
      <div className="grid grid-cols-7 border-b border-line" aria-hidden="true">
        {(grid.weeks[0] ?? []).map((day) => (
          <span key={day} className="px-3 py-2 text-d-secondary font-semibold text-ink-soft">
            {shortWeekday(day)}
          </span>
        ))}
      </div>
      {/* The cells read as one control: neighbours touch, like a tab bar's. */}
      <div data-segmented="" className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7">
        {grid.weeks.map((week) => {
          const thisWeek = week.includes(today);
          return week.map((day) => {
            const column = columns.get(day);
            const entries = [...(column?.allDay ?? []), ...(column?.timed ?? [])]
              .map((entry) => entry.occurrence)
              .filter((o) => shownFor(o, filter));
            const isToday = day === today;
            const inMonth = day.slice(0, 7) === month;
            const titles = entries.map((o) => o.title).join(", ");
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  onDay(day);
                }}
                aria-label={`${shortWeekday(day)} ${dayNumber(day)}${isToday ? ", today" : ""}${
                  entries.length ? `: ${titles}` : ""
                }`}
                className={`press-row flex min-h-0 min-w-0 flex-col items-stretch gap-1 overflow-hidden border-r border-b border-line p-1.5 text-left ${
                  isToday ? "bg-lit" : thisWeek ? "bg-surface/50" : ""
                }`}
              >
                <span className={`px-1 text-d-title font-bold ${inMonth ? "" : "text-ink-soft"}`}>
                  <span
                    className={
                      isToday
                        ? "inline-flex size-[1.5em] items-center justify-center rounded-full bg-sun text-on-sun"
                        : ""
                    }
                  >
                    {dayNumber(day)}
                  </span>
                </span>
                {entries.slice(0, SHOWN).map((occurrence) => (
                  <MonthEntry key={occurrence.key} occurrence={occurrence} members={members} />
                ))}
                {entries.length > SHOWN ? (
                  <span className="px-1 text-d-caption font-semibold text-ink-soft">
                    {`+${String(entries.length - SHOWN)} more`}
                  </span>
                ) : null}
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}

function MonthEntry({ occurrence, members }: { occurrence: Occurrence; members: Member[] }) {
  const people = members.filter((m) => occurrence.member_ids.includes(m.id));
  const color = occurrence.color ?? (people.length === 1 ? people[0]?.color : null) ?? "everyone";
  const time =
    !occurrence.all_day && occurrence.start_local
      ? formatWallTime(occurrence.start_local, { compact: true })
      : null;
  const initial = people.length === 1 ? (people[0]?.name.charAt(0) ?? "") : "";
  return (
    <span
      aria-hidden="true"
      data-person={color}
      className="flex min-w-0 items-center gap-1.5 rounded-sm border-l-4 border-p bg-p-tint px-1.5 text-d-caption"
    >
      {initial ? <span className="font-bold text-p-text">{initial}</span> : null}
      {time ? <span className="font-semibold whitespace-nowrap">{time}</span> : null}
      <span className="min-w-0 truncate">{occurrence.title}</span>
    </span>
  );
}
