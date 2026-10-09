import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { useMembers } from "../../lib/household";
import { normalizeCode } from "../../lib/joinCode";
import { rememberSignedIn } from "../../lib/session";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { SunMark } from "../../ui/SunMark";
import { TextField } from "../../ui/TextField";
import { usePluginModules } from "../usePluginModules";

export type SetupStep =
  "welcome" | "password" | "household" | "place" | "people" | "pin" | "pair" | "calendars" | "done";
export const SIGNED_IN_STEPS: SetupStep[] = ["place", "people", "pin", "pair", "calendars", "done"];

function phoneZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** 12- or 24-hour, as the phone shows time. */
function phoneTimeFormat(): "12h" | "24h" {
  try {
    const cycle = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions()
      .hourCycle;
    return cycle === "h23" || cycle === "h24" ? "24h" : "12h";
  } catch {
    return "12h";
  }
}

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

function Page({ title, children, step }: { title: string; children: ReactNode; step?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[calc(env(safe-area-inset-top)+32px)] pb-12">
      <div className="mb-8 flex items-center gap-3">
        <SunMark className="size-10" />
        <span className="text-row font-bold">Sunroom</span>
        {step ? <span className="ml-auto text-secondary text-ink-soft">{step}</span> : null}
      </div>
      <h1 className="mb-4 text-title font-bold">{title}</h1>
      <div className="flex flex-col gap-5">{children}</div>
    </main>
  );
}

/**
 * First run (UX §6, PLAN §12.1): on whatever device opened Sunroom first, usually a phone. The
 * password and the household are set together in one request that closes setup for good and
 * signs this phone in as a parent; the rest (people, the PIN, pairing the screen) uses the
 * normal routes, and each step can be done later from Settings.
 */
export function SetupWizard({ step }: { step: SetupStep }) {
  const navigate = useNavigate();
  const go = (next: SetupStep) => {
    void navigate({ to: "/setup", search: { step: next } });
  };
  const [password, setPassword] = useState("");
  switch (step) {
    case "welcome":
      return (
        <Page title="Welcome to Sunroom">
          <p className="text-body">
            Let’s set it up. It takes about three minutes, and everything can be changed later.
          </p>
          <Button
            block
            onClick={() => {
              go("password");
            }}
          >
            Start
          </Button>
        </Page>
      );
    case "password":
      return (
        <PasswordStep
          password={password}
          onPassword={setPassword}
          onNext={() => {
            go("household");
          }}
        />
      );
    case "household":
      return (
        <HouseholdStep
          password={password}
          onBack={() => {
            go("password");
          }}
          onDone={() => {
            go("place");
          }}
        />
      );
    case "place":
      return (
        <PlaceStep
          onNext={() => {
            go("people");
          }}
        />
      );
    case "people":
      return (
        <PeopleStep
          onNext={() => {
            go("pin");
          }}
        />
      );
    case "pin":
      return (
        <PinStep
          onNext={() => {
            go("pair");
          }}
        />
      );
    case "pair":
      return (
        <PairStep
          onNext={() => {
            go("calendars");
          }}
        />
      );
    case "calendars":
      return (
        <CalendarsStep
          onNext={() => {
            go("done");
          }}
        />
      );
    case "done":
      return (
        <Page title="You’re Set">
          <p className="text-body">
            Everyone at home can sign in with the household password, or with a code from Settings,
            then Phones & Screens.
          </p>
          <Button
            block
            onClick={() => {
              void navigate({ to: "/" });
            }}
          >
            Open Sunroom
          </Button>
        </Page>
      );
  }
}

