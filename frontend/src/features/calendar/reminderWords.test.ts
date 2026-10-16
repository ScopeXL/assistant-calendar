import { describe, expect, it } from "vitest";

import {
  minutesLabel,
  reminderChoices,
  reminderPick,
  remindersLabel,
  reminderValue,
} from "./reminderWords";

describe("reminders in words (ADR 0034)", () => {
  it("says how long before", () => {
    expect(minutesLabel(5)).toBe("5 min before");
    expect(minutesLabel(30)).toBe("30 min before");
    expect(minutesLabel(60)).toBe("1 hour before");
    expect(minutesLabel(90)).toBe("1½ hours before");
    expect(minutesLabel(120)).toBe("2 hours before");
    expect(minutesLabel(1440)).toBe("1 day before");
    expect(minutesLabel(2880)).toBe("2 days before");
    expect(minutesLabel(0)).toBe("When it starts");
  });

  it("puts several in one sentence, soonest first", () => {
    expect(remindersLabel([60, 10])).toBe("10 min and 1 hour before");
    expect(remindersLabel([1440, 5, 60])).toBe("5 min, 1 hour and 1 day before");
    expect(remindersLabel([45])).toBe("45 min before");
    expect(remindersLabel([])).toBe("None");
  });
});

describe("the Remind row (R1, R3)", () => {
  it("offers the household's default first, then None and the presets", () => {
    const labels = reminderChoices(10, []).map((choice) => choice.label);
    expect(labels).toEqual([
      "Default (10 min before)",
      "None",
      "5 min before",
      "10 min before",
      "15 min before",
      "30 min before",
      "1 hour before",
      "2 hours before",
      "1 day before",
    ]);
    expect(reminderChoices(null, [])[0]).toEqual({ value: "none", label: "None" });
  });

  it("names whatever an event holds, so nothing shows blank", () => {
    expect(reminderChoices(null, [30]).at(-1)).toEqual({ value: "1440", label: "1 day before" });
    expect(reminderChoices(null, [45]).at(-1)).toEqual({ value: "45", label: "45 min before" });
    expect(reminderChoices(10, [60, 10]).at(-1)).toEqual({
      value: "10,60",
      label: "10 min and 1 hour before",
    });
  });

  it("reads an event's three states, and stores a pick", () => {
    expect(reminderValue([], false, 10)).toBe("default");
    expect(reminderValue([], true, 10)).toBe("none");
    expect(reminderValue([], false, null)).toBe("none");
    expect(reminderValue([60, 10], false, 10)).toBe("10,60");
    expect(reminderPick("default")).toEqual({ reminders: [], off: false });
    expect(reminderPick("none")).toEqual({ reminders: [], off: true });
    // A pick replaces the set: two reminders stay two (R3).
    expect(reminderPick("10,60")).toEqual({ reminders: [10, 60], off: false });
  });
});
