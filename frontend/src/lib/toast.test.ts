import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  anchorToasts,
  clearToasts,
  DISPLAY_TOAST_MS,
  dismissToast,
  setToastProfile,
  showToast,
  TOAST_MS,
  toastAnchor,
  toasts,
} from "./toast";

describe("where toasts sit", () => {
  it("in an open sheet, then back above the bar when it closes", () => {
    const bar = document.createElement("div");
    const sheet = document.createElement("div");
    const barGone = anchorToasts(bar);
    expect(toastAnchor.get()).toBe(bar);
    const sheetGone = anchorToasts(sheet);
    expect(toastAnchor.get()).toBe(sheet);
    sheetGone();
    expect(toastAnchor.get()).toBe(bar);
    barGone();
    expect(toastAnchor.get()).toBeNull();
  });

  it("stays in the sheet when the screen's bar goes first", () => {
    const bar = document.createElement("div");
    const sheet = document.createElement("div");
    const barGone = anchorToasts(bar);
    const sheetGone = anchorToasts(sheet);
    barGone();
    expect(toastAnchor.get()).toBe(sheet);
    sheetGone();
    expect(toastAnchor.get()).toBeNull();
  });
});

describe("a toast's life", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearToasts();
  });
  afterEach(() => {
    setToastProfile(false);
    vi.useRealTimers();
  });

  it("shows for 6 seconds on a phone, then goes", () => {
    showToast("Milk added");
    expect(toasts.get().map((toast) => toast.message)).toEqual(["Milk added"]);
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(toasts.get()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.get()).toEqual([]);
  });

  it("goes as soon as it's dismissed (Undo), once", () => {
    const id = showToast("Removed Mia", { label: "Undo", onAction: vi.fn() });
    dismissToast(id);
    dismissToast(id);
    expect(toasts.get()).toEqual([]);
  });

  it("keeps three at most on a phone: a fourth makes the oldest go", () => {
    for (const message of ["One", "Two", "Three", "Four"]) showToast(message);
    expect(toasts.get().map((toast) => toast.message)).toEqual(["Two", "Three", "Four"]);
  });

  it("stays 8 seconds on the wall display, two at most (UX §1)", () => {
    setToastProfile(true);
    for (const message of ["One", "Two", "Three"]) showToast(message);
    expect(toasts.get().map((toast) => toast.message)).toEqual(["Two", "Three"]);
    vi.advanceTimersByTime(TOAST_MS);
    expect(toasts.get()).toHaveLength(2);
    vi.advanceTimersByTime(DISPLAY_TOAST_MS - TOAST_MS);
    expect(toasts.get()).toEqual([]);
  });
});
