/**
 * The frontend parts of the plugins that are on (PLAN §6.5): the server's list (GET
 * /api/plugins) intersected with the registry, each loaded once, in the registry's order, and
 * what they add to the shell, sorted.
 */
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";

import { usePlugins } from "../lib/household";
import {
  plugins as registry,
  type AddType,
  type PluginModule,
  type PluginRoom,
  type SettingsPage,
  type TodayBlock,
} from "./registry";

/** The modules, and whether they're known yet (the list fetched and the modules loaded). */
export function usePluginModulesState(): { modules: PluginModule[]; ready: boolean } {
  const { data: listed, isSuccess: listedReady } = usePlugins();
  const on = Object.keys(registry).filter((id) =>
    (listed ?? []).some((plugin) => plugin.id === id && plugin.enabled),
  );
  const { data = [], isSuccess } = useQuery({
    queryKey: ["plugin-modules", on],
    queryFn: async () =>
      Promise.all(
        on.map(async (id) => {
          const load = registry[id];
          if (!load) throw new Error(`no frontend for ${id}`);
          return (await load()).default;
        }),
      ),
    staleTime: Infinity,
    enabled: on.length > 0,
  });
  if (on.length === 0) return { modules: [], ready: listedReady };
  return { modules: isSuccess ? data : [], ready: listedReady && isSuccess };
}

export function usePluginModules(): PluginModule[] {
  return usePluginModulesState().modules;
}

const byOrder = <T extends { order: number }>(items: T[]) =>
  [...items].sort((a, b) => a.order - b.order);

/** Rooms on the rail and tabs on phones, in their order (UX §3). */
export function usePluginRooms(): PluginRoom[] {
  return byOrder(usePluginModules().flatMap((module) => module.rooms ?? []));
}

export function useTodayBlocks(): TodayBlock[] {
  return byOrder(usePluginModules().flatMap((module) => module.today ?? []));
}

export function useAddTypes(): AddType[] {
  return byOrder(usePluginModules().flatMap((module) => module.add ?? []));
}

export function useSettingsPages(): SettingsPage[] {
  return usePluginModules().flatMap((module) => module.settingsPages ?? []);
}

export function usePersonColumns(): ComponentType<{ memberId: string | null; day: string }>[] {
  return usePluginModules().flatMap((module) => (module.personColumn ? [module.personColumn] : []));
}

export function useRemovedGroups(): {
  id: string;
  Rows: ComponentType<{ onCount: (count: number) => void }>;
}[] {
  return usePluginModules().flatMap((module) =>
    module.removed ? [{ id: module.id, Rows: module.removed }] : [],
  );
}
