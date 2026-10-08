/**
 * The display's idle and wake state machine (UX §1 "Idle, wake and reset").
 *
 * Every touch, click or key press is activity. Listeners ask for "idle for N ms" and get called
 * once when that passes; activity re-arms them. The tap that wakes a sleeping screen presses
 * nothing: the overlay takes the touch, and the click that follows is swallowed.
 */
import { createStore } from "./store";

export const lastActivity = createStore<number>(Date.now());

function onActivity(): void {
  lastActivity.set(Date.now());
}

const EVENTS = ["pointerdown", "keydown", "wheel"] as const;

export function watchActivity(): () => void {
  for (const type of EVENTS) window.addEventListener(type, onActivity, { capture: true });
  return () => {
    for (const type of EVENTS) window.removeEventListener(type, onActivity, { capture: true });
  };
}

/** The click that follows a waking touch lands on whatever the overlay uncovered: drop it. */
export function swallowFollowingClick(): void {
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => {
    window.removeEventListener("click", swallow, { capture: true });
  }, 1000);
}

export function idleFor(): number {
  return Date.now() - lastActivity.get();
}

/**
 * Call `onIdle` once after `ms` without activity, again after the next quiet `ms`. Returns a
 * function that stops watching.
 */
export function whenIdle(ms: number, onIdle: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(onIdle, Math.max(0, ms - idleFor()));
  };
  arm();
  const unsubscribe = lastActivity.subscribe(arm);
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
