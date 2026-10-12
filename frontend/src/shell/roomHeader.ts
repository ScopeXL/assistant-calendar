/**
 * What the room on screen puts in the wall's header (shell/Header, UX §3): its title, an
 * optional line beside it, a way back, and its own controls. A store, not a portal: a portal
 * needs the header's node before the room first renders, and the kiosk remounts the shell
 * between /display and the rooms, which would blank it each time. A store set in a layout effect
 * is there before the first paint, lives outside React, and the header is its only subscriber.
 */
import { useLayoutEffect, type ReactNode } from "react";

import { createStore } from "../lib/store";

export interface RoomHeaderSpec {
  title: string;
  /** A quiet line after the title: the week's span, "4 to get", "Today". */
  subtitle?: string | undefined;
  /** The subtitle is a count: it pops when it changes (UX §9). A week's span doesn't. */
  counts?: boolean | undefined;
  /** Replaces the title for a moment ("Drop on a day"). */
  notice?: string | null | undefined;
  /** A link back to the room this one belongs to ("‹ Lists"), before the title. */
  back?: ReactNode;
  /** The room's own buttons; put `ml-auto` on what belongs at the right. */
  controls?: ReactNode;
}

export const roomHeader = createStore<RoomHeaderSpec | null>(null);

/** Hand this room's title and controls to the header for as long as the room is on screen. */
export function useRoomHeader(spec: RoomHeaderSpec): void {
  // Every render: the controls close over the room's latest state.
  useLayoutEffect(() => {
    roomHeader.set(spec);
  });
  // Leaving: cleared before the next room's own layout effect sets its title.
  useLayoutEffect(
    () => () => {
      roomHeader.set(null);
    },
    [],
  );
}

/** The same as an element, for a room whose title is a literal: `<RoomHeader title="Lists" />`. */
export function RoomHeader(spec: RoomHeaderSpec): null {
  useRoomHeader(spec);
  return null;
}
