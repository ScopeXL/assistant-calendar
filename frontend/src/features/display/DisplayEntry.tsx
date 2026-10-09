import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { api, errorMessage, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { isLoopbackAddress } from "../../lib/address";
import { zonedParts } from "../../lib/dates";
import { whenIdle, watchActivity } from "../../lib/idle";
import { watchKeyboardFields } from "../../lib/keyboard";
import { MotionProvider } from "../../lib/motion";
import { fetchSession, type Session } from "../../lib/session";
import { applyAppearance } from "../../lib/theme";
import { useMinute } from "../../lib/time";
import { DisplayShell } from "../../shell/DisplayShell";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { KeyboardHost } from "../../ui/Keyboard";
import { QrCode } from "../../ui/QrCode";
import { ShellContext } from "../../ui/shell";
import { SunMark } from "../../ui/SunMark";
import { TextField } from "../../ui/TextField";
import { CalendarRoom } from "../calendar/CalendarRoom";

const NAMES = ["Kitchen", "Hallway", "Living room", "Office"] as const;
const PASSWORD_IDLE_MS = 60_000;

/**
 * What the wall screen shows at /display (PLAN §12.3, UX §4 "Welcome and Pair this screen"):
 * where to set Sunroom up when it isn't yet; its pair code when it isn't paired; "Name this
 * screen" right after pairing; then the board. Any other browser opening /display after signing
 * in gets the display shell as a preview (ADR 0014).
 */
export function DisplayEntry() {
  const { data: status } = useQuery({
    queryKey: qk.setupStatus(),
    queryFn: async () => unwrap(await api.GET("/api/setup/status")),
    refetchInterval: (query) => (query.state.data?.setup_complete ? false : 5000),
  });
  const { data: session, isPending } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const [justPaired, setJustPaired] = useState(false);

  if (!status || isPending) return <Frame>{null}</Frame>;
  if (!status.setup_complete) {
    return (
      <Frame>
        <Welcome address={status.advertised_url} />
      </Frame>
    );
  }
  if (!session) {
    return (
      <Frame>
        <PairThisScreen
          onPaired={() => {
            setJustPaired(true);
          }}
        />
      </Frame>
    );
  }
  if (justPaired && session.device_kind === "kiosk") {
    return (
      <Frame>
        <NameThisScreen
          onDone={() => {
            setJustPaired(false);
          }}
        />
      </Frame>
    );
  }
  return (
    <DisplayShell home="/display">
      <CalendarRoom />
    </DisplayShell>
  );
}

/** The display's look and keyboard, for the screens shown before it's paired. */
function Frame({ children }: { children: ReactNode }) {
  const { hour, minute } = zonedParts(useMinute());
  const minuteOfDay = hour * 60 + minute;
  useEffect(() => {
    applyAppearance(
      {
        theme: "auto",
        daylightTint: true,
        textSize: "standard",
        reduceMotion: false,
        display: true,
      },
      minuteOfDay,
    );
  }, [minuteOfDay]);
  useEffect(() => {
    const stopActivity = watchActivity();
    const stopKeyboard = watchKeyboardFields();
    return () => {
      stopActivity();
      stopKeyboard();
    };
  }, []);
  return (
    <ShellContext.Provider value="display">
      <MotionProvider reduceMotion={false}>
        <main
          data-shell="display"
          className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-wall px-10 py-12 pb-[calc(var(--osk-h,0px)+48px)] text-center text-ink"
        >
          {children}
        </main>
        <KeyboardHost railSide="left" />
      </MotionProvider>
    </ShellContext.Provider>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-4">
      <SunMark className="size-16" />
      <p className="text-d-title font-bold">Sunroom</p>
    </div>
  );
}

function Welcome({ address }: { address: string }) {
  return (
    <>
      <Brand />
      <h1 className="text-d-glance font-bold">Set Up Sunroom on Your Phone</h1>
      {isLoopbackAddress(address) ? (
        <p className="max-w-3xl text-d-body">
          Open Sunroom on your phone with this computer's name or network address instead of{" "}
          <span className="font-bold">{new URL(address).hostname}</span>. Then come back here: this
          screen will show a code to pair it.
        </p>
      ) : (
        <>
          <QrCode value={address} label={`A code that opens ${address}`} className="size-72" />
          <p className="max-w-3xl text-d-body">
            Open <span className="font-bold">{address}</span> on your phone. Then come back here:
            this screen will show a code to pair it.
          </p>
        </>
      )}
    </>
  );
}

interface Pairing {
  code: string;
  display: string;
  poll_token: string;
  pair_url: string;
}

function PairThisScreen({ onPaired }: { onPaired: () => void }) {
  const queryClient = useQueryClient();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  // Ask for a code, then wait for a phone to claim it; a new code every 10 minutes.
  useEffect(() => {
    const loop = { stopped: false };
    const stopped = () => loop.stopped;
    const run = async () => {
      while (!stopped()) {
        const asked = await api.POST("/api/auth/kiosk/pairings");
        if (stopped()) return;
        if (!asked.response.ok || !asked.data) {
          setProblem(errorMessage(asked.error));
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          continue;
        }
        setProblem(null);
        const current = asked.data;
        setPairing(current);
        for (;;) {
          const polled = await api.GET("/api/auth/kiosk/pairings/{poll_token}", {
            params: { path: { poll_token: current.poll_token }, query: { wait: 25 } },
          });
          if (stopped()) return;
          if (polled.data?.status === "paired" && polled.data.session) {
            queryClient.setQueryData<Session>(qk.session(), polled.data.session);
            onPaired();
            return;
          }
          if (polled.data?.status !== "waiting") break; // expired: a new code
        }
      }
    };
    void run();
    return () => {
      loop.stopped = true;
    };
  }, [queryClient, onPaired]);

  if (typing) {
    return (
      <PasswordPairing
        onCancel={() => {
          setTyping(false);
        }}
        onPaired={onPaired}
      />
    );
  }
  return (
    <>
      <Brand />
      <h1 className="text-d-glance font-bold">Pair This Screen</h1>
      {pairing ? (
        <>
          <p
            aria-label={`Pair code: ${pairing.code.split("").join(" ")}`}
            data-testid="pair-code"
            className="text-d-code font-extrabold tracking-[0.12em]"
          >
            {pairing.display}
          </p>
          <div className="flex items-center gap-10 text-left">
            <QrCode value={pairing.pair_url} label="A code that opens Pair a Display on a phone" />
            <div className="flex max-w-xl flex-col gap-3">
              <p className="text-d-body">
                On your phone, open Sunroom, then More, then Pair a Display, and type this code.
              </p>
              <p className="text-d-secondary text-ink-soft">The code changes every 10 minutes.</p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-d-body text-ink-soft">{problem ?? "Getting a code…"}</p>
      )}
      <Button
        variant="quiet"
        onClick={() => {
          setTyping(true);
        }}
      >
        Type the household password here instead
      </Button>
    </>
  );
}

function PasswordPairing({ onCancel, onPaired }: { onCancel: () => void; onPaired: () => void }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const pair = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST("/api/auth/kiosk/pair-with-password", {
          body: { password, label: "Kitchen screen" },
        }),
      ),
    onSuccess: (session) => {
      queryClient.setQueryData<Session>(qk.session(), session);
      onPaired();
    },
  });

  // The password clears itself after a minute untouched: the wall is in everyone's view.
  useEffect(
    () =>
      whenIdle(PASSWORD_IDLE_MS, () => {
        setPassword("");
      }),
    [],
  );

  return (
    <form
      className="flex w-full max-w-3xl flex-col gap-6 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        if (password) pair.mutate();
      }}
    >
      <Brand />
      <h1 className="text-d-glance font-bold">Type the Household Password</h1>
      <TextField
        label="Household password"
        type={visible ? "text" : "password"}
        layout="password"
        autoComplete="off"
        autoCapitalize="none"
        value={password}
        error={pair.isError ? errorMessage(pair.error) : null}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />
      <div className="flex flex-wrap items-center gap-3 whitespace-nowrap">
        <Button type="submit" pending={pair.isPending} disabled={!password}>
          Pair this screen
        </Button>
        <Button
          variant="secondary"
          aria-pressed={visible}
          onClick={() => {
            setVisible((value) => !value);
          }}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-7" />
          ) : (
            <Eye aria-hidden="true" className="size-7" />
          )}
          {visible ? "Hide password" : "Show password"}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Show the code instead
        </Button>
      </div>
    </form>
  );
}

