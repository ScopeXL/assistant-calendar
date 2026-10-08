import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { useMembers, type Member } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { showToast } from "../../lib/toast";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { Select } from "../../ui/Select";
import { Sheet } from "../../ui/Sheet";
import { Switch } from "../../ui/Switch";
import { TextField } from "../../ui/TextField";
import { sourceName, useHolidayPlaces, useSyncChanges, type Account } from "./data";

type Step =
  | "choose"
  | "google"
  | "google-address"
  | "google-helper"
  | "google-signin"
  | "icloud"
  | "server"
  | "address"
  | "holidays"
  | "pick";

const TITLES: Record<Step, string> = {
  choose: "Add an account",
  google: "Google",
  "google-address": "Google: the secret address",
  "google-helper": "Google: share with a helper",
  "google-signin": "Sign in with Google",
  icloud: "iCloud",
  server: "A calendar server",
  address: "Another calendar",
  holidays: "Holidays",
  pick: "Pick calendars",
};

/**
 * Add an account on a phone (UX §6): Google (three ways), iCloud, a calendar server, any
 * calendar address, or holidays. Each flow ends on the account's calendars, with a switch and a
 * person each, then Done.
 */
export function AddAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [account, setAccount] = useState<Account | null>(null);
  const close = () => {
    setStep("choose");
    setAccount(null);
    onClose();
  };
  const picked = (next: Account) => {
    setAccount(next);
    setStep("pick");
  };
  return (
    <Sheet open={open} title={TITLES[step]} onClose={close} step={step}>
      {step === "choose" ? (
        <Choices
          options={[
            { step: "google", label: "Google", line: "Google Calendar, three ways to connect." },
            { step: "icloud", label: "iCloud", line: "Your iPhone's calendars, both ways." },
            {
              step: "address",
              label: "Another calendar",
              line: "Any calendar address (.ics): school, team, Outlook.",
            },
            { step: "holidays", label: "Holidays", line: "Public holidays, no address needed." },
            {
              step: "server",
              label: "A calendar server",
              line: "Nextcloud, Fastmail and others, with a user name and password.",
            },
          ]}
          onPick={setStep}
        />
      ) : step === "google" ? (
        <Choices
          options={[
            {
              step: "google-address",
              label: "Paste the secret address",
              line: "Easiest. Shows events only; you can't add from Sunroom. Google updates it slowly (sometimes hours).",
            },
            {
              step: "google-helper",
              label: "Share with a Sunroom helper",
              line: "About 10 minutes, once. Lets you add and change events from Sunroom.",
            },
            {
              step: "google-signin",
              label: "Sign in with Google",
              line: "Needs Sunroom at an https:// address on the internet and your own Google app keys.",
            },
          ]}
          onPick={setStep}
        />
      ) : step === "google-address" ? (
        <AddressFlow google onDone={close} />
      ) : step === "address" ? (
        <AddressFlow onDone={close} />
      ) : step === "holidays" ? (
        <HolidaysFlow onDone={close} />
      ) : step === "icloud" ? (
        <ServerFlow icloud onConnected={picked} />
      ) : step === "server" ? (
        <ServerFlow onConnected={picked} />
      ) : step === "google-helper" ? (
        <HelperFlow onFound={picked} />
      ) : step === "google-signin" ? (
        <SignInFlow />
      ) : account ? (
        <PickCalendars account={account} onDone={close} />
      ) : null}
    </Sheet>
  );
}