function PasswordStep({
  password,
  onPassword,
  onNext,
}: {
  password: string;
  onPassword: (value: string) => void;
  onNext: () => void;
}) {
  const { data: status } = useQuery({
    queryKey: qk.setupStatus(),
    queryFn: async () => unwrap(await api.GET("/api/setup/status")),
  });
  const [visible, setVisible] = useState(false);
  const fromServer = status?.password_from_env ?? false;
  const short = !fromServer && password.length > 0 && password.length < 12;
  return (
    <Page
      title={fromServer ? "Type the Household Password" : "Set a Household Password"}
      step="1 of 7"
    >
      <p className="text-body text-ink-soft">
        {fromServer
          ? "This server already has one (APP_PASSWORD). Type it to set up the household."
          : "Everyone at home signs in on their phone with this one password. The kitchen screen never needs it."}
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length >= (fromServer ? 1 : 12)) onNext();
        }}
      >
        <TextField
          label="Household password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          autoCapitalize="none"
          value={password}
          hint={fromServer ? null : "12 characters or more. A few words together work well."}
          error={short ? "Use at least 12 characters." : null}
          onChange={(event) => {
            onPassword(event.target.value);
          }}
        />
        <Button
          variant="secondary"
          aria-pressed={visible}
          onClick={() => {
            setVisible((value) => !value);
          }}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {visible ? "Hide password" : "Show password"}
        </Button>
        <Button type="submit" block disabled={password.length < (fromServer ? 1 : 12)}>
          Next
        </Button>
      </form>
    </Page>
  );
}

