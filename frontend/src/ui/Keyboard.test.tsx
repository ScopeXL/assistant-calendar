import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { keyboard, watchKeyboardFields } from "../lib/keyboard";
import { KeyboardHost } from "./Keyboard";

function Field({ onSubmit = () => undefined }: { onSubmit?: () => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        Name
        <input
          data-osk="text"
          inputMode="none"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
      </label>
    </form>
  );
}

let stop: () => void;
beforeAll(() => {
  // jsdom has no layout, so no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
  stop = watchKeyboardFields();
});
afterEach(() => {
  stop();
  cleanup();
  keyboard.set({ target: null, layout: "text", open: false });
});

function press(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("the on-screen keyboard (UX §1)", () => {
  it("rises when a field is focused and types into it as React expects", () => {
    render(
      <>
        <Field />
        <KeyboardHost railSide="left" />
      </>,
    );
    expect(screen.queryByRole("group", { name: "On-screen keyboard" })).toBeNull();
    const input = screen.getByLabelText("Name");
    act(() => {
      input.focus();
    });
    expect(screen.getByRole("group", { name: "On-screen keyboard" })).toBeTruthy();
    // Shift is automatic for the first letter.
    press("M");
    press("i");
    press("a");
    expect((input as HTMLInputElement).value).toBe("Mia");
    press("Delete");
    expect((input as HTMLInputElement).value).toBe("Mi");
  });

  it("goes inside an open sheet, because the page behind a modal dialog can't be tapped", () => {
    render(
      <>
        <dialog open aria-label="Change Mia">
          <Field />
        </dialog>
        <KeyboardHost railSide="left" />
      </>,
    );
    const input = screen.getByLabelText("Name");
    act(() => {
      input.focus();
    });
    const keys = screen.getByRole("group", { name: "On-screen keyboard" });
    expect(screen.getByRole("dialog", { name: "Change Mia" }).contains(keys)).toBe(true);
    press("L");
    expect((input as HTMLInputElement).value).toBe("L");
  });

  it("Done lowers it and keeps what was typed; Enter submits the field's form", () => {
    const submitted = vi.fn();
    render(
      <>
        <Field onSubmit={submitted} />
        <KeyboardHost railSide="left" />
      </>,
    );
    const input = screen.getByLabelText("Name");
    act(() => {
      input.focus();
    });
    press("S");
    press("Enter");
    expect(submitted).toHaveBeenCalledOnce();
    act(() => {
      press("Done");
    });
    expect(keyboard.get().open).toBe(false);
    expect((input as HTMLInputElement).value).toBe("S");
  });

  it("stays down while a physical keyboard is in use", () => {
    render(
      <>
        <Field />
        <KeyboardHost railSide="left" />
      </>,
    );
    fireEvent.keyDown(window, { key: "a" });
    act(() => {
      screen.getByLabelText("Name").focus();
    });
    expect(keyboard.get().open).toBe(false);
  });
});
