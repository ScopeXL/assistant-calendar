import { useNavigate } from "@tanstack/react-router";

import type { CalendarOverlay } from "../registry";
import { useCalendarOverlays } from "../usePluginModules";
import type { Occurrence } from "./types";

/** The plugin overlay an occurrence comes from (a day's dinner, a countdown), if any. */
export function useOverlayOf(occurrence: Occurrence): CalendarOverlay | undefined {
  const overlays = useCalendarOverlays();
  if (!occurrence.overlay) return undefined;
  return overlays.find((overlay) => overlay.key === occurrence.overlay);
}

/** Opening something on the board: a plugin's overlay opens its room (true); anything else is
 * the caller's (false). */
export function useOpenOverlay(): (occurrence: Occurrence) => boolean {
  const navigate = useNavigate();
  const overlays = useCalendarOverlays();
  return (occurrence) => {
    if (!occurrence.overlay) return false;
    const found = overlays.find((overlay) => overlay.key === occurrence.overlay);
    if (found) void navigate({ to: "/$room", params: { room: found.room } });
    return true;
  };
}
