import { useId, type ComponentPropsWithRef } from "react";

import type { KeyboardLayout } from "../lib/keyboard";
import { useShell } from "./shell";

/**
 * A labelled text field. On the wall display it opens the on-screen keyboard (data-osk) and
 * keeps the system's own keyboard away (inputMode none); type is at least 24 px there and 16 px
 * on phones, so an iPhone never zooms in (UX §1).
 */
export function TextField({
  label,
  hint,
  error,
  layout = "text",
  className,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "id"> & {
  label: string;
  hint?: string | null;
  error?: string | null;
  layout?: KeyboardLayout;
}) {
  const display = useShell() === "display";
  const id = useId();
  const hintId = useId();
  const errorId = useId();
  const described = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={display ? "text-d-body font-semibold" : "text-body font-semibold"}
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
        <p
          id={hintId}
          className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
        >
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
