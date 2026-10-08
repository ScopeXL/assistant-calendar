import { formatTime } from "../../lib/dates";
import { usePlugins } from "../../lib/household";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { Group, Text } from "../settings/parts";
import { PluginSettingsForm } from "../settings/PluginSettingsForm";
import { usePhotoChanges, useSources, type PhotoSource } from "./data";
import { photosCount } from "./PhotosRoom";

/**
 * Settings → Photos & screensaver (UX §4 "Photos room" Settings): when it starts, how often the
 * photo changes, the clock and what's next, shuffle; and the photos folder on the server, which
 * brings in whatever is put there.
 */
export function SettingsScreensaver() {
  const { data: plugins = [] } = usePlugins();
  const plugin = plugins.find((p) => p.id === "screensaver");
  const { data: sources = [] } = useSources();
  return (
    <>
      {plugin ? (
        <Group title="Screensaver">
          <PluginSettingsForm
            pluginId="screensaver"
            spec={plugin.settings_spec}
            values={plugin.settings}
          />
        </Group>
      ) : null}
      {sources.map((source) => (
        <SourceGroup key={source.id} source={source} />
      ))}
    </>
  );
}

function SourceGroup({ source }: { source: PhotoSource }) {
  const display = useShell() === "display";
  const { scan, setSource } = usePhotoChanges();
  const checked = source.last_scan_at
    ? `Checked at ${formatTime(new Date(source.last_scan_at))}`
    : "Not checked yet";
  return (
    <Group
      title={source.label}
      note={
        source.kind === "inbox"
          ? "Photos put in the photos/inbox folder in Sunroom's data folder on the server are added every 5 minutes, then moved to inbox/imported."
          : undefined
      }
    >
      <Switch
        label={`Bring in photos from ${source.label.toLowerCase()}`}
        checked={source.enabled}
        onChange={(enabled) => {
          setSource.mutate({ id: source.id, enabled });
        }}
      />
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${display ? "py-5" : "py-4"}`}
      >
        <div className="flex flex-col gap-1">
          <Text>{`${photosCount(source.photo_count)} from here · ${checked}`}</Text>
          {source.last_error ? (
            <p
              role="status"
              className={`${display ? "text-d-secondary" : "text-secondary"} font-semibold text-alert`}
            >
              {source.last_error}
            </p>
          ) : null}
        </div>
        <Button
          variant="secondary"
          disabled={!source.enabled}
          pending={scan.isPending}
          onClick={() => {
            scan.mutate(source.id);
          }}
        >
          Check now
        </Button>
      </div>
    </Group>
  );
}
