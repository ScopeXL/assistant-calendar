import { useState } from "react";

/**
 * A day tapped on the board while the Add panel is open sets the editor's day (UX §4): `onDay`
 * runs when `boardDay` changes after the editor opened, not for the day it opened with. Every
 * editor in the panel uses it, so a later tap moves an item's, a meal's or a countdown's day
 * as it moves an event's.
 */
export function useBoardDay(boardDay: string | null, onDay: (day: string) => void): void {
  const [seen, setSeen] = useState(boardDay);
  if (seen !== boardDay) {
    setSeen(boardDay);
    if (boardDay) onDay(boardDay);
  }
}
