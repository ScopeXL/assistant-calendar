import type { ReactNode } from "react";

import { useShell } from "./shell";

/** A pick-one or toggle chip; pressed, it fills with ink (UX §1: 56 px on the display, 44 on
 * phones). */
export function Chip({
  on,
  onClick,
  children,
  disabled = false,
  label,
}: {
  /** Pressed state; leave it out for a chip that just does something. */
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** The accessible name, when the visible text isn't enough. */
  label?: string;
}) {
  const display = useShell() === "display";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`press select-fill inline-flex items-center gap-2 rounded-full border-2 border-line bg-surface font-semibold disabled:opacity-60 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink ${
        display ? "min-h-14 px-6 text-d-body" : "min-h-11 px-4 text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

/** A row of chips with a group name for screen readers. */
export function ChipRow({
  label,
  center = false,
  children,
}: {
  label: string;
  center?: boolean;
  children: ReactNode;
}) {
  const display = useShell() === "display";
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap ${display ? "gap-3" : "gap-2"} ${center ? "justify-center" : ""}`}
    >
      {children}
    </div>
  );
}