function Choices({
  options,
  onPick,
}: {
  options: { step: Step; label: string; line: string }[];
  onPick: (step: Step) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {options.map((option) => (
        <li key={option.step}>
          <button
            type="button"
            onClick={() => {
              onPick(option.step);
            }}
            className="press-row flex min-h-16 w-full flex-col items-start justify-center rounded-button border-2 border-line bg-surface px-4 py-3 text-left"
          >
            <span className="text-body font-semibold">{option.label}</span>
            <span className="text-secondary text-ink-soft">{option.line}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-2 pl-5 text-body">{children}</ol>;
}

function Who({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body font-semibold">Whose calendar</p>
      <ChipRow label="Whose calendar">
        <Chip
          on={value === null}
          onClick={() => {
            onChange(null);
          }}
        >
          <Avatar member={null} size="xs" />
          Everyone
        </Chip>
        {members.map((member) => (
          <Chip
            key={member.id}
            on={value === member.id}
            onClick={() => {
              onChange(member.id);
            }}
          >
            <Avatar member={member} size="xs" />
            {member.name}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

const INTERVALS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 360, label: "6 hours" },
];

/** Paste a calendar address: Google's secret address, or any .ics link. */
function AddressFlow({ google = false, onDone }: { google?: boolean; onDone: () => void }) {
  const { data: members = [] } = useMembers();
  const { addIcs } = useSyncChanges();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [home, setHome] = useState(false);
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!url.trim()) return;
        addIcs.mutate(
          {
            url: url.trim(),
            label: name.trim() || null,
            owner_member_id: owner,
            interval_min: minutes,
            allow_private: home,
          },
          { onSuccess: onDone },
        );
      }}
    >
      {google ? (
        <Steps>
          <li>On a computer, open Google Calendar's settings.</li>
          <li>Under "Settings for my calendars", pick the calendar, then Integrate calendar.</li>
          <li>Copy "Secret address in iCal format" and paste it here.</li>
        </Steps>
      ) : (
        <p className="text-body">
          Paste the calendar's address. School and team sites, Outlook's "Publish calendar" and
          iCloud's public calendars all give one.
        </p>
      )}
      <TextField
        label="Calendar address"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://…/calendar.ics"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
        }}
        error={addIcs.isError ? errorMessage(addIcs.error) : null}
      />
      <TextField
        label="Name (optional)"
        autoComplete="off"
        maxLength={80}
        value={name}
        placeholder={google ? "Family" : "School"}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <Who members={members} value={owner} onChange={setOwner} />
      <div className="flex flex-col gap-2">
        <p className="text-body font-semibold">Check for changes every</p>
        <ChipRow label="Check for changes every">
          {INTERVALS.map((option) => (
            <Chip
              key={option.minutes}
              on={minutes === option.minutes}
              onClick={() => {
                setMinutes(option.minutes);
              }}
            >
              {option.label}
            </Chip>
          ))}
        </ChipRow>
      </div>
      {google ? null : (
        <Switch
          label="This server is on your home network"
          hint="Only for a server at home. A parent also adds it under Settings → Network."
          checked={home}
          onChange={setHome}
        />
      )}
      <Button type="submit" block pending={addIcs.isPending} disabled={!url.trim()}>
        Add calendar
      </Button>
    </form>
  );
}

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function HolidaysFlow({ onDone }: { onDone: () => void }) {
  const { data: places = [] } = useHolidayPlaces();
  const { data: members = [] } = useMembers();
  const { addHolidays } = useSyncChanges();
  const guess = (() => {
    try {
      return new Intl.Locale(navigator.language).maximize().region ?? "US";
    } catch {
      return "US";
    }
  })();
  const [country, setCountry] = useState(guess);
  const [region, setRegion] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const sorted = [...places].sort((a, b) =>
    regionName(a.country).localeCompare(regionName(b.country)),
  );
  const regions = places.find((place) => place.country === country)?.subdivisions ?? [];
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        addHolidays.mutate(
          { country, subdivision: region || null, owner_member_id: owner },
          { onSuccess: onDone },
        );
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-body font-semibold">Country</span>
        <Select
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            setRegion("");
          }}
        >
          {sorted.map((place) => (
            <option key={place.country} value={place.country}>
              {regionName(place.country)}
            </option>
          ))}
        </Select>
      </label>
      {regions.length ? (
        <label className="flex flex-col gap-2">
          <span className="text-body font-semibold">State or region (optional)</span>
          <Select
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
            }}
          >
            <option value="">The whole country</option>
            {regions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <Who members={members} value={owner} onChange={setOwner} />
      {addHolidays.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(addHolidays.error)}
        </p>
      ) : null}
      <Button type="submit" block pending={addHolidays.isPending}>
        Add holidays
      </Button>
    </form>
  );
}

