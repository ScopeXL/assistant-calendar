import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sw = { needRefresh: false, update: vi.fn(() => Promise.resolve()) };

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.update,
  }),
}));

const { OfflinePill, ToastRegion, UpdatePrompt } = await import("./StatusLayer");
const { connection } = await import("../lib/connection");
const { showToast, toasts } = await import("../lib/toast");

afterEach(() => {
  cleanup();
  sw.needRefresh = false;
  connection.set({ server: "unknown", showOffline: false, lastReachableAt: null });
  toasts.set([]);
});

describe("the update prompt", () => {
  it("offers Refresh when a new version is waiting", () => {
    sw.needRefresh = true;
    render(<UpdatePrompt />);
    screen.getByRole("button", { name: "Refresh" }).click();
    expect(sw.update).toHaveBeenCalledWith(true);
  });

  it("stays away otherwise", () => {
    render(<UpdatePrompt />);
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  });
});

describe("the connection pill (UX §8)", () => {
  it("says nothing while the server answers", () => {
    render(<OfflinePill />);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("is quiet on a phone and says when the wall screen last heard from the server", () => {
    connection.set({
      server: "unreachable",
      showOffline: true,
      lastReachableAt: Date.UTC(2026, 9, 7, 13, 10),
    });
    const view = render(<OfflinePill />);
    expect(screen.getByRole("status").textContent).toBe("Offline · showing what we had");
    view.unmount();
    render(<OfflinePill display />);
    expect(screen.getByRole("status").textContent).toMatch(/^Can't reach Sunroom · showing /);
  });
});

describe("toasts", () => {
  it("show their action, and the action runs once", () => {
    const undo = vi.fn();
    render(<ToastRegion />);
    act(() => {
      showToast("Removed Mia", { label: "Undo", onAction: undo });
    });
    screen.getByRole("button", { name: "Undo" }).click();
    expect(undo).toHaveBeenCalledOnce();
  });
});
