import { useId, type ComponentPropsWithRef } from "react";

import type { KeyboardLayout } from "../lib/keyboard";
import { useFieldHint, useFieldLabel } from "./Field";
import { useShell } from "./shell";

/**
 * A labelled text field; its label is the form's quiet one (ui/Field). On the wall display it opens the on-screen keyboard (data-osk) and
 * keeps the system's own keyboard away (inputMode none); type is at least 24 px there and 16 px
 * on phones, so an iPhone never zooms in (UX §1).
 */
export function TextField({
  label,
  hint,
  error,
  layout = "text",
  hideLabel = false,
  strong = false,
  className,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "id"> & {
  label: string;
  hint?: string | null;
  error?: string | null;
  layout?: KeyboardLayout;
  /** Only for screen readers: the field's placeholder or context says it on screen. */
  hideLabel?: boolean;
  /** A setting that is a row of a Settings page: labelled like the rows beside it, not like a
   * form's field. */
  strong?: boolean;
}) {
  const display = useShell() === "display";
  const labelClass = useFieldLabel();
  const hintClass = useFieldHint();
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const described = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={
          hideLabel
            ? "sr-only"
            : strong
              ? display
                ? "text-d-body font-semibold"
                : "text-body font-semibold"
              : labelClass
        }
      >
        {label}
      </label>
      <input
        id={id}
        aria-describedby={described || undefined}
        aria-invalid={error ? true : undefined}
        autoCorrect="off"
        spellCheck={false}
        {...(display ? { inputMode: "none" as const, "data-osk": layout } : {})}
        className={`min-w-0 rounded-button border-2 border-line bg-surface text-ink aria-invalid:border-alert ${
          display ? "min-h-16 px-5 text-d-body" : "min-h-12 px-4 text-body"
        } ${className ?? ""}`}
        {...props}
      />
      {hint ? (
        <p id={hintId} className={hintClass}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className={
            display
              ? "text-d-secondary font-semibold text-alert"
              : "text-secondary font-semibold text-alert"
          }
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
