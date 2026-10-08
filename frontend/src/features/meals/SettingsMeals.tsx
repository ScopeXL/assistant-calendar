import { usePlugins } from "../../lib/household";
import { Group } from "../settings/parts";
import { PluginSettingsForm } from "../settings/PluginSettingsForm";

/** Settings → Meals (UX §3): which meals the family plans, and dinner on the calendar. */
export function SettingsMeals() {
  const { data: plugins = [] } = usePlugins();
  const plugin = plugins.find((p) => p.id === "meals");
  if (!plugin) return null;
  return (
    <Group title="Meals">
      <PluginSettingsForm pluginId="meals" spec={plugin.settings_spec} values={plugin.settings} />
    </Group>
  );
}
