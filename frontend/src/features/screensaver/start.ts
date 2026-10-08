/** Start screensaver, from the wall's Photos room (or a parent's phone, via a kiosk command). */
import { createStore } from "../../lib/store";

export const saverStarts = createStore(0);

export function startSaver(): void {
  saverStarts.set(saverStarts.get() + 1);
}
