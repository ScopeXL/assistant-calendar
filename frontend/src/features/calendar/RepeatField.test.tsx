import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KeptRule } from "./EventEditor";
import { RepeatField, type RepeatChange } from "./RepeatField";
import { repeatToRRule, type Repeat, type RepeatEnd } from "./repeat";

afterEach(cleanup);

const THURSDAY = "2026-10-08"; // the second Thursday of October 2026
const TODAY = "2026-10-07";

function Field({
  start = null,
  end = {},
  keep = null,
  weekStartsOn = 6,
  presetKeys,
  onRule,
}: {
  start?: Repeat | null;
  end?: RepeatEnd;
  keep?: KeptRule | null;
  weekStartsOn?: number;
  presetKeys?: readonly string[];
  onRule?: (rule: string | null, change: RepeatChange) => void;
}) {
  const [state, setState] = useState<{
    repeat: Repeat | null;
    repeatEnd: RepeatEnd;
    kept: KeptRule | null;
  }>({ repeat: start, repeatEnd: end, kept: keep });
  return (
    <RepeatField
      day={THURSDAY}
      today={TODAY}
      value={state.repeat}
      repeatEnd={state.repeatEnd}
      kept={state.kept}
      weekStartsOn={weekStartsOn}
      {...(presetKeys ? { presetKeys } : {})}
      onChange={(change) => {
        setState(change);
        onRule?.(
          change.repeat
            ? repeatToRRule(change.repeat, THURSDAY, change.repeatEnd, weekStartsOn)
            : null,
          change,
        );
      }}
    />
  );
}

const sentence = () =>
  screen.getByText(/^(Every|Doesn\u2019t|Doesn't)/, { selector: "p[aria-live]" });

describe("how something repeats (ADR 0029)", () => {
  it("offers the usual choices worded from the start day", () => {
    const onRule = vi.fn();
    render(<Field onRule={onRule} />);
    const chips = within(screen.getByRole("group", { name: "Repeats" }))
      .getAllByRole("button")
      .map((chip) => chip.textContent);
    expect(chips).toEqual([
      "Doesn't repeat",
      "Every day",
      "Every weekday",
      "Every week on Thu",
      "Every 2 weeks on Thu",
      "Every month on the 8th",
      "Every month on the second Thursday",
      "Every year on Oct 8",
      "Custom…",
    ]);
    expect(
      screen.getByRole("button", { name: "Doesn't repeat" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(sentence().textContent).toBe("Doesn't repeat");
    // Nothing repeats, so there's nothing to end.
    expect(screen.queryByRole("group", { name: "Ends" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Every week on Thu" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=WEEKLY;BYDAY=TH");
    expect(screen.getByRole("group", { name: "Ends" })).toBeTruthy();
  });

  it("builds a custom rule: every 2 weeks on Tuesday and Thursday", () => {
    const onRule = vi.fn();
    render(<Field onRule={onRule} />);
    const custom = screen.getByRole("button", { name: "Custom…" });
    expect(custom.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(custom);
    expect(screen.getByRole("button", { name: "Custom…" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    // It starts as every week on the start day.
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=WEEKLY;BYDAY=TH");
    // The weekdays are in the household's order: Sunday first here.
    const days = within(screen.getByRole("group", { name: "On" })).getAllByRole("button");
    expect(days.map((day) => day.getAttribute("aria-label"))[0]).toBe("Sunday");
    fireEvent.click(screen.getByRole("button", { name: "Every: more" }));
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH");
    expect(sentence().textContent).toBe("Every 2 weeks on Tue and Thu");
    // No preset says this, so only Custom is pressed.
    const pressed = within(screen.getByRole("group", { name: "Repeats" }))
      .getAllByRole("button")
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => chip.textContent);
    expect(pressed).toEqual(["Custom…"]);
    // With two or more, the units read as plurals.
    expect(screen.getByRole("button", { name: "Weeks" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("offers a month by date or by weekday, and days and years", () => {
    const onRule = vi.fn();
    render(<Field onRule={onRule} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom…" }));
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=MONTHLY");
    fireEvent.click(screen.getByRole("button", { name: "On the second Thursday" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=MONTHLY;BYDAY=2TH");
    expect(screen.queryByRole("group", { name: "On" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    fireEvent.click(screen.getByRole("button", { name: "Every: more" }));
    fireEvent.click(screen.getByRole("button", { name: "Every: more" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=DAILY;INTERVAL=3");
    fireEvent.click(screen.getByRole("button", { name: "Years" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=YEARLY;INTERVAL=3");
  });

  it("ends never, on a date from a month grid, or after a number of times", () => {
    const onRule = vi.fn();
    render(<Field start={{ freq: "daily", interval: 1 }} onRule={onRule} />);
    const ends = screen.getByRole("group", { name: "Ends" });
    expect(within(ends).getByRole("button", { name: "Never" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(within(ends).getByRole("button", { name: "After 10 times" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=DAILY;COUNT=10");
    fireEvent.click(screen.getByRole("button", { name: "Times: less" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=DAILY;COUNT=9");
    expect(sentence().textContent).toBe("Every day, 9 times");
    expect(within(ends).getByRole("button", { name: "After 9 times" })).toBeTruthy();
    fireEvent.click(within(ends).getByRole("button", { name: "On a date" }));
    // Seeded 90 days on: January 6, 2027.
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=DAILY;UNTIL=20270106");
    fireEvent.click(screen.getByRole("button", { name: "January 20" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=DAILY;UNTIL=20270120");
    fireEvent.click(within(ends).getByRole("button", { name: "Never" }));
    expect(onRule.mock.lastCall?.[0]).toBe("FREQ=DAILY");
  });

  it("opens on Custom for a rule no preset says", () => {
    render(<Field start={{ freq: "weekly", interval: 3, weekdays: [0, 2] }} weekStartsOn={0} />);
    expect(screen.getByRole("button", { name: "Custom…" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByRole("status").textContent).toContain("3");
    expect(screen.getByRole("button", { name: "Monday" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(sentence().textContent).toBe("Every 3 weeks on Mon and Wed");
  });

  it("keeps a rule it can't read as it is, until something else is picked", () => {
    const onRule = vi.fn<(rule: string | null, change: RepeatChange) => void>();
    const kept = { rrule: "FREQ=MONTHLY;BYMONTHDAY=15", text: "Every month on the 15th" };
    render(<Field keep={kept} onRule={onRule} />);
    const asIs = screen.getByRole("button", { name: "As it is: every month on the 15th" });
    expect(asIs.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Doesn't repeat" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.getByText("Every month on the 15th", { selector: "p[aria-live]" })).toBeTruthy();
    expect(onRule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Every day" }));
    expect(onRule.mock.lastCall?.[1].kept).toBeNull();
    expect(screen.queryByRole("button", { name: /^As it is/ })).toBeNull();
  });

  it("offers a task only the choices it's given, and Custom for the rest", () => {
    render(
      <Field
        start={{ freq: "yearly", interval: 1 }}
        presetKeys={["none", "daily", "weekdays", "weekly", "biweekly", "monthly-date"]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Every year on Oct 8" })).toBeNull();
    expect(screen.getByRole("button", { name: "Custom…" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Year" }).getAttribute("aria-pressed")).toBe("true");
  });
});
