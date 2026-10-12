import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SavedMark } from "../ui/SavedMark";
import { SAVED_FLASH_MS, useSavedFlash } from "./savedFlash";

function Field() {
  const { saved, flash } = useSavedFlash();
  return (
    <>
      <button type="button" onClick={flash}>
        Save
      </button>
      <SavedMark show={saved} />
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the quiet Saved under a field that saves itself", () => {
  it("shows for two seconds, and a second save starts them again", () => {
    render(<Field />);
    const line = screen.getByText("", { selector: "p[aria-live=polite]" });
    expect(line.textContent).toBe("");
    const save = screen.getByRole("button", { name: "Save" });
    fireEvent.click(save);
    expect(line.textContent).toBe("Saved");
    act(() => {
      vi.advanceTimersByTime(SAVED_FLASH_MS - 500);
    });
    fireEvent.click(save);
    act(() => {
      vi.advanceTimersByTime(SAVED_FLASH_MS - 500);
    });
    expect(line.textContent).toBe("Saved");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(line.textContent).toBe("");
  });
});
