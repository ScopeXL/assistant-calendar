import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setDatePreferences } from "../lib/dates";
import { TimeField } from "./TimeField";

afterEach(() => {
  cleanup();
  setDatePreferences({ timezone: "UTC", timeFormat: "12h" });
});

function Row({
  start,
  onTime,
  ...props
}: { start: string | null; onTime?: (time: string | null) => void } & Partial<
  Parameters<typeof TimeField>[0]
>) {
  const [time, setTime] = useState(start);
  return (
    <TimeField
      label="Time"
      value={time}
      none={{ label: "All day" }}
      onChange={(next) => {
        setTime(next);
        onTime?.(next);
      }}
      {...props}
    />
  );
}

const names = () =>
  screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);

describe("a time of day, picked by touch (ADR 0030)", () => {
  it("is one row: a chip for no time, and one button that says the time", () => {
    render(<Row start="14:30" />);
    // No chips of likely times: what's chosen is the only time on the row.
    expect(names()).toEqual(["All day", "Time: 2:30 PM"]);
    expect(screen.getByRole("button", { name: "All day" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByRole("button", { name: "Time: 2:30 PM" }).textContent).toBe("2:30 PM");
  });

  it("with no time, the chip is pressed and the button offers to pick one", () => {
    const onTime = vi.fn();
    render(<Row start={null} onTime={onTime} />);
    expect(screen.getByRole("button", { name: "All day" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const button = screen.getByRole("button", { name: "Time: Pick a time" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.hasAttribute("aria-pressed")).toBe(false);
  });

  it("opens the hours and minutes in place, and Done closes them", () => {
    const onTime = vi.fn();
    render(<Row start={null} onTime={onTime} />);
    expect(screen.queryByRole("group", { name: "Time: hour" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Time: Pick a time" }));
    expect(screen.getByRole("group", { name: "Time: hour" })).toBeTruthy();
    // An hour with no time yet is on the hour.
    fireEvent.click(screen.getByRole("button", { name: "2 PM" }));
    expect(onTime).toHaveBeenLastCalledWith("14:00");
    const button = screen.getByRole("button", { name: "Time: 2:00 PM" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: ":45" }));
    expect(onTime).toHaveBeenLastCalledWith("14:45");
    // The hour keeps the minutes already chosen; the chosen hour and minutes are pressed.
    fireEvent.click(screen.getByRole("button", { name: "4 PM" }));
    expect(onTime).toHaveBeenLastCalledWith("16:45");
    expect(screen.getByRole("button", { name: "4 PM" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: ":45" }).getAttribute("aria-pressed")).toBe("true");
    // Before 6 AM is behind Earlier hours.
    expect(screen.queryByRole("button", { name: "5 AM" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Earlier hours" }));
    fireEvent.click(screen.getByRole("button", { name: "5 AM" }));
    expect(onTime).toHaveBeenLastCalledWith("05:45");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("group", { name: "Time: hour" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Time: 5:45 AM" }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("the chip for no time clears it and closes the picker", () => {
    const onTime = vi.fn();
    render(<Row start="09:00" onTime={onTime} />);
    fireEvent.click(screen.getByRole("button", { name: "Time: 9:00 AM" }));
    fireEvent.click(screen.getByRole("button", { name: "All day" }));
    expect(onTime).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("group", { name: "Time: hour" })).toBeNull();
    expect(screen.getByRole("button", { name: "Time: Pick a time" })).toBeTruthy();
  });

  it("says the time the caller's way, and needs no chip for none", () => {
    render(<Row start="17:00" label="Due" none={null} words={(time) => `by ${time}`} />);
    expect(names()).toEqual(["Due: by 17:00"]);
  });

  it("follows the household's 24-hour clock", () => {
    setDatePreferences({ timezone: "UTC", timeFormat: "24h" });
    render(<Row start="15:00" />);
    expect(screen.getByRole("button", { name: "Time: 15:00" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Time: 15:00" }));
    expect(screen.getByRole("button", { name: "15:00", pressed: true })).toBeTruthy();
  });
});