/** iCloud (an app-specific password) or another CalDAV server (its address and login). */
function ServerFlow({
  icloud = false,
  onConnected,
}: {
  icloud?: boolean;
  onConnected: (account: Account) => void;
}) {
  const { addCaldav } = useSyncChanges();
  const [server, setServer] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [home, setHome] = useState(false);
  const ready = user.trim() && password.trim() && (icloud || server.trim());
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        addCaldav.mutate(
          {
            server_url: icloud ? "https://caldav.icloud.com" : server.trim(),
            username: user.trim(),
            app_password: password.trim(),
            label: null,
            allow_private: !icloud && home,
          },
          { onSuccess: onConnected },
        );
      }}
    >
      {icloud ? (
        <>
          <Steps>
            <li>
              Open{" "}
              <a
                href="https://appleid.apple.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                appleid.apple.com
              </a>{" "}
              and sign in.
            </li>
            <li>
              Under Sign-In and Security, tap App-Specific Passwords, then the plus, and name it
              Sunroom.
            </li>
            <li>Copy the password it shows (xxxx-xxxx-xxxx-xxxx) and paste it below.</li>
          </Steps>
          <p className="text-secondary text-ink-soft">
            Two-factor authentication has to be on for your Apple ID. Your Apple ID's own password
            doesn't work here.
          </p>
        </>
      ) : (
        <TextField
          label="Server address"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://cloud.example.com"
          value={server}
          onChange={(event) => {
            setServer(event.target.value);
          }}
        />
      )}
      <TextField
        label={icloud ? "Apple ID email" : "User name"}
        type={icloud ? "email" : "text"}
        autoComplete="username"
        value={user}
        onChange={(event) => {
          setUser(event.target.value);
        }}
      />
      <TextField
        label={icloud ? "App-specific password" : "Password"}
        type="password"
        autoComplete="off"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
        error={addCaldav.isError ? errorMessage(addCaldav.error) : null}
      />
      {icloud ? null : (
        <Switch
          label="This server is on your home network"
          hint="Only for a server at home. A parent also adds it under Settings → Network."
          checked={home}
          onChange={setHome}
        />
      )}
      <Button type="submit" block pending={addCaldav.isPending} disabled={!ready}>
        {addCaldav.isPending ? "Connecting…" : "Connect"}
      </Button>
    </form>
  );
}

/** Google's helper (a service account the family makes once, never called that here). */
function HelperFlow({ onFound }: { onFound: (account: Account) => void }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [calendarId, setCalendarId] = useState("");
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      return asParent(async () =>
        unwrap(
          await api.POST("/api/calendar-sync/accounts/google/service-account", {
            body: { key_json: text, label: null },
          }),
        ),
      );
    },
    onSuccess: setAccount,
  });
  const find = useMutation({
    mutationFn: async () =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/calendar-sync/accounts/{account_id}/google/add-calendar", {
            params: { path: { account_id: account?.id ?? "" } },
            body: { calendar_id: calendarId.trim() },
          }),
        ),
      ),
    onSuccess: onFound,
  });
  if (!account) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-body">
          You'll make a helper account at Google and share your calendar with it.
        </p>
        <Steps>
          <li>
            Open{" "}
            <a
              href="https://console.cloud.google.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              console.cloud.google.com
            </a>{" "}
            and make a project named Sunroom.
          </li>
          <li>In APIs & Services, enable the Google Calendar API.</li>
          <li>In IAM & Admin → Service accounts, create one named sunroom.</li>
          <li>Open it, then Keys → Add key → JSON. A file downloads.</li>
        </Steps>
        <label className="flex flex-col gap-2">
          <span className="text-body font-semibold">Upload the key file</span>
          <input
            type="file"
            accept="application/json,.json"
            className="min-h-12 rounded-button border-2 border-line bg-surface px-3 py-2 text-body"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
        {upload.isError ? (
          <p role="alert" className="font-semibold text-alert">
            {errorMessage(upload.error)}
          </p>
        ) : null}
        {upload.isPending ? (
          <p className="text-secondary text-ink-soft">Checking the key…</p>
        ) : null}
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (calendarId.trim()) find.mutate();
      }}
    >
      <div className="flex flex-col gap-2">
        <p className="text-body font-semibold">Your helper's address:</p>
        <p className="rounded-button bg-wall px-3 py-2 text-secondary break-all">
          {account.helper_email}
        </p>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(account.helper_email ?? "").then(() => {
                showToast("Copied the helper's address");
              });
            }}
          >
            Copy
          </Button>
        </div>
      </div>
      <p className="text-body">
        In Google Calendar's settings, pick the calendar, go to Share with specific people, paste
        the helper's address, choose Make changes to events, and Send.
      </p>
      <TextField
        label="The calendar's ID"
        hint="Your Gmail address for your main calendar; another calendar's ID is under Integrate calendar."
        autoComplete="off"
        value={calendarId}
        onChange={(event) => {
          setCalendarId(event.target.value);
        }}
        error={find.isError ? errorMessage(find.error) : null}
      />
      <Button type="submit" block pending={find.isPending} disabled={!calendarId.trim()}>
        Find calendar
      </Button>
    </form>
  );
}

