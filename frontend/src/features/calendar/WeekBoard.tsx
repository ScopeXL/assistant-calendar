import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";

import {
  formatClock,
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
  const panelIcon = panelShown ? (
    <PanelRightClose aria-hidden="true" className="size-7" />
  ) : (
    <PanelRightOpen aria-hidden="true" className="size-7" />
  );

  return (
    <section aria-label="This week" className="@container flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 pt-5 pb-4">
        <h1 className="text-d-title font-bold">
          {monthYear(middle)} <span className="font-semibold text-ink-soft">{weekSpan(days)}</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon
            aria-label="Previous week"
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
            icon
            aria-label="Next week"
            onClick={() => {
              onWeekOffset(weekOffset + 1);
            }}
          >
            <ChevronRight aria-hidden="true" className="size-8" />
          </Button>
        </div>
        {/* On a narrow board (a laptop) the icon alone keeps the header on one line. */}
        <div className="ml-auto portrait:hidden">
          <span className="hidden @min-[60rem]:block">
            <Button
              variant="quiet"
              aria-pressed={panelShown}
              onClick={onTogglePanel}
              aria-label={panelShown ? "Hide the Today panel" : "Show the Today panel"}
            >
              {panelIcon}
              Today panel
            </Button>
          </span>
          <span className="block @min-[60rem]:hidden">
            <Button
              variant="quiet"
              icon
              aria-pressed={panelShown}
              onClick={onTogglePanel}
              aria-label={panelShown ? "Hide the Today panel" : "Show the Today panel"}
            >
              {panelIcon}
            </Button>
          </span>
        </div>
      </header>
      {/* UX §8. Its own strip, so the grid's lines and the now line never cross the words. */}
      <p className="border-t border-line px-6 py-3 text-d-body text-ink-soft">
        Nothing on this week yet.
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-7 border-t border-line portrait:grid-cols-1 portrait:grid-rows-7">
        {days.map((day) => (
          <DayColumn key={day} day={day} today={day === today} now={now} />
        ))}
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
      className={`day-column flex min-h-0 min-w-0 flex-col border-l border-line first:border-l-0 portrait:flex-row portrait:border-t portrait:border-l-0 portrait:first:border-t-0 ${
        today ? "bg-lit" : ""
      }`}
    >
      <h2
        className={`day-head flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 pt-4 pb-3 text-d-title portrait:w-40 portrait:shrink-0 portrait:flex-col portrait:gap-0 ${
          today ? "font-bold" : "font-semibold text-ink-soft"
        }`}
      >
        <span>{shortWeekday(day)}</span>
        {today ? (
          <span className="inline-flex h-[1.35em] min-w-[1.35em] shrink-0 items-center justify-center rounded-full bg-sun px-[0.15em] text-on-sun">
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

/**
 * "now 9:41" and a 2 px amber line across today's column (UX §4): the label above the line, so
 * the line keeps its length in a narrow column. In portrait, where days are rows, it's a
 * vertical divider (UX §3). With nothing finished yet today it sits at the start of the day;
 * with events (M1) it moves past the last finished one.
 */
function NowLine({ now }: { now: Date }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-1 px-3 py-1 portrait:flex-row-reverse portrait:items-center portrait:justify-end portrait:gap-2 portrait:self-stretch portrait:py-3"
    >
      <span className="now-label font-semibold whitespace-nowrap text-sun-ink">
        now {formatClock(now)}
      </span>
      <span className="now-glow h-0.5 w-full rounded-full bg-sun-ink portrait:h-auto portrait:w-0.5 portrait:self-stretch" />
    </div>
  );
}
