import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "./copy";

const TEXT = "sunroom@example.com";

/** navigator.clipboard as a browser has it, or missing (plain http). jsdom has none. */
function clipboard(writeText?: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

/** document.execCommand, which jsdom doesn't have. */
function execCommand(exec?: (command: string) => boolean): void {
  Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
}

/** What the textarea held, selected, at the moment of the copy. */
function watchCopy(result = true) {
  const seen = { command: "", selected: "", styled: true, host: null as Element | null };
  execCommand((command) => {
    const area = document.querySelector("textarea");
    seen.command = command;
    seen.selected = area?.value.slice(area.selectionStart, area.selectionEnd) ?? "";
    seen.styled = area?.hasAttribute("style") ?? true;
    seen.host = area?.parentElement ?? null;
    return result;
  });
  return seen;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(document, "execCommand");
  document.body.replaceChildren();
});

describe("copying from a tap", () => {
  it("uses the clipboard where the browser has one", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    clipboard(writeText);
    const seen = watchCopy();
    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(seen.command).toBe("");
  });

  it("says it didn't copy when the clipboard refuses", async () => {
    clipboard(() => Promise.reject(new DOMException("Not allowed", "NotAllowedError")));
    await expect(copyText(TEXT)).resolves.toBe(false);
  });

  it("copies from a hidden textarea where there's no clipboard, then takes it away", async () => {
    clipboard();
    const seen = watchCopy();
    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(seen).toMatchObject({ command: "copy", selected: TEXT, styled: false });
    expect(seen.host).toBe(document.body);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("puts the textarea inside an open sheet, and gives focus back", async () => {
    clipboard();
    const sheet = document.createElement("dialog");
    sheet.setAttribute("open", "");
    const button = document.createElement("button");
    sheet.append(button);
    document.body.append(sheet);
    button.focus();
    const seen = watchCopy();
    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(seen.host).toBe(sheet);
    expect(document.activeElement).toBe(button);
  });

  it("resolves false when neither way works", async () => {
    clipboard();
    watchCopy(false);
    await expect(copyText(TEXT)).resolves.toBe(false);
    execCommand(() => {
      throw new DOMException("Not supported", "NotSupportedError");
    });
    await expect(copyText(TEXT)).resolves.toBe(false);
    execCommand();
    await expect(copyText(TEXT)).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});
