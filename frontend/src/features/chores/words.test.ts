import { beforeEach, describe, expect, it } from "vitest";

import { setDatePreferences } from "../../lib/dates";
import {
  allDoneText,
  boxLabel,
  boxLine,
  countText,
  doneLine,
  routineTitle,
  starsLine,
} from "./words";

const people = [
  { id: "mia", name: "Mia" },
  { id: "leo", name: "Leo" },
];
const box = {
  due_time: "17:00",
  points: 2,
  since: null,
  turn_id: null,
  owner_id: "mia",
  completion: null,
};

beforeEach(() => {
  setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
});

describe("chores' words", () => {
  it("says when it's due, its stars and whose turn it is", () => {
    expect(boxLine(box, people, true)).toBe("by 5:00 PM · ★2");
    expect(boxLine(box, people, false)).toBe("by 5:00 PM");
    const turn = { ...box, owner_id: null, turn_id: "mia", due_time: null, points: 1 };
    expect(boxLine(turn, people, true)).toBe("★1 · Mia's turn");
    const late = { ...box, since: "2026-10-05", due_time: null, points: 0 };
    expect(boxLine(late, people, true)).toBe("since Mon");
  });

  it("names a box the way UX §10 says it", () => {
    expect(boxLabel({ ...box, title: "Feed the dog" }, people, true)).toBe(
      "Feed the dog, Mia, 2 stars, due 5:00 PM",
    );
    const turn = { ...box, title: "Dishes", owner_id: null, turn_id: "leo", points: 1 };
    expect(boxLabel(turn, people, true)).toBe("Dishes, Leo's turn, 1 star, due 5:00 PM");
    const anyone = { ...box, title: "Plants", owner_id: null, due_time: null };
    expect(boxLabel(anyone, people, false)).toBe("Plants, anyone");
  });

  it("says who did it and when, or that a parent will check", () => {
    const done = { member_id: "mia", completed_at: "2026-10-07T11:42:00Z", status: "done" };
    expect(doneLine(done, people)).toBe("Done by Mia · 7:42 AM");
    expect(doneLine({ ...done, status: "pending" }, people)).toBe(
      "Mia says it's done · waiting for a parent",
    );
  });

  it("counts, cheers and keeps stars plain", () => {
    expect(countText(2, 3)).toBe("2 of 3");
    expect(allDoneText("Mia")).toBe("All done, Mia!");
    expect(allDoneText(null)).toBe("All done!");
    expect(starsLine({ balance: 42, week: 12, streak: 6 })).toBe(
      "★ 42 · +12 this week · 6 days in a row",
    );
    expect(starsLine({ balance: 3, week: 0, streak: 0 })).toBe("★ 3 · 0 days in a row");
    expect(starsLine({ balance: 3, week: 0, streak: 1 })).toBe("★ 3 · 1 day in a row");
  });

  it("names whose routine it is", () => {
    expect(routineTitle("Bedtime routine", "Leo")).toBe("Leo's bedtime routine");
    expect(routineTitle("Leo's bedtime", "Leo")).toBe("Leo's bedtime");
  });
});
