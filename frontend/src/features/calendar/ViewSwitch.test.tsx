import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShellContext } from "../../ui/shell";
import { ViewSwitch } from "./ViewSwitch";

afterEach(cleanup);

function draw(onView = vi.fn()) {
  render(
    <ShellContext.Provider value="display">
      <ViewSwitch view="week" onView={onView} />
    </ShellContext.Provider>,
  );
  return onView;
}

describe("the board's view switch in the header (ADR 0029)", () => {
  it("is four named icons, with the chosen view written out", () => {
    const onView = draw();
    const group = screen.getByRole("group", { name: "View" });
    const cells = Array.from(group.querySelectorAll("button"));
    expect(cells.map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "Week",
      "Day",
      "Month",
      "People",
    ]);
    expect(cells.map((cell) => cell.textContent)).toEqual(["Week", "", "", ""]);
    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(onView).toHaveBeenCalledWith("people");
  });

  it("folds into a View menu that says the current view", () => {
    const onView = draw();
    const button = screen.getByRole("button", { name: "View: Week" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu", { name: "View" });
    expect(button.getAttribute("aria-controls")).toBe(menu.id);
    const rows = screen.getAllByRole("menuitemradio");
    expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);
    // Opening lands on the view that's on; the arrows walk the rows and wrap.
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[3]);
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(rows[0]);
    // A choice changes the view, closes the menu and goes back to the button.
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Month" }));
    expect(onView).toHaveBeenCalledWith("month");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes on Escape and on a press anywhere else, choosing nothing", () => {
    const onView = draw();
    const button = screen.getByRole("button", { name: "View: Week" });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onView).not.toHaveBeenCalled();
  });
});
