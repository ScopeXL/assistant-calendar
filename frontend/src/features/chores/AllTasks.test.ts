import { describe, expect, it } from "vitest";

import type { Member } from "../../lib/household";
import { taskColumns, tasksCount } from "./AllTasks";
import type { Chore } from "./data";

function person(id: string, name: string): Member {
  return {
    id,
    name,
    role: "kid",
    color: "berry",
    color_word: "Berry",
    birthday: null,
    avatar_url: null,
    archived: false,
  };
}

const ANA = person("ana", "Ana");
const MIA = person("mia", "Mia");
const LEO = person("leo", "Leo");

function chore(id: string, mode: "fixed" | "rotate" | "any", people: string[]): Chore {
  return {
    id,
    title: id,
    description: null,
    icon: null,
    points: 0,
    rrule: null,
    repeat_text: "Doesn't repeat",
    start_date: "2026-10-07",
    due_time: null,
    assignee_mode: mode,
    assignee_member_ids: people,
    rotation_index: 0,
    requires_approval: null,
    active: true,
    next_due: "2026-10-07",
  };
}

describe("All Tasks' columns (ADR 0036)", () => {
  it("puts a task under each person it names, in household order, then Anyone", () => {
    const columns = taskColumns(
      [
        chore("dishes", "rotate", ["leo", "mia"]),
        chore("plants", "any", []),
        chore("bed", "fixed", ["mia", "leo"]),
        chore("trash", "fixed", ["ana"]),
      ],
      [ANA, MIA, LEO],
    );
    expect(columns.map((c) => [c.memberId, c.tasks.map((t) => t.id)])).toEqual([
      ["ana", ["trash"]],
      ["mia", ["dishes", "bed"]],
      ["leo", ["dishes", "bed"]],
      [null, ["plants"]],
    ]);
  });

  it("draws no column for nobody's tasks, or for someone who has left", () => {
    expect(taskColumns([], [ANA, MIA])).toEqual([]);
    expect(taskColumns([chore("bed", "fixed", ["sam"])], [ANA])).toEqual([]);
  });

  it("counts them in words", () => {
    expect(tasksCount(1)).toBe("1 task");
    expect(tasksCount(5)).toBe("5 tasks");
  });
});
