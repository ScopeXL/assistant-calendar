/**
 * What the wall screen is showing right now, beyond the URL: which week, and whether the Today
 * panel is hidden on this screen. The idle machine puts it back after 2 minutes, so the next
 * person who glances sees this week (UX §1 "Idle, wake and reset").
 */
import { createStore } from "./store";

export interface DisplayState {
  weekOffset: number;
  /** null: as the household set it in Settings → Display. */
  panelShown: boolean | null;
}

export const displayState = createStore<DisplayState>({ weekOffset: 0, panelShown: null });

export function resetBoard(): void {
  displayState.set((state) =>
    state.weekOffset === 0 && state.panelShown === null
      ? state
      : { weekOffset: 0, panelShown: null },
  );
}
