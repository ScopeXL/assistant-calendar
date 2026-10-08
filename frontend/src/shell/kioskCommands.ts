/**
 * Commands a parent sends every wall screen (POST /api/kiosk/command → the kiosk.command event):
 * reload, wake. The screensaver and "show this event" arrive with M4 and M1.
 */
import { createStore } from "../lib/store";

export interface KioskCommand {
  command: string;
  at: number;
}

export const kioskCommands = createStore<KioskCommand | null>(null);

export function receiveKioskCommand(command: string): void {
  kioskCommands.set({ command, at: Date.now() });
}
