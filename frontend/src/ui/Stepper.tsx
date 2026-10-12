import { Minus, Plus } from "lucide-react";

import { Button } from "./Button";
import { Digits } from "./Digits";
import { useShell } from "./shell";

/**
 * A small whole number changed with two buttons (every 2 weeks, 10 times): no keyboard, and a
 * finger can't type a wrong value. The buttons are named for the row ("Every: less", "Every:
 * more") and stop at the ends.
 */
export function Stepper({
  label,
  value,
  min = 1,
  max = 99,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const display = useShell() === "display";
  const icon = display ? "size-8" : "size-6";
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <Button
        variant="secondary"
        icon
        aria-label={`${label}: less`}
        disabled={value <= min}
        onClick={() => {
          onChange(Math.max(min, value - 1));
        }}
      >
        <Minus aria-hidden="true" className={icon} />
      </Button>
      <output
        aria-live="polite"
        className={`text-center font-bold ${display ? "min-w-14 text-d-title" : "min-w-10 text-title"}`}
      >
        <Digits value={String(value)} />
      </output>
      <Button
        variant="secondary"
        icon
        aria-label={`${label}: more`}
        disabled={value >= max}
        onClick={() => {
          onChange(Math.min(max, value + 1));
        }}
      >
        <Plus aria-hidden="true" className={icon} />
      </Button>
    </div>
  );
}
