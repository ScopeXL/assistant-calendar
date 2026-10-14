import { createContext } from "react";

/**
 * Where an open sheet's toasts float (ui/Sheet, ADR 0032): over the bottom of its body, above
 * its footer, taking no room, so the sheet never moves for one. A sheet whose primary button is
 * pinned in its body (ui/PanelActions) floats them just above that button instead, so they never
 * cover it.
 */
export interface SheetToasts {
  /** False while the sheet slides away: its toasts go back to the page. */
  open: boolean;
  /** A pinned button bar is in the sheet: it holds the toasts until the returned function runs. */
  pin: () => () => void;
}

export const SheetToastsContext = createContext<SheetToasts | null>(null);
