import { useShell } from "./shell";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Two to four choices side by side, one chosen (Light, Dark, Auto). Each option is a button
 * with aria-pressed; the chosen one fills with ink. 56 px on the display, 44 on phones (UX §1).
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
      className={`grid auto-cols-fr grid-flow-col gap-1 rounded-full border-2 border-line bg-surface p-1 ${
        display ? "text-d-body" : "text-secondary"
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
          className={`press select-fill flex items-center justify-center rounded-full px-3 font-semibold aria-pressed:bg-ink aria-pressed:text-on-ink ${
            display ? "min-h-14" : "min-h-11"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
