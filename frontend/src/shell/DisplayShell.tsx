import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { api } from "../api/client";
import { qk } from "../api/keys";
import { TodayPanel } from "../features/calendar/TodayPanel";
import { zonedParts } from "../lib/dates";
import { displayState, resetBoard } from "../lib/displayState";
import { useSettings } from "../lib/household";
import { idleFor, swallowFollowingClick, watchActivity, whenIdle } from "../lib/idle";
import { watchKeyboardFields } from "../lib/keyboard";
import { MotionProvider } from "../lib/motion";
import { useLiveUpdates } from "../lib/live";
import { isNight } from "../lib/night";
import { askForPin } from "../lib/parent";
import { fetchSession } from "../lib/session";
import { useStore } from "../lib/store";
import { allowAppearanceMotion, applyAppearance } from "../lib/theme";
import { useMinute } from "../lib/time";
import { setToastProfile } from "../lib/toast";
import { useKeepAwake } from "../lib/wakeLock";
import { KeyboardHost } from "../ui/Keyboard";
import { PinDialog } from "../ui/PinDialog";
import { ShellContext } from "../ui/shell";
import { OfflinePill, ToastRegion, useAppUpdate } from "../ui/StatusLayer";
import { kioskCommands } from "./kioskCommands";
import { Night } from "./Night";
import { ClockBlock, Rail } from "./Rail";

const RESET_BOARD_MS = 2 * 60_000;
const SETTINGS_LOCK_MS = 2 * 60_000;
const WAKE_MS = 2 * 60_000;
const NIGHTLY_UPDATE_HOUR = 3;
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
  const room = pathname.startsWith("/settings") ? "settings" : "calendar";
  const { data: settings } = useSettings();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const now = useMinute();
  const { panelShown } = useStore(displayState);
  // Woken at night (a tap, or a parent's Wake): awake for 2 minutes from the latest wake.
  const [awake, setAwake] = useState(false);
  const [wakes, setWakes] = useState(0);
  const update = useAppUpdate();
  useKeepAwake(kiosk);
  useLiveUpdates();

  const { mutate: lockNow } = useMutation({
    mutationFn: async () => {
      await api.POST("/api/auth/pin/lock");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.session() });
    },
  });

  const hour = zonedParts(now).hour;
  const minute = zonedParts(now).minute;
  const nightTime = isNight(settings?.sleep_from, settings?.sleep_to, hour, minute);
  const sleeping = nightTime && !awake;

  // Theme, wall tint and text size follow the household's settings and the clock.
  useEffect(() => {
    if (!settings) return;
    applyAppearance(
      {
        theme: nightTime ? "dark" : settings.theme,
        daylightTint: settings.daylight_tint,
        textSize: settings.text_size,
        reduceMotion: settings.display_reduce_motion,
        display: true,
      },
      hour,
    );
  }, [settings, hour, nightTime]);

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

  // After 2 minutes idle the board goes back to this week, with the household's panel setting.
  useEffect(() => whenIdle(RESET_BOARD_MS, resetBoard), []);

  // Settings lock themselves after 2 minutes idle; other rooms return home after the household's
  // chosen minutes (0: never).
  useEffect(() => {
    if (room !== "settings") return;
    return whenIdle(SETTINGS_LOCK_MS, () => {
      if (session?.grant_expires_at) lockNow();
      void navigate({ to: home });
    });
  }, [room, session?.grant_expires_at, home, navigate, lockNow]);

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
        }
      }),
    [],
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
              unlocked={Boolean(session?.grant_expires_at) || (kiosk && session?.has_pin === false)}
              onLock={() => {
                void openSettings();
              }}
            />
          </div>
          {showPanel ? (
            <div className="hidden portrait:block portrait:border-b portrait:border-line">
              <div className="flex items-center justify-between px-6 pt-4">
                <ClockBlock compact />
              </div>
              <TodayPanel />
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
              <TodayPanel />
            </div>
          ) : null}
        </div>
        <ToastRegion display />
        <OfflinePill display />
        {kiosk ? <KeyboardHost railSide={railSide} /> : null}
        <PinDialog />
        {sleeping ? (
          <Night
            mode={settings?.sleep_mode ?? "dim_clock"}
            onWake={() => {
              swallowFollowingClick();
              setAwake(true);
              setWakes((n) => n + 1);
            }}
          />
        ) : null}
      </MotionProvider>
    </ShellContext.Provider>
  );
}
