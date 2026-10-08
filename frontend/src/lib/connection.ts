/**
 * Is the server reachable? Decided by real request results, never by navigator.onLine alone.
 * The offline pill appears only after 3 s of unreachability (UX §8), and the wall screen says
 * when it last heard from the server.
 */
import { createStore } from "./store";

export type Reachability = "unknown" | "reachable" | "unreachable";

export interface ConnectionState {
  server: Reachability;
  showOffline: boolean;
  lastReachableAt: number | null;
}

export const connection = createStore<ConnectionState>({
  server: "unknown",
  showOffline: false,
  lastReachableAt: null,
});

const OFFLINE_PILL_DELAY_MS = 3000;
let offlineTimer: ReturnType<typeof setTimeout> | undefined;

export function markReachable(): void {
  clearTimeout(offlineTimer);
  offlineTimer = undefined;
  connection.set({ server: "reachable", showOffline: false, lastReachableAt: Date.now() });
}

export function markUnreachable(): void {
  if (connection.get().server === "unreachable") return;
  connection.set((s) => ({ ...s, server: "unreachable" }));
  offlineTimer ??= setTimeout(() => {
    offlineTimer = undefined;
    if (connection.get().server === "unreachable") {
      connection.set((s) => ({ ...s, showOffline: true }));
    }
  }, OFFLINE_PILL_DELAY_MS);
}
