import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Before the module loads, so its first settling timer is a fake one too.
vi.useFakeTimers();
const { LiveStatusButton, SETTLE_MS, liveState, mergeLive } = await import("./LiveStatus");
const { liveStatus } = await import("../lib/events");
const { connection } = await import("../lib/connection");
const { toasts } = await import("../lib/toast");

const REACHABLE = { server: "reachable" as const, showOffline: false, lastReachableAt: null };

beforeEach(() => {
  vi.useFakeTimers();
  liveStatus.set("live");
  connection.set(REACHABLE);
});

afterEach(() => {
  cleanup();
  toasts.set([]);
  vi.useRealTimers();
});

describe("the live-updates icon (UX §8)", () => {
  it("merges the stream's status with the server's reachability, offline first", () => {
    expect(mergeLive("live", false)).toBe("live");
    expect(mergeLive("connecting", false)).toBe("reconnecting");
    expect(mergeLive("polling", false)).toBe("polling");
    expect(mergeLive("offline", false)).toBe("offline");
    expect(mergeLive("polling", true)).toBe("offline");
    expect(mergeLive("live", true)).toBe("offline");
    expect(mergeLive("signed-out", true)).toBe("hidden");
  });

  it("shows anything but connected only once it has lasted 2 seconds", () => {
    liveStatus.set("connecting");
    expect(liveState.get()).toBe("live");
    vi.advanceTimersByTime(SETTLE_MS - 1);
    expect(liveState.get()).toBe("live");
    vi.advanceTimersByTime(1);
    expect(liveState.get()).toBe("reconnecting");
    liveStatus.set("live");
    expect(liveState.get()).toBe("live");
  });

  it("never shows a quick reconnect, like the wall's on a room switch", () => {
    liveStatus.set("connecting");
    vi.advanceTimersByTime(300);
    liveStatus.set("live");
    vi.advanceTimersByTime(SETTLE_MS * 2);
    expect(liveState.get()).toBe("live");
  });

  it("says offline when the server stops answering, whatever the stream says", () => {
    liveStatus.set("polling");
    connection.set({ ...REACHABLE, server: "unreachable", showOffline: true });
    vi.advanceTimersByTime(SETTLE_MS);
    expect(liveState.get()).toBe("offline");
  });

  it("is a button that says the state in words", () => {
    render(<LiveStatusButton />);
    const icon = screen.getByRole("img", { name: "Live updates: connected" });
    act(() => {
      icon.closest("button")?.click();
    });
    expect(toasts.get().map((toast) => toast.message)).toEqual(["Live updates are on."]);
    act(() => {
      liveStatus.set("signed-out");
    });
    expect(screen.queryByRole("button")).toBeNull();
  });
});
