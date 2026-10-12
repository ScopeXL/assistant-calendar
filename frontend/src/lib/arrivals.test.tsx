import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ARRIVAL_MS, Arrivals, arrivals, useArrivals, useArrived } from "./arrivals";

function Chip({ id }: { id: string }) {
  return <li data-arrive={useArrived(id) ? "" : undefined}>{id}</li>;
}

function Board({ keys, scope }: { keys: string[]; scope: string | null }) {
  const arrived = useArrivals(keys, scope);
  return (
    <Arrivals value={arrived}>
      <ul>
        {keys.map((key) => (
          <Chip key={key} id={key} />
        ))}
      </ul>
    </Arrivals>
  );
}

const arrived = () =>
  screen
    .queryAllByRole("listitem")
    .filter((item) => item.hasAttribute("data-arrive"))
    .map((item) => item.textContent);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("what just arrived (UX §9 Chips arrive)", () => {
  it("is the keys that weren't there before", () => {
    expect([...arrivals([], ["a", "b"])]).toEqual(["a", "b"]);
    expect([...arrivals(["a", "b"], ["a", "c", "b"])]).toEqual(["c"]);
    // Something leaving is nobody arriving.
    expect([...arrivals(["a", "b"], ["a"])]).toEqual([]);
  });

  it("marks nothing on the first look, then only the newcomer, and only for a moment", () => {
    const view = render(<Board keys={["vet", "soccer"]} scope="week 1" />);
    expect(arrived()).toEqual([]);
    view.rerender(<Board keys={["vet", "library", "soccer"]} scope="week 1" />);
    expect(arrived()).toEqual(["library"]);
    // Drawn again for any other reason, it's still the one that arrived.
    view.rerender(<Board keys={["vet", "library", "soccer"]} scope="week 1" />);
    expect(arrived()).toEqual(["library"]);
    act(() => {
      vi.advanceTimersByTime(ARRIVAL_MS);
    });
    expect(arrived()).toEqual([]);
    // One removed: the others stay as they were.
    view.rerender(<Board keys={["vet", "library"]} scope="week 1" />);
    expect(arrived()).toEqual([]);
  });

  it("marks nothing when the scope changes: paging, a view switch", () => {
    const view = render(<Board keys={["vet", "soccer"]} scope="week 1" />);
    view.rerender(<Board keys={["swim", "piano"]} scope="week 2" />);
    expect(arrived()).toEqual([]);
    view.rerender(<Board keys={["swim", "piano", "dentist"]} scope="week 2" />);
    expect(arrived()).toEqual(["dentist"]);
  });

  it("waits for a scope's own data: loading, or last week's chips still up, is no baseline", () => {
    const view = render(<Board keys={[]} scope={null} />);
    view.rerender(<Board keys={["vet", "soccer"]} scope="week 1" />);
    expect(arrived()).toEqual([]);
    // Paging: the old week's chips show while the new week loads.
    view.rerender(<Board keys={["vet", "soccer"]} scope={null} />);
    view.rerender(<Board keys={["swim"]} scope="week 2" />);
    expect(arrived()).toEqual([]);
    // Back to a week seen before: its chips are no newcomers either.
    view.rerender(<Board keys={["vet", "soccer", "library"]} scope="week 1" />);
    expect(arrived()).toEqual([]);
  });
});
