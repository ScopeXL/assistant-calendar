import { dayNumber, monthYear, shortWeekday, weekOf, zonedParts } from "../../lib/dates";
import { useSettings } from "../../lib/household";
import { useMinute } from "../../lib/time";

/** A phone's Calendar (UX §5): this week as a strip of days over the list. Events arrive in M1. */
export function CalendarScreen() {
  const now = useMinute();
  const { data: settings } = useSettings();
  const today = zonedParts(now).day;
  const days = weekOf(today, settings?.week_starts_on ?? 6);
  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-32">
      <h1 className="mb-4 text-title font-bold">{monthYear(days[3] ?? today)}</h1>
      <ol aria-label="This week" className="mb-6 grid grid-cols-7 gap-1">
        {days.map((day) => (
          <li
            key={day}
            aria-current={day === today ? "date" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center rounded-chip text-secondary ${
              day === today ? "bg-surface font-bold" : "text-ink-soft"
            }`}
          >
            <span>{shortWeekday(day).slice(0, 1)}</span>
            <span className={day === today ? "rounded-full bg-sun px-2 text-on-sun" : ""}>
              {dayNumber(day)}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-body text-ink-soft">Nothing on this week yet.</p>
    </main>
  );
}
