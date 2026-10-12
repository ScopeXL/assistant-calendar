import type { LucideIcon } from "lucide-react";

import { useShell } from "./shell";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A few short choices side by side, one chosen (Light, Dark, Auto). Each option is a button with
 * aria-pressed; the chosen one fills with ink. 56 px on the display, 44 on phones (UX §1), with
 * room around each word. Each takes its own width and an even share of the rest. When the
 * options can't fit one line (five time words on a phone) the group wraps onto a second row
 * instead of spilling past the edge; its corners are a fixed radius, so two rows still read as
 * one control.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const display = useShell() === "display";
  return (
    <div
      role="group"
      aria-label={label}
      data-segmented=""
      className={`flex flex-wrap gap-1 border-2 border-line bg-surface p-1 ${
        // A cell's own radius plus the padding and the border around it.
        display
          ? "rounded-[calc(var(--tap)/2+6px)] text-d-body"
          : "rounded-[1.75rem] text-secondary"
      }`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value);
          }}
          className={`press select-fill flex flex-auto items-center justify-center rounded-full font-semibold whitespace-nowrap aria-pressed:bg-ink aria-pressed:text-on-ink ${
            display ? "min-h-tap min-w-tap px-5" : "min-h-11 min-w-11 px-4"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface IconSegmentOption<T extends string> extends SegmentOption<T> {
  icon: LucideIcon;
}

/**
 * The same choice as icons, where words won't fit (the board's views in the header, the Week's
 * layout): round cells at the shell's tap size with no border around the group, so it lines up
 * with the icon buttons beside it. Each cell is named by its label. `showChosen` writes the
 * chosen option's word beside its icon, so the current choice is always readable.
 */
export function IconSegmented<T extends string>({
  label,
  options,
  value,
  onChange,
  showChosen = false,
}: {
  label: string;
  options: readonly IconSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  showChosen?: boolean;
}) {
  const display = useShell() === "display";
  return (
    <div role="group" aria-label={label} data-segmented="" className="flex gap-2">
      {options.map(({ value: option, label: name, icon: Icon }) => {
        const chosen = option === value;
        const worded = showChosen && chosen;
        return (
          <button
            key={option}
            type="button"
            aria-label={name}
            aria-pressed={chosen}
            onClick={() => {
              onChange(option);
            }}
            className={`press select-fill flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap aria-pressed:bg-ink aria-pressed:text-on-ink ${
              display ? "h-tap min-w-tap text-d-body" : "h-11 min-w-11 text-secondary"
            } ${worded ? (display ? "px-5" : "px-4") : ""}`}
          >
            <Icon aria-hidden="true" className={display ? "size-8" : "size-6"} />
            {worded ? <span aria-hidden="true">{name}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
