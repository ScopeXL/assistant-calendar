import { useNavigate } from "@tanstack/react-router";
import { Cake, type LucideIcon } from "lucide-react";

import type { CalendarOverlay } from "../registry";
import { useCalendarOverlays } from "../usePluginModules";
import type { Occurrence } from "./types";

/**
 * The core's own overlays (PLAN §7.6, ADR 0028), asked for whatever plugins are on: birthdays
 * from Family. Unlike a plugin's quiet chip, a birthday is drawn as a real chip in its person's
 * color with this mark before its title, and a tap opens its read-only sheet.
 */
export const CORE_OVERLAYS: readonly { key: string; icon: LucideIcon }[] = [
  { key: "birthdays", icon: Cake },
];

/** The core overlay an occurrence comes from (a birthday), if any: its `icon` is the mark its
 * chip carries before the title. */
export function coreOverlayOf(occurrence: Occurrence): (typeof CORE_OVERLAYS)[number] | undefined {
  return CORE_OVERLAYS.find((overlay) => overlay.key === occurrence.overlay);
}

/** The plugin overlay an occurrence comes from (a day's dinner, a countdown), if any. */
export function useOverlayOf(occurrence: Occurrence): CalendarOverlay | undefined {
  const overlays = useCalendarOverlays();
  if (!occurrence.overlay) return undefined;
  return overlays.find((overlay) => overlay.key === occurrence.overlay);
}

/** Opening something on the board: a plugin's overlay opens its room (true); anything else,
 * a birthday included, is the caller's to open in its sheet (false). */
export function useOpenOverlay(): (occurrence: Occurrence) => boolean {
  const navigate = useNavigate();
  const overlays = useCalendarOverlays();
  return (occurrence) => {
    if (!occurrence.overlay || coreOverlayOf(occurrence)) return false;
    const found = overlays.find((overlay) => overlay.key === occurrence.overlay);
    if (found) void navigate({ to: "/$room", params: { room: found.room } });
    return true;
  };
}
