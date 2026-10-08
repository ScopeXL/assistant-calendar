import { createContext, useContext } from "react";

/**
 * Which surface a component is drawn on (ADR 0014): the wall display (and laptops showing the
 * display shell) or a phone. Primitives size themselves from it (UX §1: two distances, two
 * scales), so feature code never picks pixel sizes.
 */
export type ShellKind = "display" | "phone";

export const ShellContext = createContext<ShellKind>("phone");

export function useShell(): ShellKind {
  return useContext(ShellContext);
}
