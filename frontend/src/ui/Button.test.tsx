import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./Button";

afterEach(cleanup);

describe("a button waiting on the server", () => {
  it("keeps its name, can't be tapped again, and says it's busy", () => {
    render(<Button pending>Save Changes</Button>);
    const button = screen.getByRole("button", { name: "Save Changes" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("is an ordinary button otherwise", () => {
    render(<Button>Save Changes</Button>);
    const button = screen.getByRole("button", { name: "Save Changes" });
    expect(button).toHaveProperty("disabled", false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
  });
});
