import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { formatTime } from "../../lib/dates";
import { liveStatus } from "../../lib/events";
import { useSettings, useUpdateSettings } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { useStore } from "../../lib/store";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { Group, Row, Text } from "./parts";

const LIVE: Record<string, string> = {
  live: "connected",
  connecting: "connecting",
  polling: "checking every 30 seconds",
  offline: "offline",
  "signed-out": "signed out",
};

function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** Settings → About (UX §4): version, storage, how this device reaches Sunroom, and the rest. */
export function AboutPage() {
  const live = useStore(liveStatus);
  const { data: diagnostics } = useQuery({
    queryKey: qk.diagnostics(),
    queryFn: () => asParent(async () => unwrap(await api.GET("/api/admin/diagnostics"))),
  });
  return (
    <>
      <Group title="Sunroom">
        <Row label="Version">
          <Text>
            {diagnostics
              ? `${diagnostics.version} (${diagnostics.revision.slice(0, 7)})`
              : __APP_VERSION__}
          </Text>
        </Row>
        <Row label="Time zone">
          <Text>{diagnostics?.timezone.replaceAll("_", " ") ?? ""}</Text>
        </Row>
      </Group>
      {diagnostics ? (
        <Group title="Storage">
          <Row label="Free on the server">
            <Text>{`${gigabytes(diagnostics.storage.free_bytes)} of ${gigabytes(diagnostics.storage.total_bytes)}`}</Text>
          </Row>
        </Group>
      ) : null}
      <Group title="Connection">
        <Row label="Live updates">
          <Text>{LIVE[live] ?? live}</Text>
        </Row>
        {diagnostics ? (
          <>
            <Row
              label="This device uses"
              hint={
                diagnostics.client.scheme === "http" &&
                diagnostics.client.x_forwarded_proto === "https"
                  ? "Your proxy says https, but Sunroom doesn't trust it yet: set TRUSTED_PROXIES."
                  : undefined
              }
            >
              <Text>{`${diagnostics.client.scheme}://${diagnostics.client.host}`}</Text>
            </Row>
            {diagnostics.client.resolved_ip ? (
              <Row
                label="Sunroom sees it as"
                hint="Behind a reverse proxy, this is the phone's own address once TRUSTED_PROXIES is right."
              >
                <Text>{diagnostics.client.resolved_ip}</Text>
              </Row>
            ) : null}
            <Row
              label="Recently reached at"
              hint="Any of these works from a phone on the same network."
            >
              <Text>{diagnostics.recent_addresses.join(", ")}</Text>
            </Row>
          </>
        ) : null}
      </Group>
      <UpdatesGroup />
      <Group title="The small print">
        <div className="flex flex-col gap-2 py-4">
          <Text>Sunroom is open source, under the MIT licence.</Text>
          <Text soft>Not affiliated with Google or Apple.</Text>
          <Text soft>
            Your data stays on your server. No analytics, no ads, no outside scripts.
          </Text>
        </div>
      </Group>
    </>
  );
}

/** New versions (PLAN §13.6): off until a parent turns it on, because it asks GitHub. */
function UpdatesGroup() {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { data: status } = useQuery({
    queryKey: qk.update(),
    queryFn: async () => unwrap(await api.GET("/api/admin/update")),
  });
  const check = useMutation({
    mutationFn: async () => asParent(async () => unwrap(await api.POST("/api/admin/update/check"))),
    onSuccess: (fresh) => {
      queryClient.setQueryData(qk.update(), fresh);
    },
  });
  if (!settings || !status) return null;
  const line = status.available
    ? `Sunroom ${status.latest ?? ""} is available. ${status.how}.`
    : (status.problem ??
      (status.checked_at
        ? `This is the newest version (checked at ${formatTime(new Date(status.checked_at))}).`
        : null));
  return (
    <Group
      title="New versions"
      note={
        status.locked
          ? "This server keeps update checks off."
          : "Once a day Sunroom asks GitHub for the newest version. GitHub sees your server's address."
      }
    >
      <Switch
        label="Check for new versions daily"
        checked={settings.update_check}
        disabled={status.locked}
        onChange={(value) => {
          update.mutate(
            { update_check: value },
            {
              onSuccess: () => {
                void queryClient.invalidateQueries({ queryKey: qk.update() });
              },
            },
          );
        }}
      />
      {status.enabled ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 ${display ? "py-5" : "py-4"}`}
        >
          <div className="flex flex-col gap-1">
            {line ? (
              status.available ? (
                <p
                  role="status"
                  className={`bg-sun/25 font-semibold ${display ? "rounded-button-d px-5 py-3 text-d-body" : "rounded-button px-4 py-3 text-body"}`}
                >
                  {line}
                </p>
              ) : (
                <Text soft>{line}</Text>
              )
            ) : null}
            {check.isError ? <Text soft>{errorMessage(check.error)}</Text> : null}
          </div>
          <Button
            variant="secondary"
            pending={check.isPending}
            onClick={() => {
              check.mutate();
            }}
          >
            Check now
          </Button>
        </div>
      ) : null}
    </Group>
  );
}
