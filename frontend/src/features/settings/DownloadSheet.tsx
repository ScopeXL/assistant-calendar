import { useState } from "react";

import { Button, ButtonLink } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";

/** What Download offers (UX §4 Backup, ADR 0034): the server makes each copy fresh, now. */
const CHOICES = [
  {
    label: "Data Only",
    href: "/api/admin/backups/data.db",
    detail:
      "A checked copy of the data made now: people, calendars, events, lists, tasks, meals, countdowns and settings. A few MB.",
  },
  {
    label: "Data & Photos",
    href: "/api/admin/backups/full.zip",
    detail: "Everything, photos included: this can take a while and be large.",
  },
] as const;

/**
 * "Download Which?" (the shape of "Change Which?"): Data Only or Data & Photos. Each is a plain
 * link, so the browser saves the file itself, however big it is; after a tap the sheet says the
 * download started and offers Close.
 */
export function DownloadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const display = useShell() === "display";
  const [started, setStarted] = useState(false);
  // Opened again, it asks again.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStarted(false);
  }
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  return (
    <Sheet open={open} title="Download Which?" onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        {CHOICES.map((choice) => (
          <div key={choice.href} className="flex flex-col gap-2">
            <ButtonLink
              block
              variant="secondary"
              href={choice.href}
              download
              onClick={() => {
                setStarted(true);
              }}
            >
              {choice.label}
            </ButtonLink>
            <p className={soft}>{choice.detail}</p>
          </div>
        ))}
        {started ? (
          <>
            <p role="status" className={display ? "text-d-body" : "text-body"}>
              The download has started. It's saved when your browser says so.
            </p>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
