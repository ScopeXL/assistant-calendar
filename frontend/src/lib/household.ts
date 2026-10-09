/** The household's settings, people and the display's layout, as queries every screen shares. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";

import { api, unwrap } from "../api/client";
import { qk } from "../api/keys";
import type { components } from "../api/schema";
import { setDatePreferences } from "./dates";
import { asParent } from "./parent";
import { refreshMinute } from "./time";

export type HouseholdSettings = components["schemas"]["SettingsOut"];
export type SettingsChange = components["schemas"]["SettingsUpdate"];
export type Member = components["schemas"]["MemberOut"];

export function useSettings({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: async () => unwrap(await api.GET("/api/settings")),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Every date and time on screen in the household's zone and its 12- or 24-hour choice
 * (Settings → Household), never the device's (PLAN §7.2). Each shell mounts it once. When the
 * zone changes while a screen is open everything is fetched again, because the server writes
 * local times in the household's zone.
 */
export function useDatePreferences({ enabled = true }: { enabled?: boolean } = {}): void {
  const { data: settings } = useSettings({ enabled });
  const queryClient = useQueryClient();
  const timezone = settings?.timezone;
  const timeFormat = settings?.time_format;
  const shownZone = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!timezone || !timeFormat) return;
    setDatePreferences({ timezone, timeFormat });
    refreshMinute();
    if (shownZone.current !== null && shownZone.current !== timezone) {
      void queryClient.invalidateQueries();
    }
    shownZone.current = timezone;
  }, [timezone, timeFormat, queryClient]);
}

/** Change household settings (parent-only; the wall screen asks for the PIN first). */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: SettingsChange) =>
      asParent(async () => unwrap(await api.PATCH("/api/settings", { body: change }))),
    onSuccess: (settings) => {
      queryClient.setQueryData(qk.settings(), settings);
    },
  });
}

export function useMembers(archived = false) {
  return useQuery({
    queryKey: qk.members(archived),
    queryFn: async () => unwrap(await api.GET("/api/members", { params: { query: { archived } } })),
    staleTime: 30_000,
  });
}

export function usePlugins() {
  return useQuery({
    queryKey: qk.plugins(),
    queryFn: async () => unwrap(await api.GET("/api/plugins")),
    staleTime: 60_000,
  });
}
