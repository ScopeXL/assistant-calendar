import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";

import { ENTER, EXIT } from "../lib/motion";
import { useStore } from "../lib/store";
import { dismissToast, isShowing, toastAnchors, toasts, type Toast } from "../lib/toast";

/**
 * Toasts with Undo. On phones they sit in the thumb zone above the tab bar (or a sheet's
 * bottom); on the wall screen, at the bottom centre of the board, 72 px tall with a 64 px Undo.
 * They rise in and ease out with `motion`; the others close the gap (UX §9). AnimatePresence's
 * popLayout adds a <style> as a toast leaves, under the page's CSP nonce (ADR 0007).
 */
// Where the wall's toasts sit: over the board, between the rail and the Today panel, whichever
// side the rail is on and whether or not the panel shows. Static strings, so Tailwind sees them.
const BOARD = {
  left: {
    shown: "left-[var(--rail-w)] right-[var(--panel-w)]",
    hidden: "left-[var(--rail-w)] right-0",
  },
  right: {
    shown: "left-[var(--panel-w)] right-[var(--rail-w)]",
    hidden: "left-0 right-[var(--rail-w)]",
  },
} as const;

export function ToastRegion({
  display = false,
  railSide = "left",
  panelShown = true,
}: {
  display?: boolean;
  /** The wall: which side its rail is on, and whether its Today panel shows. */
  railSide?: "left" | "right";
  panelShown?: boolean;
}) {
  const list = useStore(toasts);
  const anchors = useStore(toastAnchors);
  // A toast stays where it was raised while that place is on screen (ADR 0032): one raised on
  // the page stays on the page when a sheet opens over it (under its backdrop, on its way out),
  // and one raised in a sheet falls back to the page once the sheet goes.
  const placed = (toast: Toast) =>
    anchors.some((anchor) => anchor.node === toast.anchor) ? toast.anchor : null;
  const items = (where: HTMLElement | null) => (
    <AnimatePresence mode="popLayout" initial={false}>
      {list
        .filter((toast) => placed(toast) === where)
        .map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: ENTER }}
            exit={{ opacity: 0, y: 8, transition: EXIT }}
            data-toast=""
            className={`pointer-events-auto flex w-full items-center justify-between gap-3 bg-ink text-on-ink [--focus-ring:var(--wall)] ${
              display
                ? "min-h-18 max-w-3xl rounded-button-d py-1 pr-1 pl-6 text-d-body"
                : "max-w-md rounded-button py-2 pr-2 pl-4 text-secondary"
            }`}
          >
            <span className="font-semibold">{toast.message}</span>
            {toast.actionLabel ? (
              <button
                type="button"
                className={`press shrink-0 bg-wall font-bold text-ink ${
                  display
                    ? "min-h-16 min-w-32 rounded-button-d px-6 text-d-body"
                    : "min-h-11 rounded-button px-4"
                }`}
                onClick={() => {
                  // A toast on its way out can't act a second time.
                  if (!isShowing(toast.id)) return;
                  dismissToast(toast.id);
                  toast.onAction?.();
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
          </motion.div>
        ))}
    </AnimatePresence>
  );
  return (
    <>
      {anchors.map((anchor) => createPortal(items(anchor.node), anchor.node, String(anchor.key)))}
      <div
        role="status"
        aria-live="polite"
        className={
          display
            ? `pointer-events-none fixed bottom-[calc(1.5rem+var(--tips-h,0px))] z-40 flex flex-col items-center gap-2 px-6 portrait:right-0 portrait:bottom-[calc(8rem+var(--tips-h,0px))] portrait:left-0 ${BOARD[railSide][panelShown ? "shown" : "hidden"]}`
            : "pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--tabbar-h)+12px)] z-40 flex flex-col items-center gap-2 px-4 print:hidden lg:bottom-6"
        }
      >
        {items(null)}
      </div>
    </>
  );
}
