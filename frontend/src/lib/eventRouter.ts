/**
 * Turns live-update events into cache updates (PLAN §11.5). Events only invalidate: the
 * server is the truth. Debounced 250 ms with a 1 s ceiling, so a burst refetches once.
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { qk } from "../api/keys";
import type { ServerEvent } from "./events";

const DEBOUNCE_MS = 250;
const MAX_WAIT_MS = 1000;

export function createInvalidator(queryClient: QueryClient) {
  const pending = new Map<string, QueryKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstQueuedAt: number | undefined;

  const flush = () => {
    timer = undefined;
    firstQueuedAt = undefined;
    const keys = [...pending.values()];
    pending.clear();
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };

  return (queryKey: QueryKey) => {
    pending.set(JSON.stringify(queryKey), queryKey);
    const now = Date.now();
    firstQueuedAt ??= now;
    clearTimeout(timer);
    const wait = Math.min(DEBOUNCE_MS, Math.max(0, firstQueuedAt + MAX_WAIT_MS - now));
    timer = setTimeout(flush, wait);
  };
}

export interface EventHandlers {
  onSignedOut: () => void;
  /** A parent asked every wall screen to do something now (wall screens act; phones ignore). */
  onKioskCommand?: (command: string, event: ServerEvent) => void;
}

export function createEventHandler(queryClient: QueryClient, handlers: EventHandlers) {
  const invalidate = createInvalidator(queryClient);
  return (event: ServerEvent) => {
    switch (event.type) {
      case "hello":
        if (event.mode === "resync") void queryClient.invalidateQueries();
        break;
      case "members.changed":
        invalidate(["members"]);
        invalidate(qk.session());
        break;
      case "settings.changed":
        invalidate(qk.settings());
        invalidate(qk.session());
        invalidate(qk.kioskLayout());
        invalidate(qk.allowlist());
        break;
      case "devices.changed":
        invalidate(qk.devices());
        invalidate(qk.session());
        break;
      case "plugins.changed":
        invalidate(qk.plugins());
        break;
      case "photos.changed":
        invalidate(["photos"]);
        break;
      case "kiosk.command":
        if (typeof event.command === "string") handlers.onKioskCommand?.(event.command, event);
        break;
      case "session.expired":
        handlers.onSignedOut();
        break;
      default:
        break;
    }
  };
}
