import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { qk } from "../../api/keys";
import type { HouseholdSettings } from "../../lib/household";
import { DisplayPage } from "./DisplayPage";

/** Only what the page reads to draw itself. */
function draw(overrides: Partial<HouseholdSettings> = {}) {
  const client = new QueryClient();
  client.setQueryData(qk.settings(), {
    theme: "auto",
    text_size: "standard",
    latitude: null,
    longitude: null,
    display_return_minutes: 2,
    sleep_from: "22:00",
    sleep_to: "06:30",
    sleep_mode: "dim_clock",
    dim_from: "20:00",
    dim_level: 40,
    ...overrides,
  });
  render(
    <QueryClientProvider client={client}>
      <DisplayPage />
    </QueryClientProvider>,
  );
}

function choices(name: string): string[] {
  return within(screen.getByRole("group", { name }))
    .getAllByRole("button")
    .map((button) => button.textContent);
}

afterEach(cleanup);

describe("Settings → Display (UX §4)", () => {
  it("says when Auto turns dark: 7 PM until the household has a place, then sunset", () => {
    draw();
    expect(
      screen.getByText("Auto turns dark at 7 PM until a location is set in Household."),
    ).toBeTruthy();
    cleanup();
    draw({ latitude: 40.71, longitude: -74.01 });
    expect(screen.getByText("Auto turns dark at sunset and light at sunrise.")).toBeTruthy();
    expect(screen.queryByText(/7 PM/)).toBeNull();
  });

  it("has Rolling week after Week layout, as the household has it (ADR 0033)", () => {
    draw({ display_week_layout: "agenda", display_rolling_week: true });
    const rolling = screen.getByRole<HTMLInputElement>("switch", { name: /^Rolling week/ });
    expect(rolling.checked).toBe(true);
    const layout = screen.getByRole("group", { name: "Week layout" });
    expect(layout.compareDocumentPosition(rolling) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("offers Never first, and brightness as numbers", () => {
    draw();
    expect(choices("Return to the calendar after")).toEqual(["Never", "2 min", "5 min", "10 min"]);
    expect(choices("Brightness")).toEqual(["60%", "40%", "20%"]);
    expect(screen.getByRole("button", { name: "40%" }).getAttribute("aria-pressed")).toBe("true");
  });
});
