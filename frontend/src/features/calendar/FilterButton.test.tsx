import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { Member } from "../../lib/household";
import { ShellContext } from "../../ui/shell";
import { FilterButton } from "./FilterButton";

afterEach(cleanup);

const person = (id: string, name: string, color: Member["color"]): Member => ({
  id,
  name,
  role: "parent",
  color,
  color_word: color,
  birthday: null,
  avatar_url: null,
  archived: false,
});
// The household's order, which isn't the order they're tapped in.
const FAMILY = [
  person("ana", "Ana", "sea"),
  person("sam", "Sam", "sky"),
  person("mia", "Mia", "berry"),
  person("leo", "Leo", "moss"),
];

function Board({ members = FAMILY, start = [] }: { members?: Member[]; start?: string[] }) {
  const [people, setPeople] = useState<string[]>(start);
  return (
    <ShellContext.Provider value="display">
      <FilterButton members={members} people={people} onPeople={setPeople} />
      <output>{people.join(",")}</output>
    </ShellContext.Provider>
  );
}

describe("Filter, in the wall's header (ADR 0030)", () => {
  it("is one button that opens the people, Everyone first and checked", () => {
    render(<Board />);
    const button = screen.getByRole("button", { name: "Filter" });
    expect(button.hasAttribute("data-filtered")).toBe(false);
    fireEvent.click(button);
    const menu = screen.getByRole("menu", { name: "Filter" });
    expect(screen.getByRole("group", { name: "People" })).toBeTruthy();
    const rows = Array.from(menu.querySelectorAll("[role^=menuitem]"));
    // Each row's own words: the avatar beside them is decoration.
    const words = (row: Element) =>
      Array.from(row.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join("");
    expect(rows.map(words)).toEqual(["Everyone", "Ana", "Sam", "Mia", "Leo"]);
    expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
  });

  it("takes several people, stays open while choosing, and says who in the household's order", () => {
    render(<Board />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Leo" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Mia" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("mia,leo");
    const button = screen.getByRole("button", { name: "Filter: Mia, Leo" });
    expect(button.hasAttribute("data-filtered")).toBe(true);
    expect(
      screen.getByRole("menuitemradio", { name: "Everyone" }).getAttribute("aria-checked"),
    ).toBe("false");
    // A second tap takes a person back out.
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Leo" }));
    expect(screen.getByRole("status").textContent).toBe("mia");
    expect(screen.getByRole("button", { name: "Filter: Mia" })).toBeTruthy();
  });

  it("clears and closes on Everyone", () => {
    render(<Board start={["sam", "ana"]} />);
    const button = screen.getByRole("button", { name: "Filter: Ana, Sam" });
    fireEvent.click(button);
    // Opening lands on the first person who is chosen.
    expect(document.activeElement).toBe(screen.getByRole("menuitemcheckbox", { name: "Ana" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Everyone" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("button", { name: "Filter" })).toBe(button);
  });

  it("shows three avatars at most, then how many more", () => {
    render(<Board start={["ana", "sam", "mia", "leo"]} />);
    const button = screen.getByRole("button", { name: "Filter: Ana, Sam, Mia, Leo" });
    expect(button.querySelectorAll("[data-person]")).toHaveLength(3);
    expect(button.textContent).toContain("+1");
  });

  it("ignores someone who is no longer in the household, and is nothing for a household of one", () => {
    const { unmount } = render(<Board start={["gone", "mia"]} />);
    expect(screen.getByRole("button", { name: "Filter: Mia" })).toBeTruthy();
    unmount();
    render(<Board members={FAMILY.slice(0, 1)} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
