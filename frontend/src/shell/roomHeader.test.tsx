import { cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { roomHeader, RoomHeader, useRoomHeader } from "./roomHeader";

afterEach(cleanup);

let bump: () => void = () => undefined;

function Counter() {
  const [count, setCount] = useState(1);
  useRoomHeader({ title: `List ${String(count)}`, visibleTitle: true });
  return (
    <button
      type="button"
      ref={(node) => {
        bump = () => node?.click();
      }}
      onClick={() => {
        setCount(count + 1);
      }}
    >
      More
    </button>
  );
}

describe("the room's slot in the wall's header", () => {
  it("holds the room's title from its first paint, and follows its state", () => {
    expect(roomHeader.get()).toBeNull();
    render(<Counter />);
    expect(roomHeader.get()).toMatchObject({ title: "List 1", visibleTitle: true });
    act(() => {
      bump();
    });
    expect(roomHeader.get()?.title).toBe("List 2");
  });

  it("is empty once the room leaves", () => {
    const { unmount } = render(<RoomHeader title="Countdowns" />);
    expect(roomHeader.get()?.title).toBe("Countdowns");
    unmount();
    expect(roomHeader.get()).toBeNull();
  });

  it("hands over to the next room with no gap in between", () => {
    const seen: (string | null)[] = [];
    const stop = roomHeader.subscribe(() => {
      seen.push(roomHeader.get()?.title ?? null);
    });
    const { rerender } = render(<RoomHeader key="a" title="Lists" />);
    rerender(<RoomHeader key="b" title="Meals" />);
    stop();
    // The old room's cleanup runs first, then the new room's title, in the same commit.
    expect(seen).toEqual(["Lists", null, "Meals"]);
    expect(roomHeader.get()?.title).toBe("Meals");
  });
});
