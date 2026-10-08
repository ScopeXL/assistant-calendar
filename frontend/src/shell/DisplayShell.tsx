import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "../api/client";
import { qk } from "../api/keys";
import { AddPanel } from "../features/calendar/AddPanel";
import { useReminders } from "../features/calendar/reminders";
import { TodayPanel } from "../features/calendar/TodayPanel";
import { usePluginRooms, useRailBlocks, useScreenOverlays } from "../features/usePluginModules";
import { zonedParts } from "../lib/dates";
import {
  displayState,
  editorOpen,
  idleHolds,
  resetBoard,
  updateDisplay,
} from "../lib/displayState";
import { useSettings } from "../lib/household";
import { idleFor, swallowFollowingClick, watchActivity, whenIdle } from "../lib/idle";
import { watchKeyboardFields } from "../lib/keyboard";
import { MotionProvider } from "../lib/motion";
import { useLiveUpdates } from "../lib/live";
import { noteDimmer } from "../lib/dimmer";
import { dimmedTo, isNight } from "../lib/night";
import { askForPin } from "../lib/parent";
import { useQuietTheme } from "../lib/quietTheme";
import { fetchSession } from "../lib/session";
import { useStore } from "../lib/store";
import { sunDay } from "../lib/sun";
import { allowAppearanceMotion, applyAppearance, resolveTheme } from "../lib/theme";
import { useMinute } from "../lib/time";
import { setToastProfile } from "../lib/toast";
import { useKeepAwake } from "../lib/wakeLock";
import { CelebrationLayer } from "../ui/Celebration";
import { KeyboardHost } from "../ui/Keyboard";
import { PinDialog } from "../ui/PinDialog";
import { ShellContext } from "../ui/shell";
import { OfflinePill, ToastRegion, useAppUpdate } from "../ui/StatusLayer";
import { kioskCommands } from "./kioskCommands";
import { Night } from "./Night";
import { ClockBlock, Rail } from "./Rail";

const RESET_BOARD_MS = 2 * 60_000;
const EDITOR_IDLE_MS = 10 * 60_000;
const SETTINGS_LOCK_MS = 2 * 60_000;
const WAKE_MS = 2 * 60_000;
const NIGHTLY_UPDATE_HOUR = 3;
// The page's veil for each evening dim level (percent of full brightness).
const VEIL: Record<number, string> = { 60: "opacity-30", 40: "opacity-45", 20: "opacity-60" };

/** A tap woke the sleeping wall: tell the server, so the Pi's helper switches the panel on. */
function tellServerAwake(): void {
  void api.POST("/api/display/wake").catch(() => undefined);
}
const UPDATE_IDLE_MS = 10 * 60_000;

/**
 * The wall display's shell (UX §3): the rail, the board and the Today panel in landscape; the
 * Today band on top, the board and a bottom bar in portrait. It keeps the shared screen in its
 * shared state (UX §1 "Idle, wake and reset"), sleeps on schedule (Night), acts on commands from
 * a parent's phone, takes a new version at night, and holds the on-screen keyboard and PIN pad.
 *
 * `home` is "/display" on a paired screen and "/" on a laptop (which has a real keyboard).
 */
