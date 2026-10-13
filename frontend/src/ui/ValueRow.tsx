import { Check, ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useReveal } from "../lib/reveal";
import { useFieldHint, useFieldLabel } from "./Field";
import { useShell } from "./shell";

/**
 * A row of a form that shows what's chosen on its face (ADR 0030): the label at the left, the
 * choice as one button at the right ("2:30 PM", "1 hour", "Every week on Thu"), and its picker
 * opening in place under the row when the button is tapped. It replaces a wall of chips: one
 * line per question, and the answer is always readable. `before` sits beside the button (the
 * Time row's All day chip). The button is named "Time: 2:30 PM".
 */
export function ValueRow({
  label,
  value,
  hint,
  expanded,
  onToggle,
  before,
  children,
}: {
  label: string;
  /** The current choice, in words. */
  value: string;
  hint?: string | null;
  expanded: boolean;
  onToggle: () => void;
  before?: ReactNode;
  /** The picker, drawn under the row while it's open. */
  children: ReactNode;
}) {
  const display = useShell() === "display";
  const labelClass = useFieldLabel();
  const hintClass = useFieldHint();
  const panelId = useId();
  const panel = useReveal<HTMLDivElement>(expanded);
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
          display ? "min-h-tap" : "min-h-11"
        }`}
      >
        <p className={labelClass}>{label}</p>
        <div className={`flex min-w-0 items-center ${display ? "gap-3" : "gap-2"}`}>
          {before}
          <button
            type="button"
            aria-label={`${label}: ${value}`}
            aria-expanded={expanded}
            aria-controls={expanded ? panelId : undefined}
            onClick={onToggle}
            className={`press inline-flex min-w-0 items-center gap-2 border-2 border-line bg-surface text-left font-semibold active:bg-wall ${
              display
                ? "min-h-tap rounded-button-d py-2 pr-4 pl-6 text-d-body"
                : "min-h-11 rounded-button py-1.5 pr-3 pl-4 text-body"
            }`}
          >
            <span className="min-w-0">{value}</span>
            <ChevronDown
              aria-hidden="true"
              className={`turn shrink-0 text-ink-soft ${display ? "size-7" : "size-5"} ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>
      {expanded ? (
        <div
          ref={panel}
          id={panelId}
          className={`flex flex-col rounded-panel border-2 border-line ${
            display ? "gap-4 p-3" : "gap-3 p-2"
          }`}
        >
          {children}
        </div>
      ) : null}
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}

export interface Choice<T> {
  value: T;
  label: string;
}

/**
 * One of several named choices as a list, a row each with a check on the chosen one: inside a
 * ValueRow's picker, where a row of chips would wrap onto three lines (Repeats, How long). A
 * radio group, one line per choice, 56 px on the wall and 44 on a phone.
 */
export function ChoiceList<T extends string | number | null>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: readonly Choice<T>[];
  /** undefined: none of these is chosen (something custom is). */
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  const display = useShell() === "display";
  return (
    <div role="radiogroup" aria-label={label} data-segmented="" className="flex flex-col gap-1">
      {choices.map((choice) => {
        const chosen = choice.value === value;
        return (
          <button
            key={String(choice.value)}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => {
              onChange(choice.value);
            }}
            className={`press-row flex w-full items-center justify-between gap-3 text-left font-semibold aria-checked:bg-wall ${
              display
                ? "min-h-tap rounded-button-d px-4 text-d-body"
                : "min-h-11 rounded-button px-3 text-body"
            }`}
          >
            {choice.label}
            <Check
              aria-hidden="true"
              className={`shrink-0 ${display ? "size-7" : "size-5"} ${chosen ? "" : "invisible"}`}
              strokeWidth={2.5}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * A ValueRow whose picker is just a list: tap the button, tap a choice, and it closes (Calendar,
 * Remind).
 */
export function ChoiceRow<T extends string | number | null>({
  label,
  choices,
  value,
  onChange,
  hint,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  hint?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const chosen = choices.find((choice) => choice.value === value);
  return (
    <ValueRow
      label={label}
      value={chosen?.label ?? ""}
      hint={hint ?? null}
      expanded={open}
      onToggle={() => {
        setOpen(!open);
      }}
    >
      <ChoiceList
        label={label}
        choices={choices}
        value={value}
        onChange={(next) => {
          onChange(next);
          setOpen(false);
        }}
      />
    </ValueRow>
  );
}
