import { createLink } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

import { useShell } from "./shell";

interface RowParts {
  /** What a tap does, for screen readers: "Edit Mia". */
  label: string;
  /** An avatar, a color dot or an icon at the left. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** A quiet word at the right, before the chevron: "On", "3 calendars". */
  value?: ReactNode;
}

function rowClass(display: boolean): string {
  return `press-row flex w-full items-center gap-4 text-left ${
    display ? "min-h-tap-primary py-2" : "min-h-14 py-2"
  }`;
}

function RowBody({
  leading,
  title,
  subtitle,
  value,
  subtitleId,
}: Omit<RowParts, "label"> & { subtitleId: string }) {
  const display = useShell() === "display";
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  return (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`truncate font-semibold ${display ? "text-d-body" : "text-row"}`}>
          {title}
        </span>
        {subtitle ? (
          <span id={subtitleId} className={soft}>
            {subtitle}
          </span>
        ) : null}
      </span>
      {value ? <span className={`shrink-0 ${soft}`}>{value}</span> : null}
      <ChevronRight
        aria-hidden="true"
        className={`shrink-0 text-ink-soft ${display ? "size-8" : "size-5"}`}
      />
    </>
  );
}

/**
 * A row you tap to open what it names (UX §4 Settings): the whole row is the button, 64 px on
 * the wall and 56 on phones, with a chevron at its right. Its name says what the tap does ("Edit
 * Mia"); the line under the title is read after it.
 */
export function ListRow({
  label,
  leading,
  title,
  subtitle,
  value,
  ...props
}: RowParts & Omit<ComponentPropsWithRef<"button">, "title" | "children" | "className">) {
  const display = useShell() === "display";
  const subtitleId = useId();
  return (
    <button
      type="button"
      aria-label={label}
      aria-describedby={subtitle ? subtitleId : undefined}
      className={rowClass(display)}
      {...props}
    >
      <RowBody
        leading={leading}
        title={title}
        subtitle={subtitle}
        value={value}
        subtitleId={subtitleId}
      />
    </button>
  );
}

function RowAnchor({
  label,
  leading,
  title,
  subtitle,
  value,
  ...props
}: RowParts & Omit<ComponentPropsWithRef<"a">, "title" | "children" | "className">) {
  const display = useShell() === "display";
  const subtitleId = useId();
  return (
    <a
      aria-label={label}
      aria-describedby={subtitle ? subtitleId : undefined}
      className={rowClass(display)}
      {...props}
    >
      <RowBody
        leading={leading}
        title={title}
        subtitle={subtitle}
        value={value}
        subtitleId={subtitleId}
      />
    </a>
  );
}

/** The same row as a link to another page (`to`, `params`, as the router's own Link). */
export const ListRowLink = createLink(RowAnchor);
