import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { errorMessage } from "../../api/client";
import { qk } from "../../api/keys";
import { formatTime } from "../../lib/dates";
import { useMembers, type Member } from "../../lib/household";
import { fetchSession } from "../../lib/session";
import { showToast } from "../../lib/toast";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { COLORS } from "../settings/MemberSheet";
import { AddAccountSheet } from "./AddAccount";
import { sourceName, useAccounts, useSyncChanges, type Account, type RemoteCalendar } from "./data";

/** "Updated 9:10 AM", "Syncing…", or the quiet error (UX §8: never an error wall). */
export function statusLine(account: Account): string {
  if (account.syncing) return "Syncing…";
  if (account.status === "paused") return "Paused";
  if (account.status === "needs_reconnect" || account.status === "error") {
    return account.last_error ?? `${sourceName(account)} hasn't answered.`;
  }
  const slow = account.provider === "ics" && sourceName(account) === "Google";
  if (!account.last_success_at) return "Not synced yet";
  const updated = `Updated ${formatTime(new Date(account.last_success_at))}`;
  return slow ? `${updated} · Google updates this slowly` : updated;
}

type GoogleOutcome = "connected" | "denied" | "expired" | "failed";

/** What the app says when Google's sign-in sends the browser back (google_accounts.callback). */
const GOOGLE_WORDS: Record<GoogleOutcome, string> = {
  connected: "Connected Google",
  denied: "Google didn't finish signing in. Try again.",
  expired: "That sign-in took too long. Try again.",
  failed: "Google said no. Try again, or use the secret address.",
};

function isOutcome(value: string): value is GoogleOutcome {
  return Object.hasOwn(GOOGLE_WORDS, value);
}

/** Back from Google's sign-in: `?google=<how it went>`, and `&account=<id>` for a new account. */
function googleReturn(): { outcome: GoogleOutcome; account: string | null } | null {
  try {
    const search = new URLSearchParams(window.location.search);
    const outcome = search.get("google") ?? "";
    if (!isOutcome(outcome)) return null;
    return { outcome, account: outcome === "connected" ? search.get("account") : null };
  } catch {
    return null;
  }
}

/**
 * The accounts part of Settings → Calendars & Accounts (UX §4): each account with its
 * calendars, a person chip and "Show on the kitchen screen" each, its status line, Refresh now,
 * Connect again and Disconnect. Add an account opens the same steps on a phone, a computer or
 * the wall screen (ADR 0028); on the wall, the device's kind (not its size) hands the two Google
 * ways that need a phone to one. Back from Google's sign-in it says how it went, and opens a new
 * account's calendars.
 */
