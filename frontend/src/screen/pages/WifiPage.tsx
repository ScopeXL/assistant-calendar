import { useEffect, useState } from "react";

import { WifiChooser } from "../../features/settings/ThisScreenPage";
import type { ScreenState, ScreenWifi } from "../../lib/screenAgent";
import { Button } from "../../ui/Button";
import { go } from "../route";

/** Connect to Wi-Fi: the networks in range, and the password typed on the wall's keyboard. */
export function WifiPage({ state }: { state: ScreenState }) {
  const [chosen, setChosen] = useState<ScreenWifi | null>(null);
  const wired = state.network.kind === "wired";
  useEffect(() => {
    // A cable plugged in meanwhile: nothing to join.
    if (wired) go("/find", true);
  }, [wired]);
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-d-glance font-bold">{chosen ? chosen.ssid : "Connect to Wi-Fi"}</h1>
      {chosen ? null : (
        <p className="text-d-body text-ink-soft">Pick this home’s network, or plug in a cable.</p>
      )}
      <WifiChooser
        chosen={chosen}
        onChoose={setChosen}
        onJoined={() => {
          go("/find");
        }}
      />
      <div>
        <Button
          variant="quiet"
          onClick={() => {
            go(state.sunroom ? "/settings" : "/");
          }}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
