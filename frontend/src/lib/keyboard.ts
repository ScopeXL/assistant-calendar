/**
 * The display's on-screen keyboard state (UX §1 "The on-screen keyboard"; ui/Keyboard).
 *
 * Fields on the wall screen carry data-osk (ui/TextField). Focusing one opens the keyboard with
 * that field's layout; focus moving to another field retargets it; focus leaving every field
 * lowers it, keeping what was typed. A physical key press in the last 5 seconds (a laptop, or a
 * keyboard left on the Pi) keeps it closed. The keyboard's own keys never take focus, so the
 * field keeps its caret.
 */
import { createStore } from "./store";

export type KeyboardLayout = "text" | "password" | "numeric";

export interface KeyboardState {
  target: HTMLInputElement | null;
  layout: KeyboardLayout;
  open: boolean;
}

export const keyboard = createStore<KeyboardState>({ target: null, layout: "text", open: false });

const PHYSICAL_GRACE_MS = 5000;
let physicalAt = 0;

function fieldOf(node: EventTarget | null): HTMLInputElement | null {
  return node instanceof HTMLInputElement && node.dataset.osk !== undefined ? node : null;
}

function layoutOf(field: HTMLInputElement): KeyboardLayout {
  const layout = field.dataset.osk;
  return layout === "password" || layout === "numeric" ? layout : "text";
}

function onFocusIn(event: FocusEvent): void {
  const field = fieldOf(event.target);
  if (!field) return;
  const physical = Date.now() - physicalAt < PHYSICAL_GRACE_MS;
  keyboard.set({ target: field, layout: layoutOf(field), open: !physical });
}

function onFocusOut(event: FocusEvent): void {
  if (!fieldOf(event.target)) return;
  // Moving straight to another field: focusin retargets it. Anywhere else: lower the keyboard.
  queueMicrotask(() => {
    if (!fieldOf(document.activeElement)) {
      keyboard.set((state) =>
        state.open || state.target ? { ...state, target: null, open: false } : state,
      );
    }
  });
}

/** Any key press is a physical keyboard: the on-screen one only sends input events. */
function onKeyDown(): void {
  physicalAt = Date.now();
  if (keyboard.get().open) keyboard.set((state) => ({ ...state, open: false }));
}

export function watchKeyboardFields(): () => void {
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  window.addEventListener("keydown", onKeyDown, { capture: true });
  return () => {
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    window.removeEventListener("keydown", onKeyDown, { capture: true });
  };
}

/** Put text into a field the way typing would, so React's onChange sees it: the native value
 * setter (React watches it), then an input event. */
export function setFieldValue(field: HTMLInputElement, value: string, caret: number): void {
  Reflect.set(HTMLInputElement.prototype, "value", value, field);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  try {
    field.setSelectionRange(caret, caret);
  } catch {
    // Some input types have no caret; the end is where typing goes anyway.
  }
}

export function typeInto(field: HTMLInputElement, text: string): void {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  const max = field.maxLength > 0 ? field.maxLength : Infinity;
  const next = field.value.slice(0, start) + text + field.value.slice(end);
  if (next.length > max) return;
  setFieldValue(field, next, start + text.length);
}

export function backspace(field: HTMLInputElement): void {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  if (start !== end) {
    setFieldValue(field, field.value.slice(0, start) + field.value.slice(end), start);
  } else if (start > 0) {
    setFieldValue(field, field.value.slice(0, start - 1) + field.value.slice(end), start - 1);
  }
}

/** Done: lower the keyboard and keep the draft. */
export function lowerKeyboard(): void {
  const { target } = keyboard.get();
  keyboard.set({ target: null, layout: "text", open: false });
  target?.blur();
}

/** ↵: submit the field's form if it has one (quick add saves), else it's Done. */
export function enter(field: HTMLInputElement): void {
  if (field.form) field.form.requestSubmit();
  else lowerKeyboard();
}

/** Shift is automatic for a field's first letter, and after a sentence ends. */
export function wantsCapital(field: HTMLInputElement): boolean {
  if (field.dataset.osk === "password" || field.autocapitalize === "none") return false;
  const before = field.value.slice(0, field.selectionStart ?? field.value.length);
  return before.trim() === "" || /[.!?]\s+$/.test(before);
}
