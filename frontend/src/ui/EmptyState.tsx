import type { ReactNode } from "react";

import { useShell } from "./shell";

/**
 * Empty places teach: what goes here, and the one button that starts it (UX §8).
 */
export function EmptyState({
  message,
  note,
  action,
}: {
  message: string;
  note?: string;
  action?: ReactNode;
}) {
  const display = useShell() === "display";
  return (
    <section className={display ? "flex flex-col gap-4 py-6" : "flex flex-col gap-3 py-4"}>
      <p className={display ? "text-d-body font-semibold" : "text-row font-semibold"}>{message}</p>
      {note ? (
        <p className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}>
          {note}
        </p>
      ) : null}
      {action ? <div>{action}</div> : null}
    </section>
  );
}
