/**
 * The frontend plugin registry (PLAN §6.5, ADR 0002): plugin id → its lazily loaded folder. The
 * shell builds the rail, the tab bar, the Today panel, Add and Settings from the plugins the
 * server lists (GET /api/plugins) that are also registered here, and enabled.
 *
 * The calendar is core. calendar_sync arrived in M2, lists and chores in M3, meals, countdowns,
 * screensaver and weather in M4.
 */
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

import type { Occurrence } from "./calendar/types";

/** A room on the wall screen's rail, and the same place as a tab on phones (UX §3). */
export interface PluginRoom {
  /** Its address, /lists, and what follows the key is the room's own (/lists/<id>). */
  key: string;
  label: string;
  icon: LucideIcon;
  /** Its place among the rooms; the calendar is 0. */
  order: number;
  /** The room on the wall screen and laptops; `path` is the address after the key. */
  Display: ComponentType<{ path: string[] }>;
  /** The tab on a phone. */
  Phone: ComponentType<{ path: string[] }>;
}

/** A block of the wall's Today panel and a section of a phone's Today (UX §3, §5). */
export interface TodayBlock {
  key: string;
  /** Its place under the calendar's sections: Chores today 10, Tonight 20, To do 30, Coming
   * up 40 (UX §3). */
  order: number;
  Display?: ComponentType;
  Phone?: ComponentType;
}

export interface AddEditorProps {
  /** The day picked on the board, if any. */
  day: string | null;
  /** A title to start from ("Add a countdown" from an event). */
  initialTitle?: string | null;
  /** Saved: the panel closes. */
  onDone: () => void;
}

/** A kind of thing Add makes, beside Event (UX §4 "The Add panel for other things"). */
export interface AddType {
  key: string;
  /** The chip's word: "Item", "Chore". */
  label: string;
  order: number;
  /** The room where it's the first choice when Add opens. */
  room?: string;
  Editor: ComponentType<AddEditorProps>;
}

/** Things a plugin works out and shows on the board (PLAN §7.6): a day's dinner, a countdown.
 * They're quiet chips that can't be moved; a tap opens the plugin's room. */
export interface CalendarOverlay {
  /** Its key in /api/calendar/occurrences?overlays=… */
  key: string;
  /** The mark beside its title. */
  icon: LucideIcon;
  /** The room a tap opens (its key). */
  room: string;
}

/** Where a rail block shows: under the rail's clock, beside the clock in portrait's band, or
 * at the top of a phone's Today. */
export type RailPlace = "rail" | "band" | "phone";

/** A page of its own in Settings, after Calendars & accounts. */
export interface SettingsPage {
  key: string;
  title: string;
  Page: ComponentType;
}

export interface PluginModule {
  id: string;
  rooms?: PluginRoom[];
  today?: TodayBlock[];
  add?: AddType[];
  /** Under each person's events in Who's doing what (null: Everyone's column). */
  personColumn?: ComponentType<{ memberId: string | null; day: string }>;
  /** Its rows in Settings → Household → Recently removed (ui: settings/RecentlyRemoved's
   * RemovedRow), saying how many it shows so the empty line only shows when nothing does. */
  removed?: ComponentType<{ onCount: (count: number) => void }>;
  settingsPages?: SettingsPage[];
  /** Custom sections inside core settings pages, by key (calendar_sync: Calendars & accounts). */
  settings?: Record<string, ComponentType>;
  /** Drawn over everything on the wall, for the plugin to show when it should (the
   * screensaver, when the wall has been left alone). `asleep`: Night is showing, which wins;
   * `home`: where the wall goes back to. */
  overlay?: ComponentType<{ asleep: boolean; home: "/display" | "/" }>;
  /** What it adds to the board's days. */
  calendarOverlays?: CalendarOverlay[];
  /** A small block by the clock (the weather). */
  railBlock?: ComponentType<{ place: RailPlace }>;
  /** A small mark in a board day's header (the day's weather). */
  dayHeader?: ComponentType<{ day: string }>;
  /** A line beside the date on the screensaver (the weather now). */
  saverCorner?: ComponentType;
  /** A button on an event's sheet ("Add a countdown"); `onDone` closes the sheet. */
  eventAction?: ComponentType<{ occurrence: Occurrence; onDone: () => void }>;
  /** A quiet one-line pill in the board's header (a synced account that stopped answering). */
  boardPill?: ComponentType;
  /** The body of a first-run step the plugin adds (calendar_sync: Bring in your calendars). */
  onboarding?: ComponentType<{ onDone: () => void }>;
}

export const plugins: Record<string, () => Promise<{ default: PluginModule }>> = {
  calendar_sync: () => import("./sync"),
  lists: () => import("./lists"),
  chores: () => import("./chores"),
  meals: () => import("./meals"),
  countdowns: () => import("./countdowns"),
  screensaver: () => import("./screensaver"),
  weather: () => import("./weather"),
};
