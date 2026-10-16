import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { asParent, askPinOnlyWhen, finishPinRequest, pinRequest } from "./parent";

const refusal = () =>
  new ApiError(403, "parent_required", "Only a parent can do that. Enter the parent PIN.", true);

describe('asking for the parent PIN (UX §4 "Parent PIN")', () => {
  afterEach(() => {
    finishPinRequest(false);
  });

  it("opens the PIN dialog for a refusal, and tries once more once it's unlocked", async () => {
    let calls = 0;
    const done = asParent(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(refusal()) : Promise.resolve("saved");
    });
    await vi.waitFor(() => {
      expect(pinRequest.get()).not.toBeNull();
    });
    finishPinRequest(true);
    await expect(done).resolves.toBe("saved");
    expect(calls).toBe(2);
  });

  it("never raises the pad by itself on the wall: only after a touch (ADR 0034)", async () => {
    let touched = false;
    const undo = askPinOnlyWhen(() => touched);
    try {
      // A refresh behind a locked Settings page: the refusal comes back, and no pad.
      await expect(asParent(() => Promise.reject(refusal()))).rejects.toThrow(
        "Enter the parent PIN",
      );
      expect(pinRequest.get()).toBeNull();
      // A tap a moment ago: the pad opens as ever.
      touched = true;
      const asked = asParent(() => Promise.reject(refusal()));
      await vi.waitFor(() => {
        expect(pinRequest.get()).not.toBeNull();
      });
      finishPinRequest(false);
      await expect(asked).rejects.toThrow();
    } finally {
      undo();
    }
    // Undone (the wall's shell went away), every refusal may ask again.
    const again = asParent(() => Promise.reject(refusal()));
    await vi.waitFor(() => {
      expect(pinRequest.get()).not.toBeNull();
    });
    finishPinRequest(false);
    await expect(again).rejects.toThrow();
  });
});
