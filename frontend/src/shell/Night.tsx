import { formatClock } from "../lib/dates";
import { useMinute } from "../lib/time";
import { Digits } from "../ui/Digits";

/**
 * Night (UX §4): the dim clock on black, or a black screen when the screen should be off (the Pi
 * helper turns the backlight off in M5). A tap wakes the screen for 2 minutes and does nothing
 * else: this layer takes the touch, and lib/idle drops the click that follows.
 */
export function Night({ mode, onWake }: { mode: "dim_clock" | "screen_off"; onWake: () => void }) {
  const now = useMinute();
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
      className="night-in fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center bg-night text-night-ink"
    >
      {mode === "dim_clock" ? (
        <p className="text-wall-clock font-bold opacity-35">
          <Digits value={formatClock(now)} />
        </p>
      ) : null}
    </div>
  );
}
