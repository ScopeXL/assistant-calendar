import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRegisterSW } from "virtual:pwa-register/react";

import { connection } from "../lib/connection";
import { formatTime } from "../lib/dates";
import { useStore } from "../lib/store";
import { ENTER, EXIT } from "../lib/motion";
import { dismissToast, isShowing, toastAnchor, toasts } from "../lib/toast";

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * The quiet connection pill (UX §8): never an error wall. A phone says "Offline · showing what
 * we had"; the wall screen says when it last heard from the server.
 */
export function OfflinePill({ display = false }: { display?: boolean }) {
  const { showOffline, lastReachableAt } = useStore(connection);
  if (!showOffline) return <div role="status" aria-live="polite" className="sr-only" />;
  const text =
    display && lastReachableAt
      ? `Can't reach Sunroom · showing ${formatTime(new Date(lastReachableAt))}`
      : "Offline · showing what we had";
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-30 flex justify-center print:hidden"
    >
      <span
        className={`inline-flex items-center gap-2 rounded-full bg-ink font-semibold text-on-ink ${
          display ? "px-5 py-3 text-d-secondary" : "px-4 py-2 text-secondary"
        }`}
      >
        <WifiOff aria-hidden="true" size={display ? 24 : 18} />
        {text}
      </span>
    </div>
  );
}

/** Whether a new version is waiting (the service worker installed it), and how to take it. */
export function useAppUpdate(): { ready: boolean; apply: () => void } {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible" && "serviceWorker" in navigator) {
        void navigator.serviceWorker.getRegistration().then((r) => r?.update());
      }
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return {
    ready: needRefresh,
    apply: () => {
      void updateServiceWorker(true);
    },
  };
}

/** "New version · Refresh" on phones. The wall screen restarts itself at night (shell/). */
export function UpdatePrompt() {
  const { ready, apply } = useAppUpdate();
  if (!ready) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--tabbar-h)+12px)] z-30 flex justify-center px-4 print:hidden lg:bottom-6">
      <div className="rise-in flex items-center gap-3 rounded-button bg-ink py-2 pr-2 pl-4 text-on-ink [--focus-ring:var(--wall)]">
        <span className="text-secondary font-semibold">New version</span>
        <button
          type="button"
          className="press min-h-11 rounded-button bg-wall px-4 text-secondary font-bold text-ink"
          onClick={apply}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

/**
 * Toasts with Undo. On phones they sit in the thumb zone above the tab bar (or a sheet's
 * bottom); on the wall screen, at the bottom centre of the board, 72 px tall with a 64 px Undo.
 * They rise in and ease out with `motion`; the others close the gap (UX §9). AnimatePresence's
 * popLayout adds a <style> as a toast leaves, under the page's CSP nonce (ADR 0007).
 */
export function ToastRegion({ display = false }: { display?: boolean }) {
  const list = useStore(toasts);
  const anchor = useStore(toastAnchor);
  const items = (
    <AnimatePresence mode="popLayout" initial={false}>
      {list.map((toast) => (
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
  if (anchor) return createPortal(items, anchor);
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        display
          ? "pointer-events-none fixed right-[var(--panel-w)] bottom-6 left-[var(--rail-w)] z-40 flex flex-col items-center gap-2 px-6 portrait:right-0 portrait:bottom-32 portrait:left-0"
          : "pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+var(--tabbar-h)+12px)] z-40 flex flex-col items-center gap-2 px-4 print:hidden lg:bottom-6"
      }
    >
      {items}
    </div>
  );
}
