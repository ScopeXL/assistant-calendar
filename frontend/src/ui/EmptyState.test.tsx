import { cleanup, render, screen } from "@testing-library/react";
import { ListChecks } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./Button";
import { EmptyState, QuietLine } from "./EmptyState";
import { ShellContext } from "./shell";

afterEach(cleanup);

describe("an empty room (UX §8, ADR 0032)", () => {
  it("shows an icon, a short line, a note and its one button, centred", () => {
    render(
      <ShellContext.Provider value="display">
        <EmptyState
          icon={ListChecks}
          title="No lists yet"
          note="Groceries, to-dos, packing: everyone sees them on the wall and on their phones."
          action={<Button>New List</Button>}
        />
      </ShellContext.Provider>,
    );
    const room = screen.getByText("No lists yet").closest("section");
    expect(room?.className).toMatch(/\bitems-center\b.*\btext-center\b/);
    // The icon says nothing to a screen reader: the line does.
    expect(room?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText(/^Groceries, to-dos, packing/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "New List" })).toBeTruthy();
  });

  it("has no button of its own on a phone that has its bar's", () => {
    render(<EmptyState icon={ListChecks} title="No lists yet" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stays a quiet line where the room isn't empty: a list with nothing on it", () => {
    render(<QuietLine>Nothing on Groceries yet. Add the first thing.</QuietLine>);
    expect(screen.getByText(/^Nothing on Groceries yet/).tagName).toBe("P");
  });
});