export function AccountsSection() {
  const display = useShell() === "display";
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const kiosk = session?.device_kind === "kiosk";
  const { data: accounts = [] } = useAccounts();
  const { data: members = [] } = useMembers();
  const [adding, setAdding] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("add") === "1";
    } catch {
      return false;
    }
  });
  const [landing] = useState(googleReturn);
  const [returnedId, setReturnedId] = useState(landing?.account ?? null);
  const returned = accounts.find((account) => account.id === returnedId) ?? null;
  useEffect(() => {
    if (!landing) return;
    // Once: the address loses ?google=…, so a reload (or React's second look) says nothing.
    const url = new URL(window.location.href);
    if (!url.searchParams.has("google")) return;
    url.searchParams.delete("google");
    url.searchParams.delete("account");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    showToast(GOOGLE_WORDS[landing.outcome]);
  }, [landing]);
  const title = display ? "text-d-title font-bold" : "text-row font-bold";
  // As Settings' other groups: the page's title is the h2 on the wall, the h1 on a phone.
  const Heading = display ? "h3" : "h2";
  return (
    <section className={display ? "mb-10" : "mb-8"} aria-labelledby="accounts-title">
      <Heading id="accounts-title" className={`${title} ${display ? "mb-3" : "mb-2"}`}>
        Accounts
      </Heading>
      {accounts.length === 0 ? (
        <p
          className={
            display ? "mb-4 text-d-secondary text-ink-soft" : "mb-3 text-secondary text-ink-soft"
          }
        >
          Bring in calendars you already use: Google, iCloud, or any calendar address.
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        {accounts.map((account) => (
          <AccountBlock key={account.id} account={account} members={members} kiosk={kiosk} />
        ))}
      </div>
      <div className={display ? "mt-5" : "mt-4"}>
        <Button
          variant="secondary"
          onClick={() => {
            setAdding(true);
          }}
        >
          Add an account
        </Button>
      </div>
      <AddAccountSheet
        open={adding || returned !== null}
        kiosk={kiosk}
        returned={returned}
        onClose={() => {
          setAdding(false);
          setReturnedId(null);
        }}
      />
    </section>
  );
}

function AccountBlock({
  account,
  members,
  kiosk,
}: {
  account: Account;
  members: Member[];
  kiosk: boolean;
}) {
  const display = useShell() === "display";
  const changes = useSyncChanges();
  const [confirming, setConfirming] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const body = display ? "text-d-body" : "text-body";
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  const broken = account.status === "needs_reconnect";
  return (
    <div
      className={`rounded-chip border border-line bg-surface ${display ? "px-6 py-4" : "px-4 py-3"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col">
          <span className={`${display ? "text-d-body" : "text-body"} font-semibold`}>
            {account.label}
          </span>
          {account.address ? <span className={`${soft} break-all`}>{account.address}</span> : null}
          <span
            className={`${soft} ${broken || account.status === "error" ? "font-semibold text-alert" : ""}`}
          >
            {statusLine(account)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {broken ? (
            <Button
              variant="secondary"
              onClick={() => {
                setReconnecting(true);
              }}
            >
              Connect again
            </Button>
          ) : (
            <Button
              variant="secondary"
              pending={changes.syncNow.isPending && changes.syncNow.variables.id === account.id}
              disabled={account.syncing || broken}
              onClick={() => {
                changes.syncNow.mutate(account);
              }}
            >
              Refresh now
              <span className="sr-only"> {account.label}</span>
            </Button>
          )}
        </div>
      </div>
      {changes.syncNow.isError && changes.syncNow.variables.id === account.id ? (
        <p role="alert" className={`${soft} mt-2`}>
          {errorMessage(changes.syncNow.error)}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col divide-y divide-line">
        {account.calendars.map((calendar) => (
          <CalendarRow
            key={calendar.id}
            account={account}
            calendar={calendar}
            members={members}
            single={account.calendars.length === 1 && account.read_only}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="quiet-danger"
          onClick={() => {
            setConfirming(true);
          }}
        >
          Disconnect
          <span className="sr-only"> {account.label}</span>
        </Button>
      </div>
      <Sheet
        open={confirming}
        title={`Disconnect ${sourceName(account)}?`}
        onClose={() => {
          setConfirming(false);
        }}
      >
        <div className="flex flex-col gap-4">
          <p className={body}>
            Its calendars leave the board, and Sunroom forgets its password. Events stay on{" "}
            {sourceName(account)} itself.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              pending={changes.disconnect.isPending}
              onClick={() => {
                changes.disconnect.mutate(account, {
                  onSuccess: () => {
                    setConfirming(false);
                  },
                });
              }}
            >
              Disconnect {sourceName(account)}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(false);
              }}
            >
              Keep it
            </Button>
          </div>
        </div>
      </Sheet>
      <ReconnectSheet
        account={account}
        kiosk={kiosk}
        open={reconnecting}
        onClose={() => {
          setReconnecting(false);
        }}
      />
    </div>
  );
}

/** One of an account's calendars: on the board or not, whose, and on the wall or not. */
export function CalendarRow({
  account,
  calendar,
  members,
  single = false,
}: {
  account: Account;
  calendar: RemoteCalendar;
  members: Member[];
  single?: boolean;
}) {
  const display = useShell() === "display";
  const changes = useSyncChanges();
  const owner = members.find((m) => m.id === calendar.owner_member_id) ?? null;
  const map = (body: Parameters<typeof changes.map.mutate>[0]["body"]) => {
    changes.map.mutate({ account: account.id, calendar: calendar.id, body });
  };
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  return (
    <div className={`flex flex-col gap-2 ${display ? "py-3" : "py-2"}`}>
      {single ? null : (
        <Switch
          label={calendar.name}
          hint={calendar.read_only ? "Shows events only" : undefined}
          checked={calendar.mapped}
          onChange={(mapped) => {
            map({
              mapped,
              owner_member_id: mapped ? (calendar.suggested_owner_id ?? null) : null,
            });
          }}
        />
      )}
      {calendar.last_error ? <p className={soft}>{calendar.last_error}</p> : null}
      {calendar.mapped ? (
        <>
          <ChipRow label={`Whose is ${calendar.name}`}>
            <Chip
              on={owner === null}
              onClick={() => {
                map({ clear_owner: true });
              }}
            >
              <Avatar member={null} size="xs" />
              Everyone
            </Chip>
            {members.map((member) => (
              <Chip
                key={member.id}
                on={owner?.id === member.id}
                onClick={() => {
                  map({ owner_member_id: member.id });
                }}
              >
                <Avatar member={member} size="xs" />
                {member.name}
              </Chip>
            ))}
          </ChipRow>
          {owner === null ? (
            <ChipRow label={`Color of ${calendar.name}`}>
              {COLORS.map((option) => {
                const taken = members.find((m) => m.color === option.value);
                return (
                  <Chip
                    key={option.value}
                    on={calendar.color === option.value}
                    onClick={() => {
                      map({ color: option.value });
                    }}
                  >
                    <span data-person={option.value} className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className="size-4 rounded-full bg-p" />
                      {option.word}
                      {taken ? <span className="font-normal">· used by {taken.name}</span> : null}
                    </span>
                  </Chip>
                );
              })}
            </ChipRow>
          ) : null}
          <Switch
            label="Show on the kitchen screen"
            checked={calendar.visible_on_display}
            onChange={(visible) => {
              map({ visible_on_display: visible });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** A new password or address for an account that stopped working; on the wall screen it's
 * typed on the screen's own keyboard, and Apple's page is opened on a phone or computer. */
function ReconnectSheet({
  account,
  kiosk,
  open,
  onClose,
}: {
  account: Account;
  kiosk: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const display = useShell() === "display";
  const changes = useSyncChanges();
  const [value, setValue] = useState("");
  const feed = account.provider === "ics";
  return (
    <Sheet open={open} title={`Connect ${sourceName(account)} Again`} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.trim()) return;
          changes.reconnect.mutate(
            feed ? { account, url: value.trim() } : { account, password: value.trim() },
            {
              onSuccess: () => {
                setValue("");
                onClose();
              },
            },
          );
        }}
      >
        <p className={display ? "text-d-body" : "text-body"}>
          {feed
            ? `${kiosk ? "Type" : "Paste"} the calendar's new address.`
            : sourceName(account) === "iCloud"
              ? kiosk
                ? "On a phone or computer, make a new app-specific password at appleid.apple.com, then type it here."
                : "Make a new app-specific password at appleid.apple.com and paste it here."
              : "Type the account's password again."}
        </p>
        <TextField
          label={feed ? "Calendar address" : "Password"}
          type={feed ? "url" : "password"}
          layout={feed ? "text" : "password"}
          autoCapitalize="none"
          autoComplete="off"
          value={value}
          error={changes.reconnect.isError ? errorMessage(changes.reconnect.error) : null}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
        <Button type="submit" pending={changes.reconnect.isPending} disabled={!value.trim()}>
          Connect
        </Button>
      </form>
    </Sheet>
  );
}
