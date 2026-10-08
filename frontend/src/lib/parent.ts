/**
 * Asking for the parent PIN (UX §4 "Parent PIN", PLAN §12.3).
 *
 * The wall screen and kids' phones can do parent things after a correct PIN (a 10-minute grant).
 * `asParent` runs an action; if the server answers "parent_required" with the PIN on offer, it
 * opens the PIN dialog and, once unlocked, tries the action again (once).
 */
import { ApiError } from "../api/client";
import { createStore } from "./store";

export interface PinRequest {
  /** One line above the pad saying why ("Changing events on this screen asks for the PIN."). */
  reason: string | null;
  resolve: (unlocked: boolean) => void;
}

export const pinRequest = createStore<PinRequest | null>(null);

export function askForPin(reason: string | null = null): Promise<boolean> {
  return new Promise((resolve) => {
    pinRequest.get()?.resolve(false);
    pinRequest.set({ reason, resolve });
  });
}

export function finishPinRequest(unlocked: boolean): void {
  const request = pinRequest.get();
  pinRequest.set(null);
  request?.resolve(unlocked);
}

export async function asParent<T>(
  action: () => Promise<T>,
  reason: string | null = null,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError && error.code === "parent_required" && error.pin) {
      if (await askForPin(reason)) return await action();
    }
    throw error;
  }
}
