import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { asParent } from "../../lib/parent";
import { showToast } from "../../lib/toast";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { Group, Row, Text } from "./parts";

function when(iso: string | null): string {
  if (!iso) return "Not yet. The first runs tonight.";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Settings → Backup (UX §4; PLAN §13.7): the nightly copies, a copy on demand, and the household's
 * data to take away. Restoring is a runbook step (docs/RESTORE.md); a Restore button arrives in M5.
 */
export function BackupPage() {
  const display = useShell() === "display";
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
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
        <div className={`flex flex-wrap gap-3 ${display ? "py-5" : "py-4"}`}>
          <Button
            variant="secondary"
            pending={run.isPending}
            onClick={() => {
              run.mutate();
            }}
          >
            Back up now
          </Button>
          {newest && !display ? (
            <a
              href={`/api/admin/backups/${newest.name}`}
              download
              className="press inline-flex min-h-11 items-center rounded-button border-2 border-line bg-surface px-5 text-body font-semibold"
            >
              Download backup
            </a>
          ) : null}
        </div>
      </Group>
      <Group
        title="Take your data with you"
        note="Everything you added, in one file anyone can read."
      >
        <div className={display ? "py-5" : "py-4"}>
          {display ? (
            <Text soft>Export from a phone or computer: More, then Settings, then Backup.</Text>
          ) : (
            <Button
              variant="secondary"
              pending={exporting}
              onClick={() => {
                void exportAll();
              }}
            >
              Export everything
            </Button>
          )}
        </div>
      </Group>
      {(error ?? run.error) ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(error ?? run.error)}
        </p>
      ) : null}
    </>
  );
}
