import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Stepper } from "./Stepper";

afterEach(cleanup);

function Every({ start, max }: { start: number; max?: number }) {
  const [value, setValue] = useState(start);
  return <Stepper label="Every" value={value} onChange={setValue} {...(max ? { max } : {})} />;
}

describe("a number changed with two buttons", () => {
  it("steps up and down, named for its row", () => {
    render(<Every start={2} />);
    const less = screen.getByRole<HTMLButtonElement>("button", { name: "Every: less" });
    const more = screen.getByRole<HTMLButtonElement>("button", { name: "Every: more" });
    const shown = () => screen.getByRole("status").textContent;
    expect(shown()).toContain("2");
    fireEvent.click(more);
    expect(shown()).toContain("3");
    fireEvent.click(less);
    fireEvent.click(less);
    expect(shown()).toContain("1");
    // It stops at the ends.
    expect(less.disabled).toBe(true);
    expect(more.disabled).toBe(false);
  });

  it("stops at its most", () => {
    render(<Every start={2} max={3} />);
    const more = screen.getByRole<HTMLButtonElement>("button", { name: "Every: more" });
    fireEvent.click(more);
    expect(more.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("3");
  });
});
