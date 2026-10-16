import type { ReactNode } from "react";

import { useShell } from "../../ui/shell";

/** A group of settings: a surface block with rows, under its title. A page with one group
 * leaves the title off, since the page's own says it. `mark` is drawn after the title and
 * hidden from screen readers (the heart beside Support Sunroom, ADR 0034). */
export function Group({
  title,
  children,
  note,
  mark,
}: {
  title?: string | undefined;
  /** The rows; null for a group that is only its note. */
  children: ReactNode;
  note?: string | undefined;
  mark?: ReactNode;
}) {
  const display = useShell() === "display";
  // On the wall screen the page's own title is the h2 (beside the list of pages); on a phone
  // it's the screen's h1.
  const Heading = display ? "h3" : "h2";
  return (
    <section className={display ? "mb-10" : "mb-8"}>
      {title ? (
        <Heading className={display ? "mb-3 text-d-title font-bold" : "mb-2 text-row font-bold"}>
          {title}
          {mark ? <span aria-hidden="true">{mark}</span> : null}
        </Heading>
      ) : null}
      {note ? (
        <p
          className={
            display ? "mb-4 text-d-secondary text-ink-soft" : "mb-3 text-secondary text-ink-soft"
          }
        >
          {note}
        </p>
      ) : null}
      {/* No rows (Support Sunroom before the owner fills it in): the note alone, no empty card. */}
      {children === null ? null : (
        <div
          className={`divide-y divide-line rounded-chip border border-line bg-surface ${
            display ? "px-6" : "px-4"
          }`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

/** One setting: a label on the left, its control on the right (or below, on narrow phones). */
export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  const display = useShell() === "display";
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${
        display ? "min-h-20 py-4" : "min-h-14 py-3"
      }`}
    >
      <div className="flex min-w-0 flex-col">
        <span className={display ? "text-d-body font-semibold" : "text-body font-semibold"}>
          {label}
        </span>
        {hint ? (
          <span
            className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
          >
            {hint}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Plain text at the size this shell reads at. */
export function Text({ children, soft = false }: { children: ReactNode; soft?: boolean }) {
  const display = useShell() === "display";
  return (
    <p className={`${display ? "text-d-body" : "text-body"} ${soft ? "text-ink-soft" : ""}`}>
      {children}
    </p>
  );
}
