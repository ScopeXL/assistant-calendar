import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lastActivity } from "./idle";
import { useQuietTheme } from "./quietTheme";

beforeEach(() => {
  vi.useFakeTimers();
  lastActivity.set(Date.now());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the wall's theme switch (UX §6)", () => {
  it("shows the first theme at once", () => {
    const { result } = renderHook(() => useQuietTheme("auto", "light"));
    expect(result.current).toBe("light");
  });

  it("waits for 10 quiet seconds before sunset's switch", () => {
    const { result, rerender } = renderHook(
      ({ wanted }: { wanted: "light" | "dark" }) => useQuietTheme("auto", wanted),
      { initialProps: { wanted: "light" } },
    );
    rerender({ wanted: "dark" });
    expect(result.current).toBe("light");
    act(() => {
      vi.advanceTimersByTime(6_000);
      lastActivity.set(Date.now()); // someone taps: the wait starts again
      vi.advanceTimersByTime(6_000);
    });
    expect(result.current).toBe("light");
    act(() => {
      vi.advanceTimersByTime(4_100);
    });
    expect(result.current).toBe("dark");
  });

  it("follows a parent's change at once", () => {
    const { result, rerender } = renderHook(
      ({ choice, wanted }: { choice: "auto" | "dark"; wanted: "light" | "dark" }) =>
        useQuietTheme(choice, wanted),
      { initialProps: { choice: "auto" as "auto" | "dark", wanted: "light" as "light" | "dark" } },
    );
    rerender({ choice: "dark", wanted: "dark" });
    expect(result.current).toBe("dark");
  });
});
