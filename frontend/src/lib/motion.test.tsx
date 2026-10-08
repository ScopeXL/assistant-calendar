import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cspNonce, useChangeCount } from "./motion";

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
