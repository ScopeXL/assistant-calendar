import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setDatePreferences } from "../lib/dates";
import { EVENT_TIMES } from "../lib/times";
import { TimeField } from "./TimeField";

afterEach(() => {
  cleanup();
  setDatePreferences({ timezone: "UTC", timeFormat: "12h" });
});

function Field({
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
      suggestions={EVENT_TIMES}
      onChange={(next) => {
        setTime(next);
        onTime?.(next);
      }}
      {...props}
    />
  );
}

const pressed = () =>
  screen
    .getAllByRole("button")
    .filter((chip) => chip.getAttribute("aria-pressed") === "true")
    .map((chip) => chip.textContent);

describe("a time of day, picked by touch (ADR 0029)", () => {
  it("offers no time and a few likely ones", () => {
    const onTime = vi.fn();
    render(<Field start={null} onTime={onTime} />);
    const row = screen.getByRole("group", { name: "Time" });
    expect(Array.from(row.querySelectorAll("button")).map((chip) => chip.textContent)).toEqual([
      "All day",
      "9:00 AM",
      "12:00 PM",
      "3:00 PM",
      "6:00 PM",
      "Pick a time",
    ]);
    expect(pressed()).toEqual(["All day"]);
    fireEvent.click(screen.getByRole("button", { name: "3:00 PM" }));
    expect(onTime).toHaveBeenLastCalledWith("15:00");
    expect(pressed()).toEqual(["3:00 PM"]);
  });

  it("shows an odd time as a pressed chip, in clock order", () => {
    render(<Field start="10:30" />);
    const row = screen.getByRole("group", { name: "Time" });
    expect(Array.from(row.querySelectorAll("button")).map((chip) => chip.textContent)).toEqual([
      "All day",
      "9:00 AM",
      "10:30 AM",
      "12:00 PM",
      "3:00 PM",
      "6:00 PM",
      "Pick a time",
    ]);
    expect(pressed()).toEqual(["10:30 AM"]);
  });

  it("opens the hours and minutes in place", () => {
    const onTime = vi.fn();
    render(<Field start={null} onTime={onTime} />);
    const pick = screen.getByRole("button", { name: "Pick a time" });
    expect(pick.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Time: hour" })).toBeNull();
    fireEvent.click(pick);
    expect(pick.getAttribute("aria-expanded")).toBe("true");
    // An hour with no time yet is on the hour.
    fireEvent.click(screen.getByRole("button", { name: "2 PM" }));
    expect(onTime).toHaveBeenLastCalledWith("14:00");
    fireEvent.click(screen.getByRole("button", { name: ":45" }));
    expect(onTime).toHaveBeenLastCalledWith("14:45");
    // The hour keeps the minutes already chosen.
    fireEvent.click(screen.getByRole("button", { name: "4 PM" }));
    expect(onTime).toHaveBeenLastCalledWith("16:45");
    expect(screen.getByRole("button", { name: "4:45 PM" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    // Before 6 AM is behind Earlier hours.
    expect(screen.queryByRole("button", { name: "5 AM" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Earlier hours" }));
    fireEvent.click(screen.getByRole("button", { name: "5 AM" }));
    expect(onTime).toHaveBeenLastCalledWith("05:45");
  });

  it("says a chip the caller's way, and needs no none chip", () => {
    render(
      <Field
        start="17:00"
        label="Due"
        none={null}
        suggestions={["08:00", "17:00"]}
        words={(time) => `by ${time}`}
      />,
    );
    const row = screen.getByRole("group", { name: "Due" });
    expect(Array.from(row.querySelectorAll("button")).map((chip) => chip.textContent)).toEqual([
      "by 08:00",
      "by 17:00",
      "Pick a time",
    ]);
  });

  it("follows the household's 24-hour clock", () => {
    setDatePreferences({ timezone: "UTC", timeFormat: "24h" });
    render(<Field start="15:00" />);
    expect(pressed()).toEqual(["15:00"]);
  });
});
