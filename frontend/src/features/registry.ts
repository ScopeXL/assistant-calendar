/**
 * The frontend plugin registry (PLAN §6.5, ADR 0002): plugin id → its lazily loaded folder. The
 * shell builds the rail, the tab bar, the Today panel and Settings from the plugins the server
 * lists (GET /api/plugins) that are also registered here, and enabled.
 *
 * The calendar is core. calendar_sync arrived in M2; lists and chores come in M3, meals,
 * countdowns, screensaver and weather in M4.
 */
import type { ComponentType } from "react";

export interface PluginModule {
  id: string;
  /** Full-screen rooms on the display's rail, by key. */
  rooms?: Record<string, ComponentType>;
  /** Blocks in the display's Today panel, by key. */
  panels?: Record<string, ComponentType<{ size: string }>>;
  /** Phone tabs, by key. */
  tabs?: Record<string, ComponentType>;
  /** Custom settings sections, by key (otherwise the generic form from the plugin's spec). */
  settings?: Record<string, ComponentType>;
  /** Drawn over everything on the display when idle (the screensaver). */
  overlay?: ComponentType;
  /** Overlay keys to ask /api/calendar/occurrences for (M1). */
  calendarOverlays?: string[];
  /** A quiet one-line pill in the board's header (a synced account that stopped answering). */
  boardPill?: ComponentType;
  /** The body of a first-run step the plugin adds (calendar_sync: Bring in your calendars). */
  onboarding?: ComponentType<{ onDone: () => void }>;
}

export const plugins: Record<string, () => Promise<{ default: PluginModule }>> = {
  calendar_sync: () => import("./sync"),
};
