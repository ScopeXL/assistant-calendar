import { useEffect, useState } from "react";

import { whenIdle } from "./idle";
import type { ThemeChoice } from "./theme";

const QUIET_MS = 10_000;

type Theme = "light" | "dark";

/**
 * The theme the wall shows (UX §6 "Theme auto switch at sunset"): Auto's switch at sunset or
 * sunrise waits until nobody has touched the screen for 10 seconds, so the colors never change
 * under someone's finger. A parent changing the setting sees it at once, and so does the first
 * paint.
 */
export function useQuietTheme(choice: ThemeChoice | null, wanted: Theme | null): Theme | null {
  const [shown, setShown] = useState<{ choice: ThemeChoice | null; theme: Theme | null }>({
    choice,
    theme: wanted,
  });
  // Changed by hand, or known for the first time: no wait (state from the last render, React's
  // documented pattern for it).
  if (shown.choice !== choice || (shown.theme === null && wanted !== null)) {
    setShown({ choice, theme: wanted });
  }
  useEffect(() => {
    if (wanted === null || shown.theme === null || wanted === shown.theme) return;
    return whenIdle(QUIET_MS, () => {
      setShown({ choice, theme: wanted });
    });
  }, [choice, wanted, shown]);
  return shown.choice !== choice ? wanted : (shown.theme ?? wanted);
}
