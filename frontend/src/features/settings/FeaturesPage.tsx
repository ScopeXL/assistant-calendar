import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { usePlugins } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { Button } from "../../ui/Button";
import { Switch } from "../../ui/Switch";
import { Group, Text } from "./parts";
import { PluginSettingsForm } from "./PluginSettingsForm";

/**
 * Settings → Features (UX §4): one switch per plugin with a line on what it adds; turning one off
 * hides its rooms and panels at once and keeps its data. A stopped plugin says so, with Retry.
 */
export function FeaturesPage() {
  const { data: plugins = [] } = usePlugins();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      asParent(async () =>
        on
          ? unwrap(
              await api.POST("/api/plugins/{plugin_id}/enable", {
                params: { path: { plugin_id: id } },
              }),
            )
          : unwrap(
              await api.POST("/api/plugins/{plugin_id}/disable", {
                params: { path: { plugin_id: id } },
              }),
            ),
      ),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.plugins() });
    },
  });
  const retry = useMutation({
    mutationFn: (id: string) =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/plugins/{plugin_id}/restart", {
            params: { path: { plugin_id: id } },
          }),
        ),
      ),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.plugins() });
    },
  });

  if (plugins.length === 0) {
    return (
      <Group title="In This Version">
        <div className="py-5">
          <Text>
            This version has the family calendar. Synced calendars, lists, chores, meals,
            countdowns, photos and weather each arrive as a feature you can turn on here.
          </Text>
        </div>
      </Group>
    );
  }
  return (
    <>
      {plugins.map((plugin) => (
        <Group key={plugin.id} title={plugin.name}>
          <Switch
            label={plugin.enabled ? "On" : "Off"}
            hint={plugin.description}
            checked={plugin.enabled}
            disabled={toggle.isPending}
            onChange={(on) => {
              toggle.mutate({ id: plugin.id, on });
            }}
          />
          {plugin.status === "errored" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <Text>{`${plugin.name} stopped working.`}</Text>
              <Button
                variant="secondary"
                pending={retry.isPending}
                onClick={() => {
                  retry.mutate(plugin.id);
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {plugin.enabled && plugin.settings_spec.length > 0 ? (
            <PluginSettingsForm
              pluginId={plugin.id}
              spec={plugin.settings_spec}
              values={plugin.settings}
            />
          ) : null}
          {toggle.isError ? (
            <p role="alert" className="py-3 font-semibold text-alert">
              {errorMessage(toggle.error)}
            </p>
          ) : null}
        </Group>
      ))}
    </>
  );
}
