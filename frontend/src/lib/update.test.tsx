import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { displayState, updateDisplay } from "./displayState";
import { toasts } from "./toast";
import {
  RECHECK_MS,
  REFRESH_AFTER_MS,
  WAIT_AT_MOST_MS,
  announceServerVersion,
  reloadFresh,
  serverVersion,
  useServerUpdate,
} from "./update";

function Updates({ refresh }: { refresh: () => Promise<void> }) {
  useServerUpdate(refresh);
  return null;
}

function mount(refresh: () => Promise<void>) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Updates refresh={refresh} />
    </QueryClientProvider>,
  );
}

const messages = () => toasts.get().map((toast) => toast.message);
const initial = displayState.get();

beforeEach(() => {
  vi.useFakeTimers();
  serverVersion.set(null);
  toasts.set([]);
  sessionStorage.clear();
  displayState.set(initial);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a new version on the server (ADR 0028)", () => {
  it("is announced only when it isn't this build's", () => {
    announceServerVersion(__APP_VERSION__);
    expect(serverVersion.get()).toBeNull();
    announceServerVersion("9.9.9");
    expect(serverVersion.get()).toBe("9.9.9");
    announceServerVersion(undefined);
    expect(serverVersion.get()).toBe("9.9.9");
    // The server went back to this build before the page reloaded: nothing to do.
    announceServerVersion(__APP_VERSION__);
    expect(serverVersion.get()).toBeNull();
  });

  it("says so, then refreshes after 4 seconds, once per version", () => {
    const refresh = vi.fn(() => Promise.resolve());
    mount(refresh);
    act(() => {
      announceServerVersion("9.9.9");
    });
    expect(messages()).toEqual(["Sunroom was updated to 9.9.9. Refreshing…"]);
    act(() => {
      vi.advanceTimersByTime(REFRESH_AFTER_MS);
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("sunroom.reloadedFor")).toBe("9.9.9");

    // Still the old page after that reload (a proxy kept it): no second toast, no loop.
    cleanup();
    toasts.set([]);
    serverVersion.set(null);
    refresh.mockClear();
    mount(refresh);
    act(() => {
      announceServerVersion("9.9.9");
    });
    act(() => {
      vi.advanceTimersByTime(REFRESH_AFTER_MS * 2);
    });
    expect(messages()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("waits while an editor is open, checking every 5 seconds, for 10 minutes at most", () => {
    const refresh = vi.fn(() => Promise.resolve());
    updateDisplay({ panel: { kind: "add", day: null, hour: null } });
    mount(refresh);
    act(() => {
      announceServerVersion("9.9.9");
    });
    act(() => {
      vi.advanceTimersByTime(REFRESH_AFTER_MS + RECHECK_MS * 3);
    });
    expect(refresh).not.toHaveBeenCalled();
    // The editor closes: the next check refreshes.
    act(() => {
      updateDisplay({ panel: null });
      vi.advanceTimersByTime(RECHECK_MS);
    });
    expect(refresh).toHaveBeenCalledOnce();

    // An editor left open doesn't hold a new version back forever.
    cleanup();
    sessionStorage.clear();
    serverVersion.set(null);
    refresh.mockClear();
    updateDisplay({ panel: { kind: "add", day: null, hour: null } });
    mount(refresh);
    act(() => {
      announceServerVersion("9.9.10");
    });
    act(() => {
      vi.advanceTimersByTime(WAIT_AT_MOST_MS + RECHECK_MS);
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reloads fresh: every service worker unregistered and every cache deleted first", async () => {
    const unregister = vi.fn(() => Promise.resolve(true));
    const getRegistrations = vi.fn(() => Promise.resolve([{ unregister }, { unregister }]));
    vi.stubGlobal("navigator", { serviceWorker: { getRegistrations } });
    const deleted: string[] = [];
    vi.stubGlobal("caches", {
      keys: () => Promise.resolve(["workbox-precache-v2", "photos"]),
      delete: (key: string) => {
        deleted.push(key);
        return Promise.resolve(true);
      },
    });
    const reload = vi.fn();
    await reloadFresh(reload);
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(deleted).toEqual(["workbox-precache-v2", "photos"]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("still reloads where there's no service worker or cache storage", async () => {
    vi.stubGlobal("navigator", { serviceWorker: undefined });
    vi.stubGlobal("caches", undefined);
    const reload = vi.fn();
    await reloadFresh(reload);
    expect(reload).toHaveBeenCalledOnce();
  });
});
