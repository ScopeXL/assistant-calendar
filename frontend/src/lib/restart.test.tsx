import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  announceRestart,
  askingHere,
  forgetRestart,
  useServerRestart,
  waitForServer,
} from "./restart";
import { toasts } from "./toast";

afterEach(() => {
  cleanup();
  forgetRestart();
  toasts.set([]);
});

/** A clock that moves only when the waiter pauses, and answers in the order given. */
function server(answers: ("ok" | "starting" | "gone")[]) {
  let at = 0;
  const asked: number[] = [];
  const fetcher = vi.fn(() => {
    asked.push(at);
    const answer = answers.shift() ?? "ok";
    if (answer === "gone") return Promise.reject(new TypeError("Failed to fetch"));
    return Promise.resolve(new Response(null, { status: answer === "ok" ? 200 : 503 }));
  });
  return {
    fetcher: fetcher as unknown as typeof fetch,
    asked,
    pause: (ms: number) => {
      at += ms;
      return Promise.resolve();
    },
    now: () => at,
  };
}

describe("waiting for the server (ADR 0034)", () => {
  it("waits for it to go, then to come back; a 503 and no answer both mean not yet", async () => {
    const fake = server(["ok", "starting", "gone", "starting", "ok"]);
    expect(await waitForServer({ afterGoingAway: true, ...fake })).toBe(true);
    expect(fake.asked).toEqual([0, 1000, 2000, 3000, 4000]);
  });

  it("takes an answer of ok as back when it never seemed to go", async () => {
    const fake = server(Array<"ok">(30).fill("ok"));
    expect(await waitForServer({ afterGoingAway: true, goneWithinMs: 5000, ...fake })).toBe(true);
    expect(fake.asked.at(-1)).toBe(5000);
  });

  it("gives up at the limit", async () => {
    const fake = server(Array<"gone">(400).fill("gone"));
    expect(await waitForServer({ forMs: 10_000, ...fake })).toBe(false);
    expect(fake.asked.at(-1)).toBe(10_000);
  });
});

function Shell({ refresh }: { refresh: () => Promise<void> }) {
  useServerRestart(refresh);
  return null;
}

describe("a page while Sunroom restarts", () => {
  it("says so once and reloads once, though the shell mounts again meanwhile", async () => {
    const health = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(new Response(null, { status: 200 }));
    const refresh = vi.fn(() => Promise.resolve());
    const first = render(<Shell refresh={refresh} />);
    announceRestart("restore");
    first.unmount();
    render(<Shell refresh={refresh} />);
    await vi.waitFor(
      () => {
        expect(refresh).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 },
    );
    expect(refresh).toHaveBeenCalledWith(); // reloadFresh's own reload, not the waiter's answer
    expect(toasts.get().map((toast) => toast.message)).toEqual([
      "Sunroom is restarting… Sign in again in a moment.",
    ]);
    expect(health).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
    health.mockRestore();
  });

  it("leaves the words to the sheet on the page that asked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    render(<Shell refresh={() => Promise.resolve()} />);
    askingHere(true);
    announceRestart("restore"); // the stream's frame, then the answer
    announceRestart("restore");
    await Promise.resolve();
    expect(toasts.get()).toEqual([]);
    vi.restoreAllMocks();
  });
});
