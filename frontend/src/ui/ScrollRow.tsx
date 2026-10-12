import { useEffect, useRef, useState, type ReactNode } from "react";

import { useShell } from "./shell";

type Overflow = "none" | "start" | "end" | "both";

/** Which ends of a scroller have more to show (a pixel of slack for fractional widths). */
export function overflowOf(scrollLeft: number, clientWidth: number, scrollWidth: number): Overflow {
  const start = scrollLeft > 1;
  const end = scrollLeft + clientWidth < scrollWidth - 1;
  return start && end ? "both" : start ? "start" : end ? "end" : "none";
}

/**
 * One line of choices that scrolls sideways when it can't fit (the Who row with a big family,
 * the Add panel's types on a phone, an emoji row): never a second line. A soft fade at an edge
 * says there's more that way (`.fade-x`, tokens.css); the scrollbar is hidden, since the fade and
 * the cut-off cell already say "scroll".
 */
export function ScrollRow({ label, children }: { label: string; children: ReactNode }) {
  const display = useShell() === "display";
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<Overflow>("none");
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      setOverflow(overflowOf(node.scrollLeft, node.clientWidth, node.scrollWidth));
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [children]);
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-overflow={overflow}
      className={`fade-x flex snap-x flex-nowrap overflow-x-auto [scrollbar-width:none] *:shrink-0 *:snap-start ${
        display ? "gap-3" : "gap-2"
      }`}
    >
      {children}
    </div>
  );
}