function HouseholdStep({
  password,
  onBack,
  onDone,
}: {
  password: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("Our home");
  const [zone, setZone] = useState(phoneZone);
  const [changingZone, setChangingZone] = useState(false);
  const [weekStart, setWeekStart] = useState<"6" | "0">("6");
  const setup = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/api/setup", {
          body: {
            password,
            household_name: name.trim(),
            timezone: zone,
            week_starts_on: Number(weekStart),
            time_format: phoneTimeFormat(),
          },
        }),
      ),
    onSuccess: async (session) => {
      rememberSignedIn(true);
      queryClient.setQueryData(qk.session(), session);
      await queryClient.invalidateQueries({ queryKey: qk.setupStatus() });
      onDone();
    },
  });
  if (!password) {
    return (
      <Page title="Name Your Household" step="2 of 7">
        <p className="text-body">Choose the household password first.</p>
        <Button block onClick={onBack}>
          Back
        </Button>
      </Page>
    );
  }
  return (
    <Page title="Name Your Household" step="2 of 7">
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) setup.mutate();
        }}
      >
        <TextField
          label="Household name"
          value={name}
          maxLength={80}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <ChipRow label="Ideas">
          {["Our home", "Home", "The family"].map((idea) => (
            <Chip
              key={idea}
              on={name === idea}
              onClick={() => {
                setName(idea);
              }}
            >
              {idea}
            </Chip>
          ))}
        </ChipRow>
        <div className="flex flex-col gap-2">
          <span className="text-body font-semibold">Time zone</span>
          {changingZone ? (
            <Select
              aria-label="Time zone"
              value={zone}
              onChange={(event) => {
                setZone(event.target.value);
              }}
            >
              {zones().map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-body">{zone.replaceAll("_", " ")}</span>
              <Button
                variant="quiet"
                onClick={() => {
                  setChangingZone(true);
                }}
              >
                Change
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-body font-semibold">The week starts on</span>
          <Segmented
            label="The week starts on"
            value={weekStart}
            onChange={setWeekStart}
            options={[
              { value: "6", label: "Sunday" },
              { value: "0", label: "Monday" },
            ]}
          />
        </div>
        {setup.isError ? (
          <p role="alert" className="font-semibold text-alert">
            {errorMessage(setup.error)}
          </p>
        ) : null}
        <Button type="submit" block pending={setup.isPending} disabled={!name.trim()}>
          Next
        </Button>
        <Button variant="quiet" block onClick={onBack}>
          Back
        </Button>
      </form>
    </Page>
  );
}

function PeopleStep({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();
  const { data: members = [] } = useMembers();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"parent" | "kid">("parent");
  const first = members.length === 0;
  const add = useMutation({
    mutationFn: async () => {
      const member = unwrap(await api.POST("/api/members", { body: { name: name.trim(), role } }));
      if (first) {
        // The first person is whoever is setting up: this phone is theirs.
        const session = unwrap(
          await api.PUT("/api/auth/member", { body: { member_id: member.id } }),
        );
        queryClient.setQueryData(qk.session(), session);
      }
      return member;
    },
    onSuccess: async () => {
      setName("");
      setRole("parent");
      await queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
  return (
    <Page title="Who Lives Here?" step="4 of 7">
      <p className="text-body text-ink-soft">
        {first
          ? "Start with you. Each person gets a color, used everywhere they appear."
          : "Add everyone, children included."}
      </p>
      {members.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-button border-2 border-line bg-surface px-3 py-2"
            >
              <Avatar member={member} size="sm" />
              <span className="text-row font-semibold">{member.name}</span>
              <span className="ml-auto text-secondary text-ink-soft">
                {member.role === "kid" ? "Child" : "Parent"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <TextField
          label={first ? "Your name" : "Name"}
          value={name}
          maxLength={40}
          autoComplete={first ? "given-name" : "off"}
          error={add.isError ? errorMessage(add.error) : null}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <Segmented
          label="Parent or child"
          value={role}
          onChange={setRole}
          options={[
            { value: "parent", label: "Parent" },
            { value: "kid", label: "Child" },
          ]}
        />
        <Button
          type="submit"
          variant={first ? "primary" : "secondary"}
          block
          pending={add.isPending}
          disabled={!name.trim()}
        >
          {first ? "Add me" : "Add another"}
        </Button>
      </form>
      {!first ? (
        <Button block onClick={onNext}>
          Next
        </Button>
      ) : null}
    </Page>
  );
}

function PinStep({ onNext }: { onNext: () => void }) {
  const [pin, setPin] = useState("");
  const set = useMutation({
    mutationFn: async () => {
      const result = await api.PUT("/api/auth/pin", { body: { pin } });
      if (!result.response.ok) unwrap(result);
    },
    onSuccess: onNext,
  });
  return (
    <Page title="Set a Parent PIN?" step="5 of 7">
      <p className="text-body text-ink-soft">
        It keeps children out of Settings on the kitchen screen. Adding events and checking off
        chores never ask for it.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (/^\d{4,6}$/.test(pin)) set.mutate();
        }}
      >
        <TextField
          label="PIN (4 to 6 digits)"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          error={set.isError ? errorMessage(set.error) : null}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/g, ""));
          }}
        />
        <Button type="submit" block pending={set.isPending} disabled={!/^\d{4,6}$/.test(pin)}>
          Set a PIN
        </Button>
      </form>
      <Button variant="quiet" block onClick={onNext}>
        Later
      </Button>
    </Page>
  );
}

/** Step 3: where home is, for the weather and the sunset, through the weather plugin's search.
 * With the plugin off, the step skips itself. */
function PlaceStep({ onNext }: { onNext: () => void }) {
  const Setup = usePluginModules().find((m) => m.id === "weather")?.onboarding;
  return (
    <Page title="Where’s Home?" step="3 of 7">
      {Setup ? (
        <Setup onDone={onNext} />
      ) : (
        <Button block onClick={onNext}>
          Next
        </Button>
      )}
    </Page>
  );
}

/** Step 7 (UX first run): bring in calendars, through the calendar_sync plugin's own flows.
 * With the plugin off, the step skips itself. */
function CalendarsStep({ onNext }: { onNext: () => void }) {
  const Setup = usePluginModules().find((m) => m.id === "calendar_sync")?.onboarding;
  return (
    <Page title="Bring in Your Calendars" step="7 of 7">
      {Setup ? (
        <Setup onDone={onNext} />
      ) : (
        <Button block onClick={onNext}>
          Next
        </Button>
      )}
    </Page>
  );
}

function PairStep({ onNext }: { onNext: () => void }) {
  const [code, setCode] = useState("");
  const pair = useMutation({
    mutationFn: async (value: string) =>
      unwrap(
        await api.POST("/api/auth/kiosk/pair", { body: { code: value, label: "Kitchen screen" } }),
      ),
    onSuccess: onNext,
  });
  const valid = normalizeCode(code);
  return (
    <Page title="Pair the Kitchen Screen" step="6 of 7">
      <p className="text-body text-ink-soft">
        On the screen, Sunroom now shows a code. Type it here.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) pair.mutate(valid);
        }}
      >
        <TextField
          label="The code on the screen"
          value={code}
          maxLength={10}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          className="text-title font-bold tracking-widest uppercase"
          error={pair.isError ? errorMessage(pair.error) : null}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
        <Button type="submit" block pending={pair.isPending} disabled={!valid}>
          Pair
        </Button>
      </form>
      <Button variant="quiet" block onClick={onNext}>
        Do this later
      </Button>
    </Page>
  );
}
