import { useState } from "react";

import { errorMessage } from "../../api/client";
import { formatTime } from "../../lib/dates";
import { useMembers, type Member } from "../../lib/household";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { QrCode } from "../../ui/QrCode";
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

/**
 * The accounts part of Settings → Calendars & accounts (UX §4): each account with its
 * calendars, a person chip and "Show on the kitchen screen" each, its status line, Refresh
 * now, and (on a phone) Disconnect. Add an account opens the flows on a phone, or a code to
 * scan on the wall screen, where passwords aren't typed.
 */
export function AccountsSection() {
  const display = useShell() === "display";
  const { data: accounts = [] } = useAccounts();
  const { data: members = [] } = useMembers();
  const [adding, setAdding] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("add") === "1";
    } catch {
      return false;
    }
  });
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
          <AccountBlock key={account.id} account={account} members={members} />
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
      {display ? (
        <ConnectOnPhone
          open={adding}
          onClose={() => {
            setAdding(false);
          }}
        />
      ) : (
        <AddAccountSheet
          open={adding}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </section>
  );
}

function AccountBlock({ account, members }: { account: Account; members: Member[] }) {
  const display = useShell() === "display";
  const changes = useSyncChanges();
  const [confirming, setConfirming] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
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
          {broken && !display ? (
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
      {display ? null : (
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
      )}
      <Sheet
        open={confirming}
        title={`Disconnect ${sourceName(account)}?`}
        onClose={() => {
          setConfirming(false);
        }}
      >
        <div className="flex flex-col gap-4">
          <p className="text-body">
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

function ConnectOnPhone({ open, onClose }: { open: boolean; onClose: () => void }) {
  const address = (() => {
    try {
      return `${window.location.origin}/settings/calendars?add=1`;
    } catch {
      return "/settings/calendars?add=1";
    }
  })();
  return (
    <Sheet open={open} title="Add an account" onClose={onClose}>
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-d-body">
          Connect accounts on a phone: it needs a password you shouldn't type here.
        </p>
        <QrCode value={address} label="Open Calendars & accounts on a phone" />
        <p className="text-d-secondary text-ink-soft">
          Scan this with a parent's phone, or open Settings → Calendars & accounts there.
        </p>
      </div>
    </Sheet>
  );
}

function ReconnectSheet({
  account,
  open,
  onClose,
}: {
  account: Account;
  open: boolean;
  onClose: () => void;
}) {
  const changes = useSyncChanges();
  const [value, setValue] = useState("");
  const feed = account.provider === "ics";
  return (
    <Sheet open={open} title={`Connect ${sourceName(account)} again`} onClose={onClose}>
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
        <p className="text-body">
          {feed
            ? "Paste the calendar's new address."
            : sourceName(account) === "iCloud"
              ? "Make a new app-specific password at appleid.apple.com and paste it here."
              : "Type the account's password again."}
        </p>
        <TextField
          label={feed ? "Calendar address" : "Password"}
          type={feed ? "url" : "password"}
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