function NameThisScreen({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState<string>("Kitchen");
  const [other, setOther] = useState("");
  const rename = useMutation({
    mutationFn: async (label: string) =>
      unwrap(await api.PUT("/api/auth/device/label", { body: { label } })),
    onSuccess: (session) => {
      queryClient.setQueryData<Session>(qk.session(), session);
      onDone();
    },
  });
  const label = name === "Other" ? other.trim() : `${name} screen`;
  return (
    <form
      className="flex w-full max-w-3xl flex-col items-center gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (label) rename.mutate(label);
      }}
    >
      <Brand />
      <h1 className="text-d-glance font-bold">Name This Screen</h1>
      <ChipRow label="Where is this screen?" center>
        {[...NAMES, "Other"].map((option) => (
          <Chip
            key={option}
            on={name === option}
            onClick={() => {
              setName(option);
            }}
          >
            {option}
          </Chip>
        ))}
      </ChipRow>
      {name === "Other" ? (
        <div className="w-full max-w-xl text-left">
          <TextField
            label="What should it be called?"
            value={other}
            maxLength={80}
            onChange={(event) => {
              setOther(event.target.value);
            }}
          />
        </div>
      ) : null}
      <Button type="submit" pending={rename.isPending} disabled={!label} className="min-w-64">
        Done
      </Button>
      {rename.isError ? (
        <p role="alert" className="text-d-secondary font-semibold text-alert">
          {errorMessage(rename.error)}
        </p>
      ) : null}
    </form>
  );
}
