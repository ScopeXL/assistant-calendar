import type { ReactNode } from "react";

import { useShell } from "./shell";

/**
 * An editor's primary button, pinned to the bottom of its panel or sheet so it stays in view
 * above the on-screen keyboard however long the form is (UX §1, §4). It goes inside the
 * editor's <form>, so a submit button and the keyboard's ↵ keep working. Sticky at `bottom-0`:
 * a sticky box stops at its scroller's padding, which already holds the keyboard's height. That
 * padding is still scrolled through, so a strip of the bar's own color hangs under it: without
 * it a sliver of the form shows beneath the button.
 */
export function PanelActions({ children }: { children: ReactNode }) {
  const display = useShell() === "display";
  return (
    <div
      className={`sticky bottom-0 z-10 border-t border-line bg-surface after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-surface ${
        display ? "-mx-6 px-6 py-4" : "-mx-4 px-4 py-3"
      }`}
    >
      {children}
    </div>
  );
}
