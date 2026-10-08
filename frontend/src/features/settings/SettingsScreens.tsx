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
import { usePluginModulesState } from "../usePluginModules";
import { SETTINGS_PAGES, type SettingsPageKey } from "./pages";

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

interface Page {
  key: string;
  title: string;
  render: () => ReactNode;
}

/** Core's pages, with the enabled plugins' own (Chores) after Calendars & accounts. */
function usePages(): { pages: Page[]; ready: boolean } {
  const { modules, ready } = usePluginModulesState();
  const core: Page[] = SETTINGS_PAGES.map((page) => ({ ...page, render: PAGES[page.key] }));
  const plugins: Page[] = modules.flatMap((module) =>
    (module.settingsPages ?? []).map(({ key, title, Page }) => ({
      key,
      title,
      render: () => <Page />,
    })),
  );
  const at = core.findIndex((page) => page.key === "calendars") + 1;
  return { pages: [...core.slice(0, at), ...plugins, ...core.slice(at)], ready };
}

/** Settings on a phone: the list of pages (UX §5). */
export function SettingsIndex() {
  const { pages } = usePages();
  return (
    <Screen title="Settings" back="/more">
      <ul className="divide-y divide-line rounded-chip border border-line bg-surface">
        {pages.map((page) => (
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
  const { pages, ready } = usePages();
  // A plugin's page waits for its plugin to load; an unknown one shows Family.
  const current = pages.find((p) => p.key === page) ?? (ready ? pages[0] : undefined);
  if (!current) return null;
  if (!display) {
    return (
      <Screen title={current.title} back="/settings">
        {current.render()}
      </Screen>
    );
  }
  return <DisplaySettings current={current} pages={pages} />;
}

function DisplaySettings({ current, pages }: { current: Page; pages: Page[] }) {
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
          {pages.map((page) => (
            <li key={page.key}>
              <Link
                to="/settings/$page"
                params={{ page: page.key }}
                aria-current={page.key === current.key ? "page" : undefined}
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
            {current.title}
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
        <div className="max-w-4xl">{current.render()}</div>
      </section>
    </div>
  );
}
