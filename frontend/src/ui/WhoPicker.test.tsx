import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Member } from "../lib/household";
import { ShellContext } from "./shell";
import { WhoPicker } from "./WhoPicker";

afterEach(cleanup);

const person = (
  id: string,
  name: string,
  role: "parent" | "kid",
  color: Member["color"],
): Member => ({
  id,
  name,
  role,
  color,
  color_word: color,
  birthday: null,
  avatar_url: null,
  archived: false,
});
const FAMILY = [
  person("ana", "Ana", "parent", "sea"),
  person("sam", "Sam", "parent", "sky"),
  person("mia", "Mia", "kid", "rose"),
  person("leo", "Leo", "kid", "moss"),
  person("max", "Maximiliano", "kid", "iris"),
];

describe("the Who picker (ADR 0029)", () => {
  it("is one row: Everyone first, then each person, none wrapping", () => {
    const onChange = vi.fn();
    render(
      <ShellContext.Provider value="display">
        <WhoPicker label="Who" members={FAMILY} value={[]} onChange={onChange} multiple />
      </ShellContext.Provider>,
    );
    const row = screen.getByRole("group", { name: "Who" });
    expect(row.className).toContain("flex-nowrap");
    expect(row.className).not.toContain("flex-wrap");
    const cells = screen.getAllByRole("button");
    expect(cells.map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "Everyone",
      "Ana",
      "Sam",
      "Mia",
      "Leo",
      "Maximiliano",
    ]);
    // Six cells share the row from the larger size up: 64 px avatars in 80 px cells.
    for (const cell of cells) expect(cell.style.flex).toBe("1 1 80px");
    // A long name is cut on screen, never for a screen reader.
    const long = screen.getByRole("button", { name: "Maximiliano" });
    expect(long.querySelector("span:last-child")?.className).toContain("truncate");
    expect(long.textContent).toContain("Maximiliano");
    expect(screen.getByRole("button", { name: "Everyone" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Mia" }));
    expect(onChange).toHaveBeenLastCalledWith(["mia"]);
  });

  it("adds and removes people when several can be chosen, and Everyone clears them", () => {
    const onChange = vi.fn();
    render(
      <WhoPicker
        label="Who"
        members={FAMILY}
        value={["ana", "mia"]}
        onChange={onChange}
        multiple
      />,
    );
    expect(screen.getByRole("button", { name: "Everyone" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "Leo" }));
    expect(onChange).toHaveBeenLastCalledWith(["ana", "mia", "leo"]);
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(onChange).toHaveBeenLastCalledWith(["mia"]);
    fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("calls the first cell Anyone for a task, and can leave it out or show only children", () => {
    const { rerender } = render(
      <WhoPicker
        label="Who"
        members={FAMILY}
        value={[]}
        onChange={vi.fn()}
        everyoneLabel="Anyone"
      />,
    );
    expect(screen.getByRole("button", { name: "Anyone" }).textContent).toBe("Anyone");
    expect(screen.queryByRole("button", { name: "Everyone" })).toBeNull();
    rerender(
      <WhoPicker
        label="Who's asking?"
        members={FAMILY}
        value={[]}
        onChange={vi.fn()}
        everyone={false}
        kidsOnly
      />,
    );
    expect(screen.getAllByRole("button").map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "Mia",
      "Leo",
      "Maximiliano",
    ]);
  });

  it("wraps only where it's asked to: a narrow column", () => {
    render(
      <WhoPicker
        label="Who did it?"
        members={FAMILY}
        value={[]}
        onChange={vi.fn()}
        everyone={false}
        wrap
      />,
    );
    const row = screen.getByRole("group", { name: "Who did it?" });
    expect(row.className).toContain("flex-wrap");
    expect(screen.getByRole("button", { name: "Ana" }).style.flex).toBe("");
  });
});
