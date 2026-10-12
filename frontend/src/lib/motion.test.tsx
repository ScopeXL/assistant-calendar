import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cspNonce, useChangeCount, usePageTurn } from "./motion";

afterEach(() => {
  cleanup();
  document.head.innerHTML = "";
});

describe("the CSP nonce (ADR 0007)", () => {
  it("comes from the meta tag the server stamps, and not from the unstamped placeholder", () => {
    expect(cspNonce()).toBeUndefined();
    document.head.innerHTML = '<meta name="csp-nonce" content="__SUNROOM_CSP_NONCE__">';
    expect(cspNonce()).toBeUndefined();
    document.head.innerHTML = '<meta name="csp-nonce" content="abc123">';
    expect(cspNonce()).toBe("abc123");
  });
});

function Count({ value }: { value: number | null }) {
  const changes = useChangeCount(value);
  return <span data-changes={changes}>{value ?? "…"}</span>;
}

describe("a count that pops when it changes", () => {
  it("doesn't pop on first paint or when it first arrives, only when it changes", () => {
    const view = render(<Count value={null} />);
    view.rerender(<Count value={2} />);
    expect(screen.getByText("2").dataset.changes).toBe("0");
    view.rerender(<Count value={3} />);
    expect(screen.getByText("3").dataset.changes).toBe("1");
  });
});

describe("paging (UX §9 Paging slides)", () => {
  function Pager() {
    const pages = usePageTurn();
    return (
      <div>
        <div data-testid="body" {...pages.attrs} />
        <button
          type="button"
          onClick={() => {
            pages.turn(1);
          }}
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => {
            pages.turn(-3);
          }}
        >
          Home
        </button>
        <button
          type="button"
          onClick={() => {
            pages.turn(0);
          }}
        >
          Stay
        </button>
        <button type="button" onClick={pages.rest}>
          Another view
        </button>
      </div>
    );
  }
  const marks = () => {
    const body = screen.getByTestId("body");
    return [body.getAttribute("data-page"), body.getAttribute("data-turn")];
  };

  it("says nothing until someone pages, then which side, and plays the same side twice", () => {
    render(<Pager />);
    expect(marks()).toEqual([null, null]);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(marks()).toEqual(["next", "0"]);
    // The same way again: the turn flips, so the slide plays again.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(marks()).toEqual(["next", "1"]);
    // Back three weeks to this one comes from the other side.
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(marks()).toEqual(["prev", "0"]);
    // Already there: nothing turns.
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(marks()).toEqual(["prev", "0"]);
    // A view switch isn't a page.
    fireEvent.click(screen.getByRole("button", { name: "Another view" }));
    expect(marks()).toEqual([null, null]);
  });
});
