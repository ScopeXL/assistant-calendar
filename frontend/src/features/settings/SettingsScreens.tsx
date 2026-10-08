import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Lock } from "lucide-react";
import type { ReactNode } from "react";

import { api } from "../../api/client";
import { qk } from "../../api/keys";
import { fetchSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { useShell } from "../../ui/shell";
import { AboutPage } from "./AboutPage";
import { BackupPage } from "./BackupPage";
import { CalendarsPage } from "./CalendarsPage";
import { DevicesPage } from "./DevicesPage";
import { DisplayPage } from "./DisplayPage";
import { FamilyPage } from "./FamilyPage";
import { FeaturesPage } from "./FeaturesPage";
import { HouseholdPage } from "./HouseholdPage";
import { SETTINGS_PAGES, isSettingsPage, pageTitle, type SettingsPageKey } from "./pages";

const PAGES: Record<SettingsPageKey, () => ReactNode> = {
  family: () => <FamilyPage />,
  features: () => <FeaturesPage />,
  calendars: () => <CalendarsPage />,
  display: () => <DisplayPage />,
  household: () => <HouseholdPage />,
  devices: () => <DevicesPage />,
  backup: () => <BackupPage />,
  about: () => <AboutPage />,
};

/** Settings on a phone: the list of pages (UX §5). */
export function SettingsIndex() {
  return (
    <Screen title="Settings" back="/more">
      <ul className="divide-y divide-line rounded-chip border border-line bg-surface">
        {SETTINGS_PAGES.map((page) => (
          <li key={page.key}>
            <Link
              to="/settings/$page"
              params={{ page: page.key }}
              className="press-row flex min-h-14 items-center justify-between px-4 text-row font-semibold"
            >
              {page.title}
              <ChevronRight aria-hidden="true" className="text-ink-soft" />
            </Link>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/** One Settings page: full screen with Back on a phone, list and detail on the wall screen. */
export function SettingsPageScreen({ page }: { page: string }) {
  const display = useShell() === "display";
  const key: SettingsPageKey = isSettingsPage(page) ? page : "family";
  if (!display) {
    return (
      <Screen title={pageTitle(key)} back="/settings">
        {PAGES[key]()}
      </Screen>
    );
  }
  return <DisplaySettings current={key} />;
}

function DisplaySettings({ current }: { current: SettingsPageKey }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const lock = useMutation({
    mutationFn: async () => {
      await api.POST("/api/auth/pin/lock");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.session() });
      await navigate({ to: session?.device_kind === "kiosk" ? "/display" : "/" });
    },
  });
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label="Settings"
        className="w-80 shrink-0 overflow-y-auto border-r border-line py-4"
      >
        <h1 className="px-7 pb-4 text-d-title font-bold">Settings</h1>
        {/* Inset from the rail: neighbouring targets keep 8 px apart (UX §1). */}
        <ul className="flex flex-col gap-1 px-3">
          {SETTINGS_PAGES.map((page) => (
            <li key={page.key}>
              <Link
                to="/settings/$page"
                params={{ page: page.key }}
                aria-current={page.key === current ? "page" : undefined}
                className="press-row flex min-h-16 items-center rounded-button-d px-4 text-d-body font-semibold text-ink-soft aria-[current=page]:bg-surface aria-[current=page]:text-ink"
              >
                {page.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Focusable, so a keyboard can scroll a long page with nothing in it to focus. */}
      <section
        aria-labelledby="settings-page"
        tabIndex={0}
        className="min-w-0 flex-1 overflow-y-auto px-10 py-8"
      >
        <header className="mb-8 flex items-center justify-between gap-4">
          <h2 id="settings-page" className="text-d-title font-bold">
            {pageTitle(current)}
          </h2>
          {session?.grant_expires_at ? (
            <Button
              variant="secondary"
              onClick={() => {
                lock.mutate();
              }}
            >
              <Lock aria-hidden="true" className="size-7" />
              Lock
            </Button>
          ) : null}
        </header>
        <div className="max-w-4xl">{PAGES[current]()}</div>
      </section>
    </div>
  );
}
