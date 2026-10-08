import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useShell } from "../ui/shell";
import { usePluginModulesState } from "./usePluginModules";

/**
 * A plugin's room at its own address (/lists, /chores/rewards): the wall screen's room or the
 * phone's tab. An address whose plugin is off goes home (UX §1: never a dead end).
 */
export function PluginRoomScreen({ room, path }: { room: string; path: string[] }) {
  const display = useShell() === "display";
  const navigate = useNavigate();
  const { modules, ready } = usePluginModulesState();
  const found = modules.flatMap((module) => module.rooms ?? []).find((r) => r.key === room);
  const missing = ready && !found;
  useEffect(() => {
    if (missing) void navigate({ to: "/", replace: true });
  }, [missing, navigate]);
  if (!found) return null;
  return display ? <found.Display path={path} /> : <found.Phone path={path} />;
}

/** "a/b" → ["a", "b"]; nothing → []. */
export function splitPath(splat: string | undefined): string[] {
  return (splat ?? "").split("/").filter(Boolean);
}
