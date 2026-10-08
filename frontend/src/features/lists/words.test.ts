import { beforeEach, describe, expect, it } from "vitest";

import { setDatePreferences } from "../../lib/dates";
import { countLine, lastChangeLine, splitItems, whenText } from "./words";

const TODAY = "2026-10-07"; // a Wednesday
const names: Record<string, string> = { mia: "Mia" };

beforeEach(() => {
  setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
});

describe("countLine", () => {
  it("counts in each kind's words", () => {
    expect(countLine("grocery", 12, 3)).toBe("12 to get");
    expect(countLine("todo", 4, 0, 1)).toBe("4 to do · 1 for today");
    expect(countLine("packing", 9, 0)).toBe("9 to pack");
    expect(countLine("custom", 3, 0)).toBe("3 left");
  });

  it("says when a list is done, or empty", () => {
    expect(countLine("grocery", 0, 8)).toBe("All done");
    expect(countLine("grocery", 0, 0)).toBe("Nothing on it yet");
  });
});

describe("lastChangeLine", () => {
  it("names who did it, and when, as a tile says it", () => {
    const added = {
      action: "added" as const,
      text: "Milk",
      member_id: "mia",
      at: "2026-10-07T18:10:00Z",
    };
    expect(lastChangeLine(added, (id) => names[id], TODAY)).toBe("Mia added Milk · 2:10 PM");
    const kitchen = { ...added, member_id: null, action: "checked" as const };
    expect(lastChangeLine(kitchen, (id) => names[id], TODAY)).toBe("Checked off Milk · 2:10 PM");
  });

  it("uses the weekday this week and the date before that", () => {
    expect(whenText("2026-10-05T15:00:00Z", TODAY)).toBe("Mon");
    expect(whenText("2026-09-28T15:00:00Z", TODAY)).toBe("Sep 28");
  });
});

describe("splitItems", () => {
  it("makes several items from commas", () => {
    expect(splitItems("Milk, eggs,, bread ")).toEqual(["Milk", "Eggs", "Bread"]);
    expect(splitItems(" shin guards ")).toEqual(["Shin guards"]);
  });
});
