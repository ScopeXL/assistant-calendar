import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { qk } from "../../api/keys";
import type { Member } from "../../lib/household";
import { ShellContext } from "../../ui/shell";
import { ChoreRow } from "./ChoreBoard";
import type { Box } from "./data";

const MIA: Member = {
  id: "mia",
  name: "Mia",
  role: "kid",
  color: "berry",
  color_word: "Berry",
  birthday: null,
  avatar_url: null,
  archived: false,
};

const BOX: Box = {
  chore_id: "feed",
  title: "Feed the dog",
  due_date: "2026-10-08",
  due_time: "17:00",
  icon: null,
  needs_approval: false,
  owner_id: MIA.id,
  points: 2,
  since: null,
  turn_id: null,
  completion: null,
};

/** One row, on the wall, with what it reads already loaded (nothing is fetched). */
function draw(box: Box, readOnly: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(qk.members(), [MIA]);
  client.setQueryData(qk.settings(), {});
  client.setQueryData(qk.session(), { device_kind: "kiosk", member: null, is_parent: false });
  client.setQueryData(qk.chores(), []);
  render(
    <QueryClientProvider client={client}>
      <ShellContext.Provider value="display">
        <ul>
          <ChoreRow box={box} owner={MIA} starsOn={false} readOnly={readOnly} />
        </ul>
      </ShellContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("a task's row (UX §4)", () => {
  it("has its box on today", () => {
    draw(BOX, false);
    expect(screen.getByRole("checkbox", { name: /^Feed the dog, Mia/ })).toBeTruthy();
  });

  it("draws no box on another day: its due line, and the title still opens it", () => {
    draw(BOX, true);
    expect(screen.queryByRole("checkbox")).toBeNull();
    const title = screen.getByRole("button", { name: /^Feed the dog/ });
    expect(title.textContent).toContain("by 5:00 PM");
    // The chevron says it opens (ADR 0036); no check mark while it isn't done.
    expect(title.querySelector("svg.lucide-chevron-right")).not.toBeNull();
    expect(title.querySelector("svg.lucide-check")).toBeNull();
  });

  it("says a done one is done, with a check mark and who did it", () => {
    draw(
      {
        ...BOX,
        completion: {
          id: "done",
          chore_id: BOX.chore_id,
          due_date: BOX.due_date,
          member_id: MIA.id,
          completed_at: "2026-10-08T11:42:00Z",
          points_awarded: 2,
          status: "done",
        },
      },
      true,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    const title = screen.getByRole("button", { name: /^Feed the dog/ });
    expect(title.textContent).toMatch(/Done by Mia · /);
    expect(title.querySelector("svg.lucide-check")?.getAttribute("aria-hidden")).toBe("true");
  });
});
