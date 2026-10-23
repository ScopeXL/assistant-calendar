import { useId, type ReactNode } from "react";

/**
 * One of two ways on, as a card beside the other (the screen's Welcome, ADR 0038; the wall's
 * Set Up Sunroom, ADR 0039): its name, a line on what it is, what to know, and its button at
 * the foot, so two cards side by side keep their buttons on one line. The wall's sizes only.
 */
export function Choice({
  heading,
  lead,
  children,
  action,
}: {
  heading: string;
  lead: string;
  children: ReactNode;
  /** None for a way that has nothing to tap here (a QR code for a phone). */
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-panel border border-line bg-surface p-6 text-left"
    >
      <h2 id={id} className="text-d-title font-bold">
        {heading}
      </h2>
      <p className="text-d-body font-semibold">{lead}</p>
      {children}
      {action ? <div className="mt-auto pt-2">{action}</div> : null}
    </section>
  );
}
