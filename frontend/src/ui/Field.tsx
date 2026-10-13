import { useId, type ReactNode } from "react";

import { useShell } from "./shell";

/**
 * The one look for a row's label in every form (ADR 0030): quieter than what's under it, so a
 * label reads as a label and not as one more chip. 20 px in soft ink on the wall, 14 px on a
 * phone. The primitives that write their own label (TextField, DayField, ValueRow) use it too.
 */
export function useFieldLabel(): string {
  return useShell() === "display"
    ? "text-d-secondary font-semibold text-ink-soft"
    : "text-secondary font-semibold text-ink-soft";
}

/** The line under a row that says more about it. */
export function useFieldHint(): string {
  return useShell() === "display" ? "text-d-caption text-ink-soft" : "text-caption text-ink-soft";
}

/**
 * A row of a form: its label, 8 px, its control, and a hint under it. For a control that names
 * itself to a screen reader (a group of chips with its own `aria-label`); a field that needs
 * `<label for>` is a TextField.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | null;
  children: ReactNode;
}) {
  const labelClass = useFieldLabel();
  const hintClass = useFieldHint();
  return (
    <div className="flex flex-col gap-2">
      <p className={labelClass}>{label}</p>
      {children}
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}

/**
 * A part of a form (ADR 0030): What and who, When, Details. Its rows are 16 px apart, and the
 * form puts 32 px between sections, so the eye finds three groups instead of ten rows. `quiet`
 * names the section for a screen reader only: the first one starts with the form's main field,
 * and a heading over it would say the same thing twice.
 */
export function FormSection({
  title,
  quiet = false,
  children,
}: {
  title: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  const display = useShell() === "display";
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h3
        id={id}
        className={quiet ? "sr-only" : display ? "text-d-body font-bold" : "text-row font-bold"}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
