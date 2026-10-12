import { useCallback, useEffect, useRef, useState } from "react";

export const SAVED_FLASH_MS = 2000;

/**
 * "Saved", for two seconds after a field saves itself (UX §1 "Undo, drafts, confirmations"):
 * `flash()` shows it, and a second save while it shows starts the two seconds again.
 */
export function useSavedFlash(ms = SAVED_FLASH_MS): { saved: boolean; flash: () => void } {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSaved(true);
    timer.current = setTimeout(() => {
      setSaved(false);
      timer.current = null;
    }, ms);
  }, [ms]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return { saved, flash };
}
