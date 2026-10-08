/**
 * Toasts with an optional action (usually Undo) (UX §1): 6 seconds and at most three at once on
 * a phone; 8 seconds and two on the wall display, where people look up later. A toast leaves the
 * list when it's done; ui/StatusLayer animates it out with `motion` (UX §9).
 */
import { createStore } from "./store";

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const toasts = createStore<Toast[]>([]);
export const TOAST_MS = 6000;
export const DISPLAY_TOAST_MS = 8000;
let shownFor = TOAST_MS;
let mostShown = 3;
let nextId = 1;

/** The wall display keeps toasts longer and shows fewer at once (shell/DisplayShell). */
export function setToastProfile(display: boolean): void {
  shownFor = display ? DISPLAY_TOAST_MS : TOAST_MS;
  mostShown = display ? 2 : 3;
}

export function showToast(message: string, action?: { label: string; onAction: () => void }) {
  const id = nextId++;
  const toast: Toast = action
    ? { id, message, actionLabel: action.label, onAction: action.onAction }
    : { id, message };
  // One too many: the oldest goes to make room.
  toasts.set((list) => [...list, toast].slice(-mostShown));
  setTimeout(() => {
    dismissToast(id);
  }, shownFor);
  return id;
}

export function dismissToast(id: number): void {
  toasts.set((list) =>
    list.some((toast) => toast.id === id) ? list.filter((t) => t.id !== id) : list,
  );
}

export function isShowing(id: number): boolean {
  return toasts.get().some((toast) => toast.id === id);
}

/** Clear every toast (a wall screen going to sleep: its Undo buttons belong to that moment). */
export function clearToasts(): void {
  toasts.set([]);
}

/**
 * Where toasts sit: just above a screen's bottom bar when it has one (so they never cover its
 * buttons), else above the tab bar. While a sheet is open they sit at its bottom, since the page
 * behind it can't be tapped. Bars and sheets register an anchor element (ui/ToastAnchor); the
 * newest one still on screen wins.
 */
export const toastAnchor = createStore<HTMLElement | null>(null);
const anchors: HTMLElement[] = [];

/** Toasts show in `node` until the returned function runs (when it leaves the screen). */
export function anchorToasts(node: HTMLElement): () => void {
  anchors.push(node);
  toastAnchor.set(node);
  return () => {
    const at = anchors.lastIndexOf(node);
    if (at !== -1) anchors.splice(at, 1);
    toastAnchor.set(anchors.at(-1) ?? null);
  };
}