export function DisplayShell({ home, children }: { home: "/display" | "/"; children: ReactNode }) {
  const kiosk = home === "/display";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const rooms = usePluginRooms();
  const railBlocks = useRailBlocks();
  const screenOverlays = useScreenOverlays();
  const segment = pathname.split("/")[1] ?? "";
  const room = pathname.startsWith("/settings")
    ? "settings"
    : rooms.some((r) => r.key === segment)
      ? segment
      : "calendar";
  const inPluginRoom = room !== "settings" && room !== "calendar";
  const { data: settings } = useSettings();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const now = useMinute();
  const { panelShown, panel } = useStore(displayState);
  // Woken at night (a tap, or a parent's Wake): awake for 2 minutes from the latest wake.
  const [awake, setAwake] = useState(false);
  const [wakes, setWakes] = useState(0);
  const update = useAppUpdate();
  useKeepAwake(kiosk);
  useLiveUpdates();
  useReminders();

  const { mutate: lockNow } = useMutation({
    mutationFn: async () => {
      await api.POST("/api/auth/pin/lock");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.session() });
    },
  });

  const { day, hour, minute } = zonedParts(now);
  const minuteOfDay = hour * 60 + minute;
  const nightTime = isNight(settings?.sleep_from, settings?.sleep_to, hour, minute);
  const sleeping = nightTime && !awake;
  // The evening dim: the Pi's helper dims the panel itself; anywhere else the page draws a veil.
  const [dimmer] = useState(() => noteDimmer(window.location.search));
  const dim = nightTime
    ? null
    : dimmedTo(
        settings?.dim_from,
        settings?.sleep_from,
        settings?.sleep_to,
        settings?.dim_level ?? 40,
        hour,
        minute,
      );
  const latitude = settings?.latitude;
  const longitude = settings?.longitude;
  const sun = useMemo(() => sunDay(day, latitude, longitude), [day, latitude, longitude]);
  const theme = useQuietTheme(
    settings?.theme ?? null,
    settings ? resolveTheme(settings.theme, minuteOfDay, sun) : null,
  );

  // Theme, wall tint and text size follow the household's settings, the clock and the sun.
  useEffect(() => {
    if (!settings || !theme) return;
    applyAppearance(
      {
        theme: nightTime ? "dark" : theme,
        daylightTint: settings.daylight_tint,
        textSize: settings.text_size,
        reduceMotion: settings.display_reduce_motion,
        display: true,
        sun,
      },
      minuteOfDay,
    );
  }, [settings, theme, minuteOfDay, nightTime, sun]);

  useEffect(() => {
    setToastProfile(true);
    allowAppearanceMotion();
    const stopActivity = watchActivity();
    const stopKeyboard = kiosk ? watchKeyboardFields() : () => undefined;
    return () => {
      setToastProfile(false);
      stopActivity();
      stopKeyboard();
    };
  }, [kiosk]);

  // After 2 minutes idle the board goes back to this week, with the household's panel setting;
  // an editor left open gets 10 minutes before it closes too (UX §1 "Undo, drafts").
  useEffect(
    () =>
      whenIdle(RESET_BOARD_MS, () => {
        if (!editorOpen()) resetBoard();
      }),
    [],
  );
  useEffect(() => whenIdle(EDITOR_IDLE_MS, resetBoard), []);

  // Settings lock themselves after 2 minutes idle; other rooms return home after the household's
  // chosen minutes (0: never).
  useEffect(() => {
    if (room !== "settings") return;
    return whenIdle(SETTINGS_LOCK_MS, () => {
      if (session?.grant_expires_at) lockNow();
      void navigate({ to: home });
    });
  }, [room, session?.grant_expires_at, home, navigate, lockNow]);

  // Lists, Chores and the other rooms return to the board after the household's minutes idle
  // (UX §1), unless something holds the screen (a routine being run).
  const returnMinutes = settings?.display_return_minutes ?? 5;
  useEffect(() => {
    if (!inPluginRoom || returnMinutes <= 0) return;
    return whenIdle(returnMinutes * 60_000, () => {
      if (idleHolds.get() > 0) return;
      updateDisplay({ panel: null });
      void navigate({ to: home });
    });
  }, [inPluginRoom, returnMinutes, home, navigate]);

  // A new version waits for the night (3 AM), and for a quiet screen, before it reloads.
  useEffect(() => {
    if (!kiosk || !update.ready) return;
    if (hour === NIGHTLY_UPDATE_HOUR && idleFor() >= UPDATE_IDLE_MS) update.apply();
  }, [kiosk, update, hour]);

  // Commands from a parent's phone (POST /api/kiosk/command).
  useEffect(
    () =>
      kioskCommands.subscribe(() => {
        const command = kioskCommands.get()?.command;
        if (command === "reload") window.location.reload();
        if (command === "wake") {
          setAwake(true);
          setWakes((n) => n + 1);
          if (kiosk) tellServerAwake();
        }
      }),
    [kiosk],
  );

  // Back to sleep 2 minutes after the latest wake.
  useEffect(() => {
    if (!awake) return;
    const timer = setTimeout(() => {
      setAwake(false);
    }, WAKE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [awake, wakes]);

  const openSettings = async () => {
    if (room === "settings") {
      if (session?.grant_expires_at) lockNow();
      await navigate({ to: home });
      return;
    }
    if (!session?.is_parent && !(await askForPin())) return;
    await navigate({ to: "/settings/$page", params: { page: "family" } });
  };

  const showPanel =
    room !== "settings" && (panelShown ?? settings?.display_show_today_panel ?? true);
  const railSide = settings?.display_rail_side ?? "left";

  return (
    <ShellContext.Provider value="display">
      <MotionProvider reduceMotion={settings?.display_reduce_motion ?? false}>
        <div
          data-shell="display"
          className={`flex h-dvh overflow-hidden bg-wall text-ink landscape:flex-row portrait:flex-col ${
            railSide === "right" ? "landscape:flex-row-reverse" : ""
          }`}
        >
          <div className="contents portrait:order-last portrait:block">
            <Rail
              home={home}
              room={room}
              rooms={rooms}
              lock={
                session?.grant_expires_at
                  ? "unlocked"
                  : session?.has_pin === false || (!kiosk && session?.is_parent === true)
                    ? "open"
                    : "locked"
              }
              onAdd={() => {
                if (room === "settings") void navigate({ to: home });
                updateDisplay({ panel: { kind: "add", day: null, hour: null } });
              }}
              onLock={() => {
                void openSettings();
              }}
            />
          </div>
          {showPanel ? (
            <div className="hidden portrait:flex portrait:h-[var(--band-h)] portrait:shrink-0 portrait:flex-col portrait:overflow-hidden portrait:border-b portrait:border-line portrait:bg-surface">
              <div className="flex items-center justify-between gap-6 px-6 pt-4">
                <ClockBlock compact />
                {railBlocks.map((Block, index) => (
                  <Block key={index} place="band" />
                ))}
              </div>
              <TodayPanel home={home} band />
            </div>
          ) : null}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-[var(--osk-h,0px)]">
            {children}
          </main>
          {showPanel ? (
            <div
              data-surface=""
              className="w-[var(--panel-w)] shrink-0 border-l border-line bg-surface portrait:hidden"
            >
              <TodayPanel home={home} />
            </div>
          ) : null}
        </div>
        {inPluginRoom ? (
          <AddPanel
            panel={panel?.kind === "add" ? panel : null}
            today={zonedParts(now).day}
            room={room}
            onClose={() => {
              updateDisplay({ panel: null });
            }}
            onType={(type) => {
              if (panel?.kind === "add") updateDisplay({ panel: { ...panel, type } });
            }}
          />
        ) : null}
        <CelebrationLayer />
        <ToastRegion display />
        <OfflinePill display />
        {kiosk ? <KeyboardHost railSide={railSide} /> : null}
        <PinDialog />
        {screenOverlays.map(({ id, Overlay }) => (
          <Overlay key={id} asleep={sleeping} home={home} />
        ))}
        {dim !== null && dimmer === "page" ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 z-[58] bg-night ${VEIL[dim] ?? "opacity-45"}`}
          />
        ) : null}
        {sleeping ? (
          <Night
            mode={settings?.sleep_mode ?? "dim_clock"}
            onWake={() => {
              swallowFollowingClick();
              setAwake(true);
              setWakes((n) => n + 1);
              if (kiosk) tellServerAwake();
            }}
          />
        ) : null}
      </MotionProvider>
    </ShellContext.Provider>
  );
}
