/**
 * What the wall screen is showing right now, beyond the URL: the board's view, which week, day
 * or month, the person filter, whether the Today panel is hidden on this screen, and the event
 * sheet or Add panel that's open. The idle machine puts it back after 2 minutes, so the next
 * person who glances sees this week (UX §1 "Idle, wake and reset").
 */
import { createStore } from "./store";

export type BoardView = "week" | "day" | "month" | "people" | "today";

export type BoardPanel =
  | { kind: "event"; eventId: string; recurrenceId: string | null; key: string }
  /** `type`: what Add makes (an event, or a plugin's "item", "chore"); none: the room's. */
  | { kind: "add"; day: string | null; hour: number | null; type?: string }
  | { kind: "edit"; eventId: string; recurrenceId: string | null }
  | null;

export interface DisplayState {
  /** null: the household's home view (Settings → Display). */
  view: BoardView | null;
  weekOffset: number;
  /** The Day view's day; null is today. */
  day: string | null;
  monthOffset: number;
  /** null: as the household set it in Settings → Display. */
  panelShown: boolean | null;
  /** Show these people's events (and Everyone's); empty shows all. */
  people: string[];
  panel: BoardPanel;
}

const INITIAL: DisplayState = {
  view: null,
  weekOffset: 0,
  day: null,
  monthOffset: 0,
  panelShown: null,
  people: [],
  panel: null,
};

export const displayState = createStore<DisplayState>(INITIAL);

export function updateDisplay(change: Partial<DisplayState>): void {
  displayState.set((state) => ({ ...state, ...change }));
}

/** Add or Change is open: what someone was typing outlasts the 2-minute reset (UX §1). */
export function editorOpen(): boolean {
  const panel = displayState.get().panel;
  return panel?.kind === "add" || panel?.kind === "edit";
}

/**
 * Something on the screen that mustn't be cut short by the room's idle return (a kid running a
 * routine, UX §6). Returns the release.
 */
export const idleHolds = createStore<number>(0);

export function holdIdle(): () => void {
  idleHolds.set((n) => n + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    idleHolds.set((n) => Math.max(0, n - 1));
  };
}

export function resetBoard(): void {
  displayState.set((state) =>
    state.view === null &&
    state.weekOffset === 0 &&
    state.day === null &&
    state.monthOffset === 0 &&
    state.panelShown === null &&
    state.people.length === 0 &&
    state.panel === null
      ? state
      : INITIAL,
  );
}
