import { useEffect } from "react";

import type { ScreenState } from "../../lib/screenAgent";
import { Brand } from "../../ui/Brand";
import { Button } from "../../ui/Button";
import { go } from "../route";

/** Sunroom OS with neither a cable nor Wi-Fi from Imager: join a network before looking. */
export function needsWifi(state: ScreenState): boolean {
  return state.sunroom_os && state.network.kind === "none" && state.capabilities.includes("wifi");
}

/** Welcome: the first page of a screen with no Sunroom yet. */
export function WelcomePage({ state }: { state: ScreenState }) {
  const chosen = state.sunroom !== null;
  useEffect(() => {
    // A screen that has its Sunroom has nothing to set up: it opens it.
    if (chosen) go("/opening", true);
  }, [chosen]);
  return (
    <>
      <Brand size="entry" heading />
      <p className="text-d-glance font-semibold">Let’s get this screen set up.</p>
      <Button
        onClick={() => {
          go(needsWifi(state) ? "/wifi" : "/find");
        }}
      >
        Start
      </Button>
    </>
  );
}