/** Sign in with Google: only where Google allows the way back (https, or this screen). */
function SignInFlow() {
  const secure = (() => {
    try {
      const { protocol, hostname } = window.location;
      return protocol === "https:" || hostname === "localhost";
    } catch {
      return false;
    }
  })();
  const start = useMutation({
    mutationFn: async () =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/calendar-sync/accounts/google/start", {
            body: { account_id: null },
          }),
        ),
      ),
    onSuccess: (result) => {
      window.location.assign(result.authorize_url);
    },
  });
  if (!secure) {
    return (
      <p className="text-body">
        Google only signs in to apps at an https:// address. Use Share with a Sunroom helper
        instead, or set up an https address for Sunroom first (docs/REMOTE-ACCESS.md).
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <Steps>
        <li>In Google Cloud, make an OAuth client of type Web application.</li>
        <li>
          Add this redirect address to it: {window.location.origin}
          /api/calendar-sync/google/callback
        </li>
        <li>
          Set the consent screen to External and publish it. If it stays in Testing, Google signs
          Sunroom out every 7 days.
        </li>
        <li>Paste the client ID and secret under Settings → Features → Synced calendars.</li>
      </Steps>
      <p className="text-secondary text-ink-soft">
        Google may say the app isn't verified: tap Advanced, then Go to Sunroom. It's your own app.
      </p>
      {start.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(start.error)}
        </p>
      ) : null}
      <Button
        block
        pending={start.isPending}
        onClick={() => {
          start.mutate();
        }}
      >
        Sign in with Google
      </Button>
    </div>
  );
}

/** After connecting: which calendars go on the board, and whose each is. */
function PickCalendars({ account, onDone }: { account: Account; onDone: () => void }) {
  const { data: members = [] } = useMembers();
  const { map } = useSyncChanges();
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(
      account.calendars.map((c) => [c.id, { on: true, owner: c.suggested_owner_id ?? null }]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const chosen = account.calendars.filter((c) => choices[c.id]?.on);
  const done = async () => {
    setSaving(true);
    try {
      for (const calendar of chosen) {
        await map.mutateAsync({
          account: account.id,
          calendar: calendar.id,
          body: { mapped: true, owner_member_id: choices[calendar.id]?.owner ?? null },
        });
      }
      showToast(
        `Connected ${sourceName(account)} · ${String(chosen.length)} ${chosen.length === 1 ? "calendar" : "calendars"}`,
      );
      onDone();
    } finally {
      setSaving(false);
    }
  };
  if (account.calendars.length === 0) {
    return (
      <p className="text-body">
        No calendars there yet. Sharing can take a minute; try again from Calendars & accounts.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {account.calendars.map((calendar) => {
        const choice = choices[calendar.id] ?? { on: false, owner: null };
        return (
          <div key={calendar.id} className="flex flex-col gap-2 border-b border-line pb-4">
            <Switch
              label={calendar.name}
              hint={calendar.read_only ? "Shows events only" : undefined}
              checked={choice.on}
              onChange={(on) => {
                setChoices({ ...choices, [calendar.id]: { ...choice, on } });
              }}
            />
            {choice.on ? (
              <ChipRow label={`Whose is ${calendar.name}`}>
                <Chip
                  on={choice.owner === null}
                  onClick={() => {
                    setChoices({ ...choices, [calendar.id]: { ...choice, owner: null } });
                  }}
                >
                  Everyone
                </Chip>
                {members.map((member) => (
                  <Chip
                    key={member.id}
                    on={choice.owner === member.id}
                    onClick={() => {
                      setChoices({ ...choices, [calendar.id]: { ...choice, owner: member.id } });
                    }}
                  >
                    <Avatar member={member} size="xs" />
                    {member.name}
                  </Chip>
                ))}
              </ChipRow>
            ) : null}
          </div>
        );
      })}
      {map.isError ? (
        <p role="alert" className="font-semibold text-alert">
          {errorMessage(map.error)}
        </p>
      ) : null}
      <Button block pending={saving} onClick={() => void done()}>
        Done
      </Button>
    </div>
  );
}
