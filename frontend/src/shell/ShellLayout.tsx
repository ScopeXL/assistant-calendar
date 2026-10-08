import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";

import { qk } from "../api/keys";
import { fetchSession } from "../lib/session";
import { useMediaQuery } from "../lib/useMediaQuery";
import { DisplayShell } from "./DisplayShell";
import { PhoneShell } from "./PhoneShell";

/**
 * One app, two shells (ADR 0014): a paired wall screen always gets the display shell, chosen by
 * the device's kind, not its size; a laptop (1024 px and up) gets it too, with its real keyboard;
 * everything else gets the phone shell.
 */
export function ShellLayout() {
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const wide = useMediaQuery("(min-width: 1024px)");
  if (session?.device_kind === "kiosk") {
    return (
      <DisplayShell home="/display">
        <Outlet />
      </DisplayShell>
    );
  }
  if (wide) {
    return (
      <DisplayShell home="/">
        <Outlet />
      </DisplayShell>
    );
  }
  return (
    <PhoneShell>
      <Outlet />
    </PhoneShell>
  );
}
