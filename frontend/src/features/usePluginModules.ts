/**
 * The frontend parts of the plugins that are on (PLAN §6.5): the server's list (GET
 * /api/plugins) intersected with the registry, each loaded once, in the registry's order.
 */
import { useQuery } from "@tanstack/react-query";

import { usePlugins } from "../lib/household";
import { plugins as registry, type PluginModule } from "./registry";

export function usePluginModules(): PluginModule[] {
  const { data: listed = [] } = usePlugins();
  const on = Object.keys(registry).filter((id) =>
    listed.some((plugin) => plugin.id === id && plugin.enabled),
  );
  const { data = [] } = useQuery({
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
  return on.length > 0 ? data : [];
}
