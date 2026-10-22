import { useEffect, useId, type ReactNode } from "react";

import type { ScreenState } from "../../lib/screenAgent";
import { Brand } from "../../ui/Brand";
import { Button } from "../../ui/Button";
import { afterWifi, go } from "../route";

/** Sunroom OS with neither a cable nor Wi-Fi from Imager: join a network before either way. */
export function needsWifi(state: ScreenState): boolean {
  return state.sunroom_os && state.network.kind === "none" && state.capabilities.includes("wifi");
}

function Choice({
  heading,
  lead,
  children,
  action,
}: {
  heading: string;
  lead: string;
  children: ReactNode;
  action: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-panel border border-line bg-surface p-6 text-left"
    >
      <h2 id={id} className="text-d-title font-bold">
        {heading}
      </h2>
      <p className="text-d-body font-semibold">{lead}</p>
      {children}
      <div className="mt-auto pt-2">{action}</div>
    </section>
  );
}

/**
 * Welcome: the first page of a screen with no Sunroom yet, and its two ways on, side by side
 * (ADR 0038): Sunroom on this computer, or one that already runs somewhere else. Each says what
 * it is and when to choose it, for a family that has never set up a server.
 */
export function WelcomePage({ state }: { state: ScreenState }) {
  const chosen = state.sunroom !== null;
  const here = state.capabilities.includes("run_sunroom");
  const offline = needsWifi(state);
  useEffect(() => {
    // A screen that has its Sunroom has nothing to set up: it opens it.
    if (chosen) go("/opening", true);
  }, [chosen]);
  const onward = (path: "/here" | "/find") => {
    if (offline) {
      afterWifi.set(path);
      go("/wifi");
    } else {
      go(path);
    }
  };
  return (
    <div className="flex w-full max-w-[110rem] flex-col items-center gap-8">
      <Brand size="entry" heading />
      <p className="text-d-glance font-semibold">Where will your family’s Sunroom run?</p>
      <div
        className={`grid w-full gap-6 portrait:grid-cols-1 ${here ? "landscape:grid-cols-2" : ""}`}
      >
        {here ? (
          <Choice
            heading="On This Computer"
            lead="Sunroom runs right here."
            action={
              <Button
                onClick={() => {
                  onward("/here");
                }}
              >
                Run Sunroom Here
              </Button>
            }
          >
            <p className="text-d-body">
              This computer keeps your family’s calendar, lists and photos, and everyone’s phones
              open Sunroom from it. There’s nothing else to set up.
            </p>
            <p className="text-d-body text-ink-soft">
              Choose this if your family is new to Sunroom. Keep this computer on and connected to
              your home’s network.
            </p>
          </Choice>
        ) : null}
        <Choice
          heading="On Another Computer"
          lead="Your family already has a Sunroom."
          action={
            <Button
              variant={here ? "secondary" : "primary"}
              onClick={() => {
                onward("/find");
              }}
            >
              Find Your Sunroom
            </Button>
          }
        >
          <p className="text-d-body">
            It runs somewhere else, such as a home server, a NAS, another computer or a website, and
            this screen shows it.
          </p>
          <p className="text-d-body text-ink-soft">
            Choose this if someone already set Sunroom up. This screen looks for it on your network,
            or you type its address.
          </p>
        </Choice>
      </div>
    </div>
  );
}
