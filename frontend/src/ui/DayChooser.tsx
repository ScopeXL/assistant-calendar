import { shortDate, shortWeekday } from "../lib/dates";
import { Chip, ChipRow } from "./Chip";
import { useShell } from "./shell";

/**
 * Pick a day (UX §4's Day chips): the likely days as chips, and any date below. `days` are the
 * chips (the next week, or the week on show); the first reads as a date, the rest as "Thu 9".
 */
export function DayChooser({
  value,
  days,
  label = "Day",
  min,
  onChange,
}: {
  value: string;
  days: string[];
  label?: string;
  /** No earlier date can be picked. */
  min?: string;
  onChange: (day: string) => void;
}) {
  const display = useShell() === "display";
  return (
    <div className="flex flex-col gap-3">
      <ChipRow label={label}>
        {days.map((day, n) => (
          <Chip
            key={day}
            on={value === day}
            onClick={() => {
              onChange(day);
            }}
          >
            {n === 0 ? shortDate(day) : `${shortWeekday(day)} ${String(Number(day.slice(8)))}`}
          </Chip>
        ))}
      </ChipRow>
      <label className="flex flex-col gap-2">
        <span
          className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
        >
          Pick a date
        </span>
        <input
          type="date"
          value={value}
          {...(min ? { min } : {})}
          className={`rounded-button border-2 border-line bg-surface ${
            display ? "min-h-16 px-4 text-d-body" : "min-h-12 px-3 text-body"
          }`}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
        />
      </label>
    </div>
  );
}
