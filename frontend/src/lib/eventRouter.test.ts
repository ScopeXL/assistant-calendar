import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEventHandler, createInvalidator } from "./eventRouter";

let client: QueryClient;

beforeEach(() => {
  vi.useFakeTimers();
  client = new QueryClient();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("event router", () => {
  it("debounces repeated invalidations into one per key", () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const invalidate = createInvalidator(client);
    invalidate(["members"]);
    invalidate(["members"]);
    invalidate(["session"]);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("never waits longer than a second under a steady stream", () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const invalidate = createInvalidator(client);
    for (let i = 0; i < 10; i++) {
      invalidate(["members"]);
      vi.advanceTimersByTime(200);
    }
    expect(spy).toHaveBeenCalled();
  });

  it("refetches the session when people, settings or devices change", () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const handle = createEventHandler(client, { onSignedOut: vi.fn() });
    for (const type of ["members.changed", "settings.changed", "devices.changed"]) {
      spy.mockClear();
      handle({ type });
      vi.advanceTimersByTime(250);
      expect(spy).toHaveBeenCalledWith({ queryKey: ["session"] });
    }
  });

  it("hands commands for the wall screen to the shell", () => {
    const onKioskCommand = vi.fn();
    const handle = createEventHandler(client, { onSignedOut: vi.fn(), onKioskCommand });
    handle({ type: "kiosk.command", command: "reload" });
    expect(onKioskCommand).toHaveBeenCalledWith("reload", {
      type: "kiosk.command",
      command: "reload",
    });
  });

  it("signs out on session.expired and refetches everything on resync", () => {
    const onSignedOut = vi.fn();
    const spy = vi.spyOn(client, "invalidateQueries");
    const handle = createEventHandler(client, { onSignedOut });
    handle({ type: "hello", mode: "resync" });
    expect(spy).toHaveBeenCalledWith();
    handle({ type: "session.expired" });
    expect(onSignedOut).toHaveBeenCalledOnce();
  });
});
