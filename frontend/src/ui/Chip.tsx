import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { useShell } from "./shell";

/**
 * A pick-one or toggle chip; pressed, it fills with ink (UX §1: 56 px on the display, 44 on
 * phones). `opener` is a chip that opens something in place instead (Pick a date, More…,
 * Another day): outlined whether it's open or not, with a chevron that turns, and never filled
 * like a choice (ADR 0030: a row once showed four filled chips for one time).
 */
export function Chip({
  on,
  onClick,
  children,
  disabled = false,
  label,
  expanded,
  opener = false,
  block = false,
}: {
  /** Pressed state; leave it out for a chip that just does something. */
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** The accessible name, when the visible text isn't enough. */
  label?: string;
  /** For a chip that opens something in place: whether it's open. */
  expanded?: boolean | undefined;
  /** It opens something in place: say so with a chevron, and never look chosen. */
  opener?: boolean;
  /** Fill its cell, its words centred (a grid of hours). */
  block?: boolean;
}) {
  const display = useShell() === "display";
  return (
    <button
      type="button"
      aria-pressed={opener ? undefined : on}
      aria-expanded={expanded}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`press select-fill items-center gap-2 rounded-full border-2 border-line bg-surface font-semibold whitespace-nowrap disabled:opacity-60 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink ${
        block ? "flex w-full justify-center" : "inline-flex"
      } ${
        display
          ? `min-h-tap text-d-body ${block ? "px-2" : "px-6"}`
          : `min-h-11 text-secondary ${block ? "px-1" : "px-4"}`
      }`}
    >
      {children}
      {opener ? (
        <ChevronDown
          aria-hidden="true"
          className={`turn shrink-0 text-ink-soft ${display ? "size-7" : "size-5"} ${
            expanded ? "rotate-180" : ""
          }`}
        />
      ) : null}
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
