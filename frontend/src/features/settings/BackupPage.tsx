import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { formatTime, shortDate, zonedParts } from "../../lib/dates";
import { asParent } from "../../lib/parent";
import { fetchSession } from "../../lib/session";
import { showToast } from "../../lib/toast";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { EraseSheet } from "./EraseSheet";
import { Group, Row, Text } from "./parts";

/** "Wed, Oct 7, 3:00 AM", in the household's zone and clock (not the device's). */
function when(iso: string | null): string {
  if (!iso) return "Not yet. The first runs tonight.";
  const moment = new Date(iso);
  return `${shortDate(zonedParts(moment).day)}, ${formatTime(moment)}`;
}

/** The downloads are plain links: the browser saves the file itself, however big it is. */
const DOWNLOAD_LINK =
  "press inline-flex items-center border-2 border-line bg-surface font-semibold";

/**
 * Settings → Backup (UX §4; PLAN §13.7): the nightly copies, a copy on demand, the newest copy or
 * everything (photos too) to download, the household's data to take away, and Start Over.
 * Restoring is a runbook step with the server stopped (docs/RESTORE.md). What saves a file, and
 * Erase everything, go by what the device is, not its size: a laptop has them, the kitchen
 * screen (which has no files, and which a child can reach) doesn't.
 */
export function BackupPage() {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const kiosk = session?.device_kind === "kiosk";
  // Until the session is known, neither the downloads nor the wall's line shows.
  const own = session !== undefined && !kiosk;
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const link = `${DOWNLOAD_LINK} ${
    display
      ? "min-h-tap rounded-button-d px-7 text-d-body"
      : "min-h-11 rounded-button px-5 text-body"
  }`;
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  const { data: status, error } = useQuery({
    queryKey: qk.backups(),
    queryFn: () => asParent(async () => unwrap(await api.GET("/api/admin/backups"))),
  });
  const run = useMutation({
    mutationFn: () => asParent(async () => unwrap(await api.POST("/api/admin/backups/run"))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.backups() });
      showToast("Backed up");
    },
  });

  const exportAll = async () => {
    setExporting(true);
    try {
      const data = await asParent(async () => unwrap(await api.GET("/api/export")));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `sunroom-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setExporting(false);
    }
  };

  const newest = status?.files[0];
  return (
    <>
      <Group
        title="Backups"
        note="A checked copy of everything is made every night and kept on the server: 14 daily and 8 weekly."
      >
        <Row
          label="Last backup"
          hint={status?.last_error ? `The last try failed: ${status.last_error}` : undefined}
        >
          <Text>{when(status?.last_success_at ?? null)}</Text>
        </Row>
        {status?.stale ? (
          <div className="py-4">
            <Text>The newest backup is over a week old. Try Back up now, and check the log.</Text>
          </div>
        ) : null}
        <div className={display ? "py-5" : "py-4"}>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              pending={run.isPending}
              onClick={() => {
                run.mutate();
              }}
            >
              Back up now
            </Button>
            {newest && own ? (
              <a href={`/api/admin/backups/${newest.name}`} download className={link}>
                Download backup
              </a>
            ) : null}
            {status && own ? (
              <a href="/api/admin/backups/full.zip" download className={link}>
                Download everything
              </a>
            ) : null}
          </div>
          {kiosk ? (
            <p className={`mt-4 ${soft}`}>
              Download a backup from a phone or computer: More, then Settings, then Backup.
            </p>
          ) : status && own ? (
            <p className={`mt-3 ${soft}`}>
              Everything, photos included: this can take a while and be large.
            </p>
          ) : null}
        </div>
      </Group>
      <Group
        title="Take Your Data with You"
        note="Everything you added, in one file anyone can read."
      >
        <div className={display ? "py-5" : "py-4"}>
          {kiosk ? (
            <Text soft>Export from a phone or computer: More, then Settings, then Backup.</Text>
          ) : own ? (
            <Button
              variant="secondary"
              pending={exporting}
              onClick={() => {
                void exportAll();
              }}
            >
              Export everything
            </Button>
          ) : null}
        </div>
      </Group>
      {own ? (
        <Group
          title="Start Over"
          note="Erase everything Sunroom knows and set it up again from the start. Only from a phone or computer."
        >
          <div className={display ? "py-5" : "py-4"}>
            <Button
              variant="quiet-danger"
              onClick={() => {
                setErasing(true);
              }}
            >
              Erase everything…
            </Button>
          </div>
        </Group>
      ) : null}
      <EraseSheet
        open={erasing}
        onClose={() => {
          setErasing(false);
        }}
      />
      {(error ?? run.error) ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error ?? run.error)}
        </p>
      ) : null}
    </>
  );
}
