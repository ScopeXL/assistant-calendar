import { useState } from "react";

import { useShell } from "./shell";

/**
 * The box you tick on a chore or a list item (UX §1, §7 "Done"): a 64 px box in a 96 px column
 * as tall as its row on the display, 48 px in 72 × 80 on phones. Ticked, it fills with the
 * person's color (`person`, or an ancestor's data-person) and its check draws; the row's stamp
 * and the burst belong to the caller. Its name says what it is and whose ("Feed the dog, Mia,
 * 2 stars, due 5:00 PM"); screen readers add "checkbox, not checked".
 */
export function TickBox({
  checked,
  label,
  onToggle,
  person,
  disabled = false,
  waiting = false,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  person?: string | undefined;
  disabled?: boolean;
  /** Done, waiting for a parent's OK: ticked, but hollow. */
  waiting?: boolean;
}) {
  const display = useShell() === "display";
  // Only a tick made while it's on screen animates; nothing does on first paint (UX §1).
  const [shownChecked] = useState(checked);
  const animate = checked && !shownChecked;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-person={person}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={`press flex shrink-0 items-center justify-center self-stretch ${
        display ? "min-h-[72px] w-24" : "min-h-20 w-[72px]"
      }`}
    >
      <span
        data-checked={animate ? "" : undefined}
        className={`tick-fill flex items-center justify-center border-[3px] ${
          display ? "size-16 rounded-[16px]" : "size-12 rounded-[12px]"
        } ${
          checked && !waiting
            ? "border-p bg-p text-on-ink"
            : checked
              ? "border-p bg-p-tint text-p-text"
              : "border-ink-soft bg-surface"
        }`}
      >
        {checked ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`${animate ? "check-draw" : ""} ${display ? "size-11" : "size-8"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5 9.5 17 19 7.5" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}
