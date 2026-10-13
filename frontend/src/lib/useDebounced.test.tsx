import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounced } from "./useDebounced";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a value once it has stopped changing", () => {
  it("waits out the keys, and settles on the last one", () => {
    const { result, rerender } = renderHook(({ words }) => useDebounced(words, 350), {
      initialProps: { words: "" },
    });
    rerender({ words: "S" });
    rerender({ words: "Sa" });
    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(result.current).toBe("");
    rerender({ words: "Sam" });
    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(result.current).toBe("");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("Sam");
  });
});
