import { useNavigate } from "@tanstack/react-router";
import { CloudOff } from "lucide-react";

import { formatTime } from "../../lib/dates";
import { useShell } from "../../ui/shell";
import { sourceName, useAccounts, type Account } from "./data";

/** What the pill says for an account that needs attention (UX §8 "Quiet states"). */
export function pillText(account: Account): string {
  const name = sourceName(account);
  if (account.status === "needs_reconnect") {
    return account.provider === "google"
      ? "Google signed Sunroom out."
      : `${name} needs its password again.`;
  }
  const since = account.last_success_at
    ? ` since ${formatTime(new Date(account.last_success_at))}`
    : "";
  return `${name} hasn't answered${since}. Showing what we had.`;
}

/**
 * The board header's quiet pill when a synced account has stopped answering (UX §8): one line,
 * never an error wall, the calendar's events stay. Tapping it opens Calendars & accounts.
 */
export function SyncPill() {
  const display = useShell() === "display";
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const troubled = accounts.find(
    (account) => account.status === "error" || account.status === "needs_reconnect",
  );
  if (!troubled) return null;
  return (
    <button
      type="button"
      onClick={() => {
        void navigate({ to: "/settings/$page", params: { page: "calendars" } });
      }}
      className={`press inline-flex items-center gap-2 rounded-full border-2 border-line bg-surface font-semibold text-ink-soft ${
        display ? "min-h-14 px-5 text-d-secondary" : "min-h-11 px-4 text-secondary"
      }`}
    >
      <CloudOff aria-hidden="true" className={display ? "size-6" : "size-5"} />
      {pillText(troubled)}
    </button>
  );
}
