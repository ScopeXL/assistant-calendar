import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";

import {
  formatTime,
  monthYear,
  shortWeekday,
  dayNumber,
  weekOf,
  weekSpan,
  addDays,
  zonedParts,
} from "../../lib/dates";
import { useSettings } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";

/**
 * The display's week board (UX §3, §4 "Week board"): seven days, today lit, the amber now line
 * in today's column. Events arrive in M1; until then the board says the week is empty.
 */
export function WeekBoard({
  weekOffset,
  onWeekOffset,
  panelShown,
  onTogglePanel,
}: {
  weekOffset: number;
  onWeekOffset: (offset: number) => void;
  panelShown: boolean;
  onTogglePanel: () => void;
}) {
  const now = useMinute();
  const { data: settings } = useSettings();
  const today = zonedParts(now).day;
  const days = weekOf(addDays(today, weekOffset * 7), settings?.week_starts_on ?? 6);
  const middle = days[3] ?? today;

  return (
    <section aria-label="This week" className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 pt-5 pb-4">
        <h1 className="text-d-title font-bold">
          {monthYear(middle)} <span className="font-semibold text-ink-soft">{weekSpan(days)}</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            aria-label="Previous week"
            className="w-14 px-0"
            onClick={() => {
              onWeekOffset(weekOffset - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" className="size-8" />
          </Button>
          <Button
            variant="secondary"
            disabled={weekOffset === 0}
            onClick={() => {
              onWeekOffset(0);
            }}
          >
            This week
          </Button>
          <Button
            variant="secondary"
            aria-label="Next week"
            className="w-14 px-0"
            onClick={() => {
              onWeekOffset(weekOffset + 1);
            }}
          >
            <ChevronRight aria-hidden="true" className="size-8" />
          </Button>
        </div>
        <div className="ml-auto portrait:hidden">
          <Button
            variant="quiet"
            aria-pressed={panelShown}
            onClick={onTogglePanel}
            aria-label={panelShown ? "Hide the Today panel" : "Show the Today panel"}
          >
            {panelShown ? (
              <PanelRightClose aria-hidden="true" className="size-7" />
            ) : (
              <PanelRightOpen aria-hidden="true" className="size-7" />
            )}
            Today panel
          </Button>
        </div>
      </header>
      <div className="relative grid min-h-0 flex-1 grid-cols-7 border-t border-line portrait:grid-cols-1 portrait:grid-rows-7">
        {days.map((day) => (
          <DayColumn key={day} day={day} today={day === today} now={now} />
        ))}
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-d-body text-ink-soft">
          Nothing on this week yet.
        </p>
      </div>
    </section>
  );
}

function DayColumn({ day, today, now }: { day: string; today: boolean; now: Date }) {
  return (
    <div
      data-day={day}
      data-today={today ? "" : undefined}
      aria-current={today ? "date" : undefined}
      className={`flex min-h-0 flex-col border-l border-line first:border-l-0 portrait:flex-row portrait:border-t portrait:border-l-0 portrait:first:border-t-0 ${
        today ? "bg-surface" : ""
      }`}
    >
      <h2
        className={`flex items-baseline gap-2 px-4 pt-4 pb-3 text-d-title portrait:w-40 portrait:shrink-0 portrait:flex-col portrait:gap-0 ${
          today ? "font-bold" : "font-semibold text-ink-soft"
        }`}
      >
        <span>{shortWeekday(day)}</span>
        {today ? (
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-sun text-on-sun">
            {dayNumber(day)}
          </span>
        ) : (
          <span>{dayNumber(day)}</span>
        )}
        {today ? <span className="sr-only">today</span> : null}
      </h2>
      {today ? <NowLine now={now} /> : null}
    </div>
  );
}

/** "now 9:41" and a 2 px amber line across today's column (UX §4). With nothing finished yet
 * today it sits at the top of the day; with events (M1) it drops under the last finished one. */
function NowLine({ now }: { now: Date }) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-2 px-3 py-1 portrait:flex-1 portrait:self-center"
    >
      <span className="shrink-0 text-d-caption font-semibold text-sun-ink">
        now {formatTime(now)}
      </span>
      <span className="now-glow h-0.5 flex-1 rounded-full bg-sun-ink" />
    </div>
  );
}
