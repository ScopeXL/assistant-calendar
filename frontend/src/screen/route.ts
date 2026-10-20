/**
 * The screen's own pages have six addresses and no links between machines, so their router is
 * a store of the path and the history API (no router library to load). The agent opens `/`
 * (nothing chosen yet), `/opening`, `/cant-reach`, `/find` and `/settings`.
 */
import { createStore } from "../lib/store";

export const PATHS = ["/", "/wifi", "/find", "/opening", "/cant-reach", "/settings"] as const;
export type ScreenPath = (typeof PATHS)[number];

function isPath(path: string): path is ScreenPath {
  return (PATHS as readonly string[]).includes(path);
}

function here(): ScreenPath {
  const path = window.location.pathname;
  return isPath(path) ? path : "/";
}

export const route = createStore<ScreenPath>(here());

/** Go to one of the pages: a new entry, or in place of this one. */
export function go(path: ScreenPath, replace = false): void {
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  route.set(path);
}

/** The browser's own back and forward (a mouse's buttons, on a computer). */
export function followHistory(): () => void {
  const follow = () => {
    route.set(here());
  };
  window.addEventListener("popstate", follow);
  return () => {
    window.removeEventListener("popstate", follow);
  };
}

/** Off to Sunroom itself: the agent's address for it, with this screen's parameters. */
export function openSunroom(url: string): void {
  window.location.assign(url);
}
