/**
 * Motion helpers (UX §9, ADR 0007).
 *
 * * MotionProvider puts every `motion` component under <MotionConfig> with the page's CSP nonce
 *   (the server stamps it into <meta name="csp-nonce">), so the library's own <style> blocks are
 *   allowed and nothing else's are. Reduce Motion follows the device, or the household's Display
 *   setting on the wall screen.
 * * View transitions (AnimateView, animateView) add styles without the nonce: never use them
 *   (styles/designRules.test.ts).
 * * `motion` itself keeps fading under Reduce Motion (it only drops transforms), so a component
 *   whose leaving should be instant asks useMotionReduced() and leaves `exit` out.
 */
import { MotionConfig } from "motion/react";
import { createContext, useContext, useState, type ReactNode } from "react";

import { useMediaQuery } from "./useMediaQuery";

export function cspNonce(): string | undefined {
  const value = document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content");
  return value && !value.startsWith("__") ? value : undefined;
}

export function MotionProvider({
  reduceMotion,
  children,
}: {
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const [nonce] = useState(cspNonce);
  const device = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"} {...(nonce ? { nonce } : {})}>
      <Reduced value={reduceMotion || device}>{children}</Reduced>
    </MotionConfig>
  );
}

const Reduced = createContext(false);

/** Reduce Motion is on: the device's setting, or the household's on the wall screen. */
export function useMotionReduced(): boolean {
  return useContext(Reduced);
}

/** Spring and timing values for `motion`, matching styles/motion.css (UX §9). */
export const SETTLE = { type: "spring", stiffness: 400, damping: 30 } as const;
export const ENTER = { duration: 0.22, ease: [0.05, 0.7, 0.1, 1] } as const;
export const EXIT = { duration: 0.18, ease: [0.3, 0, 0.8, 0.15] } as const;
export const GLIDE = { duration: 0.4, ease: [0.2, 0, 0, 1] } as const;
/** Something leaving the board (UX §9 "Chips leave"): it fades and shrinks a little. */
export const LEAVE = { opacity: 0, scale: 0.96, transition: EXIT } as const;

/**
 * Paging (UX §9 "Paging slides"): the week, day or month that an arrow, a Home button or a swipe
 * brings slides in a little from the side it comes from. Spread `attrs` on the board's body, call
 * `turn(step)` when someone pages (negative for earlier), and `rest()` on a view switch. Only
 * what someone did turns the page: the idle reset going back to this week doesn't.
 */
export function usePageTurn(): {
  attrs: { "data-page"?: "prev" | "next"; "data-turn"?: 0 | 1 };
  turn: (step: number) => void;
  rest: () => void;
} {
  const [turned, setTurned] = useState<{ page: "prev" | "next"; turn: 0 | 1 } | null>(null);
  return {
    attrs: turned ? { "data-page": turned.page, "data-turn": turned.turn } : {},
    turn: (step) => {
      if (step === 0) return;
      // The same way twice has to play twice: `turn` flips, and each value has its own keyframes.
      setTurned((was) => ({ page: step < 0 ? "prev" : "next", turn: was?.turn === 0 ? 1 : 0 }));
    },
    rest: () => {
      setTurned(null);
    },
  };
}

/**
 * How many times `value` has changed since the first render. As a key it re-plays a "changed"
 * animation (a count that pops); 0 means it hasn't changed yet, so nothing plays on first paint.
 * Arriving from nothing (null or undefined, still loading) isn't a change either, and nor is
 * a value that differs because its `scope` did (another day's now line isn't this day's moved).
 */
export function useChangeCount(value: unknown, scope: unknown = null): number {
  const [seen, setSeen] = useState({ value, scope, count: 0 });
  if (!Object.is(seen.value, value) || !Object.is(seen.scope, scope)) {
    const arriving = seen.value === null || seen.value === undefined;
    const counts = !arriving && Object.is(seen.scope, scope);
    const next = { value, scope, count: counts ? seen.count + 1 : seen.count };
    setSeen(next);
    return next.count;
  }
  return seen.count;
}
