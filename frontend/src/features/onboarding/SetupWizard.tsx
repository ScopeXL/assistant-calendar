import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { useMembers } from "../../lib/household";
import { rememberSignedIn } from "../../lib/session";
import { previewTheme, type ThemeChoice } from "../../lib/theme";
import { Avatar } from "../../ui/Avatar";
import { AddPersonRow, type RoleChoice } from "../settings/AddPersonRow";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { Segmented } from "../../ui/Segmented";
import { Select } from "../../ui/Select";
import { TextField } from "../../ui/TextField";
import { usePluginModules } from "../usePluginModules";
import { SetupEnd, SetupFrame, StepActions } from "./SetupFrame";

export type SetupStep =
  "welcome" | "password" | "household" | "place" | "people" | "pin" | "calendars" | "done";
export const SIGNED_IN_STEPS: SetupStep[] = ["place", "people", "pin", "calendars", "done"];

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

/** The household password's least length (auth/password.py's MIN_PASSWORD_LENGTH; ADR 0034). */
const MIN_PASSWORD = 8;

function zones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

/**
 * First run (UX §6, PLAN §12.1): on whatever device opened Sunroom first, usually a phone. The
 * password and the household are set together in one request that closes setup for good and
 * signs this phone in as a parent; the rest (the city, people, the PIN, calendars) uses the
 * normal routes, and each step can be done later from Settings. Pairing a screen isn't a step
 * (ADR 0030): the screen shows its code by itself once setup is done, and it's paired from More
 * → Pair a Display, or with the household password on the screen. The household step also
 * picks the theme, previewed on this page as it's chosen (ADR 0034).
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
        <SetupEnd title="Welcome to Sunroom">
          <p>Let’s set it up. It takes about three minutes, and everything can be changed later.</p>
          <Button
            block
            className="lg:min-h-16 lg:w-auto lg:min-w-72 lg:text-d-body"
            onClick={() => {
              go("password");
            }}
          >
            Start
          </Button>
        </SetupEnd>
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
        <SetupEnd title="You’re Set" done>
          <p>
            Everyone at home can sign in with the household password, or with a code from Settings,
            then Devices.
          </p>
          <p>
            To put Sunroom on a screen on the wall, open it there: it shows a code. Type that code
            under More, then Pair a Display, or type the household password on the screen itself.
          </p>
          <Button
            block
            className="lg:min-h-16 lg:w-auto lg:min-w-72 lg:text-d-body"
            onClick={() => {
              void navigate({ to: "/" });
            }}
          >
            Open Sunroom
          </Button>
        </SetupEnd>
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
  const least = fromServer ? 1 : MIN_PASSWORD;
  const short = !fromServer && password.length > 0 && password.length < MIN_PASSWORD;
  return (
    <SetupFrame
      step="password"
      title={fromServer ? "Type the Household Password" : "Set a Household Password"}
      lead={
        fromServer
          ? "This server already has one (APP_PASSWORD). Type it to set up the household."
          : "Everyone at home signs in on their devices with this one password. Paired screens don't need it."
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length >= least) onNext();
        }}
      >
        <TextField
          label="Household password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          autoCapitalize="none"
          value={password}
          hint={fromServer ? null : "8 characters or more. A few words together work well."}
          error={short ? "Use at least 8 characters." : null}
          onChange={(event) => {
            onPassword(event.target.value);
          }}
        />
        <Button
          variant="secondary"
          className="self-start"
          aria-pressed={visible}
          onClick={() => {
            setVisible((value) => !value);
          }}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {visible ? "Hide Password" : "Show Password"}
        </Button>
        <StepActions>
          <Button type="submit" block disabled={password.length < least}>
            Next
          </Button>
        </StepActions>
      </form>
    </SetupFrame>
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
  const [name, setName] = useState("Home");
  const [zone, setZone] = useState(phoneZone);
  const [changingZone, setChangingZone] = useState(false);
  const [weekStart, setWeekStart] = useState<"6" | "0">("6");
  const [theme, setTheme] = useState<ThemeChoice>("auto");
  // The choice shows on this page at once, as the Display page's does on the wall.
  const pickTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    previewTheme(choice);
  };
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
            theme,
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
      <SetupFrame step="household" title="Name Your Household">
        <p className="text-body">Choose the household password first.</p>
        <StepActions>
          <Button block onClick={onBack}>
            Back
          </Button>
        </StepActions>
      </SetupFrame>
    );
  }
  return (
    <SetupFrame step="household" title="Name Your Household">
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
          {["Home", "Family", "Our home"].map((idea) => (
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
        <div className="flex flex-col gap-2">
          <span className="text-body font-semibold">Theme</span>
          <Segmented
            label="Theme"
            value={theme}
            onChange={pickTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "auto", label: "Auto" },
            ]}
          />
          <p className="text-secondary text-ink-soft">
            Auto is dark from sunset to sunrise once Sunroom knows where home is (the next step),
            and from 7 PM until then. On a phone, Auto follows the phone.
          </p>
        </div>
        {setup.isError ? (
          <p role="alert" className="font-semibold text-alert">
            {errorMessage(setup.error)}
          </p>
        ) : null}
        <StepActions
          back={
            <Button variant="quiet" block onClick={onBack}>
              Back
            </Button>
          }
        >
          <Button type="submit" block pending={setup.isPending} disabled={!name.trim()}>
            Next
          </Button>
        </StepActions>
      </form>
    </SetupFrame>
  );
}

function PeopleStep({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();
  const { data: members = [] } = useMembers();
  const first = members.length === 0;
  const add = useMutation({
    mutationFn: async ({ name, role }: { name: string; role: RoleChoice }) => {
      const member = unwrap(await api.POST("/api/members", { body: { name, role } }));
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
      await queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
  return (
    <SetupFrame
      step="people"
      title="Who Lives Here?"
      lead={
        first
          ? "Start with you. Each person gets a color, used everywhere they appear."
          : "Add everyone, children included."
      }
    >
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
      <AddPersonRow
        label={first ? "Your name" : "Name"}
        action={first ? "Add Me" : "Add"}
        primary={first}
        autoComplete={first ? "given-name" : "off"}
        pending={add.isPending}
        error={add.isError ? errorMessage(add.error) : null}
        onAdd={(name, role) => add.mutateAsync({ name, role })}
      />
      {!first ? (
        <StepActions>
          <Button block onClick={onNext}>
            Next
          </Button>
        </StepActions>
      ) : null}
    </SetupFrame>
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
    <SetupFrame
      step="pin"
      title="Set a Parent PIN?"
      lead="It keeps children out of Settings on paired screens. Adding events and checking off tasks never ask for it."
    >
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
        <StepActions
          back={
            <Button variant="quiet" block onClick={onNext}>
              Later
            </Button>
          }
        >
          <Button type="submit" block pending={set.isPending} disabled={!/^\d{4,6}$/.test(pin)}>
            Set a PIN
          </Button>
        </StepActions>
      </form>
    </SetupFrame>
  );
}

/** Step 3: where home is, for the weather and the sunset, through the weather plugin's search.
 * With the plugin off, the step skips itself. */
function PlaceStep({ onNext }: { onNext: () => void }) {
  const Setup = usePluginModules().find((m) => m.id === "weather")?.onboarding;
  return (
    <SetupFrame step="place" title="Where’s Home?">
      {Setup ? (
        <Setup onDone={onNext} />
      ) : (
        <StepActions>
          <Button block onClick={onNext}>
            Next
          </Button>
        </StepActions>
      )}
    </SetupFrame>
  );
}

/** Step 6 (UX first run): bring in calendars, through the calendar_sync plugin's own flows.
 * With the plugin off, the step skips itself. */
function CalendarsStep({ onNext }: { onNext: () => void }) {
  const Setup = usePluginModules().find((m) => m.id === "calendar_sync")?.onboarding;
  return (
    <SetupFrame step="calendars" title="Bring in Your Calendars">
      {Setup ? (
        <Setup onDone={onNext} />
      ) : (
        <StepActions>
          <Button block onClick={onNext}>
            Next
          </Button>
        </StepActions>
      )}
    </SetupFrame>
  );
}
