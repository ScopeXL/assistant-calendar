import type { ReactNode } from "react";

import { useChangeCount } from "../lib/motion";

/**
 * A count that pops once when it changes (UX §9 "Count pops"): "2 of 3", "4 to get", a child's
 * stars. Never on first paint, nor when it first arrives. `roll` is for a number that turns over
 * rather than ticks up: a countdown's days roll up into place.
 */
export function Pop({
  value,
  roll = false,
  className = "",
  children,
}: {
  /** What a change in pops; shown as it is unless there are children. */
  value: string | number;
  roll?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const changes = useChangeCount(value);
  return (
    <span key={changes} className={`${changes ? (roll ? "roll" : "pop") : ""} ${className}`}>
      {children ?? value}
    </span>
  );
}
