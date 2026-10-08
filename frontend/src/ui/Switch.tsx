import { useId } from "react";

import { useShell } from "./shell";

/**
 * An on/off setting: the whole row is the target, with the label and an optional line under it.
 * A real checkbox underneath (role switch), so it works with every screen reader.
 */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string | undefined;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const display = useShell() === "display";
  const hintId = useId();
  return (
    <label
      className={`press-row flex cursor-pointer items-center justify-between gap-4 ${
        display ? "min-h-18 py-3 text-d-body" : "min-h-14 py-2 text-body"
      }`}
    >
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {hint ? (
          <span
            id={hintId}
            className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
          >
            {hint}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className={`switch shrink-0 ${display ? "switch-d" : ""}`}
      />
    </label>
  );
}
