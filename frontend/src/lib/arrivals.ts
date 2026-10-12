/**
 * Which things just joined what's on screen (UX §9 "Chips arrive"): an event added or moved
 * while the board was showing eases in, so the eye finds it. Nothing arrives on first paint, on
 * paging or on a view switch: those change the `scope`, and a new scope only sets what's there.
 */
import { createContext, useContext, useEffect, useState } from "react";

const NONE: ReadonlySet<string> = new Set<string>();

/** How long a newcomer stays marked: well past its 220 ms, so drawing it again later (the other
 * Week layout, a filter) doesn't play it twice. */
export const ARRIVAL_MS = 1000;

/** The keys in `next` that weren't in `previous`. */
export function arrivals(
  previous: readonly string[],
  next: readonly string[],
): ReadonlySet<string> {
  const before = new Set(previous);
  const fresh = next.filter((key) => !before.has(key));
  return fresh.length ? new Set(fresh) : NONE;
}

interface Seen {
  scope: string | null;
  signature: string;
  keys: readonly string[];
  arrived: ReadonlySet<string>;
}

const NOTHING: Seen = { scope: null, signature: "", keys: [], arrived: NONE };

/**
 * The keys that appeared since the last look at the same `scope` (a week, a day, a view).
 * `scope` is null while what's shown isn't the scope's own yet (loading, or the last week's
 * events still up while the next ones load): nothing arrives then, and the first real look at a
 * scope is only the baseline.
 */
export function useArrivals(keys: readonly string[], scope: string | null): ReadonlySet<string> {
  const signature = keys.join("\n");
  const [seen, setSeen] = useState<Seen>(NOTHING);
  let current = seen;
  if (scope === null) {
    if (seen.scope !== null) current = NOTHING;
  } else if (seen.scope !== scope) {
    current = { scope, signature, keys, arrived: NONE };
  } else if (seen.signature !== signature) {
    current = { scope, signature, keys, arrived: arrivals(seen.keys, keys) };
  }
  if (current !== seen) setSeen(current);
  const marked = current.arrived;
  useEffect(() => {
    if (marked.size === 0) return;
    const timer = setTimeout(() => {
      setSeen((now) => (now.arrived === marked ? { ...now, arrived: NONE } : now));
    }, ARRIVAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [marked]);
  return marked;
}

const ArrivalsContext = createContext<ReadonlySet<string>>(NONE);

/** What a board says just arrived, for the chips under it. */
export const Arrivals = ArrivalsContext.Provider;

export function useArrived(key: string): boolean {
  return useContext(ArrivalsContext).has(key);
}
