import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DayCaption } from "./DayCaption";

afterEach(cleanup);

describe("the day over a one-day board (the Day and People views, UX §4)", () => {
  it("spells the day out, with today beside it only on today", () => {
    const tomorrow = render(<DayCaption day="2026-10-08" today={false} />);
    expect(tomorrow.container.textContent).toBe("Thursday, October 8");
    cleanup();
    const today = render(<DayCaption day="2026-10-07" today />);
    expect(today.container.querySelectorAll("span")[0]?.textContent).toBe("Wednesday, October 7");
    expect(today.container.querySelectorAll("span")[1]?.textContent).toBe("today");
  });

  it("is hidden from a screen reader unless the room's name leaves the day out", () => {
    const day = render(<DayCaption day="2026-10-08" today={false} />);
    expect(day.container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    cleanup();
    const people = render(<DayCaption day="2026-10-08" today={false} spoken />);
    expect(people.container.firstElementChild?.hasAttribute("aria-hidden")).toBe(false);
  });
});
