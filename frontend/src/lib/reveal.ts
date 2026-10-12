import { useEffect, useRef, type RefObject } from "react";

/**
 * A ref for something that opens in place (a month grid, the hours, Custom): when `open` turns
 * true it scrolls into view inside its panel, so a picker opened from a row near the bottom
 * doesn't appear under the pinned button or below the fold. It scrolls only as far as needed and
 * honours the panel's scroll padding (the keyboard, the pinned button); never on first paint.
 */
export function useReveal<T extends HTMLElement>(open: boolean): RefObject<T | null> {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!open) return;
    const node = ref.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [open]);
  return ref;
}
