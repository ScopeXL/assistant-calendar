import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Menu, Sun, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { useSettings } from "../lib/household";
import { useLiveUpdates } from "../lib/live";
import { MotionProvider } from "../lib/motion";
import { applyAppearance } from "../lib/theme";
import { useMinute } from "../lib/time";
import { zonedParts } from "../lib/dates";
import { ShellContext } from "../ui/shell";
import { OfflinePill, ToastRegion, UpdatePrompt } from "../ui/StatusLayer";

interface Tab {
  to: "/" | "/calendar" | "/more";
  label: string;
  icon: LucideIcon;
}

// Today, Calendar, then enabled plugins' tabs in the household's order (M2+), then More (UX §3).
const TABS: Tab[] = [
  { to: "/", label: "Today", icon: Sun },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/more", label: "More", icon: Menu },
];

// Screens opened from More keep More lit (Settings, Pair a display, Who's using this).
const UNDER_MORE = /^\/(more|settings|pair|who|install)(\/|$)/;

/** Bottom tabs on phones (UX §3 "The phone shell"). */
export function TabBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav
      aria-label="Main"
      data-segmented=""
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] print:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={label} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              data-lit={to === "/more" && UNDER_MORE.test(pathname) ? "" : undefined}
              // The router sets data-status="active"; the active icon sits in a filled ink pill, a
              // cue that isn't color alone.
              className="group flex min-h-(--tabbar-h) flex-col items-center justify-center gap-0.5 text-caption font-semibold text-ink-soft data-lit:text-ink data-[status=active]:text-ink"
            >
              <span className="flex h-7 w-12 items-center justify-center rounded-full group-data-lit:bg-ink group-data-lit:text-on-ink group-data-[status=active]:bg-ink group-data-[status=active]:text-on-ink">
                <Icon aria-hidden="true" size={22} strokeWidth={2.25} />
              </span>
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A phone's shell: the screen above, the tabs below; theme follows the phone on Auto. */
export function PhoneShell({ children, tabs = true }: { children: ReactNode; tabs?: boolean }) {
  // Screens before signing in (no tabs) have no stream to open.
  useLiveUpdates(tabs);
  const { data: settings } = useSettings({ enabled: tabs });
  const now = useMinute();
  const hour = zonedParts(now).hour;
  useEffect(() => {
    if (!settings) return;
    applyAppearance(
      {
        theme: settings.theme,
        daylightTint: settings.daylight_tint,
        textSize: "standard",
        reduceMotion: false,
        display: false,
      },
      hour,
    );
  }, [settings, hour]);
  return (
    <ShellContext.Provider value="phone">
      <MotionProvider reduceMotion={false}>
        <div data-shell="phone" className="min-h-dvh bg-wall text-ink">
          {children}
        </div>
        {tabs ? <TabBar /> : null}
        <OfflinePill />
        <ToastRegion />
        <UpdatePrompt />
      </MotionProvider>
    </ShellContext.Provider>
  );
}
