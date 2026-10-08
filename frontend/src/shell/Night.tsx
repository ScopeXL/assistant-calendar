import { useOccurrences } from "../features/calendar/data";
import { byDay } from "../features/calendar/layout";
import { addDays, formatClock, formatWallTime, zonedParts } from "../lib/dates";
import { useMinute } from "../lib/time";
import { Digits } from "../ui/Digits";

/**
 * Night (UX §4): the dim clock on black with tomorrow's first event under it, or a black screen
 * when the screen should be off (the Pi helper turns the backlight off in M5). A tap wakes the
 * screen for 2 minutes and does nothing else: this layer takes the touch, and lib/idle drops the
 * click that follows.
 */
export function Night({ mode, onWake }: { mode: "dim_clock" | "screen_off"; onWake: () => void }) {
  const now = useMinute();
  const { day, hour } = zonedParts(now);
  // Before dawn, "tomorrow" is today: what the morning starts with.
  const next = hour < 5 ? day : addDays(day, 1);
  const { data } = useOccurrences(next, addDays(next, 1), { enabled: mode === "dim_clock" });
  const column = byDay(data?.occurrences ?? [], [next]).get(next);
  const first = column?.timed[0]?.occurrence ?? column?.allDay[0]?.occurrence;
  const when =
    first && !first.all_day && first.start_local ? formatWallTime(first.start_local) : "All day";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="The screen is sleeping. Tap to wake it."
      onPointerDown={(event) => {
        event.preventDefault();
        onWake();
      }}
      onKeyDown={onWake}
      className="night-in fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-6 bg-night text-night-ink"
    >
      {mode === "dim_clock" ? (
        <>
          <p className="text-wall-clock font-bold opacity-35">
            <Digits value={formatClock(now)} />
          </p>
          {first ? (
            <p className="max-w-[60rem] text-center text-d-glance font-semibold opacity-35">
              {hour < 5 ? "Today" : "Tomorrow"} · {when} {first.title}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
