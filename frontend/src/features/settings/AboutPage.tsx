import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { liveStatus } from "../../lib/events";
import { asParent } from "../../lib/parent";
import { useStore } from "../../lib/store";
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
