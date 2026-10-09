import { Clock, RefreshCw, Wifi, WifiOff, type LucideIcon } from "lucide-react";

import { connection } from "../lib/connection";
import { liveStatus, type LiveStatus } from "../lib/events";
import { createStore, useStore } from "../lib/store";
import { showToast } from "../lib/toast";
import { Button } from "./Button";
import { useShell } from "./shell";

/**
 * Is this screen hearing live updates? (UX §8, ADR 0028.) One icon, five states, told apart by
 * shape, never by color alone: connected, reconnecting, checking every 30 seconds (something
 * between here and the server holds the stream back), offline, and nothing once signed out.
 */
export type LiveState = "live" | "reconnecting" | "polling" | "offline" | "hidden";

/** How long a state other than connected must last before the icon shows it. */
export const SETTLE_MS = 2_000;

/** The stream's status and whether the server answers, as one state: offline wins. */
export function mergeLive(status: LiveStatus, showOffline: boolean): LiveState {
  if (status === "signed-out") return "hidden";
  if (showOffline || status === "offline") return "offline";
  if (status === "polling") return "polling";
  if (status === "connecting") return "reconnecting";
  return "live";
}

/** The state on screen. Connected (and signed out) show at once; anything else only once it has
 * lasted 2 seconds, because the wall screen reopens its stream on every room switch. */
export const liveState = createStore<LiveState>("live");
let settling: ReturnType<typeof setTimeout> | undefined;

export function followLive(): void {
  const next = mergeLive(liveStatus.get(), connection.get().showOffline);
  clearTimeout(settling);
  settling = undefined;
  if (next === "live" || next === "hidden" || next === liveState.get()) {
    liveState.set(next);
    return;
  }
  settling = setTimeout(() => {
    settling = undefined;
    liveState.set(next);
  }, SETTLE_MS);
}

liveStatus.subscribe(followLive);
connection.subscribe(followLive);
followLive();

export function useLiveState(): LiveState {
  return useStore(liveState);
}

const GLYPHS: Record<
  Exclude<LiveState, "hidden">,
  { Icon: LucideIcon; words: string; tone: string; says: string }
> = {
  live: {
    Icon: Wifi,
    words: "connected",
    tone: "text-ink-soft",
    says: "Live updates are on.",
  },
  reconnecting: {
    Icon: RefreshCw,
    words: "reconnecting",
    tone: "live-turn text-ink-soft",
    says: "Reconnecting to Sunroom…",
  },
  polling: {
    Icon: Clock,
    words: "checking every 30 seconds",
    tone: "text-ink-soft",
    says: "Live updates are off for now; checking every 30 seconds.",
  },
  offline: {
    Icon: WifiOff,
    words: "offline",
    tone: "text-ink",
    says: "Can't reach Sunroom.",
  },
};

/** The icon alone, named in words for a screen reader (About → Connection). */
export function LiveStatusIcon() {
  const display = useShell() === "display";
  const state = useLiveState();
  if (state === "hidden") return null;
  const glyph = GLYPHS[state];
  const Icon = glyph.Icon;
  return (
    <span
      role="img"
      aria-label={`Live updates: ${glyph.words}`}
      data-live={state}
      className="inline-flex shrink-0"
    >
      <Icon
        aria-hidden="true"
        className={`${glyph.tone} ${display ? "size-8" : "size-6"}`}
        strokeWidth={2.25}
      />
    </span>
  );
}

/** The icon as a button (the board's top-right corner, the phone's Calendar header): a tap
 * says the state in words. */
export function LiveStatusButton() {
  const state = useLiveState();
  if (state === "hidden") return null;
  return (
    <Button
      variant="quiet"
      icon
      onClick={() => {
        showToast(GLYPHS[state].says);
      }}
    >
      <LiveStatusIcon />
    </Button>
  );
}
