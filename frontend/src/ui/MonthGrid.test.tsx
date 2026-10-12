import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonthGrid } from "./MonthGrid";

afterEach(cleanup);

const TODAY = "2026-10-07";

function draw(props: Partial<Parameters<typeof MonthGrid>[0]> = {}) {
  const onChange = vi.fn();
  const view = render(
    <MonthGrid
      label="Day, by month"
      value="2026-10-08"
      today={TODAY}
      weekStartsOn={6}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...view };
}

describe("a month to pick a day from", () => {
  it("shows the chosen day's month as whole weeks from the household's first day", () => {
    const { onChange } = draw();
    expect(screen.getByText("October 2026")).toBeTruthy();
    const days = screen
      .getAllByRole("button")
      .filter((cell) => !(cell.getAttribute("aria-label") ?? "").endsWith("month"));
    expect(days).toHaveLength(35);
    expect(days[0]?.getAttribute("aria-label")).toBe("September 27");
    // Named as a date read aloud, unlike the week strip's "Thu, Oct 8".
    const eighth = screen.getByRole("button", { name: "October 8" });
    expect(eighth.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "October 7" }).getAttribute("aria-current")).toBe(
      "date",
    );
    // A neighbouring month's day is quieter, and can still be picked.
    const before = screen.getByRole("button", { name: "September 30" });
    expect(before.className).toContain("text-ink-soft");
    fireEvent.click(before);
    expect(onChange).toHaveBeenCalledWith("2026-09-30");
  });

  it("pages by month, across a year's end", () => {
    draw({ value: "2026-12-10" });
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("January 2027")).toBeTruthy();
    expect(screen.getByRole("button", { name: "January 15" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("November 2026")).toBeTruthy();
  });

  it("follows the chosen day when it changes from outside", () => {
    const { rerender, onChange } = draw();
    rerender(
      <MonthGrid
        label="Day, by month"
        value="2027-02-03"
        today={TODAY}
        weekStartsOn={6}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("February 2027")).toBeTruthy();
  });

  it("can't go before the earliest day", () => {
    const { onChange } = draw({ value: null, min: TODAY });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Previous month" }).disabled).toBe(
      true,
    );
    const yesterday = screen.getByRole<HTMLButtonElement>("button", { name: "October 6" });
    expect(yesterday.disabled).toBe(true);
    fireEvent.click(yesterday);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "October 7" }).disabled).toBe(
      false,
    );
  });

  it("starts a Monday household's weeks on Monday", () => {
    draw({ weekStartsOn: 0 });
    const days = screen
      .getAllByRole("button")
      .filter((cell) => !(cell.getAttribute("aria-label") ?? "").endsWith("month"));
    expect(days[0]?.getAttribute("aria-label")).toBe("September 28");
  });
});
