/** The household's settings, people and the display's layout, as queries every screen shares. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "../api/client";
import { qk } from "../api/keys";
import type { components } from "../api/schema";
import { asParent } from "./parent";

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
