/** The household's live-update stream, opened by whichever shell is on screen (PLAN §11.5). */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { receiveKioskCommand } from "../shell/kioskCommands";
import { createEventHandler } from "./eventRouter";
import { LiveUpdates } from "./events";
import { probeSession } from "./session";

let onSignedOut: () => void = () => undefined;

/** The router says what "signed out" means (it navigates); set once at startup. */
export function setSignedOutHandler(handler: () => void): void {
  onSignedOut = handler;
}

/** This device signed itself out (Settings → Phones & screens). */
export function signedOutHere(): void {
  onSignedOut();
}

export function useLiveUpdates(enabled = true): void {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const live = new LiveUpdates({
      onEvent: createEventHandler(client, {
        onSignedOut: () => {
          onSignedOut();
        },
        onKioskCommand: receiveKioskCommand,
      }),
      onPoll: () => {
        void client.invalidateQueries();
      },
      probeSession,
    });
    live.start();
    return () => {
      live.stop();
    };
  }, [client, enabled]);
}
