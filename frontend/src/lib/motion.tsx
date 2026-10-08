/**
 * Motion helpers (UX §9, ADR 0007).
 *
 * * MotionProvider puts every `motion` component under <MotionConfig> with the page's CSP nonce
 *   (the server stamps it into <meta name="csp-nonce">), so the library's own <style> blocks are
 *   allowed and nothing else's are. Reduce Motion follows the device, or the household's Display
 *   setting on the wall screen.
 * * View transitions (AnimateView, animateView) add styles without the nonce: never use them
 *   (styles/designRules.test.ts).
 */
import { MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";

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
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"} {...(nonce ? { nonce } : {})}>
      {children}
    </MotionConfig>
  );
}

/** Spring and timing values for `motion`, matching styles/motion.css (UX §9). */
export const SETTLE = { type: "spring", stiffness: 400, damping: 30 } as const;
export const ENTER = { duration: 0.22, ease: [0.05, 0.7, 0.1, 1] } as const;
export const EXIT = { duration: 0.18, ease: [0.3, 0, 0.8, 0.15] } as const;
export const GLIDE = { duration: 0.4, ease: [0.2, 0, 0, 1] } as const;

/**
 * How many times `value` has changed since the first render. As a key it re-plays a "changed"
 * animation (a count that pops); 0 means it hasn't changed yet, so nothing plays on first paint.
 * Arriving from nothing (null or undefined, still loading) isn't a change either.
 */
export function useChangeCount(value: unknown): number {
  const [seen, setSeen] = useState({ value, count: 0 });
  if (!Object.is(seen.value, value)) {
    const arriving = seen.value === null || seen.value === undefined;
    const next = { value, count: arriving ? seen.count : seen.count + 1 };
    setSeen(next);
    return next.count;
  }
  return seen.count;
}
