/**
 * Asking for the parent PIN (UX §4 "Parent PIN", PLAN §12.3).
 *
 * The wall screen and kids' phones can do parent things after a correct PIN (a 10-minute grant).
 * `asParent` runs an action; if the server answers "parent_required" with the PIN on offer, it
 * opens the PIN dialog and, once unlocked, tries the action again (once). On the wall the dialog
 * opens only after a touch (`askPinOnlyWhen`): Settings stays open once its grant locks
 * (ADR 0034), and a refresh in the background mustn't put the pad up for nobody.
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

let pinMayOpen: () => boolean = () => true;

/** Open the PIN dialog for a refusal only while `rule` says so; returns the undo. */
export function askPinOnlyWhen(rule: () => boolean): () => void {
  pinMayOpen = rule;
  return () => {
    if (pinMayOpen === rule) pinMayOpen = () => true;
  };
}

export async function asParent<T>(
  action: () => Promise<T>,
  reason: string | null = null,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code === "parent_required" &&
      error.pin &&
      pinMayOpen()
    ) {
      if (await askForPin(reason)) return await action();
    }
    throw error;
  }
}
